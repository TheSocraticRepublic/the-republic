import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import {
  contentReports,
  forumPosts,
  forumThreads,
  moderationActions,
} from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { checkRateLimit } from '@/lib/rate-limit'
import { stripHtmlTags } from '@/lib/profile/validation'

interface RouteContext {
  params: Promise<{ reportId: string }>
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { success } = await checkRateLimit(`forum-appeal:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { reportId } = await params

  let body: { reason?: unknown }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const rawReason = typeof body.reason === 'string' ? body.reason : ''
  const reason = stripHtmlTags(rawReason).slice(0, 1000)
  if (!reason.trim()) {
    return new Response(JSON.stringify({ error: 'Reason is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = getDb()

  // Fetch the report
  const reportRows = await db
    .select({
      id: contentReports.id,
      targetType: contentReports.targetType,
      targetId: contentReports.targetId,
      status: contentReports.status,
    })
    .from(contentReports)
    .where(eq(contentReports.id, reportId))
    .limit(1)

  if (reportRows.length === 0) {
    return new Response(JSON.stringify({ error: 'Report not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const report = reportRows[0]

  // C1: Only allow appeals for actioned reports. Pending/dismissed reports
  // cannot be appealed — there's nothing to contest yet (pending) or the
  // report was already resolved without action (dismissed).
  if (report.status !== 'actioned') {
    return new Response(JSON.stringify({ error: 'This report cannot be appealed' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Verify caller is the content author via polymorphic lookup
  let contentAuthorId: string | null = null
  if (report.targetType === 'post') {
    const rows = await db
      .select({ authorId: forumPosts.authorId })
      .from(forumPosts)
      .where(eq(forumPosts.id, report.targetId))
      .limit(1)
    contentAuthorId = rows[0]?.authorId ?? null
  } else {
    const rows = await db
      .select({ authorId: forumThreads.authorId })
      .from(forumThreads)
      .where(eq(forumThreads.id, report.targetId))
      .limit(1)
    contentAuthorId = rows[0]?.authorId ?? null
  }

  if (!contentAuthorId || contentAuthorId !== userId) {
    return new Response(JSON.stringify({ error: 'Only the content author may appeal' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // CH2: Duplicate appeal prevention. One appeal per report — subsequent submissions
  // would reset the report status again and spam the moderation queue.
  const existingAppeal = await db
    .select({ id: moderationActions.id })
    .from(moderationActions)
    .where(
      and(
        eq(moderationActions.actionType, 'appeal'),
        eq(moderationActions.relatedReportId, reportId)
      )
    )
    .limit(1)

  if (existingAppeal.length > 0) {
    return new Response(JSON.stringify({ error: 'This report has already been appealed' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    await db.transaction(async (tx) => {
      // Reset report to pending for a fresh moderator review
      await tx
        .update(contentReports)
        .set({
          status: 'pending',
          reviewedBy: null,
          reviewedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(contentReports.id, reportId))

      // Log the appeal in the moderation audit trail.
      // W5: moderatorId stores the appellant (content author), not an actual moderator.
      // The actionType 'appeal' distinguishes this row from moderator actions.
      // moderatorId is non-nullable in the schema so we reuse the column for the
      // appellant's userId — the semantic difference is captured by actionType.
      await tx.insert(moderationActions).values({
        moderatorId: userId, // appellant, not a moderator — see actionType: 'appeal'
        actionType: 'appeal',
        targetType: report.targetType,
        targetId: report.targetId,
        reason,
        relatedReportId: reportId,
      })
    })

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Failed to submit appeal', err)
    return new Response(JSON.stringify({ error: 'Failed to submit appeal' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
