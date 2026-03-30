import { describe, it, expect } from 'vitest'
import { BC_PUBLIC_BODIES, type PublicBody } from '@/lib/lever/public-bodies'

describe('BC_PUBLIC_BODIES', () => {
  it('all entries have required fields (name, foiAddress, jurisdiction)', () => {
    for (const body of BC_PUBLIC_BODIES) {
      expect(body.name, `${body.jurisdiction} is missing name`).toBeTruthy()
      expect(body.foiAddress, `${body.name} is missing foiAddress`).toBeTruthy()
      expect(body.jurisdiction, `${body.name} is missing jurisdiction`).toBeTruthy()
    }
  })

  it('no duplicate jurisdictions', () => {
    const jurisdictions = BC_PUBLIC_BODIES.map((b) => b.jurisdiction)
    const unique = new Set(jurisdictions)
    expect(unique.size).toBe(jurisdictions.length)
  })

  it('no duplicate names', () => {
    const names = BC_PUBLIC_BODIES.map((b) => b.name)
    const unique = new Set(names)
    expect(unique.size).toBe(names.length)
  })

  it('includes City of Vancouver', () => {
    const body = BC_PUBLIC_BODIES.find((b) => b.jurisdiction === 'vancouver')
    expect(body).toBeDefined()
    expect(body!.name).toBe('City of Vancouver')
    expect(body!.foiAddress).toContain('Vancouver')
  })

  it('includes City of Victoria', () => {
    const body = BC_PUBLIC_BODIES.find((b) => b.jurisdiction === 'victoria')
    expect(body).toBeDefined()
    expect(body!.name).toBe('City of Victoria')
  })

  it('includes City of Surrey', () => {
    const body = BC_PUBLIC_BODIES.find((b) => b.jurisdiction === 'surrey')
    expect(body).toBeDefined()
    expect(body!.name).toBe('City of Surrey')
  })

  it('includes District of Squamish', () => {
    const body = BC_PUBLIC_BODIES.find((b) => b.jurisdiction === 'squamish')
    expect(body).toBeDefined()
    expect(body!.name).toBe('District of Squamish')
  })

  it('includes BC Provincial government', () => {
    const body = BC_PUBLIC_BODIES.find((b) => b.jurisdiction === 'bc-provincial')
    expect(body).toBeDefined()
    expect(body!.name).toBe('Province of British Columbia')
  })

  it('all foiAddress values contain BC', () => {
    for (const body of BC_PUBLIC_BODIES) {
      expect(body.foiAddress).toContain('BC')
    }
  })

  it('has at least 5 entries', () => {
    expect(BC_PUBLIC_BODIES.length).toBeGreaterThanOrEqual(5)
  })
})
