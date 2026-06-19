import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'

// A health check must never be cached and must reflect live state.
export const dynamic = 'force-dynamic'

// Fail fast: a paused/unreachable DB must not hang the check. The DB client's
// own connect_timeout is 10s; we cap the probe well under the monitor's 8s
// ping timeout so the endpoint reports 503 instead of timing out.
const DB_PROBE_TIMEOUT_MS = 4000

export async function GET() {
  const checks: Record<string, 'ok' | 'down'> = {}
  let healthy = true

  try {
    const db = getDb()
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('db probe timeout')), DB_PROBE_TIMEOUT_MS)
      ),
    ])
    checks.database = 'ok'
  } catch (err) {
    checks.database = 'down'
    healthy = false
    console.error(
      '[health] database probe failed:',
      err instanceof Error ? err.message : err
    )
  }

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    },
    { status: healthy ? 200 : 503 }
  )
}
