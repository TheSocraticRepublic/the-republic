/**
 * reap-investigations — Netlify Scheduled Function
 *
 * Runs every 5 minutes. Marks stuck 'generating' investigations as 'failed'.
 * "Stuck" = generation_started_at older than STUCK_GENERATION_INTERVAL (12 min),
 * briefing_completed_at IS NULL, and status = 'generating'.
 *
 * This is the primary automated reaper; the render-time reaper in
 * investigations/page.tsx is belt-and-suspenders for the local/preview case.
 *
 * First-deploy guard: logs the affected count before updating so that a
 * misconfigured WHERE can't silently mass-fail rows in production.
 */

import type { Config, Context } from '@netlify/functions'
import { getDb } from '@/lib/db'
import { investigations, magicCodes } from '@/lib/db/schema'
import { and, isNull, sql, lt } from 'drizzle-orm'
import { STUCK_GENERATION_INTERVAL } from '@/lib/investigation/constants'

export const config: Config = {
  schedule: '*/5 * * * *',
}

export default async function handler(_req: Request, _context: Context): Promise<Response> {
  const db = getDb()

  // Dry-run log: count would-be affected rows before updating.
  // Gives visibility on first deploy; also useful for monitoring.
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(investigations)
    .where(
      and(
        sql`${investigations.status} = 'generating'`,
        isNull(investigations.briefingCompletedAt),
        sql`${investigations.generationStartedAt} < NOW() - (${STUCK_GENERATION_INTERVAL})::interval`
      )
    )

  const affectedCount = countRow?.count ?? 0

  console.log(
    `[reap-investigations] would mark ${affectedCount} stuck investigation(s) as failed`,
    `(threshold: ${STUCK_GENERATION_INTERVAL})`
  )

  // Purge fully-expired magic codes (expired > 1 day ago) to keep the table lean.
  // Sign-in codes expire after 10 minutes; this removes codes long past their window.
  // MUST run BEFORE the no-stuck early-exit below, else it only fires on cycles that
  // also have stuck investigations (the wrong coupling — in a healthy system that's
  // almost never, so the table would grow unbounded). Maintenance, not critical path:
  // log and swallow so a purge hiccup can't fail an otherwise-successful reap.
  try {
    const expiryCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const purged = await db
      .delete(magicCodes)
      .where(lt(magicCodes.expiresAt, expiryCutoff))
      .returning({ id: magicCodes.id })
    if (purged.length > 0) {
      console.log(`[reap-investigations] purged ${purged.length} expired magic code(s)`)
    }
  } catch (err) {
    console.error('[reap-investigations] magic_codes purge failed:', err)
  }

  if (affectedCount === 0) {
    return new Response('OK: nothing to reap', { status: 200 })
  }

  // Perform the update
  const updated = await db
    .update(investigations)
    .set({
      status: 'failed',
      failureReason: 'Generation timed out',
      updatedAt: sql`NOW()`,
    })
    .where(
      and(
        sql`${investigations.status} = 'generating'`,
        isNull(investigations.briefingCompletedAt),
        sql`${investigations.generationStartedAt} < NOW() - (${STUCK_GENERATION_INTERVAL})::interval`
      )
    )
    .returning({ id: investigations.id })

  console.log(`[reap-investigations] marked ${updated.length} investigation(s) as failed`)

  return new Response(`OK: reaped ${updated.length}`, { status: 200 })
}
