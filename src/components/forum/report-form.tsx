'use client'

import { useState } from 'react'

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  misinformation: 'Misinformation',
  off_topic: 'Off topic',
  other: 'Other',
}

interface ReportFormProps {
  targetType: 'post' | 'thread'
  targetId: string
  onSubmitted: () => void
  onCancel: () => void
}

export function ReportForm({ targetType, targetId, onSubmitted, onCancel }: ReportFormProps) {
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason) {
      setError('Please select a reason')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/forum/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, reason, description: description || undefined }),
      })
      if (res.status === 409) {
        setError('You have already reported this content')
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to submit report')
      }
      onSubmitted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 rounded-lg border border-border bg-surface-1 shadow-sm p-3 space-y-2"
    >
      <label htmlFor="reportReason" className="text-xs font-medium text-text-secondary">Report this {targetType}</label>
      <select
        id="reportReason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full rounded-md px-2 py-1.5 text-xs text-text-primary bg-surface-3 border border-border-strong focus:outline-none focus:border-border-strong transition-colors"
      >
        <option value="">Select a reason</option>
        {Object.entries(REASON_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={1000}
        rows={2}
        placeholder="Additional context (optional)"
        className="w-full rounded-md px-2 py-1.5 text-xs text-text-primary bg-surface-1 border border-border placeholder-text-faint resize-none focus:outline-none focus:border-border-strong transition-colors"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-md font-medium transition-colors bg-surface-3 border border-border-strong text-text-primary hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Submitting...' : 'Submit report'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-text-faint hover:text-text-secondary transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
