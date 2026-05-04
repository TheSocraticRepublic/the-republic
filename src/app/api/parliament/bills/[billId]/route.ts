import { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getDb } from '@/lib/db'
import { federalBills, federalVotes, federalMps } from '@/lib/db/schema'
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

  const { success } = await checkRateLimit(`parliament-bill:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { billId } = await params
  const db = getDb()

  const [bill] = await db
    .select({
      id: federalBills.id,
      number: federalBills.number,
      titleEn: federalBills.titleEn,
      titleFr: federalBills.titleFr,
      shortTitleEn: federalBills.shortTitleEn,
      session: federalBills.session,
      statusCode: federalBills.statusCode,
      introduced: federalBills.introduced,
      isLaw: federalBills.isLaw,
      legisInfoUrl: federalBills.legisInfoUrl,
      aiSummary: federalBills.aiSummary,
      metadata: federalBills.metadata,
      sponsorName: federalMps.name,
      sponsorParty: federalMps.party,
      sponsorMpId: federalMps.id,
    })
    .from(federalBills)
    .leftJoin(federalMps, eq(federalBills.sponsorMpId, federalMps.id))
    .where(eq(federalBills.id, billId))
    .limit(1)

  if (!bill) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

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
    })
    .from(federalVotes)
    .where(eq(federalVotes.billId, billId))
    .orderBy(desc(federalVotes.date))

  return new Response(JSON.stringify({ bill, votes }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
