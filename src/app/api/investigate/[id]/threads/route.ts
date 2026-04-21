import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { forumThreads, userProfiles } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { id: investigationId } = await params
  const db = getDb()

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

  return new Response(JSON.stringify({ threads }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
