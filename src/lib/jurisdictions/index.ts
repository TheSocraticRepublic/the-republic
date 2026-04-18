import type { JurisdictionModule } from './types'

// Registry of available jurisdiction modules
// Modules are lazy-loaded to avoid bundling all jurisdictions at startup
const JURISDICTION_REGISTRY: Record<
  string,
  () => Promise<{ default: JurisdictionModule }>
> = {
  // BC module will be added in Phase 1B when document-structures.ts is refactored
  // 'bc': () => import('./bc'),
  // 'canada-federal': () => import('./canada-federal'),  // Phase 2
}

const moduleCache = new Map<string, JurisdictionModule>()

/**
 * Load a jurisdiction module by ID.
 * Returns undefined if the jurisdiction is not registered.
 */
export async function loadJurisdictionModule(
  jurisdictionId: string
): Promise<JurisdictionModule | undefined> {
  // Check cache first
  const cached = moduleCache.get(jurisdictionId)
  if (cached) return cached

  const loader = JURISDICTION_REGISTRY[jurisdictionId]
  if (!loader) return undefined

  const module = await loader()
  moduleCache.set(jurisdictionId, module.default)
  return module.default
}

/**
 * Get all registered jurisdiction IDs.
 */
export function getRegisteredJurisdictions(): string[] {
  return Object.keys(JURISDICTION_REGISTRY)
}

/**
 * Detect which jurisdiction module to use based on concern text and optional jurisdiction name.
 * Returns the jurisdiction ID or undefined if no match.
 */
export function detectJurisdiction(
  concern: string,
  jurisdictionName?: string
): string | undefined {
  // concern text analysis will be added in Phase 1B with jurisdiction module content
  // If jurisdiction name is provided, try to match directly
  if (jurisdictionName) {
    const normalized = jurisdictionName.toLowerCase()
    for (const id of Object.keys(JURISDICTION_REGISTRY)) {
      if (normalized.includes(id) || id.includes(normalized)) {
        return id
      }
    }
  }

  // Default to BC for now (conservation-first, BC-first vertical)
  // This will become smarter as more jurisdiction modules are added
  if (Object.keys(JURISDICTION_REGISTRY).includes('bc')) {
    return 'bc'
  }

  return undefined
}

// Re-export types for convenience
export type { JurisdictionModule, FOIFramework, AssessmentFramework } from './types'
