import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { investigations } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/investigate/[id]
 * Fetch a single investigation (lightweight — for cross-arm context).
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const db = getDb()

  const [investigation] = await db
    .select({
      id: investigations.id,
      concern: investigations.concern,
      jurisdictionName: investigations.jurisdictionName,
      briefingText: investigations.briefingText,
      lensContextText: investigations.lensContextText,
      status: investigations.status,
    })
    .from(investigations)
    .where(and(eq(investigations.id, id), eq(investigations.userId, userId)))
    .limit(1)

  if (!investigation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ investigation })
}
