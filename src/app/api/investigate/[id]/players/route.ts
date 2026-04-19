import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { investigations, investigationPlayers, players } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }

  const { id } = await params
  const db = getDb()

  // Verify ownership
  const [investigation] = await db
    .select({ id: investigations.id })
    .from(investigations)
    .where(and(eq(investigations.id, id), eq(investigations.userId, userId)))
    .limit(1)

  if (!investigation) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    })
  }

  // Fetch players with their roles for this investigation
  const results = await db
    .select({
      playerId: players.id,
      name: players.name,
      playerType: players.playerType,
      description: players.description,
      metadata: players.metadata,
      role: investigationPlayers.role,
      context: investigationPlayers.context,
    })
    .from(investigationPlayers)
    .innerJoin(players, eq(investigationPlayers.playerId, players.id))
    .where(eq(investigationPlayers.investigationId, id))

  return new Response(JSON.stringify({ players: results }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
