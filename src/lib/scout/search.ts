import 'server-only'
import { getDb } from '@/lib/db'
import { scoutSources } from '@/lib/db/schema'
import { and, eq, gt } from 'drizzle-orm'

export interface SearchResult {
  url: string
  title: string
  snippet: string
}

const CACHE_TTL_DAYS = 30

/**
 * Search for documents relevant to a jurisdiction and document type.
 *
 * Checks the scout_sources cache first. If cache hit and < 30 days old,
 * returns cached results. Otherwise runs a DuckDuckGo search and caches.
 * No API key required.
 */
export async function searchForDocument(
  jurisdictionName: string,
  documentType: string,
  additionalContext?: string
): Promise<SearchResult[]> {
  const db = getDb()

  // Check cache first
  const cacheThreshold = new Date()
  cacheThreshold.setDate(cacheThreshold.getDate() - CACHE_TTL_DAYS)

  const cached = await db
    .select({
      url: scoutSources.url,
      title: scoutSources.title,
      snippet: scoutSources.snippet,
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

  // No cache — run DuckDuckGo search (no API key needed)
  const contextSuffix = additionalContext ? ` ${additionalContext}` : ''
  const query = `${jurisdictionName} ${documentType}${contextSuffix} bylaw site:.ca`

  let results: SearchResult[] = []

  try {
    const ddg = await import('duck-duck-scrape')
    const searchResults = await ddg.search(query, { safeSearch: ddg.SafeSearchType.OFF })

    results = (searchResults.results ?? []).slice(0, 3).map((r) => ({
      url: r.url,
      title: r.title,
      snippet: r.description,
    }))
  } catch (err) {
    console.warn('DuckDuckGo search error:', err)
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
