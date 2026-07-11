import { describe, it, expect, vi, afterEach } from 'vitest'
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

// WARNING-1 (audit remediation r1): SEND_CODE_GLOBAL_LIMIT must be
// env-overridable so Lee can tune the ceiling for a launch spike without a
// deploy, while invalid input still falls back to the documented default
// (300) rather than silently disabling the cap. GLOBAL_SEND_CODE_LIMIT is
// computed once at module load, so each case here sets the env var, resets
// the module registry, and re-imports — mirrors the pattern in
// instrumentation-client-scrub.test.ts.
describe('GLOBAL_SEND_CODE_LIMIT — env override (SEND_CODE_GLOBAL_LIMIT)', () => {
  afterEach(() => {
    delete process.env.SEND_CODE_GLOBAL_LIMIT
    vi.resetModules()
  })

  it('uses the env value when set to a valid positive integer', async () => {
    process.env.SEND_CODE_GLOBAL_LIMIT = '1000'
    vi.resetModules()
    const mod = await import('@/lib/rate-limit')
    expect(mod.GLOBAL_SEND_CODE_LIMIT).toBe(1000)
  })

  it('falls back to 300 when unset', async () => {
    delete process.env.SEND_CODE_GLOBAL_LIMIT
    vi.resetModules()
    const mod = await import('@/lib/rate-limit')
    expect(mod.GLOBAL_SEND_CODE_LIMIT).toBe(300)
  })

  it('falls back to 300 (fail-closed) for non-numeric input', async () => {
    process.env.SEND_CODE_GLOBAL_LIMIT = 'not-a-number'
    vi.resetModules()
    const mod = await import('@/lib/rate-limit')
    expect(mod.GLOBAL_SEND_CODE_LIMIT).toBe(300)
  })

  it('falls back to 300 (fail-closed) for zero or negative input', async () => {
    process.env.SEND_CODE_GLOBAL_LIMIT = '0'
    vi.resetModules()
    const zero = await import('@/lib/rate-limit')
    expect(zero.GLOBAL_SEND_CODE_LIMIT).toBe(300)

    process.env.SEND_CODE_GLOBAL_LIMIT = '-50'
    vi.resetModules()
    const negative = await import('@/lib/rate-limit')
    expect(negative.GLOBAL_SEND_CODE_LIMIT).toBe(300)
  })

  it('falls back to 300 (fail-closed) for non-integer input', async () => {
    process.env.SEND_CODE_GLOBAL_LIMIT = '12.5'
    vi.resetModules()
    const mod = await import('@/lib/rate-limit')
    expect(mod.GLOBAL_SEND_CODE_LIMIT).toBe(300)
  })
})
