'use client'

import { useState, useEffect, useCallback, useId, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, GitCompare, Loader2 } from 'lucide-react'
import { CTAButton } from '@/components/ui/cta-button'
import { ErrorMark, FIELD_REASON_CLASS, Field, SECTION_LABEL_CLASS, fieldControlClass } from '@/components/ui/field'
import { ComparisonView } from './comparison-view'

interface Document {
  id: string
  title: string
  status: string
}

const POLICY_AREAS = [
  { value: '', label: 'Any area' },
  { value: 'zoning', label: 'Zoning' },
  { value: 'housing', label: 'Housing' },
  { value: 'transit', label: 'Transit' },
  { value: 'budget_transparency', label: 'Budget Transparency' },
  { value: 'environment', label: 'Environment' },
  { value: 'foi_transparency', label: 'FOI / Transparency' },
  { value: 'procurement', label: 'Procurement' },
  { value: 'other', label: 'Other' },
]

/** A signed-out comparison goes to login and comes back here, as Scout's does. */
const LOGIN_FOR_MIRROR = '/login?redirect=%2Fmirror'

/**
 * Every failure a citizen can see, plain-instructional like every error in the
 * app: the fact, then the action. No server or browser string reaches the
 * page (Jen C2b C8, on Scout's C1 pattern). The 429 line covers the daily
 * limit too and promises no wait.
 */
export const MIRROR_COPY = {
  rateLimited: 'Too many comparisons for now. Compare again later.',
  unreadable: "Mirror couldn't read that question. Compare again.",
  failed: "Mirror couldn't finish that comparison. Compare again.",
  offline: "Open Cave can't be reached. Check your connection, then compare again.",
  /** Why Compare is unavailable (Jen C2b C5). */
  needsQuestion: 'Write your question above to start comparing.',
} as const

/** The message for a non-OK, non-401 answer, by status alone. */
export function mirrorErrorMessage(status: number): string {
  if (status === 429) return MIRROR_COPY.rateLimited
  if (status === 400) return MIRROR_COPY.unreadable
  return MIRROR_COPY.failed
}

interface ComparisonFormProps {
  initialDocumentId?: string
}

