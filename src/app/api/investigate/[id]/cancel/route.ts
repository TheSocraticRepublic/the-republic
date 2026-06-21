import { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getDb } from '@/lib/db'
import { investigations } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { safeRoute } from '@/lib/api/safe-route'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * POST /api/investigate/[id]/cancel
 *
 * Transitions a 'generating' investigation to 'cancelled'.
 * Owner-scoped: returns 404 for non-owners (same pattern as players route).
 * No-op if investigation is already in a terminal state.
 */
export const POST = safeRoute(async (request: NextRequest, { params }: RouteContext) => {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { success } = await checkRateLimit(`investigate-cancel:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { id } = await params
  const db = getDb()

  // Verify ownership — 404 for non-owner (avoids leaking existence)
  const [investigation] = await db
    .select({ id: investigations.id, status: investigations.status })
    .from(investigations)
    .where(and(eq(investigations.id, id), eq(investigations.userId, userId)))
    .limit(1)

  if (!investigation) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Only 'generating' investigations can be cancelled
  if (investigation.status !== 'generating') {
    return new Response(
      JSON.stringify({
        error: 'Investigation is not in a cancellable state',
        status: investigation.status,
      }),
      { status: 409, headers: { 'Content-Type': 'application/json' } }
    )
  }

  await db
    .update(investigations)
    .set({
      status: 'cancelled',
      failureReason: 'Cancelled by user',
      updatedAt: sql`NOW()`,
    })
    .where(
      and(
        eq(investigations.id, id),
        eq(investigations.userId, userId),
        sql`${investigations.status} = 'generating'`
      )
    )

  return new Response(JSON.stringify({ ok: true, status: 'cancelled' }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
