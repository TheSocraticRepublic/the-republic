import { NextRequest } from 'next/server'
import { checkTightRateLimit, checkDailyAiGeneralLimit } from '@/lib/rate-limit'
import { getDb } from '@/lib/db'
import {
  leverActions,
  documents,
  analyses,
  gadflySessions,
  gadflyTurns,
  investigations,
  jurisdictions,
} from '@/lib/db/schema'
import {
  buildInvestigationContext,
  buildLeverGeneration,
  FIPPA_LETTER_FORMAT,
  LEVER_PROMPT_VERSION,
} from '@/lib/ai/prompts/lever-system'
import { loadJurisdictionModule } from '@/lib/jurisdictions'
import {
  resolveGenerationTarget,
  resolveInvestigationProvince,
  type InvestigationJurisdictionSource,
} from '@/lib/lever/public-body'
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import { eq, asc, desc, and, sql } from 'drizzle-orm'
import { MODEL } from '@/lib/ai/model'
import { safeRoute } from '@/lib/api/safe-route'
import { cachedSystem } from '@/lib/ai/cache'

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * POST /api/lever/generate
 * Stream-generate content for an existing lever action.
 * The action record must already exist (created via POST /api/lever/actions).
 *
 * Only a draft can be generated: final and filed are 409. On finish the text
 * is saved by a compare-and-set (filings design §4): it lands only if the
 * action is still the caller's draft AND its content is still what it was
 * when this generation started. Otherwise the generation is discarded, and a
 * `lever.generate.discarded` event is logged; a newer edit or generation is
 * never overwritten.
 */
