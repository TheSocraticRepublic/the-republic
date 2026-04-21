import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import {
  contentReports,
  forumPosts,
  forumThreads,
  userProfiles,
} from '@/lib/db/schema'
import { eq, and, ne, isNull, or, asc } from 'drizzle-orm'
import { checkModeratorAccess } from '@/lib/credentials/check-moderator'
import { checkTightRateLimit, checkRateLimit } from '@/lib/rate-limit'
import { stripHtmlTags } from '@/lib/profile/validation'

const VALID_REASONS = ['spam', 'harassment', 'misinformation', 'off_topic', 'other'] as const
type ReportReason = (typeof VALID_REASONS)[number]
const VALID_TARGET_TYPES = ['thread', 'post'] as const
type TargetType = (typeof VALID_TARGET_TYPES)[number]

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Determine effective weight for rate limiting purposes
  const { effectiveWeight } = await checkModeratorAccess(userId)
  const rateLimitFn = effectiveWeight < 5 ? checkTightRateLimit : checkRateLimit
  const { success } = await rateLimitFn(`forum-report:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: {
    targetType?: unknown
    targetId?: unknown
    reason?: unknown
    description?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const targetType = body.targetType as string
  const targetId = body.targetId as string
  const reason = body.reason as string
  const rawDescription = typeof body.description === 'string' ? body.description : null

  if (!VALID_TARGET_TYPES.includes(targetType as TargetType)) {
    return new Response(JSON.stringify({ error: 'Invalid target type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!targetId || typeof targetId !== 'string') {
    return new Response(JSON.stringify({ error: 'targetId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!VALID_REASONS.includes(reason as ReportReason)) {
    return new Response(JSON.stringify({ error: 'Invalid reason' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const description = rawDescription
    ? stripHtmlTags(rawDescription).slice(0, 1000)
    : null

  const db = getDb()

  // Verify target exists and caller is not the author
  if (targetType === 'post') {
    const rows = await db
      .select({ authorId: forumPosts.authorId })
      .from(forumPosts)
      .where(eq(forumPosts.id, targetId))
      .limit(1)
    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Post not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (rows[0].authorId === userId) {
      return new Response(JSON.stringify({ error: 'Cannot report your own content' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  } else {
    const rows = await db
      .select({ authorId: forumThreads.authorId })
      .from(forumThreads)
      .where(eq(forumThreads.id, targetId))
      .limit(1)
    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Thread not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (rows[0].authorId === userId) {
      return new Response(JSON.stringify({ error: 'Cannot report your own content' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  try {
    const [report] = await db
      .insert(contentReports)
      .values({
        reporterId: userId,
        targetType: targetType as TargetType,
        targetId,
        reason: reason as ReportReason,
        description,
      })
      .returning()

    return new Response(JSON.stringify({ report }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    // Unique constraint violation — already reported
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === '23505'
    ) {
      return new Response(JSON.stringify({ error: 'Already reported' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    console.error('Failed to create report', err)
    return new Response(JSON.stringify({ error: 'Failed to submit report' }), {
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

  const { isModerator } = await checkModeratorAccess(userId)
  if (!isModerator) {
    return new Response(JSON.stringify({ error: 'Insufficient credentials' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const rawLimit = parseInt(searchParams.get('limit') ?? '20', 10)
  const limit = Math.min(50, Math.max(1, rawLimit))
  const offset = (page - 1) * limit

  const db = getDb()

  // Pending reports, excluding those this moderator already reviewed
  const reports = await db
    .select({
      id: contentReports.id,
      targetType: contentReports.targetType,
      targetId: contentReports.targetId,
      reason: contentReports.reason,
      description: contentReports.description,
      status: contentReports.status,
      reviewedBy: contentReports.reviewedBy,
      createdAt: contentReports.createdAt,
      reporterDisplayName: userProfiles.displayName,
    })
    .from(contentReports)
    .innerJoin(userProfiles, eq(contentReports.reporterId, userProfiles.userId))
    .where(
      and(
        eq(contentReports.status, 'pending'),
        or(isNull(contentReports.reviewedBy), ne(contentReports.reviewedBy, userId))
      )
    )
    .orderBy(asc(contentReports.createdAt))
    .limit(limit)
    .offset(offset)

  // Batch-load targets
  const postIds = reports
    .filter((r) => r.targetType === 'post')
    .map((r) => r.targetId)
  const threadIds = reports
    .filter((r) => r.targetType === 'thread')
    .map((r) => r.targetId)

  const [postTargets, threadTargets] = await Promise.all([
    postIds.length > 0
      ? db
          .select({
            id: forumPosts.id,
            content: forumPosts.content,
            status: forumPosts.status,
            authorDisplayName: userProfiles.displayName,
          })
          .from(forumPosts)
          .innerJoin(userProfiles, eq(forumPosts.authorId, userProfiles.userId))
          .where(
            postIds.length === 1
              ? eq(forumPosts.id, postIds[0])
              : // Use OR chain for multiple IDs — inArray not available directly
                // but we can use the eq pattern with explicit OR
                postIds.reduce<ReturnType<typeof eq> | undefined>(
                  (acc, id) => (acc ? or(acc, eq(forumPosts.id, id)) : eq(forumPosts.id, id)),
                  undefined
                )!
          )
      : Promise.resolve([]),
    threadIds.length > 0
      ? db
          .select({
            id: forumThreads.id,
            title: forumThreads.title,
            status: forumThreads.status,
            authorDisplayName: userProfiles.displayName,
          })
          .from(forumThreads)
          .innerJoin(userProfiles, eq(forumThreads.authorId, userProfiles.userId))
          .where(
            threadIds.length === 1
              ? eq(forumThreads.id, threadIds[0])
              : threadIds.reduce<ReturnType<typeof eq> | undefined>(
                  (acc, id) =>
                    acc ? or(acc, eq(forumThreads.id, id)) : eq(forumThreads.id, id),
                  undefined
                )!
          )
      : Promise.resolve([]),
  ])

  const postMap = new Map(postTargets.map((p) => [p.id, p]))
  const threadMap = new Map(threadTargets.map((t) => [t.id, t]))

  const enriched = reports.map((r) => ({
    ...r,
    target:
      r.targetType === 'post'
        ? postMap.get(r.targetId) ?? null
        : threadMap.get(r.targetId) ?? null,
  }))

  return new Response(JSON.stringify({ reports: enriched, pagination: { page, limit } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
