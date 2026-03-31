import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { jurisdictions } from '@/lib/db/schema'
import { SCOUT_SYSTEM_PROMPT, SCOUT_PROMPT_VERSION } from '@/lib/ai/prompts/scout-system'
import { getDocumentStructureContext } from '@/lib/scout/document-structures'
import { BC_PUBLIC_BODIES } from '@/lib/lever/public-bodies'
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import { eq } from 'drizzle-orm'

const MODEL = 'claude-sonnet-4-20250514'

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { concern: string; jurisdictionId?: string; policyArea?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { concern, jurisdictionId, policyArea } = body
  if (!concern?.trim()) {
    return new Response(JSON.stringify({ error: 'concern is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = getDb()

  // Fetch all jurisdictions for context
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

  // Build jurisdiction reference block
  const jurisdictionLines = allJurisdictions.map((j) => {
    const popStr = j.population ? ` (pop. ${j.population.toLocaleString()})` : ''
    const locStr = j.province ? `${j.province}, ${j.country}` : j.country
    const portalStr = j.dataPortalUrl ? ` — ${j.dataPortalUrl}` : ''
    return `- ${j.name}${popStr} — ${j.municipalType}, ${locStr}${portalStr}`
  })
  const jurisdictionContext =
    `Known jurisdictions in the system:\n${jurisdictionLines.join('\n')}`

  // Build FIPPA contact reference from known public bodies
  const foiContactLines = BC_PUBLIC_BODIES.map((pb) => {
    const emailStr = pb.foiEmail ? ` (${pb.foiEmail})` : ''
    return `- ${pb.name}: ${pb.foiAddress}${emailStr}`
  })
  const foiContext = `FIPPA contact addresses for BC public bodies:\n${foiContactLines.join('\n')}`

  // Load document structure knowledge
  const documentStructureKnowledge = getDocumentStructureContext()

  // Optionally fetch the selected jurisdiction's details
  let selectedJurisdictionContext = ''
  if (jurisdictionId) {
    const [selectedJurisdiction] = await db
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
      .where(eq(jurisdictions.id, jurisdictionId))
      .limit(1)

    if (selectedJurisdiction) {
      const popStr = selectedJurisdiction.population
        ? ` (population: ${selectedJurisdiction.population.toLocaleString()})`
        : ''
      const portalStr = selectedJurisdiction.dataPortalUrl
        ? `\nData portal: ${selectedJurisdiction.dataPortalUrl}`
        : ''
      selectedJurisdictionContext = `Selected jurisdiction: ${selectedJurisdiction.name}${popStr} — ${selectedJurisdiction.municipalType}, ${selectedJurisdiction.province ?? selectedJurisdiction.country}${portalStr}`
    }
  }

  // Build system prompt with injected document structure knowledge
  const systemPrompt = SCOUT_SYSTEM_PROMPT.replace(
    '[DOCUMENT STRUCTURE KNOWLEDGE will be injected here at runtime]',
    documentStructureKnowledge
  )

  // Build user message
  const messageParts: string[] = []

  messageParts.push(`Citizen concern:\n${concern.trim()}`)

  if (policyArea) {
    messageParts.push(`Policy area: ${policyArea}`)
  }

  if (selectedJurisdictionContext) {
    messageParts.push(selectedJurisdictionContext)
  }

  messageParts.push(jurisdictionContext)
  messageParts.push(foiContext)

  const userMessage = messageParts.join('\n\n')

  // Stream Scout response
  const result = streamText({
    model: anthropic(MODEL),
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  // Log prompt version for observability
  void SCOUT_PROMPT_VERSION

  return result.toTextStreamResponse()
}
