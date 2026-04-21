import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { forumPosts, forumThreads } from '@/lib/db/schema'
import { eq, and, sql, lt, count } from 'drizzle-orm'
import { stripHtmlTags } from '@/lib/profile/validation'
import { validatePostContent } from '@/lib/forum/validation'
import { checkRateLimit } from '@/lib/rate-limit'

interface RouteContext {
  params: Promise<{ postId: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const rl = await checkRateLimit(`forum-edit:${userId}`)
  if (!rl.success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { postId } = await params

  let body: { content?: unknown }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const rawContent = typeof body.content === 'string' ? body.content : ''
  const contentStripped = stripHtmlTags(rawContent)
  const contentValidation = validatePostContent(contentStripped)
  if (!contentValidation.valid) {
    return new Response(JSON.stringify({ error: contentValidation.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = getDb()

  // Compound WHERE: must be the author
  const existing = await db
    .select({ id: forumPosts.id, status: forumPosts.status })
    .from(forumPosts)
    .where(and(eq(forumPosts.id, postId), eq(forumPosts.authorId, userId)))
    .limit(1)

  if (existing.length === 0) {
    return new Response(JSON.stringify({ error: 'Post not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (existing[0].status !== 'visible') {
    return new Response(JSON.stringify({ error: 'Cannot edit a removed post' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const now = new Date()
  const [updated] = await db
    .update(forumPosts)
    .set({
      content: contentStripped,
      editedAt: now,
      updatedAt: now,
    })
    .where(and(eq(forumPosts.id, postId), eq(forumPosts.authorId, userId)))
    .returning()

  return new Response(JSON.stringify({ post: updated }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const rl = await checkRateLimit(`forum-delete:${userId}`)
  if (!rl.success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { postId } = await params
  const db = getDb()

  // Compound WHERE: must be the author
  const existing = await db
    .select({ id: forumPosts.id, threadId: forumPosts.threadId, createdAt: forumPosts.createdAt })
    .from(forumPosts)
    .where(and(eq(forumPosts.id, postId), eq(forumPosts.authorId, userId)))
    .limit(1)

  if (existing.length === 0) {
    return new Response(JSON.stringify({ error: 'Post not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { threadId, createdAt: postCreatedAt } = existing[0]

  // Prevent deleting the first post in a thread (thread body).
  // A post is the first post if no other post in the thread has an earlier createdAt.
  const [earlierPostCount] = await db
    .select({ c: count() })
    .from(forumPosts)
    .where(
      and(
        eq(forumPosts.threadId, threadId),
        lt(forumPosts.createdAt, postCreatedAt)
      )
    )

  if ((earlierPostCount?.c ?? 0) === 0) {
    return new Response(JSON.stringify({ error: 'Cannot delete the first post in a thread' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [post] = await tx
        .update(forumPosts)
        .set({ status: 'removed_by_author', updatedAt: new Date() })
        .where(and(eq(forumPosts.id, postId), eq(forumPosts.authorId, userId)))
        .returning({ id: forumPosts.id, status: forumPosts.status })

      await tx
        .update(forumThreads)
        .set({
          postCount: sql`GREATEST(post_count - 1, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(forumThreads.id, threadId))

      return { post }
    })

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Failed to delete forum post', err)
    return new Response(JSON.stringify({ error: 'Failed to delete post' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
