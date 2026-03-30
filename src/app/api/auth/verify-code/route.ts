import { NextRequest, NextResponse } from 'next/server'
import { verifyMagicCode } from '@/lib/auth/magic-code'
import { getDb } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { signJWT } from '@/lib/auth/jwt'
import { eq } from 'drizzle-orm'
import { AUTH_COOKIE } from '@/lib/auth/middleware'

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 // 7 days in seconds

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = body?.email?.toString().trim().toLowerCase()
  const code = body?.code?.toString().trim()

  if (!email || !code) {
    return NextResponse.json(
      { error: 'Email and code are required' },
      { status: 400 }
    )
  }

  const result = verifyMagicCode(email, code)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 401 })
  }

  // Upsert user
  const db = getDb()
  let [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (!user) {
    const [created] = await db
      .insert(users)
      .values({ email })
      .returning({ id: users.id, email: users.email })
    user = created
  } else {
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id))
  }

  const token = await signJWT({ sub: user.id, email: user.email })

  const response = NextResponse.json({ ok: true })
  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })

  return response
}
