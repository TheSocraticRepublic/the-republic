import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import {
  forumPosts,
  forumThreads,
  contentReports,
  moderationActions,
} from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { checkModeratorAccess } from '@/lib/credentials/check-moderator'
import { stripHtmlTags } from '@/lib/profile/validation'

const VALID_ACTIONS = [
  'hide_post',
  'unhide_post',
  'lock_thread',
  'unlock_thread',
  'dismiss_report',
] as const
type ActionType = (typeof VALID_ACTIONS)[number]

export async function POST(request: NextRequest) {
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

  let body: {
    action?: unknown
    targetId?: unknown
    reason?: unknown
    reportId?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const action = body.action as string
  const targetId = body.targetId as string
  const rawReason = typeof body.reason === 'string' ? body.reason : ''
  const reportId = typeof body.reportId === 'string' ? body.reportId : null

  if (!VALID_ACTIONS.includes(action as ActionType)) {
    return new Response(JSON.stringify({ error: 'Invalid action' }), {
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

  const reason = stripHtmlTags(rawReason).slice(0, 1000)
  if (!reason.trim()) {
    return new Response(JSON.stringify({ error: 'Reason is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Determine targetType for the audit log based on the action.
  // For dismiss_report, targetId is the reportId — we resolve the real targetType below.
  const targetType = action === 'hide_post' || action === 'unhide_post' ? 'post' : 'thread'

  const db = getDb()

  // CH1: Self-action guard. When a reportId is provided (or for dismiss_report where
  // targetId IS the reportId), the moderator must not be the original reporter.
  // A moderator who filed the report cannot also act on it -- conflict of interest.
  const reportIdForGuard = action === 'dismiss_report' ? targetId : reportId
  if (reportIdForGuard) {
    const guardRows = await db
      .select({ reporterId: contentReports.reporterId })
      .from(contentReports)
      .where(eq(contentReports.id, reportIdForGuard))
      .limit(1)
    if (guardRows.length > 0 && guardRows[0].reporterId === userId) {
      return new Response(JSON.stringify({ error: 'Cannot act on content you reported' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  // W2/CH5: For dismiss_report, look up the report's real targetType AND targetId before
  // the transaction. The audit log must record the content UUID as targetId (not the report
  // UUID), so targetId always refers to actual content — consistent with all other actions.
  let dismissReportTargetType: 'post' | 'thread' = 'post'
  let dismissReportContentId: string = targetId  // fallback; overwritten below if report found
  if (action === 'dismiss_report') {
    const reportRows = await db
      .select({ targetType: contentReports.targetType, targetId: contentReports.targetId })
      .from(contentReports)
      .where(eq(contentReports.id, targetId))
      .limit(1)
    if (reportRows.length > 0) {
      dismissReportTargetType = reportRows[0].targetType
      dismissReportContentId = reportRows[0].targetId
    }
  }

  try {
    await db.transaction(async (tx) => {
      // Apply the content action
      switch (action as ActionType) {
        case 'hide_post':
          await tx
            .update(forumPosts)
            .set({ status: 'hidden', updatedAt: new Date() })
            .where(and(eq(forumPosts.id, targetId), eq(forumPosts.status, 'visible')))
          break
        case 'unhide_post':
          await tx
            .update(forumPosts)
            .set({ status: 'visible', updatedAt: new Date() })
            .where(and(eq(forumPosts.id, targetId), eq(forumPosts.status, 'hidden')))
          break
        case 'lock_thread':
          await tx
            .update(forumThreads)
            .set({ status: 'locked', updatedAt: new Date() })
            .where(and(eq(forumThreads.id, targetId), eq(forumThreads.status, 'open')))
          break
        case 'unlock_thread':
          await tx
            .update(forumThreads)
            .set({ status: 'open', updatedAt: new Date() })
            .where(and(eq(forumThreads.id, targetId), eq(forumThreads.status, 'locked')))
          break
        case 'dismiss_report':
          // For dismiss_report, targetId is the reportId, not a content id.
          await tx
            .update(contentReports)
            .set({
              status: 'dismissed',
              reviewedBy: userId,
              reviewedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(contentReports.id, targetId))
          break
      }

      // If a reportId was provided and action isn't dismiss_report, mark report actioned
      if (reportId && action !== 'dismiss_report') {
        await tx
          .update(contentReports)
          .set({
            status: 'actioned',
            reviewedBy: userId,
            reviewedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(contentReports.id, reportId))
      }

      // Write audit log.
      // CH5: For dismiss_report, targetId in the audit log must be the content UUID
      // (not the report UUID). The report UUID goes in relatedReportId. This makes
      // the audit log semantically consistent: targetId always refers to actual content.
      // W2: Use the report's real targetType (resolved above, not a hardcoded guess).
      const auditTargetType = action === 'dismiss_report' ? dismissReportTargetType : targetType
      const auditTargetId = action === 'dismiss_report' ? dismissReportContentId : targetId
      await tx.insert(moderationActions).values({
        moderatorId: userId,
        actionType: action as ActionType,
        targetType: auditTargetType as 'post' | 'thread',
        targetId: auditTargetId,
        reason,
        relatedReportId: reportId ?? (action === 'dismiss_report' ? targetId : null),
      })
    })

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Failed to apply moderation action', err)
    return new Response(JSON.stringify({ error: 'Failed to apply action' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
