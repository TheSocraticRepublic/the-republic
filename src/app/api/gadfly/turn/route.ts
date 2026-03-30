import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { gadflySessions, gadflyTurns, insightMarkers, documents, analyses } from '@/lib/db/schema'
import { GADFLY_SYSTEM_PROMPT } from '@/lib/ai/prompts/gadfly-system'
import { anthropic } from '@ai-sdk/anthropic'
import { streamText, generateText } from 'ai'
import { eq, and, asc, desc, sql } from 'drizzle-orm'

const MAX_DOCUMENT_CHARS = 50_000
const MODEL = 'claude-sonnet-4-20250514'

type GadflyQuestionType = 'clarifying' | 'probing' | 'challenging' | 'connecting' | 'action'

/**
 * Classify question type from Gadfly response text using keyword heuristics.
 */
function classifyQuestionType(text: string): GadflyQuestionType | null {
  const lower = text.toLowerCase()
  if (lower.includes('what do you notice') || lower.includes('what did you notice')) {
    return 'clarifying'
  }
  if (lower.includes('why do you think') || lower.includes('why do you believe') || lower.includes('why would they')) {
    return 'probing'
  }
  if (lower.includes('you said') || lower.includes('you mentioned') || lower.includes('but the document')) {
    return 'challenging'
  }
  if (lower.includes('how does this relate') || lower.includes('how might this connect') || lower.includes('how does that connect')) {
    return 'connecting'
  }
  if (lower.includes('what would you need') || lower.includes('what would need to happen') || lower.includes('what would it take to act')) {
    return 'action'
  }
  return null
}

/**
 * POST /api/gadfly/turn
 * Submit a citizen message and stream the Gadfly response.
 */
export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { sessionId: string; content: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { sessionId, content } = body
  if (!sessionId || !content?.trim()) {
    return new Response(JSON.stringify({ error: 'sessionId and content are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = getDb()

  // 1. Verify session belongs to user and is active
  const [session] = await db
    .select()
    .from(gadflySessions)
    .where(and(eq(gadflySessions.id, sessionId), eq(gadflySessions.userId, userId)))
    .limit(1)

  if (!session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (session.status !== 'active') {
    return new Response(JSON.stringify({ error: 'Session is not active' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 2. Get existing turn count to determine turnIndex
  const existingTurns = await db
    .select({ id: gadflyTurns.id, role: gadflyTurns.role, content: gadflyTurns.content, turnIndex: gadflyTurns.turnIndex })
    .from(gadflyTurns)
    .where(eq(gadflyTurns.sessionId, sessionId))
    .orderBy(asc(gadflyTurns.turnIndex))

  const nextTurnIndex = existingTurns.length

  // 3. Save the citizen turn
  const [citizenTurn] = await db
    .insert(gadflyTurns)
    .values({
      sessionId,
      role: 'citizen',
      content: content.trim(),
      turnIndex: nextTurnIndex,
    })
    .returning({ id: gadflyTurns.id })

  // 4. Build conversation history for the AI
  const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const turn of existingTurns) {
    conversationHistory.push({
      role: turn.role === 'citizen' ? 'user' : 'assistant',
      content: turn.content,
    })
  }
  // Add the new citizen message
  conversationHistory.push({ role: 'user', content: content.trim() })

  // 5. Build system prompt with optional document context
  let systemPrompt = GADFLY_SYSTEM_PROMPT

  if (session.documentId) {
    const [doc] = await db
      .select({ rawText: documents.rawText, title: documents.title })
      .from(documents)
      .where(eq(documents.id, session.documentId))
      .limit(1)

    if (doc?.rawText) {
      const truncatedText = doc.rawText.slice(0, MAX_DOCUMENT_CHARS)
      systemPrompt += `\n\nHere is the document for this session (the citizen has access to this document — use it to ask better questions, but never reveal analysis directly):\n\n${truncatedText}`
    }

    // Check for existing Oracle analysis
    const [analysis] = await db
      .select({ summary: analyses.summary, keyFindings: analyses.keyFindings, powerMap: analyses.powerMap, missingInfo: analyses.missingInfo })
      .from(analyses)
      .where(eq(analyses.documentId, session.documentId))
      .orderBy(desc(analyses.createdAt))
      .limit(1)

    if (analysis) {
      const analysisParts: string[] = []
      if (analysis.summary) analysisParts.push(`Summary:\n${analysis.summary}`)
      if (analysis.keyFindings) analysisParts.push(`Key Findings:\n${JSON.stringify(analysis.keyFindings)}`)
      if (analysis.powerMap) analysisParts.push(`Power Map:\n${JSON.stringify(analysis.powerMap)}`)
      if (analysis.missingInfo) analysisParts.push(`Missing Information:\n${JSON.stringify(analysis.missingInfo)}`)

      if (analysisParts.length > 0) {
        systemPrompt += `\n\nHere is an existing analysis of this document (use this to guide your questions toward important findings, but NEVER reveal this analysis to the citizen — they must discover these insights themselves):\n\n${analysisParts.join('\n\n')}`
      }
    }
  }

  // 6. Stream the Gadfly response
  const result = streamText({
    model: anthropic(MODEL),
    system: systemPrompt,
    messages: conversationHistory,
    onFinish: async ({ text }) => {
      try {
        const gadflyTurnIndex = nextTurnIndex + 1
        const questionType = classifyQuestionType(text)

        // Save the gadfly turn
        const [gadflyTurn] = await db
          .insert(gadflyTurns)
          .values({
            sessionId,
            role: 'gadfly',
            content: text,
            questionType: questionType ?? undefined,
            turnIndex: gadflyTurnIndex,
          })
          .returning({ id: gadflyTurns.id })

        // Run insight extraction on the citizen's message
        let insightDetected = false
        try {
          const insightResult = await generateText({
            model: anthropic(MODEL),
            system: 'You are a brief classifier. Respond with exactly one sentence starting with the insight, or respond with exactly "NONE".',
            messages: [
              {
                role: 'user',
                content: `Did the citizen demonstrate a genuine insight, discovery, or independent connection in this message? If yes, state the insight in one sentence. If no, respond with NONE.\n\nCitizen message: "${content.trim()}"`,
              },
            ],
            maxOutputTokens: 120,
          })

          const insightText = insightResult.text.trim()
          if (insightText && insightText !== 'NONE' && !insightText.toUpperCase().startsWith('NONE')) {
            await db.insert(insightMarkers).values({
              turnId: citizenTurn.id,
              sessionId,
              insight: insightText,
            })
            insightDetected = true
          }
        } catch (err) {
          console.error('[gadfly/turn] Insight extraction failed:', err)
        }

        // Update session counts and updatedAt
        await db
          .update(gadflySessions)
          .set({
            questionCount: sql`${gadflySessions.questionCount} + 1`,
            insightCount: insightDetected
              ? sql`${gadflySessions.insightCount} + 1`
              : gadflySessions.insightCount,
            updatedAt: new Date(),
          })
          .where(eq(gadflySessions.id, sessionId))
      } catch (err) {
        console.error('[gadfly/turn] Post-stream processing failed:', err)
      }
    },
  })

  return result.toTextStreamResponse()
}
