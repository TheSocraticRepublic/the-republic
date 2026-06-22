/**
 * generate-briefing — Netlify Background Function
 *
 * Accepts the briefing generation work from POST /api/investigate and
 * POST /api/investigate/[id]/retry. Runs with a 15-minute budget.
 *
 * Caller (trigger-generation.ts) sends:
 *   POST /.netlify/functions/generate-briefing
 *   Headers: x-internal-secret: <INTERNAL_TRIGGER_SECRET>
 *   Body: { investigationId: string }
 *
 * Returns 202 immediately (background — Netlify sends 202 before the handler runs).
 * Result is persisted to DB by runBriefingGeneration.
 */

import type { Config, Context } from '@netlify/functions'
import { createHmac, timingSafeEqual } from 'crypto'
import { getDb } from '@/lib/db'
import { investigations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { runBriefingGeneration } from '@/lib/investigation/run-briefing'

export const config: Config = {
  background: true,
}

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

  // --- Run generation ---
  await runBriefingGeneration({ db, investigationId })

  return new Response('OK', { status: 200 })
}
