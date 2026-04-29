'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ContradictionCard, type Contradiction } from './contradiction-card'

interface ContradictionListProps {
  mpId: string
}

export function ContradictionList({ mpId }: ContradictionListProps) {
  const [contradictions, setContradictions] = useState<Contradiction[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  async function analyze() {
    setLoading(true)
    setError(false)

    try {
      const res = await fetch(`/api/parliament/mps/${mpId}/contradictions`, {
        method: 'POST',
      })

      if (!res.ok) {
        setError(true)
        setLoading(false)
        return
      }

      const data = await res.json()
      setContradictions(data.contradictions ?? [])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  if (contradictions === null && !loading) {
    return (
      <div
        className="rounded-xl border px-6 py-6 text-center"
        style={{
          borderColor: 'rgba(255,255,255,0.06)',
          backgroundColor: 'rgba(255,255,255,0.015)',
        }}
      >
        <p className="text-xs text-neutral-500 mb-4">
          Compare what this MP has said in Parliament against how they voted.
        </p>
        <button
          onClick={analyze}
          className="rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-150"
          style={{
            color: '#D4764E',
            backgroundColor: 'rgba(212,118,78,0.10)',
            border: '1px solid rgba(212,118,78,0.20)',
          }}
        >
          Check for contradictions
        </button>
        {error && (
          <p className="mt-2 text-xs text-red-400">Analysis failed. Try again.</p>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8">
        <Loader2 size={14} className="animate-spin text-neutral-500" />
        <span className="text-xs text-neutral-500">
          Analyzing statements against voting record...
        </span>
      </div>
    )
  }

  if (contradictions && contradictions.length === 0) {
    return (
      <div
        className="rounded-xl border px-6 py-6 text-center"
        style={{
          borderColor: 'rgba(255,255,255,0.06)',
          backgroundColor: 'rgba(255,255,255,0.015)',
        }}
      >
        <p className="text-xs text-neutral-500">
          No clear contradictions found between statements and votes. This is a valid outcome.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {contradictions?.map((c, i) => (
        <ContradictionCard key={i} contradiction={c} />
      ))}
    </div>
  )
}
