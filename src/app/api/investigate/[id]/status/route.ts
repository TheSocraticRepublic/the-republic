import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getDb } from '@/lib/db'
import { investigations } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { safeRoute } from '@/lib/api/safe-route'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/investigate/[id]/status
 *
 * Lightweight poll endpoint for the GeneratingPoller client component.
 * Returns only { status, failureReason } — never briefingText (saves bandwidth).
 *
 * Owner-scoped: returns 404 for non-owners (IDOR pattern — never leak existence).
 * Uses the GENERAL rate-limit bucket so 3s polling from the poller does not
 * starve the detail route (which uses its own investigate-detail bucket).
 */
export const GET = safeRoute(async (request: NextRequest, { params }: RouteContext) => {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // General bucket — 30/min is plenty for 3s polling but won't starve other routes.
  const { success } = await checkRateLimit(`investigate-status:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { id } = await params
  const db = getDb()

  const [row] = await db
    .select({
      status: investigations.status,
      failureReason: investigations.failureReason,
    })
    .from(investigations)
    .where(and(eq(investigations.id, id), eq(investigations.userId, userId)))
    .limit(1)

  if (!row) {
    // 404 for non-owner (IDOR: never reveal whether the row exists)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    status: row.status,
    failureReason: row.failureReason ?? null,
  })
})
