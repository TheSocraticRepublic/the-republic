import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { jurisdictions } from '@/lib/db/schema'
import { asc } from 'drizzle-orm'

// Public endpoint — no auth required
export async function GET(_request: NextRequest) {
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
