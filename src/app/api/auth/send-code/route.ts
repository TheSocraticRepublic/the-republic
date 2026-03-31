import { NextRequest, NextResponse } from 'next/server'
import { createMagicCode } from '@/lib/auth/magic-code'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
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

  const code = createMagicCode(email)

  // In production: send via email (Resend, SES, etc.)
  console.log(`[AUTH] Magic code for ${email}: ${code}`)

  // Dev mode: return code in response so it shows on screen
  const isDev = process.env.NODE_ENV === 'development'
  return NextResponse.json({ ok: true, ...(isDev && { code }) })
}
