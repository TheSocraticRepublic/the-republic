import { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getDb } from '@/lib/db'
import { investigations, investigationPlayers, players } from '@/lib/db/schema'
import { eq, and, ne, isNotNull, or, inArray } from 'drizzle-orm'
import { safeRoute } from '@/lib/api/safe-route'

export const GET = safeRoute(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }

  const { success } = await checkRateLimit(`investigate-players:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { id } = await params
  const db = getDb()

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

  const expand = request.nextUrl.searchParams.get('expand') === 'true'

  if (!expand) {
    return new Response(JSON.stringify({ players: results }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Enriched response: cross-investigation appearances + co-appearing players
  const playerIds = results.map((r) => r.playerId)

  const appearances: Record<string, Array<{
    investigationId: string
    role: string
    concern: string
    jurisdictionName: string | null
  }>> = {}

  if (playerIds.length > 0) {
    const allAppearances = await db
      .select({
        playerId: investigationPlayers.playerId,
        investigationId: investigationPlayers.investigationId,
        role: investigationPlayers.role,
        concern: investigations.concern,
        jurisdictionName: investigations.jurisdictionName,
      })
      .from(investigationPlayers)
      .innerJoin(
        investigations,
        eq(investigationPlayers.investigationId, investigations.id)
      )
      .where(
        and(
          inArray(investigationPlayers.playerId, playerIds),
          ne(investigationPlayers.investigationId, id),
          or(
            isNotNull(investigations.preservedAt),
            eq(investigations.userId, userId)
          )
        )
      )

    for (const row of allAppearances) {
      if (!appearances[row.playerId]) {
        appearances[row.playerId] = []
      }
      appearances[row.playerId].push({
        investigationId: row.investigationId,
        role: row.role,
        concern: row.concern.slice(0, 200),
        jurisdictionName: row.jurisdictionName,
      })
    }
  }

  // Co-appearing players (relationship edges within this investigation)
  const relationships: Record<string, string[]> = {}
  for (const p of results) {
    relationships[p.playerId] = results
      .filter((other) => other.playerId !== p.playerId)
      .map((other) => other.playerId)
  }

  return new Response(
    JSON.stringify({ players: results, appearances, relationships }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
