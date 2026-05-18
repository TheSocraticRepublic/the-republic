import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Lazy singleton — only instantiated when Upstash env vars are present.
// Falls back to a no-op in environments where Redis is not configured
// (e.g. local dev without Upstash credentials).
let _ratelimit: Ratelimit | null = null
let _tightRatelimit: Ratelimit | null = null
let _prodWarningLogged = false

function logProdWarning(): void {
  if (!_prodWarningLogged && process.env.NODE_ENV === 'production') {
    _prodWarningLogged = true
    console.warn('Rate limiting disabled: UPSTASH_REDIS_REST_URL not configured')
  }
}

function getRatelimit(): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    logProdWarning()
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
    logProdWarning()
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

let _dailyAiLimit: Ratelimit | null = null

function getDailyAiLimit(): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    logProdWarning()
    return null
  }
  if (!_dailyAiLimit) {
    _dailyAiLimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.fixedWindow(5, '24 h'),
      analytics: true,
      prefix: 'republic-daily-ai',
    })
  }
  return _dailyAiLimit
}

export async function checkDailyAiLimit(userId: string): Promise<{
  success: boolean
  limit: number
  remaining: number
  reset: number
}> {
  const limiter = getDailyAiLimit()
  if (!limiter) {
    return { success: true, limit: 5, remaining: 5, reset: Date.now() }
  }
  return limiter.limit(userId)
}

let _dailyAiGeneralLimit: Ratelimit | null = null

function getDailyAiGeneralLimit(): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    logProdWarning()
    return null
  }
  if (!_dailyAiGeneralLimit) {
    _dailyAiGeneralLimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.fixedWindow(10, '24 h'),
      analytics: true,
      prefix: 'republic-daily-ai-general',
    })
  }
  return _dailyAiGeneralLimit
}

export async function checkDailyAiGeneralLimit(userId: string): Promise<{
  success: boolean
  limit: number
  remaining: number
  reset: number
}> {
  const limiter = getDailyAiGeneralLimit()
  if (!limiter) {
    return { success: true, limit: 10, remaining: 10, reset: Date.now() }
  }
  return limiter.limit(userId)
}
