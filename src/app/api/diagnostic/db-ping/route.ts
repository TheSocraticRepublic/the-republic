import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export async function POST() {
  const traceId = randomUUID().slice(0, 8)
  const t0 = Date.now()

  const db = getDb()
  const tDb = Date.now()
  console.log(`[db-ping:${traceId}] db-ref t=${tDb - t0}ms`)

  const result = await db.execute(sql`SELECT 1 as ping`)
  const tQuery = Date.now()
  console.log(`[db-ping:${traceId}] query done t=${tQuery - t0}ms (query took ${tQuery - tDb}ms)`)

  return NextResponse.json({
    ok: true,
    _trace: traceId,
    _ms: Date.now() - t0,
    _dbMs: tQuery - tDb,
    _ts: new Date().toISOString(),
    _ping: result,
  })
}
