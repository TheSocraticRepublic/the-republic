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

    const { probeRateLimiter } = await import('@/lib/rate-limit')
    const result = await probeRateLimiter()

    // Construction succeeds on a well-formed URL; the call then fails against
    // a host that will not authenticate. Either way the probe must report down
    // rather than throw.
    expect(result.ok).toBe(false)
    expect(result.reason).toBeTruthy()
  })

  it('never rejects — a throwing probe would 500 the health endpoint itself', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'not-a-url'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const { probeRateLimiter } = await import('@/lib/rate-limit')
    await expect(probeRateLimiter()).resolves.toBeDefined()
  })
})
