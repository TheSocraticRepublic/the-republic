import { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getDb } from '@/lib/db'
import { federalMps, federalMpBallots, federalVotes } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
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

  const { success } = await checkRateLimit(`parliament-mp-votes:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { mpId } = await params
  const page = parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10)
  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get('limit') ?? '20', 10),
    50
  )
  const offset = (page - 1) * limit

  const db = getDb()

  const [mp] = await db
    .select({ id: federalMps.id })
    .from(federalMps)
    .where(eq(federalMps.id, mpId))
    .limit(1)

  if (!mp) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const ballots = await db
    .select({
      voteId: federalVotes.id,
      session: federalVotes.session,
      number: federalVotes.number,
      date: federalVotes.date,
      descriptionEn: federalVotes.descriptionEn,
      result: federalVotes.result,
      ballot: federalMpBallots.ballot,
    })
    .from(federalMpBallots)
    .innerJoin(federalVotes, eq(federalMpBallots.voteId, federalVotes.id))
    .where(eq(federalMpBallots.mpId, mpId))
    .orderBy(desc(federalVotes.date), desc(federalVotes.number))
    .limit(limit + 1)
    .offset(offset)

  const hasMore = ballots.length > limit
  const votes = ballots.slice(0, limit)

  return new Response(
    JSON.stringify({ votes, hasMore }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
