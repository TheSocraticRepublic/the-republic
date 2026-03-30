import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { documents, analyses, jurisdictions } from '@/lib/db/schema'
import { MIRROR_SYSTEM_PROMPT, MIRROR_PROMPT_VERSION } from '@/lib/ai/prompts/mirror-system'
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import { eq, desc } from 'drizzle-orm'

const MAX_DOCUMENT_CHARS = 60_000
const MODEL = 'claude-sonnet-4-20250514'

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { documentId?: string; policyArea?: string; description: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { documentId, policyArea, description } = body
  if (!description?.trim()) {
    return new Response(JSON.stringify({ error: 'description is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = getDb()

  // Fetch all seeded jurisdictions for context
  const allJurisdictions = await db
    .select({
      id: jurisdictions.id,
      name: jurisdictions.name,
      country: jurisdictions.country,
      province: jurisdictions.province,
      municipalType: jurisdictions.municipalType,
      population: jurisdictions.population,
      dataPortalUrl: jurisdictions.dataPortalUrl,
    })
    .from(jurisdictions)

  // Build jurisdiction reference block for the model
  const jurisdictionLines = allJurisdictions.map((j) => {
    const popStr = j.population ? ` (pop. ${j.population.toLocaleString()})` : ''
    const locStr = j.province ? `${j.province}, ${j.country}` : j.country
    return `- ${j.name}${popStr} — ${j.municipalType}, ${locStr}`
  })
  const jurisdictionContext =
    `Reference jurisdictions (verified population data):\n${jurisdictionLines.join('\n')}`

  // Optionally fetch document + Oracle analysis for linked document
  let documentContext = ''
  if (documentId) {
    const [doc] = await db
      .select({ id: documents.id, userId: documents.userId, title: documents.title, rawText: documents.rawText })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1)

    if (doc && doc.userId === userId) {
      const truncatedText = doc.rawText ? doc.rawText.slice(0, MAX_DOCUMENT_CHARS) : ''

      // Fetch most recent Oracle analysis if available
      const [analysis] = await db
        .select({ summary: analyses.summary, keyFindings: analyses.keyFindings, powerMap: analyses.powerMap })
        .from(analyses)
        .where(eq(analyses.documentId, documentId))
        .orderBy(desc(analyses.createdAt))
        .limit(1)

      const parts: string[] = [`Document: "${doc.title}"`]

      if (truncatedText) {
        parts.push(`\nDocument text (truncated):\n${truncatedText}`)
      }

      if (analysis) {
        const analysisParts: string[] = []
        if (analysis.summary) analysisParts.push(`Summary:\n${analysis.summary}`)
        if (analysis.keyFindings) analysisParts.push(`Key Findings:\n${JSON.stringify(analysis.keyFindings)}`)
        if (analysis.powerMap) analysisParts.push(`Power Map:\n${JSON.stringify(analysis.powerMap)}`)
        if (analysisParts.length > 0) {
          parts.push(`\nOracle analysis:\n${analysisParts.join('\n\n')}`)
        }
      }

      documentContext = parts.join('\n')
    }
  }

  // Build user message
  const messageparts: string[] = []

  messageparts.push(`Policy question to compare:\n${description.trim()}`)

  if (policyArea) {
    messageparts.push(`Policy area: ${policyArea}`)
  }

  if (documentContext) {
    messageparts.push(`\nLinked document context:\n---\n${documentContext}\n---`)
  }

  messageparts.push(`\n${jurisdictionContext}`)

  const userMessage = messageparts.join('\n\n')

  // Stream Mirror response
  const result = streamText({
    model: anthropic(MODEL),
    system: MIRROR_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  // Log prompt version for observability
  void MIRROR_PROMPT_VERSION

  return result.toTextStreamResponse()
}
