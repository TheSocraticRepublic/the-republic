import 'server-only'
import { randomInt, createHash } from 'crypto'
import { getDb } from '@/lib/db'
import { magicCodes } from '@/lib/db/schema'
import { eq, and, gt, lt, isNull, sql } from 'drizzle-orm'
import { sendMagicCodeEmail } from '@/lib/email'

const CODE_TTL_MINUTES = 10
const MAX_CODES_PER_HOUR = 5
const MAX_VERIFY_ATTEMPTS = 5

function generateCode(): string {
  return String(randomInt(10000000, 99999999))
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

const DEDUP_WINDOW_MS = 30_000

export async function sendMagicCode(email: string): Promise<void> {
  const normalized = email.toLowerCase().trim()
  const db = getDb()

  // Wrap the entire send sequence in a transaction to prevent race conditions.
  // Two concurrent requests for the same email could both pass the dedup check
  // and issue two codes without the atomic boundary. The transaction returns the
  // plaintext code so we can send the email AFTER commit (holding the lock for
  // an email API round-trip would be wasteful and risks transaction timeout).
  //
  // Returns the plaintext code if a new code was issued; null if dedup skipped.
  const plainCode = await db.transaction(async (tx) => {
    const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_MS)
    const existing = await tx
      .select({ id: magicCodes.id })
      .from(magicCodes)
      .where(
        and(
          eq(magicCodes.email, normalized),
          isNull(magicCodes.usedAt),
          gt(magicCodes.createdAt, dedupCutoff),
          gt(magicCodes.expiresAt, new Date())
        )
      )
      .limit(1)

    if (existing.length > 0) return null

    const expiryCutoff = new Date(Date.now() - CODE_TTL_MINUTES * 60_000)
    await tx
      .delete(magicCodes)
      .where(
        and(
          eq(magicCodes.email, normalized),
          lt(magicCodes.expiresAt, expiryCutoff)
        )
      )

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const recentCodes = await tx
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

    await tx
      .update(magicCodes)
      .set({ usedAt: new Date() })
      .where(and(eq(magicCodes.email, normalized), isNull(magicCodes.usedAt)))

    const code = generateCode()
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000)

    await tx.insert(magicCodes).values({
      email: normalized,
      code: hashCode(code),
      expiresAt,
    })

    return code
  })

  // Send email after the transaction has committed. If dedup skipped, plainCode
  // is null and we do nothing (the previous code is still valid).
  if (plainCode) {
    await sendMagicCodeEmail(normalized, plainCode)
  }
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
