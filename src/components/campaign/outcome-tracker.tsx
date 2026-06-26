'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Star, Check } from 'lucide-react'

interface TrackedMaterial {
  id: string
  materialType: string
  title: string
  createdAt: string
}

interface Outcome {
  id: string
  outcomeType: string
  description: string
  outcomeDate: string | null
  satisfaction: number | null
  lessonsLearned: string | null
  createdAt: string
}

interface OutcomeTrackerProps {
  investigationId: string
  materials: TrackedMaterial[]
}

type PromptKey = 'foi' | 'response' | 'council'
type OutcomeStatus = 'yes' | 'not_yet' | null

const PROMPT_TO_OUTCOME_TYPE: Record<PromptKey, string> = {
  foi: 'fippa_response_received',
  response: 'fippa_response_received',
  council: 'council_presentation',
}

const OUTCOME_TYPE_LABELS: Record<string, string> = {
  fippa_response_received: 'FIPPA response',
  comment_submitted: 'Comment submitted',
  council_presentation: 'Council presentation',
  media_coverage: 'Media coverage',
  policy_change: 'Policy change',
  assessment_decision: 'Assessment decision',
  other: 'Other',
}

export function OutcomeTracker({ investigationId, materials }: OutcomeTrackerProps) {
  const [promptState, setPromptState] = useState<Record<PromptKey, OutcomeStatus>>({
    foi: null,
    response: null,
    council: null,
  })
  const [activeForm, setActiveForm] = useState<PromptKey | null>(null)
  const [description, setDescription] = useState('')
  const [outcomeDate, setOutcomeDate] = useState('')
  const [satisfaction, setSatisfaction] = useState<number>(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [outcomes, setOutcomes] = useState<Outcome[]>([])
  const [loadingOutcomes, setLoadingOutcomes] = useState(true)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const fetchOutcomes = useCallback(async () => {
    try {
      const res = await fetch(`/api/investigate/${investigationId}/outcomes`)
      if (res.ok) {
        const data = await res.json()
        setOutcomes(data)
      }
    } catch {
      // Silently fail — non-critical
    } finally {
      setLoadingOutcomes(false)
    }
  }, [investigationId])

  useEffect(() => {
    fetchOutcomes()
  }, [fetchOutcomes])

  function handlePromptClick(field: PromptKey, value: OutcomeStatus) {
    setPromptState((prev) => ({ ...prev, [field]: value }))

    if (value === 'yes') {
      setActiveForm(field)
      setDescription('')
      setOutcomeDate('')
      setSatisfaction(0)
      setSubmitSuccess(false)
      setSubmitError(null)
    } else {
      if (activeForm === field) {
        setActiveForm(null)
      }
    }
  }

  async function handleSubmit() {
    if (!activeForm || !description.trim() || submitting) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(
        `/api/investigate/${investigationId}/outcomes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            outcomeType: PROMPT_TO_OUTCOME_TYPE[activeForm],
            description: description.trim(),
            outcomeDate: outcomeDate || undefined,
            satisfaction: satisfaction > 0 ? satisfaction : undefined,
          }),
        }
      )

      if (res.ok) {
        setSubmitSuccess(true)
        setActiveForm(null)
        setDescription('')
        setOutcomeDate('')
        setSatisfaction(0)
        setSubmitError(null)
        // Refresh the outcomes list
        await fetchOutcomes()
        // Clear the success indicator after a moment
        setTimeout(() => setSubmitSuccess(false), 3000)
      } else {
        const data = await res.json().catch(() => null)
        setSubmitError(data?.error ?? 'Failed to save outcome. Please try again.')
      }
    } catch {
      setSubmitError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="rounded-2xl border px-6 py-6 space-y-6"
      style={{
        backgroundColor: 'var(--surface-1)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Header */}
      <div className="space-y-1">
        <p
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--accent-lever)' }}
        >
          How is it going?
        </p>
        <p className="text-xs leading-relaxed text-text-muted">
          {materials.length > 0
            ? `You have generated ${materials.length} material${materials.length > 1 ? 's' : ''}. Let us know how they are being used.`
            : 'Track what happens after you act.'}
        </p>
      </div>

      {/* Prompts */}
      <div className="space-y-5">
        {/* FOI */}
        <div className="space-y-2">
          <p className="text-sm text-text-primary">
            Did you file the FOI request?
          </p>
          <div className="flex flex-wrap gap-2">
            <OutcomeButton
              label="Yes"
              active={promptState.foi === 'yes'}
              onClick={() => handlePromptClick('foi', 'yes')}
            />
            <OutcomeButton
              label="Not yet"
              active={promptState.foi === 'not_yet'}
              onClick={() => handlePromptClick('foi', 'not_yet')}
            />
          </div>
          {activeForm === 'foi' && (
            <OutcomeForm
              description={description}
              onDescriptionChange={setDescription}
              outcomeDate={outcomeDate}
              onOutcomeDateChange={setOutcomeDate}
              satisfaction={satisfaction}
              onSatisfactionChange={setSatisfaction}
              onSubmit={handleSubmit}
              onCancel={() => setActiveForm(null)}
              submitting={submitting}
              error={submitError}
            />
          )}
        </div>

        {/* Response */}
        <div className="space-y-2">
          <p className="text-sm text-text-primary">
            Has the public body responded?
          </p>
          <div className="flex flex-wrap gap-2">
            <OutcomeButton
              label="Yes, I got a response"
              active={promptState.response === 'yes'}
              onClick={() => handlePromptClick('response', 'yes')}
            />
            <OutcomeButton
              label="No response yet"
              active={promptState.response === 'not_yet'}
              onClick={() => handlePromptClick('response', 'not_yet')}
            />
          </div>
          {activeForm === 'response' && (
            <OutcomeForm
              description={description}
              onDescriptionChange={setDescription}
              outcomeDate={outcomeDate}
              onOutcomeDateChange={setOutcomeDate}
              satisfaction={satisfaction}
              onSatisfactionChange={setSatisfaction}
              onSubmit={handleSubmit}
              onCancel={() => setActiveForm(null)}
              submitting={submitting}
              error={submitError}
            />
          )}
        </div>

        {/* Council */}
        <div className="space-y-2">
          <p className="text-sm text-text-primary">
            Did you present at a council meeting?
          </p>
          <div className="flex flex-wrap gap-2">
            <OutcomeButton
              label="Yes"
              active={promptState.council === 'yes'}
              onClick={() => handlePromptClick('council', 'yes')}
            />
            <OutcomeButton
              label="Not yet"
              active={promptState.council === 'not_yet'}
              onClick={() => handlePromptClick('council', 'not_yet')}
            />
          </div>
          {activeForm === 'council' && (
            <OutcomeForm
              description={description}
              onDescriptionChange={setDescription}
              outcomeDate={outcomeDate}
              onOutcomeDateChange={setOutcomeDate}
              satisfaction={satisfaction}
              onSatisfactionChange={setSatisfaction}
              onSubmit={handleSubmit}
              onCancel={() => setActiveForm(null)}
              submitting={submitting}
              error={submitError}
            />
          )}
        </div>
      </div>

      {/* Success toast */}
      {submitSuccess && (
        <div
          className="rounded-lg px-4 py-3 text-xs flex items-center gap-2"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--accent-mirror) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-mirror) 18%, transparent)',
            color: 'var(--accent-mirror)',
          }}
        >
          <Check size={12} />
          Outcome recorded. Thank you for closing the loop.
        </div>
      )}

      {/* Previously recorded outcomes */}
      {loadingOutcomes ? (
        <div className="flex items-center gap-2 text-xs text-text-faint py-2">
          <Loader2 size={12} className="animate-spin" />
          Loading outcomes...
        </div>
      ) : outcomes.length > 0 ? (
        <div className="space-y-3 pt-2">
          <div className="h-px w-full" style={{ backgroundColor: 'var(--border)' }} />
          <p
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: 'color-mix(in srgb, var(--accent-lever) 60%, transparent)' }}
          >
            Recorded Outcomes
          </p>
          <div className="space-y-2">
            {outcomes.map((o) => (
              <div
                key={o.id}
                className="rounded-xl border px-4 py-3"
                style={{
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--surface-1)',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-text-faint mb-1">
                      {OUTCOME_TYPE_LABELS[o.outcomeType] ?? o.outcomeType}
                    </p>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      {o.description}
                    </p>
                    {o.outcomeDate && (
                      <p className="mt-1 text-[10px] text-text-faint">
                        {o.outcomeDate}
                      </p>
                    )}
                  </div>
                  {o.satisfaction && (
                    <div className="flex gap-0.5 shrink-0">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          size={10}
                          className={
                            n <= o.satisfaction!
                              ? 'fill-[var(--accent-lever)] text-[var(--accent-lever)]'
                              : 'text-text-faint'
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

// --- Inline form for recording an outcome ---

function OutcomeForm({
  description,
  onDescriptionChange,
  outcomeDate,
  onOutcomeDateChange,
  satisfaction,
  onSatisfactionChange,
  onSubmit,
  onCancel,
  submitting,
  error,
}: {
  description: string
  onDescriptionChange: (v: string) => void
  outcomeDate: string
  onOutcomeDateChange: (v: string) => void
  satisfaction: number
  onSatisfactionChange: (v: number) => void
  onSubmit: () => void
  onCancel: () => void
  submitting: boolean
  error: string | null
}) {
  return (
    <div
      className="rounded-xl border px-4 py-4 space-y-3 mt-2"
      style={{
        borderColor: 'color-mix(in srgb, var(--accent-lever) 15%, transparent)',
        backgroundColor: 'color-mix(in srgb, var(--accent-lever) 3%, transparent)',
      }}
    >
      {/* Description */}
      <div className="space-y-1">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          What happened?
        </label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Describe the outcome..."
          rows={3}
          className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm text-text-primary placeholder-neutral-600 focus:outline-none focus:border-[var(--accent-lever)]/40 resize-none"
          style={{ borderColor: 'var(--border-strong)' }}
        />
      </div>

      {/* Date picker */}
      <div className="space-y-1">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          Date (optional)
        </label>
        <input
          type="date"
          value={outcomeDate}
          onChange={(e) => onOutcomeDateChange(e.target.value)}
          className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-[var(--accent-lever)]/40 [color-scheme:light]"
          style={{ borderColor: 'var(--border-strong)' }}
        />
      </div>

      {/* Satisfaction 1-5 stars */}
      <div className="space-y-1">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          Satisfaction (optional)
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => onSatisfactionChange(satisfaction === n ? 0 : n)}
              className="p-0.5 transition-colors focus-visible:outline-none"
              type="button"
            >
              <Star
                size={16}
                className={
                  n <= satisfaction
                    ? 'fill-[var(--accent-lever)] text-[var(--accent-lever)]'
                    : 'text-text-faint hover:text-text-muted'
                }
              />
            </button>
          ))}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div
          className="rounded-lg px-3 py-2 text-xs"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--accent-lever) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-lever) 18%, transparent)',
            color: 'var(--accent-lever)',
          }}
        >
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 justify-end pt-1">
        <button
          onClick={onCancel}
          className="text-[10px] text-text-faint hover:text-text-secondary transition-colors px-3 py-1.5"
          type="button"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={!description.trim() || submitting}
          className="rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-150 disabled:opacity-40"
          style={{
            color: 'var(--accent-lever)',
            backgroundColor: 'color-mix(in srgb, var(--accent-lever) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-lever) 25%, transparent)',
          }}
          type="button"
        >
          {submitting ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" />
              Saving...
            </span>
          ) : (
            'Record outcome'
          )}
        </button>
      </div>
    </div>
  )
}

// --- Outcome button (shared with prompts) ---

function OutcomeButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-lever)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-0"
      style={{
        backgroundColor: active
          ? 'var(--surface-3)'
          : 'var(--surface-1)',
        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        border: active
          ? '1px solid var(--border-strong)'
          : '1px solid var(--border)',
      }}
    >
      {label}
    </button>
  )
}
