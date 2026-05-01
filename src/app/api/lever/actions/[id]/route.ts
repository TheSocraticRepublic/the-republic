import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import {
  leverActions,
  investigationOutcomes,
  credentialEvents,
} from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { CREDENTIAL_WEIGHTS } from '@/lib/credentials'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/lever/actions/[id]
 * Fetch a single lever action with full content.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
}

/**
 * PATCH /api/lever/actions/[id]
 * Update action status (draft → final → filed) or edit content.
 * When status transitions to 'filed':
 *   - Records filedAt timestamp in metadata
 *   - Auto-creates investigation outcome (if investigationId present)
 *   - Awards foi_filed credential for FIPPA requests (with dedup)
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  let body: { status?: 'draft' | 'final' | 'filed'; content?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { status, content } = body

  if (!status && content === undefined) {
    return NextResponse.json(
      { error: 'At least one of status or content is required' },
      { status: 400 }
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

  // Validate status transitions: draft→final, final→filed only
  if (status && status !== existing.status) {
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

  // Detect transition to 'filed'
  const isFilingTransition = status === 'filed' && existing.status !== 'filed'

  const existingMetadata = (existing.metadata ?? {}) as Record<string, unknown>
  const updates: Partial<{
    status: 'draft' | 'final' | 'filed'
    content: string
    metadata: Record<string, unknown>
    updatedAt: Date
  }> = {
    updatedAt: new Date(),
  }
  if (status) updates.status = status
  if (content !== undefined) updates.content = content

  // Store filedAt timestamp when filing
  if (isFilingTransition) {
    updates.metadata = {
      ...existingMetadata,
      filedAt: new Date().toISOString(),
    }
  }

  const [updated] = await db
    .update(leverActions)
    .set(updates)
    .where(eq(leverActions.id, id))
    .returning({
      id: leverActions.id,
      status: leverActions.status,
      updatedAt: leverActions.updatedAt,
    })

  // Post-filing side effects (non-blocking — update already returned)
  if (isFilingTransition && existing.investigationId) {
    try {
      await db.transaction(async (tx) => {
        // Auto-create outcome based on action type
        const outcomeMap: Record<string, { type: string; description: string }> = {
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
            outcomeType: outcomeSpec.type as any,
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
}
