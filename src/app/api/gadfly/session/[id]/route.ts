import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getDb } from '@/lib/db'
import { gadflySessions, gadflyTurns, insightMarkers } from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { safeRoute } from '@/lib/api/safe-route'

/**
 * GET /api/gadfly/session/[id]
 * Fetch session detail with all turns and insight markers.
 */
export const GET = safeRoute(async (request: NextRequest, { params }) => {
  const { id } = await params
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { success } = await checkRateLimit(`gadfly-session-detail:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = getDb()

  const [session] = await db
    .select()
    .from(gadflySessions)
    .where(and(eq(gadflySessions.id, id), eq(gadflySessions.userId, userId)))
    .limit(1)

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const turns = await db
    .select()
    .from(gadflyTurns)
    .where(eq(gadflyTurns.sessionId, id))
    .orderBy(asc(gadflyTurns.turnIndex))

  const insights = await db
    .select()
    .from(insightMarkers)
    .where(eq(insightMarkers.sessionId, id))
    .orderBy(asc(insightMarkers.createdAt))

  // Group insight markers by turnId for easy lookup on the client
  const insightsByTurn: Record<string, typeof insights> = {}
  for (const insight of insights) {
    if (!insightsByTurn[insight.turnId]) {
      insightsByTurn[insight.turnId] = []
    }
    insightsByTurn[insight.turnId].push(insight)
  }

  return NextResponse.json({ session, turns, insightsByTurn })
})
