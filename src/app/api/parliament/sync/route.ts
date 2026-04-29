import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { parliamentSyncLog } from '@/lib/db/schema'
import { syncParliamentData } from '@/lib/parliament/sync'

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { session?: string } = {}
  try {
    body = await request.json()
  } catch {
    // No body is fine — use defaults
  }

  const session = body.session || '45-1'
  const startedAt = new Date()

  const db = getDb()

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
      JSON.stringify({
        error: 'Sync failed',
        message: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
