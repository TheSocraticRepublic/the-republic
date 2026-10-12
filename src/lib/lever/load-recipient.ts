import 'server-only'
import { and, eq } from 'drizzle-orm'
import type { getDb } from '@/lib/db'
import { investigations, jurisdictions } from '@/lib/db/schema'
import {
  resolveInvestigationProvince,
  resolveRecipient,
  type InvestigationJurisdictionSource,
  type ProvinceId,
  type RecipientResolution,
} from '@/lib/lever/public-body'

type Db = ReturnType<typeof getDb>

/**
 * The investigation fields the recipient resolver reads, for the action's own
 * investigation, owned by the same user. The same query the generation route
 * runs (its resolved jurisdiction's province, then its name and concern for
 * keyword detection), so every reader resolves a letter's province alike.
 */
export async function loadInvestigationJurisdiction(
  db: Db,
  investigationId: string | null,
  userId: string
): Promise<InvestigationJurisdictionSource | null> {
  if (!investigationId) return null
  const [row] = await db
    .select({
      concern: investigations.concern,
      jurisdictionName: investigations.jurisdictionName,
      province: jurisdictions.province,
    })
    .from(investigations)
    .leftJoin(jurisdictions, eq(jurisdictions.id, investigations.jurisdictionId))
    .where(and(eq(investigations.id, investigationId), eq(investigations.userId, userId)))
    .limit(1)
  return row ?? null
}

/** The resolver's answer for a stored action (filings design §3). */
export async function loadRecipientResolution(
  db: Db,
  action: { metadata: unknown; investigationId: string | null },
  userId: string
): Promise<RecipientResolution> {
  const investigation = await loadInvestigationJurisdiction(db, action.investigationId, userId)
  return resolveRecipient({ metadata: action.metadata, investigation })
}

/**
 * The investigation's province alone, for the Lever page: the viewer
 * re-resolves on the client as the citizen chooses a province, and it needs
 * nothing of the investigation but this.
 */
export async function loadInvestigationProvince(
  db: Db,
  investigationId: string | null,
  userId: string
): Promise<ProvinceId | null> {
  return resolveInvestigationProvince(await loadInvestigationJurisdiction(db, investigationId, userId))
}
