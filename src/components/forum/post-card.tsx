'use client'

import { useState } from 'react'
import { ProfileBadge } from '@/components/profile/profile-badge'
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
  const [error, setError] = useState<string | null>(null)

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
    if (!confirm('Remove this post?')) return
    setDeleteLoading(true)
    setError(null)
    try {
      await onDelete(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
      setDeleteLoading(false)
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
                <button
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="text-xs text-neutral-600 hover:text-neutral-300 transition-colors"
                >
                  {deleteLoading ? 'Removing...' : 'Delete'}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

