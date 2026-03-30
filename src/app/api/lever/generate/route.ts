import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import {
  leverActions,
  documents,
  analyses,
  gadflySessions,
  gadflyTurns,
} from '@/lib/db/schema'
import { LEVER_SYSTEM_PROMPT } from '@/lib/ai/prompts/lever-system'
import { BC_PUBLIC_BODIES } from '@/lib/lever/public-bodies'
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import { eq, asc, desc, and } from 'drizzle-orm'

const MODEL = 'claude-sonnet-4-20250514'

const ACTION_TYPE_LABELS: Record<string, string> = {
  fippa_request: 'FIPPA Request',
  public_comment: 'Public Comment',
  policy_brief: 'Policy Brief',
}

/**
 * POST /api/lever/generate
 * Stream-generate content for an existing lever action.
 * The action record must already exist (created via POST /api/lever/actions).
 * On finish, updates the action content in the database.
 */
export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
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

  const metadata = (action.metadata ?? {}) as Record<string, unknown>
  const description = (metadata.description as string) ?? ''
  const publicBodyName = (metadata.publicBodyName as string) ?? null
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

  // 3. For FIPPA requests, resolve public body address
  let publicBodyContext = ''
  if (action.actionType === 'fippa_request' && publicBodyName) {
    const pb = BC_PUBLIC_BODIES.find((b) => b.name === publicBodyName)
    if (pb) {
      publicBodyContext = `\nPublic Body: ${pb.name}\nFOI Address: ${pb.foiAddress}`
      if (pb.foiEmail) publicBodyContext += `\nFOI Email: ${pb.foiEmail}`
    } else {
      publicBodyContext = `\nPublic Body: ${publicBodyName}`
    }
  }

  // 4. Build user message
  const contextBlock = contextParts.length > 0
    ? `\n\nCONTEXT:\n${contextParts.join('\n\n---\n\n')}`
    : ''

  const actionLabel = ACTION_TYPE_LABELS[action.actionType] ?? action.actionType
  const userMessage = `Generate a ${actionLabel}.${publicBodyContext}

Citizen's request: ${description}${contextBlock}

Produce a complete, fileable document. Do not include explanatory preamble — go straight into the document.`

  // 5. Stream and update action on finish
  const result = streamText({
    model: anthropic(MODEL),
    system: LEVER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    onFinish: async ({ text }) => {
      try {
        await db
          .update(leverActions)
          .set({ content: text, updatedAt: new Date() })
          .where(eq(leverActions.id, actionId))
      } catch (err) {
        console.error('[lever/generate] Failed to update action:', err)
      }
    },
  })

  return result.toTextStreamResponse()
}
