import { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getDb } from '@/lib/db'
import { investigations } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { safeRoute } from '@/lib/api/safe-route'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * DELETE /api/investigate/[id]/delete
 *
 * Permanently deletes an investigation and all related rows (cascaded via FK).
 * Owner-scoped: returns 404 for non-owners (avoids leaking existence).
 *
 * Cascade coverage (all have ON DELETE CASCADE to investigations):
 *   investigation_players, campaign_materials, issue_tracking,
 *   investigation_outcomes, archive_records, shadow_alerts,
 *   investigation_votes, peer_reviews, forum_threads (set null — orphaned safely)
 *
 * Not reversible. Inform the user before calling.
 */
export const DELETE = safeRoute(async (request: NextRequest, { params }: RouteContext) => {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { success } = await checkRateLimit(`investigate-delete:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { id } = await params
  const db = getDb()

  // Verify ownership before deletion — 404 for non-owner (avoids leaking existence)
  const [investigation] = await db
    .select({ id: investigations.id })
    .from(investigations)
    .where(and(eq(investigations.id, id), eq(investigations.userId, userId)))
    .limit(1)

  if (!investigation) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  await db
    .delete(investigations)
    .where(and(eq(investigations.id, id), eq(investigations.userId, userId)))

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
