import { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getDb } from '@/lib/db'
import { federalMps, federalMpBallots } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { safeRoute } from '@/lib/api/safe-route'

export const GET = safeRoute(async (
  request: NextRequest,
  { params }
) => {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { success } = await checkRateLimit(`parliament-mp:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { mpId } = await params
  const db = getDb()

  const [mp] = await db
    .select()
    .from(federalMps)
    .where(eq(federalMps.id, mpId))
    .limit(1)

  if (!mp) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const [stats] = await db
    .select({
      totalVotes: sql<number>`count(*)`,
      yesVotes: sql<number>`count(*) filter (where ${federalMpBallots.ballot} = 'yes')`,
      noVotes: sql<number>`count(*) filter (where ${federalMpBallots.ballot} = 'no')`,
      absentVotes: sql<number>`count(*) filter (where ${federalMpBallots.ballot} = 'didnt_vote')`,
    })
    .from(federalMpBallots)
    .where(eq(federalMpBallots.mpId, mpId))

  return new Response(
    JSON.stringify({
      mp: {
        id: mp.id,
        name: mp.name,
        party: mp.party,
        ridingName: mp.ridingName,
        ridingProvince: mp.ridingProvince,
        email: mp.email,
        photoUrl: mp.photoUrl,
        metadata: mp.metadata,
      },
      stats: {
        totalVotes: Number(stats?.totalVotes ?? 0),
        yesVotes: Number(stats?.yesVotes ?? 0),
        noVotes: Number(stats?.noVotes ?? 0),
        absentVotes: Number(stats?.absentVotes ?? 0),
      },
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
