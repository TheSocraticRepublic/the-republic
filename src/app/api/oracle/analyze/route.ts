import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { documents, documentChunks, analyses } from '@/lib/db/schema'
import { ORACLE_SYSTEM_PROMPT, ORACLE_PROMPT_VERSION } from '@/lib/ai/prompts/oracle-system'
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import { eq, asc } from 'drizzle-orm'

const MAX_CONTENT_CHARS = 100_000
const MODEL = 'claude-sonnet-4-20250514'

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { documentId?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { documentId } = body
  if (!documentId) {
    return new Response(JSON.stringify({ error: 'documentId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = getDb()

  // Fetch document — verify ownership
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1)

  if (!doc) {
    return new Response(JSON.stringify({ error: 'Document not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (doc.userId !== userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (doc.status !== 'ready') {
    return new Response(JSON.stringify({ error: 'Document is not ready for analysis' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Assemble document text from chunks (ordered by index)
  const chunks = await db
    .select({ content: documentChunks.content, chunkIndex: documentChunks.chunkIndex })
    .from(documentChunks)
    .where(eq(documentChunks.documentId, documentId))
    .orderBy(asc(documentChunks.chunkIndex))

  let fullText: string
  if (doc.rawText) {
    fullText = doc.rawText.slice(0, MAX_CONTENT_CHARS)
  } else {
    fullText = chunks
      .map((c) => c.content)
      .join('\n\n')
      .slice(0, MAX_CONTENT_CHARS)
  }

  const userMessage = `Analyze this government document:\n\n---\n${fullText}\n---`

  // Stream the analysis
  const result = streamText({
    model: anthropic(MODEL),
    system: ORACLE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    onFinish: async ({ text }) => {
      // Save analysis to DB after streaming completes
      try {
        // Parse sections from the completed text
        const summary = extractSection(text, 'Plain Language Summary')
        const keyFindings = extractSection(text, 'Key Findings')
        const powerMap = extractSection(text, 'Power Map')
        const missingInfo = extractSection(text, 'What is Missing')
        const hiddenAssumptions = extractSection(text, 'Hidden Assumptions')
        const questionsToAsk = extractSection(text, 'Questions to Ask')

        await db.insert(analyses).values({
          documentId,
          summary,
          keyFindings: keyFindings ? [keyFindings] : null,
          powerMap: powerMap ? { raw: powerMap } : null,
          missingInfo: missingInfo ? [missingInfo] : null,
          hiddenAssumptions: hiddenAssumptions ? [hiddenAssumptions] : null,
          questionsToAsk: questionsToAsk ? [questionsToAsk] : null,
          model: MODEL,
          promptVersion: ORACLE_PROMPT_VERSION,
        })
      } catch (err) {
        console.error('[oracle/analyze] Failed to save analysis:', err)
      }
    },
  })

  return result.toTextStreamResponse()
}

/**
 * Extract a markdown section by heading name.
 */
function extractSection(text: string, heading: string): string | null {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`##\\s+${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, 'i')
  const match = text.match(re)
  return match ? match[1].trim() : null
}
