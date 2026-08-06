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
    // NB: in production the fallback FAILS CLOSED — every rate-limited
    // request 429s until Redis is configured. Say so, or this log sends an
    // incident responder hunting for a "disabled" limiter that is actually
    // rejecting everything.
    console.warn(
      'Rate limiting DEGRADED: UPSTASH_REDIS_REST_URL not configured — production fails closed, all rate-limited requests will 429'
    )
  }
}

/**
 * Build a Ratelimit client, returning null on ANY failure.
 *
 * Redis.fromEnv() throws (UrlError) when the env vars are present but
 * malformed — a URL missing its scheme, or carrying stray whitespace. The
 * truthiness guard above cannot catch that: Next.js inlines static
 * `process.env.X` references at build time while fromEnv() reads them
 * dynamically at runtime, so the guard can pass on a baked-in value while
 * construction throws on the live one.
 *
 * Left unguarded this surfaces as a 500 on every rate-limited route — which
 * is exactly how production auth went down on 2026-08-06 (same class as the
 * 2026-06-19 Upstash outage). Returning null routes the caller to
 * rateLimitFallback(), which fails CLOSED in production as designed.
 */
function buildLimiter(
  limiter: ReturnType<typeof Ratelimit.slidingWindow>,
  prefix: string
): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    logProdWarning()
    return null
  }
  try {
    return new Ratelimit({
      redis: Redis.fromEnv(),
      limiter,
      analytics: false,
      prefix,
    })
  } catch (err) {
    console.error(
      `[rate-limit] limiter construction failed for prefix "${prefix}" — check UPSTASH_REDIS_REST_URL/TOKEN. Falling back.`,
      err
    )
    return null
  }
}

function getRatelimit(): Ratelimit | null {
  if (!_ratelimit) {
    _ratelimit = buildLimiter(Ratelimit.slidingWindow(30, '60 s'), 'republic')
  }
  return _ratelimit
}

function getTightRatelimit(): Ratelimit | null {
  if (!_tightRatelimit) {
    _tightRatelimit = buildLimiter(Ratelimit.slidingWindow(5, '60 s'), 'republic-tight')
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
 * Wraps limiter.limit() with a timeout and try/catch so a Redis hang or crash
 * falls back gracefully instead of 500ing the request.
 */
async function guardedLimit(
  limiter: Ratelimit,
  identifier: string,
  limit: number
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    let timedOut = false
    const result = await Promise.race([
      limiter.limit(identifier),
      new Promise<{ success: boolean; limit: number; remaining: number; reset: number }>((resolve) => {
        timer = setTimeout(() => {
          timedOut = true
          console.warn('[rate-limit] Redis timeout — applying fallback')
          resolve(rateLimitFallback(limit))
        }, 1000)
      }),
    ])
    if (!timedOut && timer) clearTimeout(timer)
    return result
  } catch (err) {
    if (timer) clearTimeout(timer)
    console.error('[rate-limit] Redis error — applying fallback', err)
    return rateLimitFallback(limit)
  }
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
  return guardedLimit(limiter, identifier, 30)
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
  return guardedLimit(limiter, identifier, 5)
}

let _dailyAiLimit: Ratelimit | null = null

function getDailyAiLimit(): Ratelimit | null {
  if (!_dailyAiLimit) {
    _dailyAiLimit = buildLimiter(Ratelimit.fixedWindow(5, '24 h'), 'republic-daily-ai')
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
  return guardedLimit(limiter, userId, 5)
}

let _dailyAiGeneralLimit: Ratelimit | null = null

function getDailyAiGeneralLimit(): Ratelimit | null {
  if (!_dailyAiGeneralLimit) {
    _dailyAiGeneralLimit = buildLimiter(
      Ratelimit.fixedWindow(10, '24 h'),
      'republic-daily-ai-general'
    )
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
  return guardedLimit(limiter, userId, 10)
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
  if (!_globalSendCodeLimit) {
    _globalSendCodeLimit = buildLimiter(
      Ratelimit.slidingWindow(GLOBAL_SEND_CODE_LIMIT, GLOBAL_SEND_CODE_WINDOW),
      'republic-global-send-code'
    )
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
  return guardedLimit(limiter, GLOBAL_SEND_CODE_KEY, GLOBAL_SEND_CODE_LIMIT)
}
