import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { parliamentSyncLog, federalMps, federalVotes, federalBills } from '@/lib/db/schema'
import { eq, desc, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = getDb()

  const [lastSync] = await db
    .select({
      syncType: parliamentSyncLog.syncType,
      startedAt: parliamentSyncLog.startedAt,
      completedAt: parliamentSyncLog.completedAt,
      recordsFetched: parliamentSyncLog.recordsFetched,
      recordsUpserted: parliamentSyncLog.recordsUpserted,
      durationMs: parliamentSyncLog.durationMs,
      errors: parliamentSyncLog.errors,
    })
    .from(parliamentSyncLog)
    .orderBy(desc(parliamentSyncLog.startedAt))
    .limit(1)

  const [counts] = await db
    .select({
      totalMps: sql<number>`(select count(*) from federal_mps where active = true)`,
      totalVotes: sql<number>`(select count(*) from federal_votes)`,
      totalBills: sql<number>`(select count(*) from federal_bills)`,
    })
    .from(sql`(select 1) as _`)

  return new Response(
    JSON.stringify({
      lastSync: lastSync ?? null,
      counts: {
        totalMps: Number(counts?.totalMps ?? 0),
        totalVotes: Number(counts?.totalVotes ?? 0),
        totalBills: Number(counts?.totalBills ?? 0),
      },
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}
