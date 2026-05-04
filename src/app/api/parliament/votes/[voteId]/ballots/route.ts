import { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getDb } from '@/lib/db'
import { federalVotes, federalMpBallots, federalMps } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
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

  const { success } = await checkRateLimit(`parliament-ballots:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { voteId } = await params
  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get('limit') ?? '400', 10),
    500
  )

  const db = getDb()

  const [vote] = await db
    .select({ id: federalVotes.id })
    .from(federalVotes)
    .where(eq(federalVotes.id, voteId))
    .limit(1)

  if (!vote) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const ballots = await db
    .select({
      mpId: federalMps.id,
      mpName: federalMps.name,
      party: federalMps.party,
      ridingName: federalMps.ridingName,
      ballot: federalMpBallots.ballot,
    })
    .from(federalMpBallots)
    .innerJoin(federalMps, eq(federalMpBallots.mpId, federalMps.id))
    .where(eq(federalMpBallots.voteId, voteId))
    .orderBy(asc(federalMps.party), asc(federalMps.name))
    .limit(limit)

  return new Response(JSON.stringify({ ballots }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
