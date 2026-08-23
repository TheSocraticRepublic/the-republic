import { NextRequest, NextResponse } from 'next/server'
import { sendMagicCode } from '@/lib/auth/magic-code'
import { checkRateLimit, checkGlobalSendCodeLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/api/ip'
import { checkCsrfOrigin } from '@/lib/api/csrf'
import { safeRoute } from '@/lib/api/safe-route'

export const POST = safeRoute(async function POST(request: NextRequest) {
  try {
    const csrfReject = checkCsrfOrigin(request)
    if (csrfReject) return csrfReject

    const ip = getClientIp(request)
    const { success } = await checkRateLimit(`send-code:${ip}`)

    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Wait before requesting another code.' },
        { status: 429 }
      )
    }

    // SEC-1: global backstop, independent of IP — bounds total send-code
    // volume even if an attacker defeats the per-IP limit above by rotating
    // source IPs across the fleet.
    const { success: globalOk } = await checkGlobalSendCodeLimit()
    if (!globalOk) {
      return NextResponse.json(
        { error: 'Too many requests. Wait before requesting another code.' },
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
})
