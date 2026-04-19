import type { SearchResult } from '@/lib/scout/search'

/**
 * Build a formatted context block from a map of search results by document type.
 * Returns an empty string if there are no results to display.
 */
export function buildSearchResultsContext(
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
