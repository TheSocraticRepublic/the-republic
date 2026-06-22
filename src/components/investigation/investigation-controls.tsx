'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X, RotateCcw, Trash2 } from 'lucide-react'

type InvestigationStatus = 'generating' | 'complete' | 'failed' | 'cancelled' | 'active' | 'archived'

interface InvestigationControlsProps {
  id: string
  status: InvestigationStatus
}

/**
 * Inline action controls for an investigation card in the list view.
 * Rendered as a client component so we can call the cancel/retry/delete APIs.
 * Stop-propagation prevents the parent <Link> from navigating when a control is clicked.
 */
export function InvestigationControls({ id, status }: InvestigationControlsProps) {
  const router = useRouter()
  const [pending, setPending] = useState<'cancel' | 'retry' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleCancel(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (pending) return
    setPending('cancel')
    setError(null)
    try {
      const res = await fetch(`/api/investigate/${id}/cancel`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Cancel failed')
      } else {
        router.refresh()
      }
    } catch {
      setError('Network error')
    } finally {
      setPending(null)
    }
  }

  async function handleRetry(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (pending) return
    setPending('retry')
    setError(null)
    try {
      // Retry returns 202 immediately — generation runs in the background
      const res = await fetch(`/api/investigate/${id}/retry`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Retry failed')
        setPending(null)
        return
      }
      // Refresh the page — the server component will re-render with status='generating'
      // and the GeneratingPoller will start polling
      router.refresh()
    } catch {
      setError('Network error')
      setPending(null)
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (pending) return
    if (!window.confirm('Delete this investigation? This cannot be undone.')) return
    setPending('delete')
    setError(null)
    try {
      const res = await fetch(`/api/investigate/${id}/delete`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Delete failed')
      } else {
        router.refresh()
      }
    } catch {
      setError('Network error')
    } finally {
      setPending(null)
    }
  }

  const isDisabled = pending !== null

  return (
    <div
      className="flex items-center gap-1 mt-2"
      role="group"
      aria-label="Investigation actions"
    >
      {error && (
        <span className="text-[10px] text-red-400 mr-1" role="alert">{error}</span>
      )}

      {status === 'generating' && (
        <button
          onClick={handleCancel}
          disabled={isDisabled}
          aria-label="Cancel investigation"
          title="Cancel"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-text-muted transition-colors hover:text-text-secondary hover:bg-surface-3 disabled:opacity-40"
        >
          {pending === 'cancel' ? (
            <Loader2 size={10} className="animate-spin" />
          ) : (
            <X size={10} strokeWidth={2} />
          )}
          Cancel
        </button>
      )}

      {(status === 'failed' || status === 'cancelled') && (
        <button
          onClick={handleRetry}
          disabled={isDisabled}
          aria-label="Retry investigation generation"
          title="Retry"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-text-muted transition-colors hover:text-text-secondary hover:bg-surface-3 disabled:opacity-40"
        >
          {pending === 'retry' ? (
            <Loader2 size={10} className="animate-spin" />
          ) : (
            <RotateCcw size={10} strokeWidth={2} />
          )}
          Retry
        </button>
      )}

      {status !== 'generating' && (
        <button
          onClick={handleDelete}
          disabled={isDisabled}
          aria-label="Delete investigation"
          title="Delete"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-text-muted transition-colors hover:text-red-400 hover:bg-surface-3 disabled:opacity-40"
        >
          {pending === 'delete' ? (
            <Loader2 size={10} className="animate-spin" />
          ) : (
            <Trash2 size={10} strokeWidth={2} />
          )}
          Delete
        </button>
      )}
    </div>
  )
}
