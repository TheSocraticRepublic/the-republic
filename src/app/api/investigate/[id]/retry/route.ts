import { NextRequest } from 'next/server'
import { checkTightRateLimit } from '@/lib/rate-limit'
import { getDb } from '@/lib/db'
import { investigations } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { triggerBriefingGeneration } from '@/lib/investigation/trigger-generation'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * POST /api/investigate/[id]/retry
 *
 * Re-runs briefing generation on a failed or cancelled investigation.
 * Resets status to 'generating', clears previous results and failureReason,
 * sets generation_started_at = NOW(), then triggers the background function.
 *
 * Owner-scoped: returns 404 for non-owners.
 * Rate-limited with the same tight limit as the creation route.
 * Returns 202 { id } — generation runs in the background.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { success } = await checkTightRateLimit(`investigate:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { id } = await params
  const db = getDb()

  // Fetch the investigation — ownership scoped, 404 for non-owner
  const [inv] = await db
    .select({
      id: investigations.id,
      userId: investigations.userId,
      status: investigations.status,
    })
    .from(investigations)
    .where(and(eq(investigations.id, id), eq(investigations.userId, userId)))
    .limit(1)

  if (!inv) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Only allow retry on terminal non-complete states
  if (inv.status !== 'failed' && inv.status !== 'cancelled') {
    return new Response(
      JSON.stringify({
        error: 'Investigation is not in a retryable state',
        status: inv.status,
      }),
      { status: 409, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Reset row: status → generating, clear previous results, set generation_started_at
  await db
    .update(investigations)
    .set({
      status: 'generating',
      failureReason: null,
      briefingText: null,
      briefingCompletedAt: null,
      generationStartedAt: new Date(),
      updatedAt: sql`NOW()`,
    })
    .where(and(eq(investigations.id, id), eq(investigations.userId, userId)))

  // Trigger background generation
  const { ok } = await triggerBriefingGeneration(id)

  if (!ok) {
    // Trigger failed — put row back to failed so user can retry again
    try {
      await db
        .update(investigations)
        .set({
          status: 'failed',
          failureReason: 'Failed to start generation — please retry',
          updatedAt: sql`NOW()`,
        })
        .where(and(eq(investigations.id, id), eq(investigations.userId, userId)))
    } catch (dbErr) {
      console.error('[investigate/retry] failed to revert investigation after trigger failure', dbErr)
    }
    return new Response(JSON.stringify({
      error: 'Failed to start investigation generation. Please try again.',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ id }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' },
  })
}
