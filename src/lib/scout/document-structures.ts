// DEPRECATED: Import from @/lib/jurisdictions instead.
// This file is kept for backward compatibility with existing consumers.
export { bcConcernCategories as CONCERN_CATEGORIES } from '@/lib/jurisdictions/bc/concern-categories'
export { bcPortals as JURISDICTION_PORTALS } from '@/lib/jurisdictions/bc/portals'
export { getDocumentStructureContext } from '@/lib/jurisdictions/bc/concern-categories'
export { getJurisdictionPortalContext } from '@/lib/jurisdictions/bc/portals'

// Re-export types for any consumers that import them from this path
export type { ConcernCategory, ConcernDocument } from '@/lib/jurisdictions/types'
