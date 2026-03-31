import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { jurisdictions } from '@/lib/db/schema'
import { BRIEFING_SYSTEM_PROMPT, BRIEFING_PROMPT_VERSION } from '@/lib/ai/prompts/briefing-system'
import {
  getDocumentStructureContext,
  getJurisdictionPortalContext,
  CONCERN_CATEGORIES,
} from '@/lib/scout/document-structures'
import { searchForDocument, SearchResult } from '@/lib/scout/search'
import { BC_PUBLIC_BODIES } from '@/lib/lever/public-bodies'
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import { eq } from 'drizzle-orm'

const MODEL = 'claude-sonnet-4-20250514'

/**
 * Identify which concern categories match the given concern text,
 * and return the top document types from each matched category.
 * Caps at 2 document types per matched category.
 */
function matchDocumentTypesFromConcern(concernText: string): string[] {
  const lower = concernText.toLowerCase()
  const matched: string[] = []

  for (const category of CONCERN_CATEGORIES) {
    const isMatch = category.concern_keywords.some((kw) => lower.includes(kw))
    if (isMatch) {
      const docTypes = category.documents.slice(0, 2).map((d) => d.type)
      matched.push(...docTypes)
    }
  }

  return [...new Set(matched)].slice(0, 6)
}

/**
 * Build the search results context block for prompt injection.
 */
function buildSearchResultsContext(
  searchResultsByType: Map<string, SearchResult[]>
): string {
  const lines: string[] = []

  for (const [docType, results] of searchResultsByType.entries()) {
    if (results.length === 0) continue
    for (const result of results) {
      const domain = (() => {
        try {
          return new URL(result.url).hostname
        } catch {
          return result.url
        }
      })()
      const title = result.title || docType
      lines.push(`- "${title}" — ${result.url} (${domain})`)
    }
  }

  return lines.join('\n')
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

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

  // Identify relevant document types from the concern text and run parallel web searches
  const documentTypesToSearch = selectedJurisdictionName
    ? matchDocumentTypesFromConcern(concern)
    : []

  const searchResultsByType = new Map<string, SearchResult[]>()

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

  // Build injected context for prompt
  const portalContextBlock = portalContext
    ? `[KNOWN DOCUMENT PORTALS]\n${portalContext}`
    : ''

  const searchResultsText = buildSearchResultsContext(searchResultsByType)
  const searchContextBlock = searchResultsText
    ? `[SEARCH RESULTS]\nThe following documents were found via web search. Cite these URLs when relevant:\n${searchResultsText}`
    : ''

  // Build system prompt with injected document structure knowledge
  const systemPrompt = BRIEFING_SYSTEM_PROMPT.replace(
    '[DOCUMENT STRUCTURE KNOWLEDGE will be injected here at runtime]',
    documentStructureKnowledge
  )

  // Build user message
  const messageParts: string[] = []

  messageParts.push(`Citizen concern:\n${concern.trim()}`)

  if (selectedJurisdictionContext) {
    messageParts.push(selectedJurisdictionContext)
  }

  if (portalContextBlock) {
    messageParts.push(portalContextBlock)
  }

  if (searchContextBlock) {
    messageParts.push(searchContextBlock)
  }

  messageParts.push(jurisdictionContext)
  messageParts.push(foiContext)

  const userMessage = messageParts.join('\n\n')

  // Stream Briefing response
  const result = streamText({
    model: anthropic(MODEL),
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  // Log prompt version for observability
  void BRIEFING_PROMPT_VERSION

  return result.toTextStreamResponse()
}
