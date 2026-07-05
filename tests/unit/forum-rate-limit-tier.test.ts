import { describe, it, expect } from 'vitest'
import {
  pickForumRateLimit,
  FORUM_LOW_WEIGHT_THRESHOLD,
  checkForumWriteFlood,
} from '@/lib/forum/rate-limit-tier'
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

describe('checkForumWriteFlood', () => {
  it('is a function that delegates to the normal (not tight) rate limiter', async () => {
    expect(typeof checkForumWriteFlood).toBe('function')

    // No UPSTASH_* env vars in the test environment, so both limiters fall
    // back to the open/closed-by-NODE_ENV stub in lib/rate-limit.ts. The
    // fallback threads the caller's `limit` through as-is, so comparing
    // against the normal limiter's own fallback output (limit: 30) confirms
    // this helper is wired to checkRateLimit, not checkTightRateLimit
    // (limit: 5) — the coarse flood-breaker must use the normal ceiling.
    const [floodResult, normalResult] = await Promise.all([
      checkForumWriteFlood('user-flood-test'),
      checkRateLimit('forum-write:user-flood-test'),
    ])
    expect(floodResult.limit).toBe(normalResult.limit)
    expect(floodResult.limit).toBe(30)
  })
})
