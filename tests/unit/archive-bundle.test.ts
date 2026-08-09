import { describe, it, expect } from 'vitest'
import type { ArchiveBundle } from '@/lib/archive/bundle'
import { canonicalize } from '@/lib/archive/hash'

// Type-level test: verifies the ArchiveBundle interface compiles correctly
// and has the required shape. We create a minimal conforming object and
// assert on field presence — the TypeScript compiler enforces the contract.

function makeBundle(): ArchiveBundle {
  return {
    version: '1.1',
    preservedAt: new Date().toISOString(),
    republicVersion: '0.1.0',
    investigation: {
      id: 'inv-1',
      concern: 'Test concern',
      jurisdictionId: null,
      policyArea: null,
      briefingText: null,
      lensContextText: null,
      status: 'active',
      createdAt: new Date().toISOString(),
    },
    documents: [],
    analyses: [],
    forumThreads: [],
    peerReviews: [],
    provenance: {
      jurisdiction: null,
      concernCategory: null,
    },
  }
}

describe('ArchiveBundle interface', () => {
  it('bundle version is "1.1"', () => {
    const bundle = makeBundle()
    expect(bundle.version).toBe('1.1')
  })

  it('bundle has all required top-level fields', () => {
    const bundle = makeBundle()
    expect(bundle).toHaveProperty('version')
    expect(bundle).toHaveProperty('preservedAt')
    expect(bundle).toHaveProperty('republicVersion')
    expect(bundle).toHaveProperty('investigation')
    expect(bundle).toHaveProperty('documents')
    expect(bundle).toHaveProperty('analyses')
    expect(bundle).toHaveProperty('forumThreads')
    expect(bundle).toHaveProperty('peerReviews')
    expect(bundle).toHaveProperty('provenance')
  })

  it('investigation block has all required fields', () => {
    const { investigation } = makeBundle()
    expect(investigation).toHaveProperty('id')
    expect(investigation).toHaveProperty('concern')
    expect(investigation).toHaveProperty('jurisdictionId')
    expect(investigation).toHaveProperty('policyArea')
    expect(investigation).toHaveProperty('briefingText')
    expect(investigation).toHaveProperty('lensContextText')
    expect(investigation).toHaveProperty('status')
    expect(investigation).toHaveProperty('createdAt')
  })

  // PRIV-2: the archiver's raw account UUID used to live here, and provenance
  // is inside computeContentHash — so it was pinned to IPFS and written to
  // Arweave permanently, publicly linking a named citizen to every
  // investigation they archived. Dropped in bundle v1.1. This assertion is an
  // intentional contract inversion, not a stale test.
  it('provenance block carries no archiverId', () => {
    const { provenance } = makeBundle()
    expect(provenance).not.toHaveProperty('archiverId')
    expect(provenance).toHaveProperty('jurisdiction')
    expect(provenance).toHaveProperty('concernCategory')
  })

  it('documents, analyses, forumThreads, and peerReviews are arrays', () => {
    const bundle = makeBundle()
    expect(Array.isArray(bundle.documents)).toBe(true)
    expect(Array.isArray(bundle.analyses)).toBe(true)
    expect(Array.isArray(bundle.forumThreads)).toBe(true)
    expect(Array.isArray(bundle.peerReviews)).toBe(true)
  })

  it('preservedAt is a valid ISO 8601 timestamp string', () => {
    const bundle = makeBundle()
    const parsed = new Date(bundle.preservedAt)
    expect(parsed.getTime()).not.toBeNaN()
  })
})

describe('PRIV-2 — no archiver UUID reaches the canonicalized hash input', () => {
  const ARCHIVER_UUID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301'

  // Asserted against the canonical STRING rather than against `provenance`, so
  // a UUID leaking into any other field — a new provenance key, a summary, a
  // document title — is caught too. This is the pinned-to-Arweave surface.
  it('canonicalized v1.1 bundle contains no UUID at all', () => {
    const bundle = makeBundle()
    bundle.investigation.concern = 'Council rezoning decision'
    const canonical = canonicalize(bundle)

    expect(canonical).not.toContain(ARCHIVER_UUID)
    expect(canonical).toMatch(/"version":"1\.1"/)
    expect(canonical).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    )
  })

  it('the guard would fail if a UUID were reintroduced anywhere', () => {
    const bundle = makeBundle()
    // Negative control: proves the assertion above is not vacuous.
    bundle.investigation.policyArea = ARCHIVER_UUID
    expect(canonicalize(bundle)).toContain(ARCHIVER_UUID)
  })
})
