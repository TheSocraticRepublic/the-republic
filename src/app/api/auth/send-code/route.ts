import { NextRequest, NextResponse } from 'next/server'
import { sendMagicCode } from '@/lib/auth/magic-code'
import { checkRateLimit } from '@/lib/rate-limit'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  const traceId = randomUUID().slice(0, 8)
  const t0 = Date.now()
  const nfReqId = request.headers.get('x-nf-request-id') ?? 'none'

  console.log(`[send-code:${traceId}] START nf-req=${nfReqId} t=0ms`)

  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'

    const t1 = Date.now()
    const { success } = await checkRateLimit(`send-code:${ip}`)
    console.log(`[send-code:${traceId}] rate-limit done t=${Date.now() - t0}ms (took ${Date.now() - t1}ms)`)

    if (!success) {
      console.log(`[send-code:${traceId}] RATE LIMITED t=${Date.now() - t0}ms`)
      return NextResponse.json(
        { error: 'Too many requests. Please wait before requesting another code.' },
        { status: 429 }
      )
    }

    const t2 = Date.now()
    const body = await request.json().catch(() => null)
    console.log(`[send-code:${traceId}] body parsed t=${Date.now() - t0}ms (took ${Date.now() - t2}ms)`)

    const email = body?.email?.toString().trim().toLowerCase()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    const t3 = Date.now()
    await sendMagicCode(email)
    console.log(`[send-code:${traceId}] sendMagicCode done t=${Date.now() - t0}ms (took ${Date.now() - t3}ms)`)

    console.log(`[send-code:${traceId}] COMPLETE t=${Date.now() - t0}ms`)
    return NextResponse.json({ ok: true, _trace: traceId, _ms: Date.now() - t0 })
  } catch (err) {
    console.error(`[send-code:${traceId}] ERROR t=${Date.now() - t0}ms`, err)
    const message = err instanceof Error ? err.message : 'Failed to send code'

    if (message.includes('Too many codes')) {
      return NextResponse.json({ error: message, _trace: traceId }, { status: 429 })
    }

    return NextResponse.json({ error: 'Internal server error', _trace: traceId }, { status: 500 })
  }
}
