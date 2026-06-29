import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getDb } from '@/lib/db'
import { jurisdictions } from '@/lib/db/schema'
import { asc } from 'drizzle-orm'
import { getClientIp } from '@/lib/api/ip'
import { safeRoute } from '@/lib/api/safe-route'

// Public endpoint — no auth required
export const GET = safeRoute(async function handler(_request: NextRequest) {
  const ip = getClientIp(_request)
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
})
