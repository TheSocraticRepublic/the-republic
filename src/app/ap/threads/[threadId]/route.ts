import { NextRequest } from 'next/server'
import { isFederationConfigured } from '@/lib/activitypub/context'
import { threadToArticle } from '@/lib/activitypub/activity'
import { getDb } from '@/lib/db'
import { forumThreads, forumPosts, userProfiles } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { checkRateLimit } from '@/lib/rate-limit'

interface RouteContext {
  params: Promise<{ threadId: string }>
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  if (!isFederationConfigured()) {
    return new Response(JSON.stringify({ error: 'Federation not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { success } = await checkRateLimit(`ap-thread:${ip}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { threadId } = await params
  const db = getDb()

  // Only serve open threads
  const threadRows = await db
    .select({
      id: forumThreads.id,
      title: forumThreads.title,
      authorId: forumThreads.authorId,
      status: forumThreads.status,
      createdAt: forumThreads.createdAt,
    })
    .from(forumThreads)
    .where(and(eq(forumThreads.id, threadId), eq(forumThreads.status, 'open')))
    .limit(1)

  if (threadRows.length === 0) {
    return new Response(JSON.stringify({ error: 'Thread not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const thread = threadRows[0]

  // Get the author's apHandle
  const profileRows = await db
    .select({ apHandle: userProfiles.apHandle })
    .from(userProfiles)
    .where(eq(userProfiles.userId, thread.authorId))
    .limit(1)

  if (profileRows.length === 0 || !profileRows[0].apHandle) {
    return new Response(JSON.stringify({ error: 'Author not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Get the first post content (the thread body)
  const firstPostRows = await db
    .select({ content: forumPosts.content })
    .from(forumPosts)
    .where(and(eq(forumPosts.threadId, threadId), eq(forumPosts.authorId, thread.authorId)))
    .limit(1)

  const content = firstPostRows[0]?.content ?? ''

  const accept = request.headers.get('accept') ?? ''
  const wantsAp =
    accept.includes('application/activity+json') ||
    accept.includes('application/ld+json')

  if (!wantsAp) {
    return new Response(null, {
      status: 301,
      headers: { Location: `/forum/${threadId}` },
    })
  }

  const article = threadToArticle({
    id: thread.id,
    title: thread.title,
    content,
    authorApHandle: profileRows[0].apHandle,
    createdAt: thread.createdAt,
  })

  return new Response(JSON.stringify(article), {
    status: 200,
    headers: {
      'Content-Type': 'application/activity+json',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
