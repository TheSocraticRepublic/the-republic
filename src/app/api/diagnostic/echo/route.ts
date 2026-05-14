import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  const traceId = randomUUID().slice(0, 8)
  const t0 = Date.now()
  const nfReqId = request.headers.get('x-nf-request-id') ?? 'none'
  const body = await request.json().catch(() => ({}))

  console.log(`[diagnostic:${traceId}] ECHO nf-req=${nfReqId} body=${JSON.stringify(body)} t=${Date.now() - t0}ms`)

  return NextResponse.json({
    ok: true,
    _trace: traceId,
    _ms: Date.now() - t0,
    _nfReqId: nfReqId,
    _ts: new Date().toISOString(),
  })
}

export async function GET() {
  return NextResponse.json({ status: 'diagnostic endpoint alive' })
}
