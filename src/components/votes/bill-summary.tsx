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
          No AI summary available yet.
        </p>
        <button
          onClick={generateSummary}
          className="rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-150"
          style={{
            color: '#D4764E',
            backgroundColor: 'rgba(212,118,78,0.10)',
            border: '1px solid rgba(212,118,78,0.20)',
          }}
        >
          Summarize this bill
        </button>
        {error && (
          <p className="mt-2 text-xs text-red-400">Failed to generate summary.</p>
        )}
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl p-8"
      style={{ backgroundColor: '#f8f6f3' }}
    >
      <div className="mb-4 flex items-center justify-between">
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: '#a8a29e' }}
        >
          AI Summary
        </p>
        {isStreaming && (
          <span className="flex items-center gap-1.5 text-[10px]" style={{ color: '#a8a29e' }}>
            <Loader2 size={10} className="animate-spin" />
            Generating
          </span>
        )}
      </div>

      <SectionedMarkdown text={summary} isStreaming={isStreaming} />
    </div>
  )
}
