import { NextRequest } from 'next/server'
import { isFederationConfigured } from '@/lib/activitypub/context'
import { postToNote } from '@/lib/activitypub/activity'
import { getDb } from '@/lib/db'
import { forumPosts, userProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { checkRateLimit } from '@/lib/rate-limit'

interface RouteContext {
  params: Promise<{ postId: string }>
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  if (!isFederationConfigured()) {
    return new Response(JSON.stringify({ error: 'Federation not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const { success } = await checkRateLimit(`ap-post:${ip}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { postId } = await params
  const db = getDb()

  const postRows = await db
    .select({
      id: forumPosts.id,
      content: forumPosts.content,
      authorId: forumPosts.authorId,
      parentId: forumPosts.parentId,
      threadId: forumPosts.threadId,
      status: forumPosts.status,
      createdAt: forumPosts.createdAt,
    })
    .from(forumPosts)
    .where(eq(forumPosts.id, postId))
    .limit(1)

  if (postRows.length === 0) {
    return new Response(JSON.stringify({ error: 'Post not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const post = postRows[0]

  // Only serve visible posts
  if (post.status !== 'visible') {
    return new Response(JSON.stringify({ error: 'Post not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const profileRows = await db
    .select({ apHandle: userProfiles.apHandle })
    .from(userProfiles)
    .where(eq(userProfiles.userId, post.authorId))
    .limit(1)

  if (profileRows.length === 0 || !profileRows[0].apHandle) {
    return new Response(JSON.stringify({ error: 'Author not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const accept = request.headers.get('accept') ?? ''
  const wantsAp =
    accept.includes('application/activity+json') ||
    accept.includes('application/ld+json')

  if (!wantsAp) {
    return new Response(null, {
      status: 301,
      headers: { Location: `/forum/${post.threadId}` },
    })
  }

  const note = postToNote({
    id: post.id,
    content: post.content,
    authorApHandle: profileRows[0].apHandle,
    createdAt: post.createdAt,
    parentPostId: post.parentId,
    threadId: post.threadId,
  })

  return new Response(JSON.stringify(note), {
    status: 200,
    headers: {
      'Content-Type': 'application/activity+json',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
