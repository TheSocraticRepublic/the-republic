'use client'

import { useState, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { SectionedMarkdown } from '@/components/ui/markdown-prose'

interface VotingPatternsProps {
  mpId: string
}

export function VotingPatterns({ mpId }: VotingPatternsProps) {
  const [analysis, setAnalysis] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState(false)
  const startedRef = useRef(false)

  async function generatePatterns() {
    if (startedRef.current) return
    startedRef.current = true
    setIsStreaming(true)
    setError(false)

    try {
      const res = await fetch(`/api/parliament/mps/${mpId}/patterns`, {
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
        setAnalysis(accumulated)
      }
    } catch {
      setError(true)
      startedRef.current = false
    } finally {
      setIsStreaming(false)
    }
  }

  if (!analysis && !isStreaming) {
    return (
      <div
        className="rounded-xl border px-6 py-6 text-center"
        style={{
          borderColor: 'var(--border)',
          backgroundColor: 'var(--surface-1)',
        }}
      >
        <p className="text-xs text-text-muted mb-4">
          See how this MP generally votes across policy areas.
        </p>
        <button
          onClick={generatePatterns}
          className="rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-150"
          style={{
            color: '#D4764E',
            backgroundColor: 'rgba(212,118,78,0.10)',
            border: '1px solid rgba(212,118,78,0.20)',
          }}
        >
          Analyze voting patterns
        </button>
        {error && (
          <p className="mt-2 text-xs text-red-400">Analysis failed. Try again.</p>
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
          Voting Patterns
        </p>
        {isStreaming && (
          <span className="flex items-center gap-1.5 text-[10px]" style={{ color: '#a8a29e' }}>
            <Loader2 size={10} className="animate-spin" />
            Analyzing
          </span>
        )}
      </div>

      <SectionedMarkdown text={analysis} isStreaming={isStreaming} />
    </div>
  )
}
