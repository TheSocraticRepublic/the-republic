import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { investigations, jurisdictions } from '@/lib/db/schema'
import { buildBriefingPrompt } from '@/lib/ai/prompts/briefing-system'
import { loadJurisdictionModule } from '@/lib/jurisdictions'
import {
  getDocumentStructureContext,
  getJurisdictionPortalContext,
} from '@/lib/jurisdictions/bc'
import { matchDocumentTypesFromConcern } from '@/lib/jurisdictions/match'
import { searchForDocument } from '@/lib/scout/search'
import { buildSearchResultsContext } from '@/lib/ai/search-context'
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import { eq } from 'drizzle-orm'

const MODEL = 'claude-sonnet-4-20250514'

// Conservation keywords used for concern detection
const CONSERVATION_KEYWORDS = [
  'mine',
  'mining',
  'extraction',
  'pipeline',
  'lng',
  'coal',
  'fracking',
  'park',
  'protected area',
  'conservation',
  'old growth',
  'wildlife',
  'habitat',
  'species at risk',
  'salmon',
  'watershed',
  'wetland',
  'environmental assessment',
  'impact assessment',
  'EIS',
  'EIA',
  'EAO',
  'EPIC',
]

function isConservationConcern(concern: string): boolean {
  const lower = concern.toLowerCase()
  return CONSERVATION_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))
}

function detectConcernCategory(concern: string): string | null {
  if (isConservationConcern(concern)) return 'conservation'
  return null
}

export async function POST(request: NextRequest) {
  // Auth check
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Parse body
  let body: { concern: string; jurisdictionId?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { concern, jurisdictionId } = body
  if (!concern?.trim()) {
    return new Response(JSON.stringify({ error: 'concern is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = getDb()

  // --- Stage 1: Create investigation record ---

  const concernCategory = detectConcernCategory(concern)
  let investigation: { id: string }
  try {
    const [inserted] = await db
      .insert(investigations)
      .values({
        userId,
        concern: concern.trim(),
        jurisdictionId: jurisdictionId || null,
        concernCategory,
        environmentalReviewType:
          concernCategory === 'conservation' ? 'bc_eao' : null,
        status: 'active',
      })
      .returning({ id: investigations.id })
    investigation = inserted
  } catch (err) {
    console.error('Failed to create investigation record', err)
    return new Response(JSON.stringify({ error: 'Failed to create investigation' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Load BC jurisdiction module
  const bcModule = await loadJurisdictionModule('bc')

  // Fetch all jurisdictions for the prompt context block
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
  const jurisdictionContext = `Known jurisdictions in the system:\n${jurisdictionLines.join('\n')}`

  // Build FIPPA contact reference from the BC module's public bodies
  const publicBodies = bcModule?.publicBodies ?? []
  const foiContactLines = publicBodies.map((pb) => {
    const emailStr = pb.email ? ` (${pb.email})` : ''
    return `- ${pb.name}: ${pb.foiAddress}${emailStr}`
  })
  const foiContext = `FIPPA contact addresses for BC public bodies:\n${foiContactLines.join('\n')}`

  // Load document structure knowledge
  const documentStructureKnowledge = getDocumentStructureContext()

  // Resolve the selected jurisdiction if provided
  let selectedJurisdictionContext = ''
  let selectedJurisdictionName = ''

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
      selectedJurisdictionName = selectedJurisdiction.name

      // Persist jurisdiction name to the investigation record
      await db
        .update(investigations)
        .set({ jurisdictionName: selectedJurisdictionName })
        .where(eq(investigations.id, investigation.id))

      const popStr = selectedJurisdiction.population
        ? ` (population: ${selectedJurisdiction.population.toLocaleString()})`
        : ''
      const portalStr = selectedJurisdiction.dataPortalUrl
        ? `\nData portal: ${selectedJurisdiction.dataPortalUrl}`
        : ''
      selectedJurisdictionContext = `Selected jurisdiction: ${selectedJurisdiction.name}${popStr} — ${selectedJurisdiction.municipalType}, ${selectedJurisdiction.province ?? selectedJurisdiction.country}${portalStr}`
    }
  }

  // Get curated portal URLs for the selected jurisdiction
  const portalContext = selectedJurisdictionName
    ? getJurisdictionPortalContext(selectedJurisdictionName)
    : ''

  // Match document types from concern text and run parallel web searches
  const documentTypesToSearch = selectedJurisdictionName
    ? await matchDocumentTypesFromConcern(concern)
    : []

  const searchResultsByType = new Map<string, Awaited<ReturnType<typeof searchForDocument>>>()

  if (documentTypesToSearch.length > 0) {
    const searchPromises = documentTypesToSearch.map(async (docType) => {
      const results = await searchForDocument(selectedJurisdictionName, docType)
      return { docType, results }
    })

    const settled = await Promise.allSettled(searchPromises)
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        searchResultsByType.set(outcome.value.docType, outcome.value.results)
      }
    }
  }

  // Build context blocks for the user message
  const portalContextBlock = portalContext
    ? `[KNOWN DOCUMENT PORTALS]\n${portalContext}`
    : ''

  const searchResultsText = buildSearchResultsContext(searchResultsByType)
  const searchContextBlock = searchResultsText
    ? `[SEARCH RESULTS]\nThe following documents were found via web search. Cite these URLs when relevant:\n${searchResultsText}`
    : ''

  // Build composable system prompt
  const systemPrompt = buildBriefingPrompt({
    jurisdictionModule: bcModule,
    documentStructures: documentStructureKnowledge,
    isConservationConcern: concernCategory === 'conservation',
  })

  // Build user message
  const messageParts: string[] = [
    `Citizen concern:\n${concern.trim()}`,
  ]
  if (selectedJurisdictionContext) messageParts.push(selectedJurisdictionContext)
  if (portalContextBlock) messageParts.push(portalContextBlock)
  if (searchContextBlock) messageParts.push(searchContextBlock)
  messageParts.push(jurisdictionContext)
  messageParts.push(foiContext)

  const userMessage = messageParts.join('\n\n')

  // Stream the briefing
  const result = streamText({
    model: anthropic(MODEL),
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    onFinish: async ({ text }) => {
      // --- Stage 2: Async persist after streaming completes ---
      try {
        await db
          .update(investigations)
          .set({
            briefingText: text,
            briefingCompletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(investigations.id, investigation.id))
      } catch (err) {
        console.error('Failed to persist briefing text for investigation', investigation.id, err)
      }
    },
  })

  // Return the stream with the investigation ID in a custom header
  return result.toTextStreamResponse({
    headers: { 'X-Investigation-Id': investigation.id },
  })
}
