import { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getDb } from '@/lib/db'
import { federalMps } from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { safeRoute } from '@/lib/api/safe-route'

export const GET = safeRoute(async (request: NextRequest) => {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { success } = await checkRateLimit(`parliament-mps:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = getDb()
  const party = request.nextUrl.searchParams.get('party')
  const province = request.nextUrl.searchParams.get('province')

  const conditions = [eq(federalMps.active, true)]
  if (party) conditions.push(eq(federalMps.party, party))
  if (province) conditions.push(eq(federalMps.ridingProvince, province))

  const mps = await db
    .select({
      id: federalMps.id,
      name: federalMps.name,
      party: federalMps.party,
      ridingName: federalMps.ridingName,
      ridingProvince: federalMps.ridingProvince,
      photoUrl: federalMps.photoUrl,
    })
    .from(federalMps)
    .where(and(...conditions))
    .orderBy(asc(federalMps.name))

  return new Response(JSON.stringify({ mps }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
