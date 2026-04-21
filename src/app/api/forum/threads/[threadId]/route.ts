import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { forumThreads, forumPosts, userProfiles, jurisdictions, contentReports } from '@/lib/db/schema'
import { eq, asc, and, inArray } from 'drizzle-orm'

interface RouteContext {
  params: Promise<{ threadId: string }>
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { threadId } = await params
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10)
  const limit = Math.min(100, Math.max(1, rawLimit))
  const offset = (page - 1) * limit

  const db = getDb()

  const threadRows = await db
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
      authorId: forumThreads.authorId,
      authorDisplayName: userProfiles.displayName,
      jurisdictionName: jurisdictions.name,
    })
    .from(forumThreads)
    .innerJoin(userProfiles, eq(forumThreads.authorId, userProfiles.userId))
    .leftJoin(jurisdictions, eq(forumThreads.jurisdictionId, jurisdictions.id))
    .where(eq(forumThreads.id, threadId))
    .limit(1)

  if (threadRows.length === 0) {
    return new Response(JSON.stringify({ error: 'Thread not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const thread = threadRows[0]

  // Fetch posts for this thread. Hidden posts are included so clients can render
  // tombstones with an appeal option for the author. 'removed_by_author' is also
  // included for the same reason.
  const posts = await db
    .select({
      id: forumPosts.id,
      threadId: forumPosts.threadId,
      authorId: forumPosts.authorId,
      authorDisplayName: userProfiles.displayName,
      parentId: forumPosts.parentId,
      content: forumPosts.content,
      editedAt: forumPosts.editedAt,
      status: forumPosts.status,
      createdAt: forumPosts.createdAt,
      updatedAt: forumPosts.updatedAt,
    })
    .from(forumPosts)
    .innerJoin(userProfiles, eq(forumPosts.authorId, userProfiles.userId))
    .where(
      and(
        eq(forumPosts.threadId, threadId),
        inArray(forumPosts.status, ['visible', 'hidden', 'removed_by_author'])
      )
    )
    .orderBy(asc(forumPosts.createdAt))
    .limit(limit)
    .offset(offset)

  // W8/N1: For hidden posts, look up the actioned report so clients can pass
  // the correct reportId to the appeal endpoint (appeals need a reportId, not a postId).
  const hiddenPostIds = posts
    .filter((p) => p.status === 'hidden')
    .map((p) => p.id)

  const reportIdByPostId = new Map<string, string>()
  if (hiddenPostIds.length > 0) {
    const reportRows = await db
      .select({
        id: contentReports.id,
        targetId: contentReports.targetId,
      })
      .from(contentReports)
      .where(
        and(
          eq(contentReports.targetType, 'post'),
          eq(contentReports.status, 'actioned'),
          inArray(contentReports.targetId, hiddenPostIds)
        )
      )
    for (const row of reportRows) {
      // If multiple actioned reports exist for the same post (edge case), last one wins.
      reportIdByPostId.set(row.targetId, row.id)
    }
  }

  // W1: Null out content for hidden posts whose author is not the requesting user.
  // The author can still see their own hidden content (needed for context when appealing).
  const postsWithRedaction = posts.map((post) => {
    if (post.status === 'hidden' && post.authorId !== userId) {
      return { ...post, content: null }
    }
    return post
  })

  // Attach reportId to hidden posts so the appeal flow has the correct ID.
  const postsForResponse = postsWithRedaction.map((post) => {
    if (post.status === 'hidden') {
      return { ...post, reportId: reportIdByPostId.get(post.id) ?? null }
    }
    return post
  })

  // Count total posts for pagination
  const totalPosts = thread.postCount

  return new Response(
    JSON.stringify({
      thread,
      posts: postsForResponse,
      pagination: {
        page,
        limit,
        total: totalPosts,
        totalPages: Math.ceil(totalPosts / limit),
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}
