'use client'

import { useState, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, MessageSquarePlus } from 'lucide-react'
import { clsx } from 'clsx'

type FeedbackType = 'bug' | 'suggestion'

const TYPE_OPTIONS: { value: FeedbackType; label: string; subtitle: string }[] = [
  { value: 'bug', label: 'Bug', subtitle: 'Something is broken' },
  { value: 'suggestion', label: 'Suggestion', subtitle: 'Idea or request' },
]

export function FeedbackDialog() {
  const [open, setOpen] = useState(false)
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const reset = useCallback(() => {
    setFeedbackType('bug')
    setDescription('')
    setError(null)
    setSubmitted(false)
    setSubmitting(false)
  }, [])

  const handleOpenChange = useCallback(
    (v: boolean) => {
      setOpen(v)
      if (!v) reset()
    },
    [reset]
  )

  const handleSubmit = useCallback(async () => {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackType,
          description: description.trim(),
          pageContext: typeof window !== 'undefined' ? window.location.pathname : null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Submission failed')
      }
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [feedbackType, description])

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button className="flex items-center gap-1.5 text-[11px] text-text-muted transition-colors hover:text-text-secondary">
          <MessageSquarePlus size={11} strokeWidth={1.75} />
          Report a bug or suggestion
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <Dialog.Content
          aria-describedby={submitted ? 'feedback-success' : 'feedback-desc'}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md sm:w-full -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border-strong bg-surface-1 p-6 shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {/* Header */}
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title
              className="text-base font-semibold text-text-primary"
              style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
            >
              {submitted ? 'Thanks' : 'Send feedback'}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close feedback dialog"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text-secondary"
            >
              <X size={14} strokeWidth={2} />
            </Dialog.Close>
          </div>

          {submitted ? (
            <p
              id="feedback-success"
              className="text-sm text-text-muted leading-relaxed"
            >
              Received. We read every report.
            </p>
          ) : (
            <div className="space-y-4">
              <p id="feedback-desc" className="sr-only">
                Submit a bug report or suggestion for Open Cave.
              </p>

              {/* Type toggle */}
              <div>
                <p
                  id="feedback-type-label"
                  className="mb-1.5 block text-xs font-medium text-text-secondary"
                >
                  Type
                </p>
                <div
                  role="group"
                  aria-labelledby="feedback-type-label"
                  className="grid grid-cols-2 gap-2"
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={feedbackType === opt.value}
                      onClick={() => setFeedbackType(opt.value)}
                      className={clsx(
                        'rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-all duration-150',
                        feedbackType === opt.value
                          ? 'border-white/20 bg-white/10 text-text-primary'
                          : 'border-border bg-surface-1 text-text-muted hover:border-border-strong hover:text-text-secondary'
                      )}
                    >
                      <span className="block font-medium">{opt.label}</span>
                      <span className="block text-[10px] opacity-70">{opt.subtitle}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="feedback-description"
                  className="mb-1.5 block text-xs font-medium text-text-secondary"
                >
                  Description
                </label>
                <textarea
                  id="feedback-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder={
                    feedbackType === 'bug'
                      ? 'What happened? What did you expect?'
                      : 'What would you like to see?'
                  }
                  maxLength={5000}
                  className="w-full resize-none rounded-lg border border-border-strong bg-surface-1 px-3 py-2 text-sm text-text-primary placeholder-text-faint outline-none focus:border-white/20 shadow-sm"
                />
                <p className="mt-1 text-right text-[10px] text-text-faint">
                  {description.length} / 5000
                </p>
              </div>

              {/* Error */}
              {error && (
                <p role="alert" className="text-xs text-red-400">
                  {error}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          {!submitted && (
            <div className="mt-6 flex justify-end gap-3">
              <Dialog.Close className="rounded-lg px-4 py-2 text-sm text-text-muted transition-colors hover:text-text-secondary">
                Cancel
              </Dialog.Close>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !description.trim()}
                className={clsx(
                  'rounded-lg px-5 py-2 text-sm font-medium transition-all duration-150 border',
                  submitting || !description.trim()
                    ? 'cursor-not-allowed opacity-40 border-border text-text-muted'
                    : 'border-white/20 bg-white/10 text-text-primary hover:bg-white/15'
                )}
              >
                {submitting ? 'Sending...' : 'Send'}
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
