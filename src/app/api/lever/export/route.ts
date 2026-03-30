import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { leverActions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

const ACTION_TYPE_LABELS: Record<string, string> = {
  fippa_request: 'fippa-request',
  public_comment: 'public-comment',
  policy_brief: 'policy-brief',
}

/**
 * POST /api/lever/export
 * Returns the action content as a downloadable plain text file.
 */
export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { actionId: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { actionId } = body
  if (!actionId) {
    return new Response(JSON.stringify({ error: 'actionId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = getDb()

  const [action] = await db
    .select({
      id: leverActions.id,
      title: leverActions.title,
      actionType: leverActions.actionType,
      content: leverActions.content,
      status: leverActions.status,
      createdAt: leverActions.createdAt,
    })
    .from(leverActions)
    .where(and(eq(leverActions.id, actionId), eq(leverActions.userId, userId)))
    .limit(1)

  if (!action) {
    return new Response(JSON.stringify({ error: 'Action not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!action.content) {
    return new Response(JSON.stringify({ error: 'Action has no content to export' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Build filename: e.g. "fippa-request-2026-03-30.txt"
  const date = new Date(action.createdAt).toISOString().slice(0, 10)
  const typeSlug = ACTION_TYPE_LABELS[action.actionType] ?? 'action'
  const filename = `${typeSlug}-${date}.txt`

  return new Response(action.content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
