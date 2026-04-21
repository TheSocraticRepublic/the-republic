import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Lazy singleton — only instantiated when Upstash env vars are present.
// Falls back to a no-op in environments where Redis is not configured
// (e.g. local dev without Upstash credentials).
let _ratelimit: Ratelimit | null = null
let _tightRatelimit: Ratelimit | null = null

function getRatelimit(): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  if (!_ratelimit) {
    _ratelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(30, '60 s'),
      analytics: true,
      prefix: 'republic',
    })
  }
  return _ratelimit
}

function getTightRatelimit(): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  if (!_tightRatelimit) {
    _tightRatelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, '60 s'),
      analytics: true,
      prefix: 'republic-tight',
    })
  }
  return _tightRatelimit
}

/**
 * Check rate limit for a given identifier (IP address or user ID).
 * Returns { success: true } when Redis is not configured so that
 * local development is not blocked.
 */
export async function checkRateLimit(identifier: string): Promise<{
  success: boolean
  limit: number
  remaining: number
  reset: number
}> {
  const limiter = getRatelimit()
  if (!limiter) {
    return { success: true, limit: 30, remaining: 30, reset: Date.now() }
  }
  return limiter.limit(identifier)
}

/**
 * Tight rate limit for low-credential users — 5 requests per 60 seconds.
 * Applied to report submissions when effective weight < 5.
 * Returns { success: true } when Redis is not configured.
 */
export async function checkTightRateLimit(identifier: string): Promise<{
  success: boolean
  limit: number
  remaining: number
  reset: number
}> {
  const limiter = getTightRatelimit()
  if (!limiter) {
    return { success: true, limit: 5, remaining: 5, reset: Date.now() }
  }
  return limiter.limit(identifier)
}
