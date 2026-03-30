import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { leverActions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

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

  // Verify ownership
  const [existing] = await db
    .select({ id: leverActions.id })
    .from(leverActions)
    .where(and(eq(leverActions.id, id), eq(leverActions.userId, userId)))
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: 'Action not found' }, { status: 404 })
  }

  const updates: Partial<{ status: 'draft' | 'final' | 'filed'; content: string; updatedAt: Date }> = {
    updatedAt: new Date(),
  }
  if (status) updates.status = status
  if (content !== undefined) updates.content = content

  const [updated] = await db
    .update(leverActions)
    .set(updates)
    .where(eq(leverActions.id, id))
    .returning({
      id: leverActions.id,
      status: leverActions.status,
      updatedAt: leverActions.updatedAt,
    })

  return NextResponse.json({ action: updated })
}
