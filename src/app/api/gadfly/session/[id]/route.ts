import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { gadflySessions, gadflyTurns, insightMarkers } from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/gadfly/session/[id]
 * Fetch session detail with all turns and insight markers.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
}
