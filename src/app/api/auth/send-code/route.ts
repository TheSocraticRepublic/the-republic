import { NextRequest, NextResponse } from 'next/server'
import { sendMagicCode } from '@/lib/auth/magic-code'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const { success } = await checkRateLimit(`send-code:${ip}`)

    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before requesting another code.' },
        { status: 429 }
      )
    }

    const body = await request.json().catch(() => null)
    const email = body?.email?.toString().trim().toLowerCase()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    await sendMagicCode(email)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[auth] send-code error:', err)
    const message = err instanceof Error ? err.message : 'Failed to send code'

    if (message.includes('Too many codes')) {
      return NextResponse.json({ error: message }, { status: 429 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
