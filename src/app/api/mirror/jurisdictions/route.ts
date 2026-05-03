import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getDb } from '@/lib/db'
import { jurisdictions } from '@/lib/db/schema'
import { asc } from 'drizzle-orm'

// Public endpoint — no auth required
export async function GET(_request: NextRequest) {
  const ip = _request.headers.get('x-forwarded-for') ?? 'unknown'
  const { success } = await checkRateLimit(`mirror-jurisdictions:${ip}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = getDb()

  const rows = await db
    .select({
      id: jurisdictions.id,
      name: jurisdictions.name,
      country: jurisdictions.country,
      province: jurisdictions.province,
      municipalType: jurisdictions.municipalType,
      population: jurisdictions.population,
      dataPortalUrl: jurisdictions.dataPortalUrl,
    })
    .from(jurisdictions)
    .orderBy(asc(jurisdictions.country), asc(jurisdictions.province), asc(jurisdictions.name))

  return NextResponse.json({ jurisdictions: rows })
}
