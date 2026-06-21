import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { users, magicCodes } from '@/lib/db/schema'
import { AUTH_COOKIE } from '@/lib/auth/middleware'
import { checkTightRateLimit } from '@/lib/rate-limit'
import { safeRoute } from '@/lib/api/safe-route'

// Self-service account deletion (PIPEDA right-to-deletion).
// Deleting the user row cascades to everything tied to the account:
// investigations, documents, gadfly sessions, lever actions, credentials,
// forum posts/threads, archive_record rows, and the profile. Public content
// already pinned to IPFS / written to Arweave is immutable and is not affected
// by removing our database pointer to it.
export const DELETE = safeRoute(async (request: NextRequest) => {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { success } = await checkTightRateLimit(`account-delete:${userId}`)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const db = getDb()

  // Fetch email before deletion so we can clean up magic_codes orphans.
  // magic_codes has no userId FK — only email — so cascade doesn't reach it.
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  await db.delete(users).where(eq(users.id, userId))

  // Delete any remaining magic_code rows for this email (orphaned PII).
  if (user) {
    await db.delete(magicCodes).where(eq(magicCodes.email, user.email))
  }

  const response = NextResponse.json({ ok: true })
  // Clear the session cookie — the account it pointed to no longer exists.
  response.cookies.set(AUTH_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
  return response
})
