import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getDb } from '@/lib/db'
import { investigations, jurisdictions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { safeRoute } from '@/lib/api/safe-route'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/investigate/[id]
 * Fetch a single investigation (lightweight — for cross-arm context).
 */
export const GET = safeRoute(async (request: NextRequest, { params }: RouteContext) => {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { success } = await checkRateLimit(`investigate-detail:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
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
      // The resolved jurisdiction's province (e.g. "British Columbia"), which
      // the Lever's new-action dialog pre-selects from. Null if unresolved.
      jurisdictionProvince: jurisdictions.province,
    })
    .from(investigations)
    .leftJoin(jurisdictions, eq(jurisdictions.id, investigations.jurisdictionId))
    .where(and(eq(investigations.id, id), eq(investigations.userId, userId)))
    .limit(1)

  if (!investigation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ investigation })
})
