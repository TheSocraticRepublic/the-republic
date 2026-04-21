import { getDb } from '@/lib/db'
import { credentialEvents } from '@/lib/db/schema'
import { eq, sum, sql } from 'drizzle-orm'
import { computeEffectiveWeight, MODERATION_THRESHOLD } from '@/lib/credentials'

export async function checkModeratorAccess(
  userId: string
): Promise<{ isModerator: boolean; effectiveWeight: number }> {
  const db = getDb()
  const [weightRow, lastRow] = await Promise.all([
    db
      .select({ total: sum(credentialEvents.weight) })
      .from(credentialEvents)
      .where(eq(credentialEvents.userId, userId)),
    db
      .select({ last: sql<string>`MAX(created_at)` })
      .from(credentialEvents)
      .where(eq(credentialEvents.userId, userId)),
  ])
  const raw = Number(weightRow[0]?.total ?? 0)
  const lastStr = lastRow[0]?.last ?? null
  const lastAt = lastStr ? new Date(lastStr) : null
  const effective = computeEffectiveWeight(raw, lastAt)
  return { isModerator: effective >= MODERATION_THRESHOLD, effectiveWeight: effective }
}
