'use client'

import { useState, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { SectionedMarkdown } from '@/components/ui/markdown-prose'

interface BillSummaryProps {
  billId: string
  existingSummary?: string | null
}

export function BillSummary({ billId, existingSummary }: BillSummaryProps) {
  const [summary, setSummary] = useState(existingSummary ?? '')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState(false)
  const startedRef = useRef(false)

  async function generateSummary() {
    if (startedRef.current) return
    startedRef.current = true
    setIsStreaming(true)
    setError(false)

    try {
      const res = await fetch(`/api/parliament/bills/${billId}/summarize`, {
        method: 'POST',
      })

      if (!res.ok || !res.body) {
        setError(true)
        setIsStreaming(false)
        startedRef.current = false
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setSummary(accumulated)
      }
    } catch {
      setError(true)
      startedRef.current = false
    } finally {
      setIsStreaming(false)
    }
  }

  if (!summary && !isStreaming) {
    return (
      <div
        className="rounded-xl border px-6 py-6 text-center"
        style={{
          borderColor: 'var(--border)',
          backgroundColor: 'var(--surface-1)',
        }}
      >
        <p className="text-xs text-text-muted mb-4">
          No AI overview available yet. This overview is based on the bill&apos;s title and metadata, not the bill text.
        </p>
        <button
          onClick={generateSummary}
          className="rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-150"
          style={{
            color: 'var(--accent-votes)',
            backgroundColor: 'rgba(212,118,78,0.10)',
            border: '1px solid rgba(212,118,78,0.20)',
          }}
        >
          Explain this bill&apos;s metadata
        </button>
        {error && (
          <p className="mt-2 text-xs text-status-danger">Failed to generate summary.</p>
        )}
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl p-8"
      style={{ backgroundColor: 'var(--color-island-bg)' }}
    >
      <div className="mb-4 flex items-center justify-between">
        <p
          className="text-3xs font-semibold uppercase"
          style={{ color: 'var(--color-island-muted)' }}
        >
          AI Overview — based on metadata only
        </p>
        {isStreaming && (
          <span className="flex items-center gap-1.5 text-2xs font-medium" style={{ color: 'var(--color-island-muted)' }}>
            <Loader2 size={10} className="animate-spin" />
            Generating
          </span>
        )}
      </div>

      <SectionedMarkdown text={summary} isStreaming={isStreaming} />
    </div>
  )
}
