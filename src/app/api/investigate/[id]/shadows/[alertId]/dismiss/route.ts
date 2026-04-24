import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { investigations, shadowAlerts } from '@/lib/db/schema'
import { and, eq, isNull } from 'drizzle-orm'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; alertId: string }> }
) {
  // Auth required
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { id, alertId } = await params

  // UUID validation on both ids
  if (!UUID_REGEX.test(id)) {
    return new Response(JSON.stringify({ error: 'Invalid investigation id format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!UUID_REGEX.test(alertId)) {
    return new Response(JSON.stringify({ error: 'Invalid alertId format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = getDb()

  // Verify the investigation exists and the caller is the author
  const [investigation] = await db
    .select({ userId: investigations.userId })
    .from(investigations)
    .where(
      and(
        eq(investigations.id, id),
        eq(investigations.userId, userId)
      )
    )
    .limit(1)

  if (!investigation) {
    return new Response(JSON.stringify({ error: 'Investigation not found or forbidden' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Dismiss the alert — only if it belongs to this investigation and is not already dismissed
  const now = new Date()
  const updated = await db
    .update(shadowAlerts)
    .set({ dismissedAt: now })
    .where(
      and(
        eq(shadowAlerts.id, alertId),
        eq(shadowAlerts.investigationId, id),
        isNull(shadowAlerts.dismissedAt)
      )
    )
    .returning({ id: shadowAlerts.id })

  if (updated.length === 0) {
    return new Response(JSON.stringify({ error: 'Alert not found or already dismissed' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ dismissed: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
