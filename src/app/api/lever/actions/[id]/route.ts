import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import {
  leverActions,
  investigationOutcomes,
  credentialEvents,
} from '@/lib/db/schema'
import { eq, and, sql, type SQL } from 'drizzle-orm'
import { CREDENTIAL_WEIGHTS } from '@/lib/credentials'
import { checkRateLimit } from '@/lib/rate-limit'
import { safeRoute } from '@/lib/api/safe-route'
import { parseLetter } from '@/lib/lever/letter-blocks'

/** PATCH refuses content longer than this (UTF-16 code units, JS string length) with 413. */
const MAX_CONTENT_LENGTH = 100_000
const SHA256_HEX = /^[0-9a-f]{64}$/

const NOT_A_DRAFT = 'This letter is no longer a draft'
const CONTENT_CHANGED = 'This letter changed since you opened it'
const STATUS_CHANGED = "This letter's status changed since you opened it. Reload to see it."
const UNCLEAN_SPLIT = "Remove the notes that aren't part of your request before you finalise."

/** SHA-256 of the stored content as lowercase hex, computed in the database over its UTF-8 bytes. */
const storedContentSha256 = sql<string>`encode(sha256(convert_to(${leverActions.content}, 'UTF8')), 'hex')`

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/lever/actions/[id]
 * Fetch a single lever action with full content.
 */
