import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { forumPosts, forumThreads } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { stripHtmlTags } from '@/lib/profile/validation'
import { validatePostContent } from '@/lib/forum/validation'

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

  const { postId } = await params
  const db = getDb()

  // Compound WHERE: must be the author
  const existing = await db
    .select({ id: forumPosts.id, threadId: forumPosts.threadId })
    .from(forumPosts)
    .where(and(eq(forumPosts.id, postId), eq(forumPosts.authorId, userId)))
    .limit(1)

  if (existing.length === 0) {
    return new Response(JSON.stringify({ error: 'Post not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { threadId } = existing[0]

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
          postCount: sql`post_count - 1`,
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
