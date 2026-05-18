import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { parliamentSyncLog, credentialEvents } from '@/lib/db/schema'
import { syncParliamentData } from '@/lib/parliament/sync'
import { eq, sql } from 'drizzle-orm'
import { MODERATION_THRESHOLD } from '@/lib/credentials'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { success } = await checkRateLimit(`parliament-sync:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Gate: only users with sufficient credential weight can trigger sync
  const db = getDb()
  const [weightResult] = await db
    .select({ total: sql<number>`COALESCE(SUM(${credentialEvents.weight}), 0)` })
    .from(credentialEvents)
    .where(eq(credentialEvents.userId, userId))

  if ((weightResult?.total ?? 0) < MODERATION_THRESHOLD) {
    return new Response(
      JSON.stringify({ error: 'Insufficient credential weight to trigger sync' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
  }

  let body: { session?: string } = {}
  try {
    body = await request.json()
  } catch {
    // No body is fine — use defaults
  }

  const session = body.session || '45-1'
  const startedAt = new Date()

  try {
    const result = await syncParliamentData(session)
    const completedAt = new Date()
    const durationMs = completedAt.getTime() - startedAt.getTime()

    const totalFetched =
      result.mps.fetched + result.bills.fetched + result.votes.fetched + result.ballots.fetched
    const totalUpserted =
      result.mps.upserted + result.bills.upserted + result.votes.upserted + result.ballots.upserted

    await db.insert(parliamentSyncLog).values({
      syncType: 'full',
      session,
      recordsFetched: totalFetched,
      recordsUpserted: totalUpserted,
      errors: result.errors.length > 0 ? result.errors : null,
      durationMs,
      startedAt,
      completedAt,
    })

    return new Response(JSON.stringify({ result }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const completedAt = new Date()
    const durationMs = completedAt.getTime() - startedAt.getTime()

    await db
      .insert(parliamentSyncLog)
      .values({
        syncType: 'full',
        session,
        recordsFetched: 0,
        recordsUpserted: 0,
        errors: [err instanceof Error ? err.message : String(err)],
        durationMs,
        startedAt,
        completedAt,
      })
      .catch(() => {})

    console.error('[parliament/sync] Sync failed:', err)
    return new Response(
      JSON.stringify({ error: 'Sync failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
