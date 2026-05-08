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
  } catch (err: unknown) {
    const e = err as Record<string, unknown>
    return NextResponse.json(
      {
        error: e?.message ?? 'Unknown',
        code: e?.code,
        errno: e?.errno,
        severity: e?.severity,
        detail: e?.detail,
        routine: e?.routine,
        cause: e?.cause ? String(e.cause) : undefined,
        name: e?.name,
        stack: String(e?.stack ?? '').split('\n').slice(0, 5),
      },
      { status: 500 }
    )
  }
}