export function ComparisonForm({ initialDocumentId }: ComparisonFormProps = {}) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [fetchingDocs, setFetchingDocs] = useState(false)
  const [selectedDocId, setSelectedDocId] = useState(initialDocumentId ?? '')
  const [policyArea, setPolicyArea] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamedText, setStreamedText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [hasResult, setHasResult] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [docsError, setDocsError] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const questionRef = useRef<HTMLTextAreaElement>(null)
  const reasonId = useId()
  const router = useRouter()

  // Fetch user documents on mount
  useEffect(() => {
    setFetchingDocs(true)
    setDocsError(false)
    fetch('/api/oracle/documents')
      .then((r) => r.json())
      .then((data) => {
        const ready = (data.documents ?? []).filter((d: Document) => d.status === 'ready')
        setDocuments(ready)
        // If initialDocumentId is set but not already selected, verify it exists
        if (initialDocumentId && ready.some((d: Document) => d.id === initialDocumentId)) {
          setSelectedDocId(initialDocumentId)
        }
      })
      .catch(() => setDocsError(true))
      .finally(() => setFetchingDocs(false))
  }, [initialDocumentId])

  const handleCompare = useCallback(async () => {
    if (!description.trim() || loading) return

    // Cancel any in-progress request
    if (abortRef.current) {
      abortRef.current.abort()
    }
    abortRef.current = new AbortController()

    setLoading(true)
    setIsStreaming(true)
    setStreamedText('')
    setHasResult(false)
    setSubmitError(null)

    try {
      const res = await fetch('/api/mirror/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDocId || undefined,
          policyArea: policyArea || undefined,
          description: description.trim(),
        }),
        signal: abortRef.current.signal,
      })

      if (res.status === 401) {
        router.push(LOGIN_FOR_MIRROR)
        return
      }

      if (!res.ok) {
        // Logged for the developer; the citizen gets the status's own copy.
        const data: unknown = await res.json().catch(() => null)
        console.error('[mirror] compare failed:', res.status, data)
        setSubmitError(mirrorErrorMessage(res.status))
        setIsStreaming(false)
        setLoading(false)
        return
      }

      if (!res.body) {
        setSubmitError(MIRROR_COPY.failed)
        setIsStreaming(false)
        setLoading(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk
        setStreamedText(accumulated)
      }

      setHasResult(true)
    } catch (err) {
      // An abort is a newer comparison replacing this one: nothing to report.
      // Anything else thrown by fetch or the stream is the network.
      if (!(err instanceof Error && err.name === 'AbortError')) {
        console.error('[mirror] stream error:', err)
        setSubmitError(MIRROR_COPY.offline)
      }
    } finally {
      setIsStreaming(false)
      setLoading(false)
    }
  }, [description, selectedDocId, policyArea, loading, router])

  const hasQuestion = description.trim().length > 0

  return (
    <div className="space-y-8">
      {/* Form */}
      <section>
        <h2 className={`mb-4 ${SECTION_LABEL_CLASS}`}>
          Comparison parameters
        </h2>

        <div className="space-y-4">
          {/* The question first, as Scout and Investigate do (app-arms P2-12, C2a) */}
          <Field id="compare-description" label="What policy question do you want to compare?">
            {(control) => (
              <textarea
                {...control}
                ref={questionRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. How have other BC municipalities handled short-term rental bylaws? What did they actually do, and what happened?"
                rows={4}
                className={fieldControlClass('textarea')}
                // Locked while comparing, but never natively disabled: the
                // citizen's own words keep full ink and the caret (Jen C2b C4,
                // Scout's C1 pattern). aria-disabled says it is unavailable.
                readOnly={loading}
                aria-disabled={loading ? 'true' : undefined}
              />
            )}
          </Field>

          {/* Document selector. A failed list is announced, but the select
              is not invalid: the comparison runs without a document. */}
          <Field id="compare-document" label="Linked document" optional>
            {(control) => (
              <>
                {fetchingDocs ? (
                  <div className="h-9 animate-pulse rounded-lg bg-surface-1" />
                ) : (
                  <div className="relative">
                    <select
                      {...control}
                      value={selectedDocId}
                      onChange={(e) => setSelectedDocId(e.target.value)}
                      className={fieldControlClass('select')}
                      disabled={loading}
                    >
                      <option value="">No linked document</option>
                      {documents.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.title}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={13}
                      strokeWidth={2}
                      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted"
                    />
                  </div>
                )}
                {docsError && (
                  <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs text-status-danger">
                    <ErrorMark />
                    <span>Couldn&apos;t load your documents. You can still compare without a linked document.</span>
                  </p>
                )}
              </>
            )}
          </Field>

          {/* Policy area */}
          <Field id="compare-policy-area" label="Policy area" optional>
            {(control) => (
              <div className="relative">
                <select
                  {...control}
                  value={policyArea}
                  onChange={(e) => setPolicyArea(e.target.value)}
                  className={fieldControlClass('select')}
                  disabled={loading}
                >
                  {POLICY_AREAS.map((area) => (
                    <option key={area.value} value={area.value}>
                      {area.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={13}
                  strokeWidth={2}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted"
                />
              </div>
            )}
          </Field>

          {submitError && (
            <p role="alert" className="flex items-start gap-1.5 text-xs text-status-danger">
              <ErrorMark />
              <span>{submitError}</span>
            </p>
          )}

          {/* Submit, with why it is unavailable 8px above it (Jen C2b C5) */}
          <div>
          {!hasQuestion && (
            <p id={reasonId} className={FIELD_REASON_CLASS}>
              {MIRROR_COPY.needsQuestion}
            </p>
          )}
          <div className="flex justify-end">
            {/* The arm recipe on the Mirror room (an allowed ground). Empty,
                it is aria-disabled and refuses; busy, it refuses a second
                comparison and keeps focus. */}
            <CTAButton
              variant="arm"
              arm="mirror"
              onClick={handleCompare}
              // Unavailable, pressing it takes the citizen to the question.
              onUnavailable={() => questionRef.current?.focus()}
              disabled={!hasQuestion}
              busy={loading}
              describedBy={!hasQuestion ? reasonId : undefined}
            >
              {/* Busy keeps the label; only the icon turns to a spinner, so
                  the box never changes (Jen C2b C3). */}
              {loading ? (
                <Loader2 size={14} strokeWidth={2} className="animate-spin" aria-hidden="true" />
              ) : (
                <GitCompare size={14} strokeWidth={2} aria-hidden="true" />
              )}
              Compare
            </CTAButton>
          </div>
          </div>
          {/* The working state, for a screen reader. */}
          <p role="status" className="sr-only">
            {loading ? 'Comparing…' : ''}
          </p>
        </div>
      </section>

      {/* Results — ComparisonView renders its own "no result yet" note when
          there's nothing to show, so it always mounts here. */}
      <section>
        {(isStreaming || hasResult) && streamedText && (
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-muted">
            Comparison results
          </h2>
        )}
        <ComparisonView
          text={streamedText}
          isStreaming={isStreaming}
          documentId={selectedDocId || undefined}
          documentTitle={documents.find((d) => d.id === selectedDocId)?.title}
        />
      </section>
    </div>
  )
}
