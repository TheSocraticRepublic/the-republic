import { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getDb } from '@/lib/db'
import { federalVotes } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'
import { safeRoute } from '@/lib/api/safe-route'

export const GET = safeRoute(async (request: NextRequest) => {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { success } = await checkRateLimit(`parliament-votes:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const page = parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10)
  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get('limit') ?? '20', 10),
    50
  )
  const offset = (page - 1) * limit

  const db = getDb()

  const votes = await db
    .select({
      id: federalVotes.id,
      session: federalVotes.session,
      number: federalVotes.number,
      date: federalVotes.date,
      descriptionEn: federalVotes.descriptionEn,
      result: federalVotes.result,
      yeaTotal: federalVotes.yeaTotal,
      nayTotal: federalVotes.nayTotal,
      billId: federalVotes.billId,
    })
    .from(federalVotes)
    .orderBy(desc(federalVotes.date), desc(federalVotes.number))
    .limit(limit + 1)
    .offset(offset)

  const hasMore = votes.length > limit

  return new Response(
    JSON.stringify({ votes: votes.slice(0, limit), hasMore }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
