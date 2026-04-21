'use client'

import { useState } from 'react'
import { REVIEW_DIMENSIONS, REVIEW_SUMMARY_MAX } from '@/lib/review/validation'

const DIMENSION_LABELS: Record<(typeof REVIEW_DIMENSIONS)[number], string> = {
  factualAccuracy: 'Factual Accuracy',
  sourceQuality: 'Source Quality',
  missingContext: 'Missing Context',
  strategicEffectiveness: 'Strategic Effectiveness',
  jurisdictionalAccuracy: 'Jurisdictional Accuracy',
}

const DIMENSION_DESCRIPTIONS: Record<(typeof REVIEW_DIMENSIONS)[number], string> = {
  factualAccuracy: 'Are the facts cited in the briefing accurate and verifiable?',
  sourceQuality: 'Are the sources credible, primary, and appropriate for the claims made?',
  missingContext: 'Does the briefing identify what important context might be absent?',
  strategicEffectiveness: 'Are the recommended actions realistic and well-targeted?',
  jurisdictionalAccuracy: 'Is the jurisdictional and regulatory context correctly interpreted?',
}

const SCORE_LABELS = ['', 'Poor', 'Below average', 'Adequate', 'Good', 'Excellent']

interface ReviewFormProps {
  investigationId: string
  onSubmitted: (review: unknown) => void
}

export function ReviewForm({ investigationId, onSubmitted }: ReviewFormProps) {
  const [scores, setScores] = useState<Record<string, number>>({
    factualAccuracy: 0,
    sourceQuality: 0,
    missingContext: 0,
    strategicEffectiveness: 0,
    jurisdictionalAccuracy: 0,
  })
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allScored = REVIEW_DIMENSIONS.every((dim) => scores[dim] > 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!allScored) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/investigate/${investigationId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...scores, summary: summary || undefined }),
      })

      if (res.status === 409) {
        setError('You have already reviewed this investigation')
        return
      }
      if (res.status === 403) {
        setError('You cannot review your own investigation')
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Failed to submit review')
        return
      }

      const data = await res.json()
      onSubmitted(data.review)
    } catch {
      setError('Failed to submit review')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-white/10 bg-black/60 p-6 backdrop-blur-md"
    >
      <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-neutral-500">
        Write a review
      </p>

      <div className="space-y-6">
        {REVIEW_DIMENSIONS.map((dim) => (
          <div key={dim}>
            <p className="mb-0.5 text-sm font-bold text-neutral-200">
              {DIMENSION_LABELS[dim]}
            </p>
            <p className="mb-2 text-xs text-neutral-500">
              {DIMENSION_DESCRIPTIONS[dim]}
            </p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((score) => {
                const selected = scores[dim] === score
                return (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setScores((prev) => ({ ...prev, [dim]: score }))}
                    title={SCORE_LABELS[score]}
                    className="flex-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: selected
                        ? 'rgba(255, 255, 255, 0.12)'
                        : 'transparent',
                      border: selected
                        ? '1px solid rgba(255, 255, 255, 0.25)'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      color: selected ? '#f4f4f5' : '#71717a',
                    }}
                  >
                    {score}
                    <span className="block text-[9px] font-normal mt-0.5 leading-tight">
                      {SCORE_LABELS[score]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-bold text-neutral-200">Summary</p>
            <span className="text-xs text-neutral-600">
              {summary.length} / {REVIEW_SUMMARY_MAX}
            </span>
          </div>
          <p className="mb-2 text-xs text-neutral-500">
            Optional. Share your overall assessment or any context for your scores.
          </p>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={REVIEW_SUMMARY_MAX}
            rows={4}
            placeholder="Your assessment..."
            className="w-full rounded-lg px-3 py-2 text-sm text-neutral-200 bg-white/[0.04] border border-white/[0.10] placeholder-neutral-600 resize-none focus:outline-none focus:border-white/[0.20] transition-colors"
          />
        </div>
      </div>

      {error && <p className="mt-4 text-xs text-red-400">{error}</p>}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={!allScored || loading}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          style={{
            backgroundColor: allScored ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: allScored ? '#f4f4f5' : '#52525b',
            cursor: allScored && !loading ? 'pointer' : 'not-allowed',
          }}
        >
          {loading ? 'Submitting...' : 'Submit review'}
        </button>
        {!allScored && (
          <span className="text-xs text-neutral-600">Score all five dimensions to submit</span>
        )}
      </div>
    </form>
  )
}
