'use client'

import { useState, useRef } from 'react'
import { Loader2 } from 'lucide-react'

interface VoteExplanationProps {
  voteId: string
  existingExplanation?: string | null
}

export function VoteExplanation({ voteId, existingExplanation }: VoteExplanationProps) {
  const [explanation, setExplanation] = useState(existingExplanation ?? '')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState(false)
  const startedRef = useRef(false)

  async function generateExplanation() {
    if (startedRef.current) return
    startedRef.current = true
    setIsStreaming(true)
    setError(false)

    try {
      const res = await fetch(`/api/parliament/votes/${voteId}/explain`, {
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
        setExplanation(accumulated)
      }
    } catch {
      setError(true)
      startedRef.current = false
    } finally {
      setIsStreaming(false)
    }
  }

  if (!explanation && !isStreaming) {
    return (
      <button
        onClick={generateExplanation}
        className="rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-150"
        style={{
          color: '#D4764E',
          backgroundColor: 'rgba(212,118,78,0.10)',
          border: '1px solid rgba(212,118,78,0.20)',
        }}
      >
        Explain this vote
      </button>
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
          What This Vote Means
        </p>
        {isStreaming && (
          <span className="flex items-center gap-1.5 text-[10px]" style={{ color: '#a8a29e' }}>
            <Loader2 size={10} className="animate-spin" />
            Analyzing
          </span>
        )}
      </div>

      <div
        className="whitespace-pre-wrap"
        style={{ color: '#292524', fontSize: '15px', lineHeight: '1.7' }}
      >
        {explanation}
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-400">Failed to generate explanation.</p>
      )}
    </div>
  )
}
