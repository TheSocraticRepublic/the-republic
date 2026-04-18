import { loadJurisdictionModule } from '@/lib/jurisdictions'

/**
 * Identify which concern categories match the given concern text,
 * and return the top document types from each matched category.
 * Caps at 2 document types per matched category, 6 total.
 */
export async function matchDocumentTypesFromConcern(concernText: string): Promise<string[]> {
  const bcModule = await loadJurisdictionModule('bc')
  if (!bcModule) return []

  const lower = concernText.toLowerCase()
  const matched: string[] = []

  for (const category of bcModule.concernCategories) {
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