export const POST = safeRoute(async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { success } = await checkTightRateLimit(`lever-generate:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const aiDaily = await checkDailyAiGeneralLimit(userId)
  if (!aiDaily.success) {
    return new Response(JSON.stringify({
      error: 'Daily AI usage limit reached. Try again tomorrow.',
    }), { status: 429, headers: { 'Content-Type': 'application/json' } })
  }

  let body: { actionId: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { actionId } = body
  if (!actionId) {
    return new Response(JSON.stringify({ error: 'actionId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = getDb()

  // Fetch the action and verify ownership
  const [action] = await db
    .select()
    .from(leverActions)
    .where(and(eq(leverActions.id, actionId), eq(leverActions.userId, userId)))
    .limit(1)

  if (!action) {
    return new Response(JSON.stringify({ error: 'Action not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (action.status !== 'draft') {
    return jsonError(409, 'This letter is no longer a draft')
  }

  // The compare-and-set baseline for onFinish: the content as it was when
  // this generation started.
  const contentAtStart = action.content

  const metadata = (action.metadata ?? {}) as Record<string, unknown>
  const description = (metadata.description as string) ?? ''

  // The investigation is read first: it decides the jurisdiction, and for a
  // FIPPA request an unresolved one is refused before any other work.
  let investigation: (InvestigationJurisdictionSource & {
    briefingText: string | null
    lensContextText: string | null
  }) | null = null
  if (action.investigationId) {
    const [row] = await db
      .select({
        jurisdictionName: investigations.jurisdictionName,
        briefingText: investigations.briefingText,
        lensContextText: investigations.lensContextText,
        concern: investigations.concern,
        // The investigation's resolved jurisdiction, the source the briefing
        // itself was written under (run-briefing.ts).
        province: jurisdictions.province,
      })
      .from(investigations)
      .leftJoin(jurisdictions, eq(jurisdictions.id, investigations.jurisdictionId))
      .where(and(eq(investigations.id, action.investigationId), eq(investigations.userId, userId)))
      .limit(1)
    investigation = row ?? null
  }

  // One jurisdiction for generated legal text (filings design §3). A FIPPA
  // request takes it from the recipient resolver and is refused when it is
  // unresolved; other action types keep their detection-or-BC behaviour.
  const target = resolveGenerationTarget({
    actionType: action.actionType,
    metadata,
    investigation,
  })
  if (!target.ok) {
    return jsonError(target.status, target.error)
  }

  const contextParts: string[] = []

  // 1. If documentId present, fetch document + Oracle analysis for context
  if (action.documentId) {
    const [doc] = await db
      .select({ title: documents.title, rawText: documents.rawText })
      .from(documents)
      .where(eq(documents.id, action.documentId))
      .limit(1)

    if (doc) {
      contextParts.push(`DOCUMENT CONTEXT:\nTitle: ${doc.title}`)
      if (doc.rawText) {
        contextParts.push(doc.rawText.slice(0, 30_000))
      }

      // Oracle analysis
      const [analysis] = await db
        .select({ summary: analyses.summary, keyFindings: analyses.keyFindings, powerMap: analyses.powerMap })
        .from(analyses)
        .where(eq(analyses.documentId, action.documentId))
        .orderBy(desc(analyses.createdAt))
        .limit(1)

      if (analysis) {
        const parts: string[] = ['ORACLE ANALYSIS:']
        if (analysis.summary) parts.push(`Summary: ${analysis.summary}`)
        if (analysis.keyFindings) parts.push(`Key Findings: ${JSON.stringify(analysis.keyFindings)}`)
        if (analysis.powerMap) parts.push(`Power Map: ${JSON.stringify(analysis.powerMap)}`)
        contextParts.push(parts.join('\n'))
      }
    }
  }

  // 2. If sessionId present, fetch Gadfly turns for citizen insights
  if (action.sessionId) {
    const [session] = await db
      .select({ title: gadflySessions.title })
      .from(gadflySessions)
      .where(eq(gadflySessions.id, action.sessionId))
      .limit(1)

    if (session) {
      const turns = await db
        .select({ role: gadflyTurns.role, content: gadflyTurns.content, turnIndex: gadflyTurns.turnIndex })
        .from(gadflyTurns)
        .where(eq(gadflyTurns.sessionId, action.sessionId))
        .orderBy(asc(gadflyTurns.turnIndex))

      if (turns.length > 0) {
        const turnText = turns
          .map((t) => `${t.role === 'citizen' ? 'Citizen' : 'Gadfly'}: ${t.content}`)
          .join('\n\n')
        contextParts.push(`GADFLY INQUIRY CONTEXT (${session.title}):\n${turnText}`)
      }
    }
  }

  // 3. Investigation context for richer FIPPA/comment generation
  // For a FIPPA request the briefing (written under the investigation's own
  // province, with its FOI contacts) is included only when that province is
  // the request's; otherwise another province's citations and addresses could
  // reach the prompt. The concern always stays.
  const isFippa = action.actionType === 'fippa_request'
  const includeBriefing = !isFippa || resolveInvestigationProvince(investigation) === target.jurisdictionId
  const investigationContext = investigation
    ? buildInvestigationContext(investigation, { includeBriefing })
    : ''

  // 4. The jurisdiction module. A FIPPA target is always a registered
  // province, so a missing module is an error, never a BC substitute. Other
  // action types keep their pre-A2 fallback to BC.
  const jurisdictionModule = isFippa
    ? await loadJurisdictionModule(target.jurisdictionId)
    : (await loadJurisdictionModule(target.jurisdictionId)) ?? (await loadJurisdictionModule('bc'))
  if (!jurisdictionModule) {
    throw new Error(`[lever/generate] no jurisdiction module for ${target.jurisdictionId}`)
  }

  // 5. The whole prompt: system prompt and user message.
  const { system, userMessage } = buildLeverGeneration({
    module: jurisdictionModule,
    actionType: action.actionType,
    publicBodyName: target.publicBodyName,
    description,
    contextParts,
    investigationContext,
  })

  // 6. Stream; on finish, save by compare-and-set (filings design §4).
  // A FIPPA generation also records the letter format and prompt version it
  // was written under, merged into the existing metadata. Other action types
  // write content only: their prompt carries no marker.
  const formatMetadata = isFippa
    ? { letterFormat: FIPPA_LETTER_FORMAT, promptVersion: LEVER_PROMPT_VERSION }
    : null
  const result = streamText({
    model: anthropic(MODEL),
    system: cachedSystem(system),
    messages: [{ role: 'user', content: userMessage }],
    maxOutputTokens: 4096,
    onFinish: async ({ text }) => {
      try {
        const saved = await db
          .update(leverActions)
          .set({
            content: text,
            updatedAt: new Date(),
            ...(formatMetadata
              ? {
                  metadata: sql`coalesce(${leverActions.metadata}, '{}'::jsonb) || ${JSON.stringify(formatMetadata)}::jsonb`,
                }
              : {}),
          })
          .where(
            and(
              eq(leverActions.id, actionId),
              eq(leverActions.userId, userId),
              eq(leverActions.status, 'draft'),
              eq(leverActions.content, contentAtStart),
            )
          )
          .returning({ id: leverActions.id })

        if (saved.length === 0) {
          // Not an error: the draft was edited, regenerated or finalised while
          // this stream ran, and that newer state wins. Identifiers only.
          console.warn(
            JSON.stringify({
              event: 'lever.generate.discarded',
              actionId,
              reason: 'action is no longer the draft this generation started from',
              ts: new Date().toISOString(),
            })
          )
        }
      } catch (err) {
        console.error('[lever/generate] Failed to update action:', err)
      }
    },
  })

  return result.toTextStreamResponse()
})
