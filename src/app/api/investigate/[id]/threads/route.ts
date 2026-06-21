import { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getDb } from '@/lib/db'
import { investigations, forumThreads, userProfiles } from '@/lib/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { safeRoute } from '@/lib/api/safe-route'

interface RouteContext {
  params: Promise<{ id: string }>
}

export const GET = safeRoute(async (request: NextRequest, { params }: RouteContext) => {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { success } = await checkRateLimit(`investigate-threads:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { id: investigationId } = await params
  const db = getDb()

  // Ownership check — prevent IDOR: only the owner may read thread metadata.
  const [investigation] = await db
    .select({ id: investigations.id })
    .from(investigations)
    .where(and(eq(investigations.id, investigationId), eq(investigations.userId, userId)))
    .limit(1)

  if (!investigation) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const threads = await db
    .select({
      id: forumThreads.id,
      title: forumThreads.title,
      investigationId: forumThreads.investigationId,
      jurisdictionId: forumThreads.jurisdictionId,
      concernCategory: forumThreads.concernCategory,
      status: forumThreads.status,
      pinned: forumThreads.pinned,
      postCount: forumThreads.postCount,
      lastPostAt: forumThreads.lastPostAt,
      createdAt: forumThreads.createdAt,
      authorDisplayName: userProfiles.displayName,
    })
    .from(forumThreads)
    .innerJoin(userProfiles, eq(forumThreads.authorId, userProfiles.userId))
    .where(eq(forumThreads.investigationId, investigationId))
    .orderBy(desc(forumThreads.lastPostAt))
    .limit(20)

  return new Response(JSON.stringify({ threads }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
