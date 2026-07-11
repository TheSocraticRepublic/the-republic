import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Lazy singleton — only instantiated when Upstash env vars are present.
// When Redis is not configured the limiter does NOT no-op uniformly: it fails
// OPEN in development and CLOSED in production (see rateLimitFallback).
//
// analytics is OFF on every limiter by design. Upstash's Analytics feature
// retains per-identifier (IP / account) request telemetry, which would
// contradict Open Cave's "no analytics / no retained activity records" privacy
// promise. We keep only the ephemeral, auto-expiring counters needed to enforce
// the limit — nothing about what a citizen reads, searches, or opens.
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
      analytics: false,
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
      analytics: false,
      prefix: 'republic-tight',
    })
  }
  return _tightRatelimit
}

/**
 * When Upstash isn't configured: fail OPEN in development (local dev needs no
 * Redis) but fail CLOSED in production — a missing/misconfigured Redis must not
 * silently disable abuse protection (caught in the 2026-06-18 production audit).
 */
function rateLimitFallback(limit: number): {
  success: boolean
  limit: number
  remaining: number
  reset: number
} {
  const open = process.env.NODE_ENV !== 'production'
  return { success: open, limit, remaining: open ? limit : 0, reset: Date.now() }
}

/**
 * Check rate limit for a given identifier (IP address or user ID).
 * Fails closed in production when Redis is not configured.
 */
export async function checkRateLimit(identifier: string): Promise<{
  success: boolean
  limit: number
  remaining: number
  reset: number
}> {
  const limiter = getRatelimit()
  if (!limiter) {
    return rateLimitFallback(30)
  }
  return limiter.limit(identifier)
}

/**
 * Tight rate limit for low-credential users — 5 requests per 60 seconds.
 * Applied to forum thread creation, forum post creation, and report
 * submission when effective weight < 5 (see `pickForumRateLimit`), plus a
 * range of AI-backed and account-sensitive routes that call it directly.
 * Fails closed in production when Redis is not configured (success: false);
 * fails open in development.
 */
export async function checkTightRateLimit(identifier: string): Promise<{
  success: boolean
  limit: number
  remaining: number
  reset: number
}> {
  const limiter = getTightRatelimit()
  if (!limiter) {
    return rateLimitFallback(5)
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
      analytics: false,
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
    return rateLimitFallback(5)
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
      analytics: false,
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
    return rateLimitFallback(10)
  }
  return limiter.limit(userId)
}

/**
 * Global backstop for /api/auth/send-code — SEC-1. getClientIp resolves the
 * real client IP wherever Netlify supplies a trustworthy header, but a
 * distributed sender (botnet, IP-rotating proxy pool) can still spread
 * requests across enough distinct IPs to defeat the per-IP limiter above
 * while still driving real cost (magic-code emails) and inbox-spam harm.
 *
 * This is a SINGLE global bucket — the same fixed key for every caller, not
 * keyed by IP or email — so it caps total send-code volume across the whole
 * app regardless of origin. It is a backstop, not the primary control: the
 * threshold must stay well above genuine peak legitimate traffic (so it
 * never blocks real users) while still bounding worst-case abuse cost.
 * 300 requests / 5 minutes is a starting value, not a researched ceiling —
 * tune against real traffic once there's production signal.
 *
 * WARNING-1 (audit remediation r1): env-overridable via SEND_CODE_GLOBAL_LIMIT
 * so the ceiling can be tuned for a launch traffic spike without a code
 * change/deploy. Unset, non-numeric, or non-positive values fall back to the
 * documented default of 300 (fail-closed on bad input, not fail-open to an
 * unbounded limit). See .env.example.
 */
function resolveGlobalSendCodeLimit(): number {
  const raw = process.env.SEND_CODE_GLOBAL_LIMIT
  if (!raw) return 300
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 300
}

export const GLOBAL_SEND_CODE_LIMIT = resolveGlobalSendCodeLimit()
const GLOBAL_SEND_CODE_WINDOW = '5 m'
const GLOBAL_SEND_CODE_KEY = 'global'

let _globalSendCodeLimit: Ratelimit | null = null

function getGlobalSendCodeLimit(): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    logProdWarning()
    return null
  }
  if (!_globalSendCodeLimit) {
    _globalSendCodeLimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(GLOBAL_SEND_CODE_LIMIT, GLOBAL_SEND_CODE_WINDOW),
      analytics: false,
      prefix: 'republic-global-send-code',
    })
  }
  return _globalSendCodeLimit
}

/**
 * Checks the global send-code ceiling. Fails closed in production when
 * Redis is not configured (matches checkRateLimit / checkTightRateLimit);
 * fails open in development.
 */
export async function checkGlobalSendCodeLimit(): Promise<{
  success: boolean
  limit: number
  remaining: number
  reset: number
}> {
  const limiter = getGlobalSendCodeLimit()
  if (!limiter) {
    return rateLimitFallback(GLOBAL_SEND_CODE_LIMIT)
  }
  return limiter.limit(GLOBAL_SEND_CODE_KEY)
}
