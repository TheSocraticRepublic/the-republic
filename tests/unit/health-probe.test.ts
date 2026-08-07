import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Regression guard for the 2026-08-06 outage.
 *
 * The health check probed Postgres only, so it returned 200 with
 * `database: ok` while every auth route was returning 500 — and the twice-weekly
 * keepalive workflow read that green and passed. The single property worth
 * pinning is therefore: **the health check can go red when Redis is broken.**
 * A probe that cannot detect the outage is worse than no probe, because it
 * manufactures confidence.
 */

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('probeRateLimiter', () => {
  it('reports not-configured when Upstash env vars are absent', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN

    const { probeRateLimiter } = await import('@/lib/rate-limit')
    const result = await probeRateLimiter()

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('not configured')
  })

  it('reports construction failure on a malformed URL — the actual outage cause', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'not-a-url'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const { probeRateLimiter } = await import('@/lib/rate-limit')
    const result = await probeRateLimiter()

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('limiter construction failed')
  })

  it('reports the underlying reason when the Redis round-trip throws', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'bad-token'

    // Fail the round-trip deterministically, in-process. This test previously
    // relied on a REAL request to example.upstash.io failing inside vitest's
    // 5s budget — but @upstash/redis retries 5 times with exponential backoff
    // (~4.3s) before surfacing an error, so it sat on the timeout boundary and
    // flaked on any slow DNS. A required CI check that is intermittently red
    // decays into the same decoration as one that is always green.
    //
    // Construction is left real: Redis.fromEnv() still runs and still succeeds
    // on a well-formed URL, which is the precondition this case depends on.
    vi.doMock('@upstash/ratelimit', () => ({
      Ratelimit: class {
        static slidingWindow = () => ({})
        async limit(): Promise<never> {
          throw new Error('Redis timeout')
        }
      },
    }))

    const { probeRateLimiter } = await import('@/lib/rate-limit')
    const result = await probeRateLimiter()

    expect(result.ok).toBe(false)
    // Assert the exact message, not merely truthiness: the property that
    // mattered during the 2026-08-06 outage was that the probe surfaces the
    // UNDERLYING reason — "Redis timeout" (a hang) reads differently from
    // "Redis error" (a bad credential), and that distinction is what isolated
    // the cause within minutes.
    expect(result.reason).toBe('Redis timeout')
  })

  it('never rejects — a throwing probe would 500 the health endpoint itself', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'not-a-url'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const { probeRateLimiter } = await import('@/lib/rate-limit')
    await expect(probeRateLimiter()).resolves.toBeDefined()
  })
})
