'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface PreserveButtonProps {
  investigationId: string
}

export function PreserveButton({ investigationId }: PreserveButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handlePreserve() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/archive/${investigationId}`, {
        method: 'POST',
      })
      if (res.ok) {
        router.refresh()
      } else {
        let message = 'Preservation failed. Please try again.'
        try {
          const body = await res.json()
          if (body?.error) message = body.error
        } catch {
          // ignore parse errors, keep default message
        }
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="inline-flex flex-col gap-1.5">
      <button
        onClick={handlePreserve}
        disabled={loading}
        aria-busy={loading}
        className="inline-flex items-center rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-150 disabled:opacity-50 bg-surface-3 border border-border-strong text-text-secondary hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
      >
        {loading ? 'Preserving…' : 'Preserve to Archive'}
      </button>
      {error && (
        <span className="text-[var(--accent-lever)] text-sm">{error}</span>
      )}
    </div>
  )
}
