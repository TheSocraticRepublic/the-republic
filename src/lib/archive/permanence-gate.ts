import { getDb } from '@/lib/db'
import {
  investigations,
  credentialEvents,
  peerReviews,
} from '@/lib/db/schema'
import { eq, sum, sql } from 'drizzle-orm'
import { computeEffectiveWeight, MODERATION_THRESHOLD } from '@/lib/credentials'
import { checkModeratorAccess } from '@/lib/credentials/check-moderator'

/**
 * Check whether an investigation is eligible for Arweave permanence.
 *
 * An investigation qualifies under ANY of three independent criteria:
 *
 * (a) The investigation author's effective credential weight >= 5.
 *     Effective weight accounts for decay, so prolific but inactive users
 *     do not automatically grant permanence to old investigations.
 *
 * (b) The investigation has >= 2 peer reviews whose average factualAccuracy >= 3.
 *     Two reviewers agreeing on baseline accuracy is the minimum peer signal.
 *
 * (c) The requesting user has moderator access (effective weight >= MODERATION_THRESHOLD).
 *     Moderators can escalate any archived investigation to permanent storage.
 *
 * Returns { eligible: true, reason: <qualifying criterion> } on success,
 * or { eligible: false, reason: <explanation> } when none of the criteria are met.
 */
export async function checkPermanenceEligibility(
  investigationId: string,
  requestingUserId: string,
  db: ReturnType<typeof getDb>
): Promise<{ eligible: boolean; reason: string }> {
  // Criterion (c): moderator override — checked first as it's cheapest and most common
  // for admin workflows. checkModeratorAccess fetches its own db connection internally.
  const { isModerator } = await checkModeratorAccess(requestingUserId)
  if (isModerator) {
    return { eligible: true, reason: 'Moderator override' }
  }

  // Fetch the investigation author
  const [inv] = await db
    .select({ userId: investigations.userId })
    .from(investigations)
    .where(eq(investigations.id, investigationId))
    .limit(1)

  if (!inv) {
    return { eligible: false, reason: 'Investigation not found' }
  }

  // Criterion (a): Author's effective credential weight >= 5
  const authorId = inv.userId

  const [weightRow, lastRow] = await Promise.all([
    db
      .select({ total: sum(credentialEvents.weight) })
      .from(credentialEvents)
      .where(eq(credentialEvents.userId, authorId)),
    db
      .select({ last: sql<string>`MAX(created_at)` })
      .from(credentialEvents)
      .where(eq(credentialEvents.userId, authorId)),
  ])

  const rawWeight = Number(weightRow[0]?.total ?? 0)
  const lastStr = lastRow[0]?.last ?? null
  const lastAt = lastStr ? new Date(lastStr) : null
  const authorEffectiveWeight = computeEffectiveWeight(rawWeight, lastAt)

  if (authorEffectiveWeight >= 5) {
    return { eligible: true, reason: 'Author credential weight >= 5' }
  }

  // Criterion (b): >= 2 peer reviews with average factualAccuracy >= 3
  const reviews = await db
    .select({ factualAccuracy: peerReviews.factualAccuracy })
    .from(peerReviews)
    .where(eq(peerReviews.investigationId, investigationId))

  if (reviews.length >= 2) {
    const totalAccuracy = reviews.reduce((sum, r) => sum + r.factualAccuracy, 0)
    const avgAccuracy = totalAccuracy / reviews.length

    if (avgAccuracy >= 3) {
      return {
        eligible: true,
        reason: '2+ peer reviews with avg accuracy >= 3',
      }
    }

    return {
      eligible: false,
      reason: `${reviews.length} peer reviews found but average factualAccuracy (${avgAccuracy.toFixed(2)}) is below 3.0`,
    }
  }

  // Detailed failure reasons for debugging and user feedback
  if (reviews.length === 1) {
    return {
      eligible: false,
      reason: `Only 1 peer review found (minimum 2 required). Author credential weight (${authorEffectiveWeight}) is below 5.`,
    }
  }

  return {
    eligible: false,
    reason: `No peer reviews found. Author credential weight (${authorEffectiveWeight}) is below 5.`,
  }
}
