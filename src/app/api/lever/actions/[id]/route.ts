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
import { isProvinceId } from '@/lib/lever/public-body'
import { createHash } from 'node:crypto'
import {
  NOT_A_DRAFT,
  CONTENT_CHANGED,
  STATUS_CHANGED,
  UNCLEAN_SPLIT,
  UNCLEAN_SPLIT_REPEATED,
  CONFIRM_NO_NOTES,
  EMPTY_LETTER,
} from '@/lib/lever/write-conflicts'

/** PATCH refuses content longer than this (UTF-16 code units, JS string length) with 413. */
const MAX_CONTENT_LENGTH = 100_000
const SHA256_HEX = /^[0-9a-f]{64}$/
/**
 * The largest request body read at all: the content bound at JSON's worst
 * case (six characters per escaped code unit, `\uXXXX`) plus room for the
 * other fields. Anything longer cannot hold valid content.
 */
const MAX_BODY_LENGTH = MAX_CONTENT_LENGTH * 6 + 4096
const TOO_LONG = 'This letter is too long to save. Keep it under 100,000 characters.'


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
 * When status transitions to 'filed', in the same transaction as the status
 * UPDATE and only when it returned the row (so a double "file" runs them once,
 * and a failure rolls the filing back for a retry):
 *   - Records filedAt timestamp in metadata
 *   - Auto-creates investigation outcome (if investigationId present)
 *   - Awards foi_filed credential for FIPPA requests (with dedup)
 *
 * `jurisdiction` (A4) records the province a FIPPA draft goes to, as
 * `metadata.jurisdiction`, on its own (no content or status in the same
 * request), by the same draft compare-and-set: the way forward for a legacy
 * draft whose generation was refused with "Choose the province this request
 * goes to".
 *
 * The 200 body carries the content as stored, so the client re-baselines its
 * hash on exactly what the server holds (§4).
 *
 * `confirmNoNotes: true` (A5, Lee 2026-10-12) lets a finalise through for a
 * marker-v1 letter whose marker line is missing (a parse with split 'none'
 * and no fallback), which is otherwise refused with CONFIRM_NO_NOTES so the
 * citizen can confirm. It lands by the same compare-and-set, in the same
 * transaction, and records `metadata.notesRemovalConfirmedAt`, a time this
 * route takes itself and never from the request. Two markers (worded
 * UNCLEAN_SPLIT_REPEATED) and a fallback parse (UNCLEAN_SPLIT) stay refused
 * whatever the flag says; on any other write the flag is ignored. A blank
 * letter is never finalised (400, EMPTY_LETTER).
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

  // An oversized body is refused before it is parsed: by its declared length
  // when there is one, else by the length of the text read.
  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (declaredLength > MAX_BODY_LENGTH) {
    return NextResponse.json({ error: TOO_LONG }, { status: 413 })
  }
  let body: {
    status?: 'draft' | 'final' | 'filed'
    content?: unknown
    expectedContentSha256?: unknown
    jurisdiction?: unknown
    confirmNoNotes?: unknown
  }
  try {
    const raw = await request.text()
    if (raw.length > MAX_BODY_LENGTH) {
      return NextResponse.json({ error: TOO_LONG }, { status: 413 })
    }
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { status, content, expectedContentSha256, jurisdiction, confirmNoNotes } = body ?? {}

  if (!status && content === undefined && jurisdiction === undefined) {
    return NextResponse.json(
      { error: 'At least one of status, content or jurisdiction is required' },
      { status: 400 }
    )
  }
  if (jurisdiction !== undefined) {
    if (!isProvinceId(jurisdiction)) {
      return NextResponse.json({ error: 'jurisdiction must be one of bc, ab, on' }, { status: 400 })
    }
    if (status || content !== undefined) {
      return NextResponse.json({ error: 'jurisdiction is set on its own' }, { status: 400 })
    }
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
      { error: TOO_LONG },
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
  // and province changes alike: both are draft-only writes.
  const draftWrite = content !== undefined || jurisdiction !== undefined
  if (draftWrite && existing.status !== 'draft') {
    return NextResponse.json({ error: NOT_A_DRAFT }, { status: 409 })
  }
  if (jurisdiction !== undefined && existing.actionType !== 'fippa_request') {
    return NextResponse.json({ error: 'Only an FOI request has a province' }, { status: 400 })
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
  // or 'ambiguous' still has notes inside it (filings design §4). A missing
  // marker line ('none' from a real parse, never a fallback) is the one case
  // the citizen may confirm past (A5).
  const isFinalising = statusChange && status === 'final'
  let confirmedNoNotes = false
  if (isFinalising) {
    // A finalise checked against text the client never saw is a content
    // conflict first: the citizen is told the letter changed, not what is
    // wrong with a version they haven't read (A5, "a content change in
    // between still gets the changed-since-opened conflict"). The UPDATE's
    // compare-and-set below stays the authority; this only words the 409.
    if (
      typeof expectedContentSha256 === 'string' &&
      createHash('sha256').update(existing.content ?? '', 'utf8').digest('hex') !== expectedContentSha256
    ) {
      return NextResponse.json({ error: CONTENT_CHANGED }, { status: 409 })
    }
    const finalText = typeof content === 'string' ? content : existing.content
    // A blank letter is never finalised, whatever its format (Jen A5 C5).
    if (typeof finalText !== 'string' || finalText.trim() === '') {
      return NextResponse.json({ error: EMPTY_LETTER }, { status: 400 })
    }
    if (existingMetadata.letterFormat === 'marker-v1') {
      const { split, fallback } = parseLetter(finalText, existingMetadata.letterFormat)
      if (split === 'none' && !fallback) {
        if (confirmNoNotes !== true) {
          return NextResponse.json({ error: CONFIRM_NO_NOTES }, { status: 409 })
        }
        confirmedNoNotes = true
      } else if (split === 'ambiguous') {
        // Two or more marker lines: the refusal names that (Jen A5 C2).
        return NextResponse.json({ error: UNCLEAN_SPLIT_REPEATED }, { status: 409 })
      } else if (split !== 'marker') {
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
    eq(leverActions.status, draftWrite ? 'draft' : fromStatus),
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
  // A confirmed finalise records when the citizen confirmed, merged into the
  // stored metadata. The time is the server's: nothing in the request sets it.
  if (confirmedNoNotes) {
    updates.metadata = sql`coalesce(${leverActions.metadata}, '{}'::jsonb) || ${JSON.stringify({
      notesRemovalConfirmedAt: new Date().toISOString(),
    })}::jsonb`
  }
  // The province, merged into the stored metadata; nothing else in it changes.
  if (jurisdiction !== undefined) {
    updates.metadata = sql`coalesce(${leverActions.metadata}, '{}'::jsonb) || ${JSON.stringify({
      jurisdiction,
    })}::jsonb`
  }

  // The write, and for a filing its side effects, in ONE transaction: if
  // recording the outcome or credential fails, the filing rolls back with it,
  // so the letter stays final and a repeat "file" retries everything.
  let updated:
    | { id: string; status: 'draft' | 'final' | 'filed'; content: string | null; updatedAt: Date }
    | undefined
  try {
    updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(leverActions)
        .set(updates)
        .where(and(...conditions))
        .returning({
          id: leverActions.id,
          status: leverActions.status,
          content: leverActions.content,
          updatedAt: leverActions.updatedAt,
        })
      if (!row) return undefined

      // Filing side effects. Reached only when this request's UPDATE
      // returned the row, so a double "file" runs them once.
      if (isFilingTransition && existing.investigationId) {
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
      }
      return row
    })
  } catch (err) {
    if (!isFilingTransition) throw err
    console.error('[lever/actions] Filing failed and was rolled back:', err)
    return NextResponse.json(
      { error: "The filing couldn't be recorded. Nothing was changed. Try again." },
      { status: 500 }
    )
  }

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
    const requiredStatus = draftWrite ? 'draft' : fromStatus
    const error =
      current.status === requiredStatus
        ? CONTENT_CHANGED
        : requiredStatus === 'draft'
          ? NOT_A_DRAFT
          : STATUS_CHANGED
    return NextResponse.json({ error }, { status: 409 })
  }

  return NextResponse.json({ action: updated })
})
