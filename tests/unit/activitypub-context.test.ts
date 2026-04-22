import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getApDomain,
  isFederationConfigured,
  actorUrl,
  inboxUrl,
  outboxUrl,
  followersUrl,
  threadUrl,
  postUrl,
} from '@/lib/activitypub/context'

describe('isFederationConfigured', () => {
  afterEach(() => {
    delete process.env.AP_DOMAIN
  })

  it('returns false when AP_DOMAIN is not set', () => {
    delete process.env.AP_DOMAIN
    expect(isFederationConfigured()).toBe(false)
  })

  it('returns true when AP_DOMAIN is set', () => {
    process.env.AP_DOMAIN = 'republic.example.com'
    expect(isFederationConfigured()).toBe(true)
  })
})

describe('getApDomain', () => {
  afterEach(() => {
    delete process.env.AP_DOMAIN
  })

  it('throws when AP_DOMAIN is not set', () => {
    delete process.env.AP_DOMAIN
    expect(() => getApDomain()).toThrow('AP_DOMAIN')
  })

  it('returns the domain without trailing slash', () => {
    process.env.AP_DOMAIN = 'republic.example.com/'
    expect(getApDomain()).toBe('republic.example.com')
  })

  it('returns the domain as-is when no trailing slash', () => {
    process.env.AP_DOMAIN = 'republic.example.com'
    expect(getApDomain()).toBe('republic.example.com')
  })
})

describe('URL builders', () => {
  beforeEach(() => {
    process.env.AP_DOMAIN = 'republic.example.com'
  })

  afterEach(() => {
    delete process.env.AP_DOMAIN
  })

  it('actorUrl produces correct absolute URL', () => {
    expect(actorUrl('citizen_42')).toBe(
      'https://republic.example.com/ap/users/citizen_42'
    )
  })

  it('inboxUrl produces correct absolute URL', () => {
    expect(inboxUrl('citizen_42')).toBe(
      'https://republic.example.com/ap/users/citizen_42/inbox'
    )
  })

  it('outboxUrl produces correct absolute URL', () => {
    expect(outboxUrl('citizen_42')).toBe(
      'https://republic.example.com/ap/users/citizen_42/outbox'
    )
  })

  it('followersUrl produces correct absolute URL', () => {
    expect(followersUrl('citizen_42')).toBe(
      'https://republic.example.com/ap/users/citizen_42/followers'
    )
  })

  it('threadUrl produces correct absolute URL', () => {
    expect(threadUrl('abc-123')).toBe(
      'https://republic.example.com/ap/threads/abc-123'
    )
  })

  it('postUrl produces correct absolute URL', () => {
    expect(postUrl('xyz-456')).toBe(
      'https://republic.example.com/ap/posts/xyz-456'
    )
  })

  it('URL builders throw when AP_DOMAIN is not set', () => {
    delete process.env.AP_DOMAIN
    expect(() => actorUrl('someone')).toThrow()
  })
})
