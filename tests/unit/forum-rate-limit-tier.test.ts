import { describe, it, expect } from 'vitest'
import { pickForumRateLimit, FORUM_LOW_WEIGHT_THRESHOLD } from '@/lib/forum/rate-limit-tier'
import { checkRateLimit, checkTightRateLimit } from '@/lib/rate-limit'

describe('FORUM_LOW_WEIGHT_THRESHOLD', () => {
  it('is pinned at 5', () => {
    expect(FORUM_LOW_WEIGHT_THRESHOLD).toBe(5)
  })
})

describe('pickForumRateLimit', () => {
  it('returns checkTightRateLimit for weight 0', () => {
    expect(pickForumRateLimit(0)).toBe(checkTightRateLimit)
  })

  it('returns checkTightRateLimit for weight one below the threshold (4)', () => {
    expect(pickForumRateLimit(4)).toBe(checkTightRateLimit)
  })

  it('returns checkRateLimit exactly at the threshold (5)', () => {
    expect(pickForumRateLimit(5)).toBe(checkRateLimit)
  })

  it('returns checkRateLimit for an established contributor (30)', () => {
    expect(pickForumRateLimit(30)).toBe(checkRateLimit)
  })

  it('returns checkTightRateLimit for negative weight', () => {
    expect(pickForumRateLimit(-1)).toBe(checkTightRateLimit)
  })
})
