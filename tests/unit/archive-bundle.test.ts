import { describe, it, expect } from 'vitest'
import type { ArchiveBundle } from '@/lib/archive/bundle'

// Type-level test: verifies the ArchiveBundle interface compiles correctly
// and has the required shape. We create a minimal conforming object and
// assert on field presence — the TypeScript compiler enforces the contract.

function makeBundle(): ArchiveBundle {
  return {
    version: '1.0',
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
      archiverId: 'user-1',
      jurisdiction: null,
      concernCategory: null,
    },
  }
}

describe('ArchiveBundle interface', () => {
  it('bundle version is "1.0"', () => {
    const bundle = makeBundle()
    expect(bundle.version).toBe('1.0')
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

  it('provenance block has all required fields', () => {
    const { provenance } = makeBundle()
    expect(provenance).toHaveProperty('archiverId')
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
