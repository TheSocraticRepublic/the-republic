import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import {
  forumThreads,
  forumPosts,
  credentialEvents,
  userProfiles,
  jurisdictions,
  investigations,
} from '@/lib/db/schema'
import { eq, desc, and, count, sql } from 'drizzle-orm'
import { stripHtmlTags } from '@/lib/profile/validation'
import { validateThreadTitle, validatePostContent } from '@/lib/forum/validation'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { success } = await checkRateLimit(`forum-thread:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: {
    title?: unknown
    content?: unknown
    investigationId?: unknown
    jurisdictionId?: unknown
    concernCategory?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const rawTitle = typeof body.title === 'string' ? body.title : ''
  const rawContent = typeof body.content === 'string' ? body.content : ''
  const investigationId = typeof body.investigationId === 'string' ? body.investigationId : null
  const jurisdictionId = typeof body.jurisdictionId === 'string' ? body.jurisdictionId : null
  const concernCategory = typeof body.concernCategory === 'string' ? body.concernCategory : null

  const titleStripped = stripHtmlTags(rawTitle)
  const titleValidation = validateThreadTitle(titleStripped)
  if (!titleValidation.valid) {
    return new Response(JSON.stringify({ error: titleValidation.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const contentStripped = stripHtmlTags(rawContent)
  const contentValidation = validatePostContent(contentStripped)
  if (!contentValidation.valid) {
    return new Response(JSON.stringify({ error: contentValidation.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = getDb()

  // Verify investigation exists if provided
  if (investigationId) {
    const inv = await db
      .select({ id: investigations.id })
      .from(investigations)
      .where(eq(investigations.id, investigationId))
      .limit(1)
    if (inv.length === 0) {
      return new Response(JSON.stringify({ error: 'Investigation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const now = new Date()

  try {
    const result = await db.transaction(async (tx) => {
      const [thread] = await tx
        .insert(forumThreads)
        .values({
          authorId: userId,
          title: titleStripped,
          investigationId,
          jurisdictionId,
          concernCategory,
          postCount: 1,
          lastPostAt: now,
        })
        .returning()

      const [firstPost] = await tx
        .insert(forumPosts)
        .values({
          threadId: thread.id,
          authorId: userId,
          content: contentStripped,
          parentId: null,
        })
        .returning()

      await tx.insert(credentialEvents).values({
        userId,
        credentialType: 'forum_contribution',
        weight: 1,
        sourceId: thread.id,
        sourceType: 'forum_post',
      })

      return { thread, firstPost }
    })

    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Failed to create forum thread', err)
    return new Response(JSON.stringify({ error: 'Failed to create thread' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const rawLimit = parseInt(searchParams.get('limit') ?? '20', 10)
  const limit = Math.min(50, Math.max(1, rawLimit))
  const offset = (page - 1) * limit
  const jurisdictionParam = searchParams.get('jurisdiction')
  const categoryParam = searchParams.get('category')
  const statusParam = searchParams.get('status') ?? 'open'

  const db = getDb()

  const conditions = []
  if (statusParam === 'open' || statusParam === 'locked' || statusParam === 'archived') {
    conditions.push(eq(forumThreads.status, statusParam as 'open' | 'locked' | 'archived'))
  }
  if (jurisdictionParam) {
    conditions.push(eq(forumThreads.jurisdictionId, jurisdictionParam))
  }
  if (categoryParam) {
    conditions.push(eq(forumThreads.concernCategory, categoryParam))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [threads, totalResult] = await Promise.all([
    db
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
        jurisdictionName: jurisdictions.name,
      })
      .from(forumThreads)
      .innerJoin(userProfiles, eq(forumThreads.authorId, userProfiles.userId))
      .leftJoin(jurisdictions, eq(forumThreads.jurisdictionId, jurisdictions.id))
      .where(whereClause)
      .orderBy(desc(forumThreads.pinned), desc(sql`${forumThreads.lastPostAt} NULLS LAST`))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(forumThreads)
      .where(whereClause),
  ])

  const total = totalResult[0]?.total ?? 0
  const totalPages = Math.ceil(total / limit)

  return new Response(
    JSON.stringify({
      threads,
      pagination: { page, limit, total, totalPages },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}