export const GET = safeRoute(async function GET(request: NextRequest, { params }: RouteContext) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { success } = await checkRateLimit(`lever-action:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { id } = await params
  const db = getDb()

  const [action] = await db
    .select()
    .from(leverActions)
    .where(and(eq(leverActions.id, id), eq(leverActions.userId, userId)))
    .limit(1)

  if (!action) {
    return NextResponse.json({ error: 'Action not found' }, { status: 404 })
  }

  return NextResponse.json({ action })
})

/**
 * PATCH /api/lever/actions/[id]
 * Update action status (draft → final → filed) or edit content.
 *
 * Every write is one compare-and-set UPDATE (filings design §4), so "final
 * and filed content can't be edited" holds at write time, not just at read:
 *   - a content edit lands only while the row is still the caller's draft;
 *   - a status change lands only from the status it was read in;
 *   - with `expectedContentSha256` (hex SHA-256 of the content string exactly
 *     as the API returned it), only if the stored content still hashes to it;
 *   - finalising is also bound to the exact text checked for a clean split.
 * No row updated → 409, with the reason. Content over 100,000 characters → 413.
 *
 * When status transitions to 'filed', and only when this request's UPDATE
 * returned the row (so a double "file" runs them once):
 *   - Records filedAt timestamp in metadata
 *   - Auto-creates investigation outcome (if investigationId present)
 *   - Awards foi_filed credential for FIPPA requests (with dedup)
 *
 * PATCH never writes `letterFormat`; only generation does.
 */
export const PATCH = safeRoute(async function PATCH(request: NextRequest, { params }: RouteContext) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { success } = await checkRateLimit(`lever-action:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { id } = await params

  let body: { status?: 'draft' | 'final' | 'filed'; content?: unknown; expectedContentSha256?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { status, content, expectedContentSha256 } = body ?? {}

  if (!status && content === undefined) {
    return NextResponse.json(
      { error: 'At least one of status or content is required' },
      { status: 400 }
    )
  }
  if (content !== undefined && typeof content !== 'string') {
    return NextResponse.json({ error: 'content must be a string' }, { status: 400 })
  }
  if (
    expectedContentSha256 !== undefined &&
    (typeof expectedContentSha256 !== 'string' || !SHA256_HEX.test(expectedContentSha256))
  ) {
    return NextResponse.json(
      { error: 'expectedContentSha256 must be a lowercase hex SHA-256' },
      { status: 400 }
    )
  }
  if (typeof content === 'string' && content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: 'This letter is too long to save. Keep it under 100,000 characters.' },
      { status: 413 }
    )
  }

  const db = getDb()

  // Fetch existing action with full data for filing logic
  const [existing] = await db
    .select()
    .from(leverActions)
    .where(and(eq(leverActions.id, id), eq(leverActions.userId, userId)))
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: 'Action not found' }, { status: 404 })
  }

  // Block content edits on non-draft actions (content already filed/finalized)
  if (content !== undefined && existing.status !== 'draft') {
    return NextResponse.json({ error: NOT_A_DRAFT }, { status: 409 })
  }

  // Validate status transitions: draft→final, final→filed only
  const statusChange = !!status && status !== existing.status
  if (statusChange) {
    const VALID_TRANSITIONS: Record<string, string> = {
      draft: 'final',
      final: 'filed',
    }
    if (VALID_TRANSITIONS[existing.status] !== status) {
      return NextResponse.json(
        { error: `Invalid status transition: ${existing.status} → ${status}` },
        { status: 409 }
      )
    }
  }

  const existingMetadata = (existing.metadata ?? {}) as Record<string, unknown>

  // Finalising needs a clean split: a marker-v1 letter whose split is 'none'
  // or 'ambiguous' still has notes inside it (filings design §4).
  const isFinalising = statusChange && status === 'final'
  if (isFinalising) {
    const finalText = typeof content === 'string' ? content : existing.content
    if (existingMetadata.letterFormat === 'marker-v1') {
      const { split } = parseLetter(finalText, existingMetadata.letterFormat)
      if (split !== 'marker') {
        return NextResponse.json({ error: UNCLEAN_SPLIT }, { status: 409 })
      }
    }
  }

  // Detect transition to 'filed'
  const isFilingTransition = statusChange && status === 'filed'

  // The compare-and-set. The row must still be in the status it was read in:
  // a content edit requires 'draft' (checked above, so fromStatus is 'draft'),
  // a status change requires its from-state.
  const fromStatus = existing.status
  const conditions: SQL[] = [
    eq(leverActions.id, id),
    eq(leverActions.userId, userId),
    eq(leverActions.status, content !== undefined ? 'draft' : fromStatus),
  ]
  if (typeof expectedContentSha256 === 'string') {
    conditions.push(sql`${storedContentSha256} = ${expectedContentSha256}`)
  } else if (isFinalising) {
    // No client hash: bind the finalise to the exact text checked above.
    conditions.push(eq(leverActions.content, existing.content))
  }

  const updates: Partial<{
    status: 'draft' | 'final' | 'filed'
    content: string
    metadata: SQL
    updatedAt: Date
  }> = {
    updatedAt: new Date(),
  }
  if (status) updates.status = status
  if (typeof content === 'string') updates.content = content

  // Store filedAt timestamp when filing, merged into the stored metadata
  if (isFilingTransition) {
    updates.metadata = sql`coalesce(${leverActions.metadata}, '{}'::jsonb) || ${JSON.stringify({
      filedAt: new Date().toISOString(),
    })}::jsonb`
  }

  const [updated] = await db
    .update(leverActions)
    .set(updates)
    .where(and(...conditions))
    .returning({
      id: leverActions.id,
      status: leverActions.status,
      updatedAt: leverActions.updatedAt,
    })

  if (!updated) {
    // Lost the compare-and-set. Say which precondition no longer holds.
    const [current] = await db
      .select({ status: leverActions.status })
      .from(leverActions)
      .where(and(eq(leverActions.id, id), eq(leverActions.userId, userId)))
      .limit(1)
    if (!current) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 })
    }
    const requiredStatus = content !== undefined ? 'draft' : fromStatus
    const error =
      current.status === requiredStatus
        ? CONTENT_CHANGED
        : requiredStatus === 'draft'
          ? NOT_A_DRAFT
          : STATUS_CHANGED
    return NextResponse.json({ error }, { status: 409 })
  }

  // Post-filing side effects (non-blocking — update already returned).
  // Reached only when this request's UPDATE returned the row.
  if (isFilingTransition && existing.investigationId) {
    try {
      await db.transaction(async (tx) => {
        // Auto-create outcome based on action type
        const outcomeMap: Record<
          string,
          { type: (typeof investigationOutcomes.$inferInsert)['outcomeType']; description: string }
        > = {
          fippa_request: {
            type: 'fippa_response_received',
            description: 'FOI request filed — awaiting response',
          },
          public_comment: {
            type: 'comment_submitted',
            description: 'Public comment submitted',
          },
        }

        const outcomeSpec = outcomeMap[existing.actionType]
        if (outcomeSpec) {
          await tx.insert(investigationOutcomes).values({
            investigationId: existing.investigationId!,
            userId,
            outcomeType: outcomeSpec.type,
            description: outcomeSpec.description,
          })
        }

        // Award foi_filed credential for FIPPA requests (dedup by actionId)
        if (existing.actionType === 'fippa_request') {
          const [existingCredential] = await tx
            .select({ id: credentialEvents.id })
            .from(credentialEvents)
            .where(
              and(
                eq(credentialEvents.userId, userId),
                eq(credentialEvents.credentialType, 'foi_filed'),
                eq(credentialEvents.sourceId, id),
                eq(credentialEvents.sourceType, 'lever_action'),
              )
            )
            .limit(1)

          if (!existingCredential) {
            // Application-level dedup via SELECT above; onConflictDoNothing is
            // defense-in-depth against concurrent PATCH requests (TOCTOU).
            await tx.insert(credentialEvents).values({
              userId,
              credentialType: 'foi_filed',
              weight: CREDENTIAL_WEIGHTS.foi_filed,
              sourceId: id,
              sourceType: 'lever_action',
            }).onConflictDoNothing()
          }
        }
      })
    } catch (err) {
      // Log but don't fail the PATCH — the status update itself succeeded
      console.error('[lever/actions] Post-filing side effects failed:', err)
    }
  }

  return NextResponse.json({ action: updated })
})
