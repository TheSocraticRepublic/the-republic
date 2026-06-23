/**
 * generate-briefing-background — Netlify Background Function
 *
 * The `-background` filename suffix is REQUIRED: it is what makes Netlify
 * actually execute this as a background function (15-min wall-clock budget,
 * async). The `config.background` flag alone only registers it (the invocation
 * 202-acks) but the handler never runs — verified in prod. Do not rename without
 * also updating the trigger path in src/lib/investigation/trigger-generation.ts.
 *
 * Accepts the briefing generation work from POST /api/investigate and
 * POST /api/investigate/[id]/retry.
 *
 * Caller (trigger-generation.ts) sends:
 *   POST /.netlify/functions/generate-briefing-background
 *   Headers: x-internal-secret: <INTERNAL_TRIGGER_SECRET>
 *   Body: { investigationId: string }
 *
 * Returns 202 immediately (background — Netlify sends 202 before the handler runs).
 * Result is persisted to DB by runBriefingGeneration.
 */

import type { Context } from '@netlify/functions'
import { createHmac, timingSafeEqual } from 'crypto'
import { getDb } from '@/lib/db'
import { investigations } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { runBriefingGeneration } from '@/lib/investigation/run-briefing'

// Wall-clock backstop: runBriefingGeneration aborts the model call at 240s and
// handles its own errors, but a hang OUTSIDE the model call (a stalled DB query,
// setup) or a throw before its internal try (the row pre-load) would otherwise
// leave the row silently 'generating'. This guarantees a terminal state.
const BG_WALL_CLOCK_MS = 300_000

export default async function handler(req: Request, _context: Context): Promise<Response> {
  // --- Auth: constant-time comparison of x-internal-secret ---
  const secret = process.env.INTERNAL_TRIGGER_SECRET
  if (!secret) {
    console.error('[generate-briefing] INTERNAL_TRIGGER_SECRET not configured')
    return new Response('Unauthorized', { status: 401 })
  }

  const provided = req.headers.get('x-internal-secret') ?? ''

  // Use constant-time comparison to prevent timing attacks.
  // Both buffers must be the same byte length for timingSafeEqual.
  // We use HMAC with a fixed key to normalize length.
  const key = Buffer.from(secret, 'utf8')
  const expectedHmac = createHmac('sha256', key).update(secret).digest()
  const providedHmac = createHmac('sha256', key).update(provided).digest()

  if (!timingSafeEqual(expectedHmac, providedHmac)) {
    console.warn('[generate-briefing] invalid x-internal-secret')
    return new Response('Unauthorized', { status: 401 })
  }

  // --- Parse body ---
  let investigationId: string
  try {
    const body = await req.json() as { investigationId?: unknown }
    if (typeof body.investigationId !== 'string' || !body.investigationId) {
      return new Response('Bad Request: investigationId required', { status: 400 })
    }
    investigationId = body.investigationId
  } catch {
    return new Response('Bad Request: invalid JSON', { status: 400 })
  }

  // --- Idempotency guard: only proceed if status='generating' ---
  // This makes Netlify auto-retry and double-submit safe.
  const db = getDb()

  const [row] = await db
    .select({ status: investigations.status })
    .from(investigations)
    .where(eq(investigations.id, investigationId))
    .limit(1)

  if (!row) {
    console.warn('[generate-briefing] investigation not found:', investigationId)
    return new Response('Not Found', { status: 404 })
  }

  if (row.status !== 'generating') {
    // NO-OP: already completed, failed, cancelled, or in another terminal state.
    // This is correct: auto-retry on a complete row must not overwrite the briefing.
    console.log(
      '[generate-briefing] NO-OP for investigation',
      investigationId,
      '— status is',
      row.status
    )
    return new Response('OK', { status: 200 })
  }

  // --- Run generation (with wall-clock backstop + terminal-state guarantee) ---
  try {
    await Promise.race([
      runBriefingGeneration({ db, investigationId }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`bg-fn wall-clock timeout after ${BG_WALL_CLOCK_MS / 1000}s`)),
          BG_WALL_CLOCK_MS
        )
      ),
    ])
  } catch (err) {
    // runBriefingGeneration persists its own failures; this catches anything it
    // can't (throws before its internal try, or the wall-clock timeout above) so
    // the row never stays silently 'generating'.
    const msg = err instanceof Error ? err.message.slice(0, 500) : String(err)
    console.error('[generate-briefing] generation did not complete:', investigationId, err)
    try {
      await db
        .update(investigations)
        .set({ status: 'failed', failureReason: `bg-fn: ${msg}`, updatedAt: sql`NOW()` })
        .where(
          sql`${investigations.id} = ${investigationId} AND ${investigations.briefingCompletedAt} IS NULL AND ${investigations.status} = 'generating'`
        )
    } catch (dbErr) {
      console.error('[generate-briefing] failed to persist terminal state', investigationId, dbErr)
    }
  }

  return new Response('OK', { status: 200 })
}
