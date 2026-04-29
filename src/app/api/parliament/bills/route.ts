import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { federalBills, federalMps } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
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

  const bills = await db
    .select({
      id: federalBills.id,
      number: federalBills.number,
      titleEn: federalBills.titleEn,
      session: federalBills.session,
      statusCode: federalBills.statusCode,
      introduced: federalBills.introduced,
      sponsorName: federalMps.name,
    })
    .from(federalBills)
    .leftJoin(federalMps, eq(federalBills.sponsorMpId, federalMps.id))
    .orderBy(desc(federalBills.introduced))
    .limit(limit + 1)
    .offset(offset)

  const hasMore = bills.length > limit

  return new Response(
    JSON.stringify({ bills: bills.slice(0, limit), hasMore }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}
