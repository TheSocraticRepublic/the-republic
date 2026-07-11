import { describe, it, expect } from 'vitest'
import { checkGlobalSendCodeLimit, GLOBAL_SEND_CODE_LIMIT, checkRateLimit } from '@/lib/rate-limit'

// No UPSTASH_* env vars are set in the test environment, so
// checkGlobalSendCodeLimit falls back to the open/closed-by-NODE_ENV stub
// in lib/rate-limit.ts (rateLimitFallback), same as every other limiter in
// this module — see forum-rate-limit-tier.test.ts for the established
// pattern this mirrors.

describe('GLOBAL_SEND_CODE_LIMIT', () => {
  it('is a positive number', () => {
    expect(GLOBAL_SEND_CODE_LIMIT).toBeGreaterThan(0)
  })
})

describe('checkGlobalSendCodeLimit', () => {
  it('is wired to its own limit ceiling, not the per-IP send-code limiter', async () => {
    const [globalResult, perIpResult] = await Promise.all([
      checkGlobalSendCodeLimit(),
      checkRateLimit('send-code:203.0.113.1'),
    ])
    expect(globalResult.limit).toBe(GLOBAL_SEND_CODE_LIMIT)
    // The per-IP limiter (checkRateLimit) is configured with a different
    // ceiling (30/60s) — asserting the two differ confirms this is a
    // distinct bucket, not an accidental alias of the existing limiter.
    expect(globalResult.limit).not.toBe(perIpResult.limit)
  })

  it('succeeds in the test/dev fallback (fail-open, no Redis configured)', async () => {
    const result = await checkGlobalSendCodeLimit()
    expect(result.success).toBe(true)
  })

  it('is keyed independently of any caller-supplied identifier (no params accepted)', () => {
    expect(checkGlobalSendCodeLimit.length).toBe(0)
  })
})
