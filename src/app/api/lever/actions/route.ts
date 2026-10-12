import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { leverActions, documents, gadflySessions, investigations } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { checkRateLimit } from '@/lib/rate-limit'
import { safeRoute } from '@/lib/api/safe-route'
import {
  CHOOSE_PROVINCE_ERROR,
  isProvinceId,
  listedIn,
  otherProvinceBodyError,
  type ProvinceId,
} from '@/lib/lever/public-body'

/** A typed "Other" public body name longer than this is refused. */
const MAX_PUBLIC_BODY_NAME_LENGTH = 200

/**
 * GET /api/lever/actions
 * List the current user's lever actions.
 */
export const GET = safeRoute(async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { success } = await checkRateLimit(`lever-actions:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = getDb()

  const actions = await db
    .select({
      id: leverActions.id,
      title: leverActions.title,
      actionType: leverActions.actionType,
      status: leverActions.status,
      investigationId: leverActions.investigationId,
      createdAt: leverActions.createdAt,
    })
    .from(leverActions)
    .where(eq(leverActions.userId, userId))
    .orderBy(desc(leverActions.createdAt))

  return NextResponse.json({ actions })
})

/**
 * POST /api/lever/actions
 * Create a new lever action stub (before generation).
 * Returns the action ID so the client can redirect to /lever/[id].
 *
 * A FIPPA request must carry the province the citizen confirmed
 * (`jurisdiction`: bc, ab or on), stored as `metadata.jurisdiction`; the
 * recipient resolver prefers it over detection. Its public body is stored in
 * `metadata.publicBody` as the exact directory entry name when it is one,
 * otherwise as the name the citizen typed ("Other").
 */
export const POST = safeRoute(async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { success } = await checkRateLimit(`lever-actions:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: {
    actionType:
      | 'fippa_request'
      | 'public_comment'
      | 'policy_brief'
      | 'legal_template'
      | 'media_spec'
      | 'talking_points'
      | 'coalition_template'
    documentId?: string
    sessionId?: string
    publicBodyName?: unknown
    jurisdiction?: unknown
    investigationId?: string
    description: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { actionType, documentId, sessionId, publicBodyName, jurisdiction, investigationId, description } = body

  if (!actionType || !description?.trim()) {
    return NextResponse.json(
      { error: 'actionType and description are required' },
      { status: 400 }
    )
  }

  if (publicBodyName !== undefined && publicBodyName !== null && typeof publicBodyName !== 'string') {
    return NextResponse.json({ error: 'publicBodyName must be a string' }, { status: 400 })
  }
  const typedBodyName = typeof publicBodyName === 'string' && publicBodyName.trim() ? publicBodyName.trim() : null

  // FIPPA: the confirmed province, and the body as its exact directory name.
  let province: ProvinceId | null = null
  let publicBody: string | null = typedBodyName
  if (actionType === 'fippa_request') {
    if (!isProvinceId(jurisdiction)) {
      return NextResponse.json({ error: CHOOSE_PROVINCE_ERROR }, { status: 400 })
    }
    province = jurisdiction
    if (typedBodyName) {
      // A directory body (by name or legacy alias) is stored under its exact
      // directory name; one that belongs to another province is refused here,
      // rather than stored and refused at every generation.
      const listing = listedIn(typedBodyName)
      if (listing && listing.province !== province) {
        return NextResponse.json(
          { error: otherProvinceBodyError(listing.province), field: 'publicBody' },
          { status: 400 }
        )
      }
      if (listing) {
        publicBody = listing.name
      } else if (typedBodyName.length > MAX_PUBLIC_BODY_NAME_LENGTH) {
        return NextResponse.json(
          { error: `Keep the public body name to ${MAX_PUBLIC_BODY_NAME_LENGTH} characters or fewer`, field: 'publicBody' },
          { status: 400 }
        )
      }
    }
  }

  const db = getDb()

  // Verify documentId ownership if provided
  if (documentId) {
    const [doc] = await db
      .select({ userId: documents.userId })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1)

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }
    if (doc.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
  }

  // Verify sessionId ownership if provided
  if (sessionId) {
    const [session] = await db
      .select({ userId: gadflySessions.userId })
      .from(gadflySessions)
      .where(eq(gadflySessions.id, sessionId))
      .limit(1)

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    if (session.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
  }

  // Verify investigationId ownership if provided
  if (investigationId) {
    const [investigation] = await db
      .select({ userId: investigations.userId })
      .from(investigations)
      .where(and(eq(investigations.id, investigationId), eq(investigations.userId, userId)))
      .limit(1)

    if (!investigation) {
      return NextResponse.json({ error: 'Investigation not found' }, { status: 403 })
    }
  }

  const ACTION_TYPE_LABELS: Record<string, string> = {
    fippa_request: 'FIPPA Request',
    public_comment: 'Public Comment',
    policy_brief: 'Policy Brief',
    legal_template: 'Legal Template',
    media_spec: 'Media Specification',
    talking_points: 'Talking Points',
    coalition_template: 'Coalition Template',
  }

  const titlePrefix = ACTION_TYPE_LABELS[actionType] ?? actionType
  const shortDesc = description.trim().slice(0, 60)
  const title = `${titlePrefix}: ${shortDesc}${description.trim().length > 60 ? '...' : ''}`

  const [action] = await db
    .insert(leverActions)
    .values({
      userId,
      sessionId: sessionId ?? null,
      documentId: documentId ?? null,
      investigationId: investigationId ?? null,
      actionType,
      title,
      content: '',
      metadata: {
        publicBody,
        addressee: publicBody,
        description: description.trim(),
        ...(province ? { jurisdiction: province } : {}),
      },
      status: 'draft',
    })
    .returning({ id: leverActions.id, title: leverActions.title })

  return NextResponse.json({ actionId: action.id, title: action.title }, { status: 201 })
})
