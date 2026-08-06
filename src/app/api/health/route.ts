import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { APP_VERSION } from '@/lib/version'
import { probeRateLimiter } from '@/lib/rate-limit'

// A health check must never be cached and must reflect live state.
export const dynamic = 'force-dynamic'

// Fail fast: a paused/unreachable dependency must not hang the check. The DB
// client's own connect_timeout is 10s; we cap each probe well under the
// monitor's 8s ping timeout so the endpoint reports 503 instead of timing out.
const DB_PROBE_TIMEOUT_MS = 4000
const REDIS_PROBE_TIMEOUT_MS = 2000

type CheckState = 'ok' | 'down' | 'not_configured'

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} probe timeout`)), ms)
    ),
  ])
}

export async function GET() {
  const checks: Record<string, CheckState> = {}
  let healthy = true

  // --- Postgres ---
  try {
    const db = getDb()
    await withTimeout(db.execute(sql`select 1`), DB_PROBE_TIMEOUT_MS, 'db')
    checks.database = 'ok'
  } catch (err) {
    checks.database = 'down'
    healthy = false
    console.error(
      '[health] database probe failed:',
      err instanceof Error ? err.message : err
    )
  }

  // --- Redis / rate limiter ---
  //
  // A hard dependency, not a nice-to-have. The limiter fails CLOSED in
  // production, so an unreachable Redis turns every auth route into a 429 —
  // login is down either way. It must be able to take this endpoint red.
  try {
    const probe = await withTimeout(
      probeRateLimiter(),
      REDIS_PROBE_TIMEOUT_MS,
      'redis'
    )
    if (probe.ok) {
      checks.redis = 'ok'
    } else if (probe.reason === 'not configured') {
      // Absent config fails closed in production (auth 429s) but is the normal
      // state in local dev, where the limiter fails open.
      checks.redis = 'not_configured'
      if (process.env.NODE_ENV === 'production') healthy = false
    } else {
      checks.redis = 'down'
      healthy = false
      console.error('[health] redis probe failed:', probe.reason)
    }
  } catch (err) {
    checks.redis = 'down'
    healthy = false
    console.error(
      '[health] redis probe failed:',
      err instanceof Error ? err.message : err
    )
  }

  // --- Email (Resend) ---
  //
  // Configuration presence only — deliberately NOT a live API call. A probe on
  // every ping would spend quota and add a third-party dependency to our own
  // liveness signal. Named `email_configured` so it cannot be misread as proof
  // that delivery works; a missing key still means nobody can complete login,
  // which is worth surfacing.
  checks.email_configured = process.env.RESEND_API_KEY ? 'ok' : 'not_configured'
  if (!process.env.RESEND_API_KEY && process.env.NODE_ENV === 'production') {
    healthy = false
  }

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
    },
    { status: healthy ? 200 : 503 }
  )
}
