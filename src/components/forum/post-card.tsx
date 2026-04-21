'use client'

import { useState } from 'react'
import { Flag } from 'lucide-react'
import { ProfileBadge } from '@/components/profile/profile-badge'
import { ReportForm } from './report-form'
import { formatRelativeTime } from '@/lib/format-relative-time'
import { MAX_REPLY_DEPTH } from '@/lib/forum/validation'

interface PostCardProps {
  id: string
  authorId: string
  authorDisplayName: string
  content: string
  editedAt?: Date | string | null
  status: 'visible' | 'hidden' | 'removed_by_author'
  createdAt: Date | string
  parentId?: string | null
  depth: number
  currentUserId: string
  threadStatus: 'open' | 'locked' | 'archived'
  onReply?: (postId: string) => void
  onEdit?: (postId: string, newContent: string) => Promise<void>
  onDelete?: (postId: string) => Promise<void>
  onReport?: (postId: string) => void
}

export function PostCard({
  id,
  authorId,
  authorDisplayName,
  content,
  editedAt,
  status,
  createdAt,
  depth,
  currentUserId,
  threadStatus,
  onReply,
  onEdit,
  onDelete,
}: PostCardProps) {
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(content)
  const [editLoading, setEditLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reporting, setReporting] = useState(false)
  const [reported, setReported] = useState(false)
  const [appealing, setAppealing] = useState(false)
  const [appealReason, setAppealReason] = useState('')
  const [appealLoading, setAppealLoading] = useState(false)
  const [appealError, setAppealError] = useState<string | null>(null)

  const isAuthor = authorId === currentUserId
  const isThreadOpen = threadStatus === 'open'
  const isVisible = status === 'visible'
  const showActions = isVisible && isThreadOpen

  async function handleSaveEdit() {
    if (!onEdit) return
    setEditLoading(true)
    setError(null)
    try {
      await onEdit(id, editContent)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setEditLoading(false)
    }
  }

  async function handleDelete() {
    if (!onDelete) return
    setDeleteLoading(true)
    setError(null)
    try {
      await onDelete(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
      setDeleteLoading(false)
    }
  }

  async function handleAppeal(reportId: string) {
    if (!appealReason.trim()) {
      setAppealError('Reason is required')
      return
    }
    setAppealLoading(true)
    setAppealError(null)
    try {
      const res = await fetch(`/api/forum/reports/${reportId}/appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: appealReason }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to submit appeal')
      }
      setAppealing(false)
      setAppealReason('')
    } catch (err) {
      setAppealError(err instanceof Error ? err.message : 'Failed to submit appeal')
    } finally {
      setAppealLoading(false)
    }
  }

  if (status === 'removed_by_author') {
    return (
      <div
        className="py-3 px-4 rounded-lg"
        style={{ marginLeft: depth * 24 }}
      >
        <p className="text-xs text-neutral-600 italic">
          [This post was removed by the author]
          {' '}
          <span className="text-neutral-700">{formatRelativeTime(createdAt)}</span>
        </p>
      </div>
    )
  }

  if (status === 'hidden') {
    return (
      <div
        className="py-3 px-4 rounded-lg border border-white/[0.04]"
        style={{ marginLeft: depth * 24 }}
      >
        {isAuthor ? (
          <div className="space-y-2">
            <p className="text-xs text-neutral-600 italic">
              [Hidden by moderator —{' '}
              <button
                onClick={() => setAppealing((v) => !v)}
                className="text-neutral-500 hover:text-neutral-300 underline underline-offset-2 transition-colors"
              >
                appeal
              </button>
              ]
            </p>
            {appealing && (
              <div className="space-y-2">
                <textarea
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                  maxLength={1000}
                  rows={2}
                  placeholder="Why should this be reviewed again?"
                  className="w-full rounded-md px-2 py-1.5 text-xs text-neutral-200 bg-white/[0.04] border border-white/[0.08] placeholder-neutral-600 resize-none focus:outline-none focus:border-white/[0.18] transition-colors"
                />
                {appealError && <p className="text-xs text-red-400">{appealError}</p>}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAppeal(id)}
                    disabled={appealLoading}
                    className="text-xs px-3 py-1.5 rounded-md transition-colors"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.07)',
                      color: '#f4f4f5',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                    }}
                  >
                    {appealLoading ? 'Submitting...' : 'Submit appeal'}
                  </button>
                  <button
                    onClick={() => { setAppealing(false); setAppealReason('') }}
                    className="text-xs text-neutral-600 hover:text-neutral-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-neutral-600 italic">
            [Content hidden by moderator]
          </p>
        )}
      </div>
    )
  }

  return (
    <div
      className="rounded-xl border border-white/[0.06] bg-black/40 px-4 py-4"
      style={{ marginLeft: depth * 24 }}
    >
      <div className="flex items-center justify-between mb-3">
        <ProfileBadge displayName={authorDisplayName} size="sm" />
        <div className="flex items-center gap-2 text-[10px] text-neutral-600">
          <span>{formatRelativeTime(createdAt)}</span>
          {editedAt && <span className="text-neutral-700">(edited)</span>}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            maxLength={5000}
            rows={4}
            className="w-full rounded-lg px-3 py-2 text-sm text-neutral-200 bg-white/[0.04] border border-white/[0.10] placeholder-neutral-600 resize-none focus:outline-none focus:border-white/[0.20] transition-colors"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveEdit}
              disabled={editLoading}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#f4f4f5',
                border: '1px solid rgba(255, 255, 255, 0.15)',
              }}
            >
              {editLoading ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setEditContent(content) }}
              className="text-xs text-neutral-600 hover:text-neutral-300 transition-colors"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-neutral-300 whitespace-pre-wrap">{content}</p>
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
          {showActions && (
            <div className="flex items-center gap-3 mt-3">
              {depth < MAX_REPLY_DEPTH && onReply && (
                <button
                  onClick={() => onReply(id)}
                  className="text-xs text-neutral-600 hover:text-neutral-300 transition-colors"
                >
                  Reply
                </button>
              )}
              {isAuthor && onEdit && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-neutral-600 hover:text-neutral-300 transition-colors"
                >
                  Edit
                </button>
              )}
              {isAuthor && onDelete && (
                confirming ? (
                  <>
                    <button
                      onClick={handleDelete}
                      disabled={deleteLoading}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      {deleteLoading ? 'Removing...' : 'Confirm remove'}
                    </button>
                    <button
                      onClick={() => setConfirming(false)}
                      className="text-xs text-neutral-600 hover:text-neutral-300 transition-colors"
                    >
                      Keep
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirming(true)}
                    className="text-xs text-neutral-600 hover:text-neutral-300 transition-colors"
                  >
                    Delete
                  </button>
                )
              )}
              {!isAuthor && !reported && (
                <button
                  onClick={() => setReporting((v) => !v)}
                  className="ml-auto flex items-center gap-1 text-xs text-neutral-700 hover:text-neutral-400 transition-colors"
                  title="Report this post"
                >
                  <Flag size={11} strokeWidth={1.75} />
                </button>
              )}
              {!isAuthor && reported && (
                <span className="ml-auto text-xs text-neutral-600">Reported</span>
              )}
            </div>
          )}
          {reporting && (
            <ReportForm
              targetType="post"
              targetId={id}
              onSubmitted={() => { setReporting(false); setReported(true) }}
              onCancel={() => setReporting(false)}
            />
          )}
        </>
      )}
    </div>
  )
}

