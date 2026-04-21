import type { JurisdictionModule } from './types'

// Registry of available jurisdiction modules
// Modules are lazy-loaded to avoid bundling all jurisdictions at startup
const JURISDICTION_REGISTRY: Record<
  string,
  () => Promise<{ default: JurisdictionModule }>
> = {
  'bc': () => import('./bc'),
  'ab': () => import('./ab'),
  'on': () => import('./on'),
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
  // If jurisdiction name is provided, try to match directly then by province keyword
  if (jurisdictionName) {
    const normalized = jurisdictionName.toLowerCase()

    // Province keyword matching for common variations (must run before ID match
    // to avoid short IDs like 'on' matching substrings of city names like 'edmonton')
    if (
      normalized.includes('alberta') ||
      normalized.includes('edmonton') ||
      normalized.includes('calgary') ||
      normalized.includes('red deer') ||
      normalized.includes('lethbridge') ||
      normalized.includes('fort mcmurray')
    ) {
      return 'ab'
    }

    if (
      normalized.includes('ontario') ||
      normalized.includes('toronto') ||
      normalized.includes('ottawa') ||
      normalized.includes('mississauga') ||
      normalized.includes('hamilton') ||
      normalized.includes('brampton') ||
      normalized.includes('london, on') ||
      normalized.includes('london ontario')
    ) {
      return 'on'
    }

    if (
      normalized.includes('british columbia') ||
      normalized.includes('vancouver') ||
      normalized.includes('victoria') ||
      normalized.includes('surrey') ||
      normalized.includes('kelowna') ||
      normalized.includes('squamish') ||
      normalized.includes('whistler') ||
      normalized.includes('kamloops') ||
      normalized.includes('nanaimo')
    ) {
      return 'bc'
    }

    // Fallback: direct ID match (exact equality only to avoid substring false-positives)
    if (Object.keys(JURISDICTION_REGISTRY).includes(normalized)) {
      return normalized
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
