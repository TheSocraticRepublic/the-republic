import 'server-only'
import { randomInt, createHash } from 'crypto'
import { getDb } from '@/lib/db'
import { magicCodes } from '@/lib/db/schema'
import { eq, and, gt, lt, isNull, sql } from 'drizzle-orm'
import { sendMagicCodeEmail } from '@/lib/email'

const CODE_TTL_MINUTES = 10
const MAX_CODES_PER_HOUR = 10
const MAX_VERIFY_ATTEMPTS = 5

function generateCode(): string {
  return String(randomInt(10000000, 99999999))
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

export async function sendMagicCode(email: string): Promise<void> {
  const normalized = email.toLowerCase().trim()
  const db = getDb()

  // If there's already an unused, unexpired code created in the last 30 seconds,
  // this is a Netlify retry — skip silently
  const thirtySecondsAgo = new Date(Date.now() - 30_000)
  const recentUnused = await db
    .select({ id: magicCodes.id })
    .from(magicCodes)
    .where(
      and(
        eq(magicCodes.email, normalized),
        isNull(magicCodes.usedAt),
        gt(magicCodes.expiresAt, new Date()),
        gt(magicCodes.createdAt, thirtySecondsAgo)
      )
    )
    .limit(1)

  if (recentUnused.length > 0) {
    return
  }

  const expiryCutoff = new Date(Date.now() - CODE_TTL_MINUTES * 60_000)
  await db
    .delete(magicCodes)
    .where(
      and(
        eq(magicCodes.email, normalized),
        lt(magicCodes.expiresAt, expiryCutoff)
      )
    )

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recentCodes = await db
    .select({ count: sql<number>`count(*)` })
    .from(magicCodes)
    .where(
      and(
        eq(magicCodes.email, normalized),
        gt(magicCodes.createdAt, oneHourAgo)
      )
    )

  if (recentCodes[0].count >= MAX_CODES_PER_HOUR) {
    throw new Error('Too many codes requested. Try again later.')
  }

  await db
    .update(magicCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(magicCodes.email, normalized), isNull(magicCodes.usedAt)))

  const code = generateCode()
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000)

  await db.insert(magicCodes).values({
    email: normalized,
    code: hashCode(code),
    expiresAt,
  })

  await sendMagicCodeEmail(normalized, code)
}

export type VerifyResult =
  | { success: true }
  | { success: false; error: 'expired' | 'invalid' | 'too_many_attempts' }

export async function verifyMagicCode(
  email: string,
  code: string
): Promise<VerifyResult> {
  const normalized = email.toLowerCase().trim()
  const now = new Date()
  const db = getDb()

  const activeCodes = await db
    .select()
    .from(magicCodes)
    .where(
      and(
        eq(magicCodes.email, normalized),
        isNull(magicCodes.usedAt),
        gt(magicCodes.expiresAt, now)
      )
    )
    .limit(1)

  if (activeCodes.length === 0) {
    return { success: false, error: 'invalid' }
  }

  const activeCode = activeCodes[0]

  if (activeCode.attempts >= MAX_VERIFY_ATTEMPTS) {
    return { success: false, error: 'too_many_attempts' }
  }

  if (activeCode.code !== hashCode(code)) {
    await db
      .update(magicCodes)
      .set({ attempts: activeCode.attempts + 1 })
      .where(eq(magicCodes.id, activeCode.id))
    return { success: false, error: 'invalid' }
  }

  await db
    .update(magicCodes)
    .set({ usedAt: now })
    .where(eq(magicCodes.id, activeCode.id))

  return { success: true }
}
