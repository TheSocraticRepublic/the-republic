import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { archiveRecords, investigations, jurisdictions, userProfiles } from '@/lib/db/schema'
import { eq, and, gte, lte, count, desc } from 'drizzle-orm'
import { checkRateLimit } from '@/lib/rate-limit'

const PAGE_SIZE = 50

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { success } = await checkRateLimit(`archive-list:${ip}`)
  if (!success) return new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429, headers: { 'Content-Type': 'application/json' } })

  const { searchParams } = new URL(request.url)

  const rawPage = parseInt(searchParams.get('page') ?? '1', 10)
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1

  const jurisdictionId = searchParams.get('jurisdictionId')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  const db = getDb()

  // Build WHERE conditions
  const conditions = []

  if (jurisdictionId) {
    conditions.push(eq(investigations.jurisdictionId, jurisdictionId))
  }

  if (dateFrom) {
    const from = new Date(dateFrom)
    if (!isNaN(from.getTime())) {
      conditions.push(gte(archiveRecords.preservedAt, from))
    }
  }

  if (dateTo) {
    const to = new Date(dateTo)
    if (!isNaN(to.getTime())) {
      conditions.push(lte(archiveRecords.preservedAt, to))
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const offset = (page - 1) * PAGE_SIZE

  const [archives, totalResult] = await Promise.all([
    db
      .select({
        id: archiveRecords.id,
        investigationId: archiveRecords.investigationId,
        // userId is intentionally omitted — this is a public endpoint
        archivedBy: userProfiles.displayName,
        archiveStatus: archiveRecords.archiveStatus,
        ipfsCid: archiveRecords.ipfsCid,
        contentHash: archiveRecords.contentHash,
        preservedAt: archiveRecords.preservedAt,
        createdAt: archiveRecords.createdAt,
        // From investigations
        concern: investigations.concern,
        concernCategory: investigations.concernCategory,
        jurisdictionId: investigations.jurisdictionId,
        jurisdictionName: investigations.jurisdictionName,
      })
      .from(archiveRecords)
      .innerJoin(investigations, eq(archiveRecords.investigationId, investigations.id))
      .leftJoin(jurisdictions, eq(investigations.jurisdictionId, jurisdictions.id))
      .leftJoin(userProfiles, eq(archiveRecords.userId, userProfiles.userId))
      .where(whereClause)
      .orderBy(desc(archiveRecords.preservedAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ total: count() })
      .from(archiveRecords)
      .innerJoin(investigations, eq(archiveRecords.investigationId, investigations.id))
      .leftJoin(jurisdictions, eq(investigations.jurisdictionId, jurisdictions.id))
      .where(whereClause),
  ])

  const total = totalResult[0]?.total ?? 0

  return new Response(
    JSON.stringify({
      archives,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}
