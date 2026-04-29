'use client'

import { useState, useRef } from 'react'
import { Loader2 } from 'lucide-react'

interface MpLetterGeneratorProps {
  mpId: string
  mpName: string
  defaultConcern?: string
  voteIds?: string[]
  investigationId?: string
}

export function MpLetterGenerator({
  mpId,
  mpName,
  defaultConcern = '',
  voteIds,
  investigationId,
}: MpLetterGeneratorProps) {
  const [concern, setConcern] = useState(defaultConcern)
  const [letter, setLetter] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const startedRef = useRef(false)

  async function generateLetter() {
    if (startedRef.current || !concern.trim()) return
    startedRef.current = true
    setIsStreaming(true)

    try {
      const res = await fetch(`/api/parliament/mps/${mpId}/letter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concern: concern.trim(),
          voteIds,
          investigationId,
        }),
      })

      if (!res.ok || !res.body) {
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
        setLetter(accumulated)
      }
    } catch {
      startedRef.current = false
    } finally {
      setIsStreaming(false)
    }
  }

  if (letter) {
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
            Letter to {mpName}
          </p>
          {isStreaming && (
            <span className="flex items-center gap-1.5 text-[10px]" style={{ color: '#a8a29e' }}>
              <Loader2 size={10} className="animate-spin" />
              Writing
            </span>
          )}
        </div>
        <div
          className="whitespace-pre-wrap font-mono"
          style={{ color: '#292524', fontSize: '13px', lineHeight: '1.8' }}
        >
          {letter}
        </div>
      </div>
    )
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="rounded-xl px-4 py-2.5 text-xs font-semibold transition-all duration-150"
        style={{
          color: '#D4764E',
          backgroundColor: 'rgba(212,118,78,0.10)',
          border: '1px solid rgba(212,118,78,0.20)',
        }}
      >
        Write to your MP
      </button>
    )
  }

  return (
    <div
      className="rounded-xl border px-5 py-5 space-y-4"
      style={{
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(255,255,255,0.02)',
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-600">
        Write to {mpName}
      </p>
      <textarea
        value={concern}
        onChange={(e) => setConcern(e.target.value)}
        placeholder="What do you want to tell your MP about?"
        rows={4}
        className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 resize-none"
        style={{ borderColor: 'rgba(255,255,255,0.1)' }}
      />
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={() => setShowForm(false)}
          className="text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors px-3 py-1.5"
        >
          Cancel
        </button>
        <button
          onClick={generateLetter}
          disabled={!concern.trim() || isStreaming}
          className="rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-150 disabled:opacity-40"
          style={{
            color: '#D4764E',
            backgroundColor: 'rgba(212,118,78,0.10)',
            border: '1px solid rgba(212,118,78,0.20)',
          }}
        >
          {isStreaming ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" />
              Generating...
            </span>
          ) : (
            'Generate letter'
          )}
        </button>
      </div>
    </div>
  )
}
