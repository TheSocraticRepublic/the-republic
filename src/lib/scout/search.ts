import 'server-only'
import { getDb } from '@/lib/db'
import { scoutSources } from '@/lib/db/schema'
import { and, eq, gt } from 'drizzle-orm'

export interface SearchResult {
  url: string
  title: string
  snippet: string
}

interface TavilySearchResponse {
  results: Array<{
    url: string
    title: string
    content: string
  }>
}

const CACHE_TTL_DAYS = 30

/**
 * Search for documents relevant to a jurisdiction and document type.
 *
 * Checks the scout_sources cache first. If cache hit and < 30 days old,
 * returns cached results. Otherwise calls Tavily and caches the results.
 *
 * Gracefully returns empty array when TAVILY_API_KEY is not configured.
 */
export async function searchForDocument(
  jurisdictionName: string,
  documentType: string,
  additionalContext?: string
): Promise<SearchResult[]> {
  const db = getDb()

  // Check cache first — results less than 30 days old
  const cacheThreshold = new Date()
  cacheThreshold.setDate(cacheThreshold.getDate() - CACHE_TTL_DAYS)

  const cached = await db
    .select({
      url: scoutSources.url,
      title: scoutSources.title,
      snippet: scoutSources.snippet,
      cachedAt: scoutSources.cachedAt,
    })
    .from(scoutSources)
    .where(
      and(
        eq(scoutSources.jurisdictionName, jurisdictionName),
        eq(scoutSources.documentType, documentType),
        gt(scoutSources.cachedAt, cacheThreshold)
      )
    )
    .limit(3)

  if (cached.length > 0) {
    return cached.map((row) => ({
      url: row.url,
      title: row.title ?? '',
      snippet: row.snippet ?? '',
    }))
  }

  // No cache hit — attempt live search
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    console.warn(
      'Tavily API key not configured — live search disabled, using curated data only'
    )
    return []
  }

  const contextSuffix = additionalContext ? ` ${additionalContext}` : ''
  const query = `"${jurisdictionName}" "${documentType}"${contextSuffix} site:.ca filetype:pdf OR bylaw`

  let results: SearchResult[] = []

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 3,
        search_depth: 'basic',
      }),
    })

    if (!response.ok) {
      console.warn(
        `Tavily search failed with status ${response.status} for query: ${query}`
      )
      return []
    }

    const data = (await response.json()) as TavilySearchResponse

    results = (data.results ?? []).map((r) => ({
      url: r.url,
      title: r.title,
      snippet: r.content,
    }))
  } catch (err) {
    console.warn('Tavily search error:', err)
    return []
  }

  // Cache results
  if (results.length > 0) {
    await Promise.allSettled(
      results.map((result) =>
        db.insert(scoutSources).values({
          jurisdictionName,
          documentType,
          searchQuery: query,
          url: result.url,
          title: result.title,
          snippet: result.snippet,
          verified: false,
        })
      )
    )
  }

  return results
}
