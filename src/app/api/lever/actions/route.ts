import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { leverActions, documents, gadflySessions } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

/**
 * GET /api/lever/actions
 * List the current user's lever actions.
 */
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDb()

  const actions = await db
    .select({
      id: leverActions.id,
      title: leverActions.title,
      actionType: leverActions.actionType,
      status: leverActions.status,
      createdAt: leverActions.createdAt,
    })
    .from(leverActions)
    .where(eq(leverActions.userId, userId))
    .orderBy(desc(leverActions.createdAt))

  return NextResponse.json({ actions })
}

/**
 * POST /api/lever/actions
 * Create a new lever action stub (before generation).
 * Returns the action ID so the client can redirect to /lever/[id].
 */
export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
    publicBodyName?: string
    description: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { actionType, documentId, sessionId, publicBodyName, description } = body

  if (!actionType || !description?.trim()) {
    return NextResponse.json(
      { error: 'actionType and description are required' },
      { status: 400 }
    )
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
      actionType,
      title,
      content: '',
      metadata: {
        publicBodyName: publicBodyName ?? null,
        description: description.trim(),
      },
      status: 'draft',
    })
    .returning({ id: leverActions.id, title: leverActions.title })

  return NextResponse.json({ actionId: action.id, title: action.title }, { status: 201 })
}
