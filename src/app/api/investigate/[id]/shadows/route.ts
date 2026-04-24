import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { shadowAlerts } from '@/lib/db/schema'
import { and, eq, isNull } from 'drizzle-orm'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth required
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { id } = await params

  // UUID validation
  if (!UUID_REGEX.test(id)) {
    return new Response(JSON.stringify({ error: 'Invalid investigation id format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = getDb()

  // Query undismissed shadow alerts for this investigation
  const shadows = await db
    .select()
    .from(shadowAlerts)
    .where(
      and(
        eq(shadowAlerts.investigationId, id),
        isNull(shadowAlerts.dismissedAt)
      )
    )

  return new Response(JSON.stringify({ shadows }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
