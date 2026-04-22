import { NextRequest } from 'next/server'
import {
  isFederationConfigured,
  actorUrl,
  outboxUrl,
  threadUrl,
  postUrl,
  AP_CONTEXT,
} from '@/lib/activitypub/context'
import { getDb } from '@/lib/db'
import { userProfiles, forumThreads, forumPosts } from '@/lib/db/schema'
import { eq, and, desc, count } from 'drizzle-orm'
import { checkRateLimit } from '@/lib/rate-limit'

const PAGE_SIZE = 20

interface RouteContext {
  params: Promise<{ apHandle: string }>
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  if (!isFederationConfigured()) {
    return new Response(JSON.stringify({ error: 'Federation not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const { success } = await checkRateLimit(`ap-outbox:${ip}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { apHandle } = await params
  const db = getDb()

  const profileRows = await db
    .select({ userId: userProfiles.userId })
    .from(userProfiles)
    .where(eq(userProfiles.apHandle, apHandle))
    .limit(1)

  if (profileRows.length === 0) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { userId } = profileRows[0]
  const actor = actorUrl(apHandle)
  const outbox = outboxUrl(apHandle)

  const pageParam = request.nextUrl.searchParams.get('page')

  // Without ?page, return the OrderedCollection summary (no items)
  if (!pageParam) {
    const [threadCountRows, postCountRows] = await Promise.all([
      db
        .select({ n: count() })
        .from(forumThreads)
        .where(and(eq(forumThreads.authorId, userId), eq(forumThreads.status, 'open'))),
      db
        .select({ n: count() })
        .from(forumPosts)
        .where(eq(forumPosts.authorId, userId)),
    ])

    const total =
      Number(threadCountRows[0]?.n ?? 0) + Number(postCountRows[0]?.n ?? 0)

    return new Response(
      JSON.stringify({
        '@context': AP_CONTEXT,
        id: outbox,
        type: 'OrderedCollection',
        totalItems: total,
        first: `${outbox}?page=1`,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/activity+json',
          'Cache-Control': 'public, max-age=60',
        },
      }
    )
  }

  const page = Math.max(1, parseInt(pageParam, 10))
  const offset = (page - 1) * PAGE_SIZE

  const [threads, posts] = await Promise.all([
    db
      .select({
        id: forumThreads.id,
        title: forumThreads.title,
        createdAt: forumThreads.createdAt,
      })
      .from(forumThreads)
      .where(and(eq(forumThreads.authorId, userId), eq(forumThreads.status, 'open')))
      .orderBy(desc(forumThreads.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({
        id: forumPosts.id,
        content: forumPosts.content,
        parentId: forumPosts.parentId,
        createdAt: forumPosts.createdAt,
      })
      .from(forumPosts)
      .where(eq(forumPosts.authorId, userId))
      .orderBy(desc(forumPosts.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
  ])

  const items: unknown[] = []

  for (const thread of threads) {
    const articleId = threadUrl(thread.id)
    const article = {
      id: articleId,
      type: 'Article',
      attributedTo: actor,
      name: thread.title,
      published: thread.createdAt.toISOString(),
      to: ['https://www.w3.org/ns/activitystreams#Public'],
      cc: [`${actor}/followers`],
      url: articleId,
    }
    items.push({
      id: `${articleId}/activity`,
      type: 'Create',
      actor,
      published: thread.createdAt.toISOString(),
      to: ['https://www.w3.org/ns/activitystreams#Public'],
      cc: [`${actor}/followers`],
      object: article,
    })
  }

  for (const post of posts.slice(0, Math.max(0, PAGE_SIZE - items.length))) {
    const noteId = postUrl(post.id)
    const note: Record<string, unknown> = {
      id: noteId,
      type: 'Note',
      attributedTo: actor,
      content: post.content,
      published: post.createdAt.toISOString(),
      to: ['https://www.w3.org/ns/activitystreams#Public'],
      cc: [`${actor}/followers`],
    }
    if (post.parentId) {
      note.inReplyTo = postUrl(post.parentId)
    }
    items.push({
      id: `${noteId}/activity`,
      type: 'Create',
      actor,
      published: post.createdAt.toISOString(),
      to: ['https://www.w3.org/ns/activitystreams#Public'],
      cc: [`${actor}/followers`],
      object: note,
    })
  }

  const hasMore = items.length === PAGE_SIZE
  const collection: Record<string, unknown> = {
    '@context': AP_CONTEXT,
    id: `${outbox}?page=${page}`,
    type: 'OrderedCollectionPage',
    partOf: outbox,
    orderedItems: items,
  }
  if (hasMore) {
    collection.next = `${outbox}?page=${page + 1}`
  }

  return new Response(JSON.stringify(collection), {
    status: 200,
    headers: {
      'Content-Type': 'application/activity+json',
      'Cache-Control': 'public, max-age=60',
    },
  })
}
