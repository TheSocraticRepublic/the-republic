import { loadJurisdictionModule } from '@/lib/jurisdictions'
import type { JurisdictionModule } from '@/lib/jurisdictions/types'

/**
 * Identify which concern categories match the given concern text,
 * and return the top document types from each matched category.
 * Caps at 2 document types per matched category, 6 total.
 *
 * Accepts an optional pre-loaded jurisdiction module. Falls back to
 * loading BC if none is provided (backward compat).
 */
export async function matchDocumentTypesFromConcern(
  concernText: string,
  module?: JurisdictionModule
): Promise<string[]> {
  const resolved = module ?? (await loadJurisdictionModule('bc'))
  if (!resolved) return []

  const lower = concernText.toLowerCase()
  const matched: string[] = []

  for (const category of resolved.concernCategories) {
    const isMatch = category.keywords.some((kw) => lower.includes(kw))
    if (isMatch) {
      // Take up to 2 document types from this category
      const docTypes = category.documents.slice(0, 2).map((d) => d.type)
      matched.push(...docTypes)
    }
  }

  // Deduplicate and cap at 6 total searches
  return [...new Set(matched)].slice(0, 6)
}
