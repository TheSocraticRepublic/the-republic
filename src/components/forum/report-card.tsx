'use client'

import { useState } from 'react'
import { formatRelativeTime } from '@/lib/format-relative-time'

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  misinformation: 'Misinformation',
  off_topic: 'Off topic',
  other: 'Other',
}

interface ReportTarget {
  id: string
  status: string
  authorDisplayName: string
  content?: string  // posts have content
  title?: string    // threads have title
}

interface ReportCardProps {
  id: string
  targetType: 'post' | 'thread'
  targetId: string
  reason: string
  description: string | null
  status: string
  reviewedBy: string | null
  createdAt: Date | string
  reporterDisplayName: string
  target: ReportTarget | null
  isAppeal?: boolean
  onActioned: (reportId: string) => void
}

export function ReportCard({
  id,
  targetType,
  targetId,
  reason,
  description,
  createdAt,
  reporterDisplayName,
  target,
  isAppeal,
  onActioned,
}: ReportCardProps) {
  const [actionReason, setActionReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function applyAction(action: string) {
    if (!actionReason.trim()) {
      setError('Reason is required')
      return
    }
    setLoading(true)
    setError(null)

    // For dismiss_report, targetId for the API is the reportId itself
    const isDismiss = action === 'dismiss_report'

    try {
      const res = await fetch('/api/forum/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          targetId: isDismiss ? id : targetId,
          reason: actionReason,
          reportId: isDismiss ? undefined : id,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to apply action')
      }
      onActioned(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply action')
    } finally {
      setLoading(false)
    }
  }

  const contentPreview = target
    ? target.content
      ? target.content.slice(0, 300)
      : target.title ?? ''
    : '[Content unavailable]'

  const isPost = targetType === 'post'

  return (
    <div
      className="rounded-xl border border-white/[0.07] bg-black/40 p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span>
            Reported {targetType} by{' '}
            <span className="text-neutral-400">{reporterDisplayName}</span>
          </span>
          <span>{formatRelativeTime(createdAt)}</span>
        </div>
        <div className="flex items-center gap-2">
          {isAppeal && (
            <span
              className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{
                backgroundColor: 'rgba(200, 160, 75, 0.15)',
                color: '#C8A84B',
                border: '1px solid rgba(200, 160, 75, 0.25)',
              }}
            >
              Appeal
            </span>
          )}
          <span
            className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: '#a1a1aa',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {REASON_LABELS[reason] ?? reason}
          </span>
        </div>
      </div>

      {/* Content preview */}
      {target && (
        <div
          className="rounded-lg px-3 py-2 text-xs text-neutral-400"
          style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          <p className="text-[10px] text-neutral-600 mb-1">
            {isPost ? 'Post' : 'Thread'} by {target.authorDisplayName}
            {target.status !== 'visible' && target.status !== 'open' && (
              <span className="ml-2 text-amber-600">({target.status})</span>
            )}
          </p>
          <p className="leading-relaxed whitespace-pre-wrap line-clamp-4">{contentPreview}</p>
        </div>
      )}

      {/* Reporter description */}
      {description && (
        <p className="text-xs text-neutral-500 italic">&ldquo;{description}&rdquo;</p>
      )}

      {/* Action area */}
      <div className="space-y-2 pt-1">
        <textarea
          value={actionReason}
          onChange={(e) => setActionReason(e.target.value)}
          maxLength={1000}
          rows={2}
          placeholder="Reason for action (required)"
          className="w-full rounded-md px-2 py-1.5 text-xs text-neutral-200 bg-white/[0.04] border border-white/[0.08] placeholder-neutral-600 resize-none focus:outline-none focus:border-white/[0.18] transition-colors"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          {isPost && (
            <>
              <button
                onClick={() => applyAction('hide_post')}
                disabled={loading}
                className="text-xs px-3 py-1.5 rounded-md transition-colors"
                style={{
                  backgroundColor: 'rgba(200, 91, 91, 0.12)',
                  color: '#C85B5B',
                  border: '1px solid rgba(200, 91, 91, 0.25)',
                }}
              >
                Hide post
              </button>
              <button
                onClick={() => applyAction('unhide_post')}
                disabled={loading}
                className="text-xs px-3 py-1.5 rounded-md transition-colors"
                style={{
                  backgroundColor: 'rgba(91, 200, 138, 0.10)',
                  color: '#5BC88A',
                  border: '1px solid rgba(91, 200, 138, 0.22)',
                }}
              >
                Unhide post
              </button>
            </>
          )}
          {!isPost && (
            <>
              <button
                onClick={() => applyAction('lock_thread')}
                disabled={loading}
                className="text-xs px-3 py-1.5 rounded-md transition-colors"
                style={{
                  backgroundColor: 'rgba(200, 91, 91, 0.12)',
                  color: '#C85B5B',
                  border: '1px solid rgba(200, 91, 91, 0.25)',
                }}
              >
                Lock thread
              </button>
              <button
                onClick={() => applyAction('unlock_thread')}
                disabled={loading}
                className="text-xs px-3 py-1.5 rounded-md transition-colors"
                style={{
                  backgroundColor: 'rgba(91, 200, 138, 0.10)',
                  color: '#5BC88A',
                  border: '1px solid rgba(91, 200, 138, 0.22)',
                }}
              >
                Unlock thread
              </button>
            </>
          )}
          <button
            onClick={() => applyAction('dismiss_report')}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-md transition-colors text-neutral-500 hover:text-neutral-300"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
