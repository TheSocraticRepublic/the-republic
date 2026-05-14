import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  const traceId = randomUUID().slice(0, 8)
  const t0 = Date.now()
  const nfReqId = request.headers.get('x-nf-request-id') ?? 'none'
  const body = await request.json().catch(() => ({}))
  const testKey = body.key ?? 'default'

  const db = getDb()
  const tDb = Date.now()

  // Insert a row for every invocation — no dedup, no guard
  await db.execute(
    sql`INSERT INTO magic_codes (email, code, expires_at)
        VALUES (${`__diag_${testKey}`}, ${traceId}, now() + interval '1 hour')`
  )
  const tInsert = Date.now()

  // Count total invocations for this key
  const [{ count }] = await db.execute(
    sql`SELECT count(*) as count FROM magic_codes WHERE email = ${`__diag_${testKey}`}`
  ) as [{ count: string }]
  const tCount = Date.now()

  console.log(`[invoke-count:${traceId}] key=${testKey} nf-req=${nfReqId} count=${count} db=${tDb - t0}ms insert=${tInsert - tDb}ms count-query=${tCount - tInsert}ms total=${tCount - t0}ms`)

  return NextResponse.json({
    ok: true,
    _trace: traceId,
    _nfReqId: nfReqId,
    _invocationCount: Number(count),
    _ms: Date.now() - t0,
    _ts: new Date().toISOString(),
  })
}

export async function DELETE() {
  const db = getDb()
  await db.execute(sql`DELETE FROM magic_codes WHERE email LIKE '__diag_%'`)
  return NextResponse.json({ ok: true, cleaned: true })
}
