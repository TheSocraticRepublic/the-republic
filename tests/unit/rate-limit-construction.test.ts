import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Regression guard for the 2026-08-06 production auth outage.
 *
 * Redis.fromEnv() throws (UrlError) when UPSTASH_REDIS_REST_URL is present but
 * malformed — no scheme, or stray whitespace. That construction call used to
 * sit outside guardedLimit's try/catch, so the throw escaped as a 500 on every
 * rate-limited route, taking all three auth routes down with it.
 *
 * The contract these tests pin: a limiter that cannot be CONSTRUCTED must
 * degrade to rateLimitFallback (fail closed in production, open in dev) —
 * never reject.
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

describe('rate limiter construction failure', () => {
  it('malformed URL (no scheme) resolves to the fallback instead of throwing', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'not-a-url'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    vi.stubEnv('NODE_ENV', 'production')
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const { checkRateLimit } = await import('@/lib/rate-limit')
    const result = await checkRateLimit('test-id')

    // Fails CLOSED in production — the designed posture.
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('URL with stray whitespace resolves to the fallback', async () => {
    process.env.UPSTASH_REDIS_REST_URL = ' https://example.upstash.io '
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    vi.stubEnv('NODE_ENV', 'production')
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const { checkTightRateLimit } = await import('@/lib/rate-limit')
    const result = await checkTightRateLimit('test-id')

    expect(result.success).toBe(false)
  })

  it('construction failure fails OPEN in development', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'not-a-url'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    vi.stubEnv('NODE_ENV', 'development')
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const { checkRateLimit } = await import('@/lib/rate-limit')
    const result = await checkRateLimit('test-id')

    expect(result.success).toBe(true)
  })

  it('every limiter entry point survives a construction failure', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'not-a-url'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    vi.stubEnv('NODE_ENV', 'production')
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const mod = await import('@/lib/rate-limit')

    // None of these may reject — that was the outage.
    await expect(mod.checkRateLimit('id')).resolves.toBeDefined()
    await expect(mod.checkTightRateLimit('id')).resolves.toBeDefined()
    await expect(mod.checkDailyAiLimit('id')).resolves.toBeDefined()
    await expect(mod.checkDailyAiGeneralLimit('id')).resolves.toBeDefined()
    await expect(mod.checkGlobalSendCodeLimit()).resolves.toBeDefined()
  })
})
