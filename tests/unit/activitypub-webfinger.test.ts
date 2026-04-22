import { describe, it, expect } from 'vitest'
import {
  parseWebfingerResource,
  buildWebfingerResponse,
} from '@/lib/activitypub/webfinger'

describe('parseWebfingerResource', () => {
  const domain = 'republic.example.com'

  it('returns null for null input', () => {
    expect(parseWebfingerResource(null, domain)).toBeNull()
  })

  it('returns null for non-acct URI', () => {
    expect(parseWebfingerResource('https://republic.example.com/users/alice', domain)).toBeNull()
  })

  it('returns null when domain does not match', () => {
    expect(parseWebfingerResource('acct:alice@mastodon.social', domain)).toBeNull()
  })

  it('returns null for malformed acct (no @)', () => {
    expect(parseWebfingerResource('acct:alice', domain)).toBeNull()
  })

  it('returns null for empty handle', () => {
    expect(parseWebfingerResource('acct:@republic.example.com', domain)).toBeNull()
  })

  it('returns the handle for valid acct URI with matching domain', () => {
    expect(parseWebfingerResource('acct:alice@republic.example.com', domain)).toBe('alice')
  })

  it('is case-insensitive on domain comparison', () => {
    expect(parseWebfingerResource('acct:alice@REPUBLIC.EXAMPLE.COM', domain)).toBe('alice')
  })

  it('handles handles with underscores and numbers', () => {
    expect(parseWebfingerResource('acct:citizen_42@republic.example.com', domain)).toBe('citizen_42')
  })
})

describe('buildWebfingerResponse', () => {
  const domain = 'republic.example.com'

  it('builds correct subject', () => {
    const response = buildWebfingerResponse('alice', domain)
    expect(response.subject).toBe('acct:alice@republic.example.com')
  })

  it('includes actor URL in aliases', () => {
    const response = buildWebfingerResponse('alice', domain)
    expect(response.aliases).toContain('https://republic.example.com/ap/users/alice')
  })

  it('has self link with correct type and href', () => {
    const response = buildWebfingerResponse('alice', domain)
    const selfLink = response.links.find((l) => l.rel === 'self')
    expect(selfLink).toBeDefined()
    expect(selfLink?.type).toBe('application/activity+json')
    expect(selfLink?.href).toBe('https://republic.example.com/ap/users/alice')
  })

  it('response has required JRD fields', () => {
    const response = buildWebfingerResponse('citizen_42', domain)
    expect(response.subject).toBeDefined()
    expect(response.aliases).toBeDefined()
    expect(Array.isArray(response.links)).toBe(true)
  })
})
