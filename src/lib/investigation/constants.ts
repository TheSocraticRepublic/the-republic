/**
 * Shared threshold for detecting stuck/zombie investigation rows.
 *
 * Any row with status='generating' and generation_started_at older than this
 * is considered stuck. Used by BOTH reapers:
 *   - netlify/functions/reap-investigations.mts  (scheduled, runs in production)
 *   - src/app/(app)/investigations/page.tsx      (render-time, belt-and-suspenders)
 *
 * 12 minutes:
 *   - Strictly above the 240s (4 min) model AbortSignal.timeout in run-briefing.ts
 *   - Plus cold-start / DB / context-build overhead (~1-2 min)
 *   - Comfortably below the 15-minute Netlify background function budget
 *   - Eliminates the old 5-minute threshold that reaped retried rows immediately
 *     (old createdAt << new generation_started_at — now correctly gated)
 */
export const STUCK_GENERATION_THRESHOLD_MINUTES = 12

/**
 * SQL interval string for use in Drizzle raw SQL expressions. Cast the bound
 * value to ::interval — `INTERVAL $1` is rejected by Postgres:
 *   sql`generation_started_at < NOW() - (${STUCK_GENERATION_INTERVAL})::interval`
 */
export const STUCK_GENERATION_INTERVAL = `${STUCK_GENERATION_THRESHOLD_MINUTES} minutes`
