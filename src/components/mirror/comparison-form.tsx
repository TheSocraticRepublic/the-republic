'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronDown, GitCompare, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
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
  const abortRef = useRef<AbortController | null>(null)

  // Fetch user documents on mount
  useEffect(() => {
    setFetchingDocs(true)
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
      .catch(() => {})
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

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }))
        console.error('[mirror] compare failed:', data.error)
        setIsStreaming(false)
        setLoading(false)
        return
      }

      if (!res.body) {
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
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('[mirror] stream error:', err)
      }
    } finally {
      setIsStreaming(false)
      setLoading(false)
    }
  }, [description, selectedDocId, policyArea, loading])

  const canSubmit = description.trim().length > 0 && !loading

  return (
    <div className="space-y-8">
      {/* Form */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Comparison parameters
        </h2>

        <div className="space-y-4">
          {/* Document selector */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-400">
              Linked document <span className="text-neutral-600">(optional)</span>
            </label>
            {fetchingDocs ? (
              <div className="h-9 animate-pulse rounded-lg bg-white/[0.04]" />
            ) : (
              <div className="relative">
                <select
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-white/[0.1] bg-black/60 px-3 py-2 pr-8 text-sm text-neutral-200 outline-none focus:border-[#5BC88A]/40 focus:ring-0"
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
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500"
                />
              </div>
            )}
          </div>

          {/* Policy area */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-400">
              Policy area <span className="text-neutral-600">(optional)</span>
            </label>
            <div className="relative">
              <select
                value={policyArea}
                onChange={(e) => setPolicyArea(e.target.value)}
                className="w-full appearance-none rounded-lg border border-white/[0.1] bg-black/60 px-3 py-2 pr-8 text-sm text-neutral-200 outline-none focus:border-[#5BC88A]/40 focus:ring-0"
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
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-400">
              What policy question do you want to compare?
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. How have other BC municipalities handled short-term rental bylaws? What did they actually do, and what happened?"
              rows={4}
              className="w-full resize-none rounded-lg border border-white/[0.1] bg-black/60 px-3 py-2.5 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-[#5BC88A]/40"
              disabled={loading}
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <button
              onClick={handleCompare}
              disabled={!canSubmit}
              className={clsx(
                'inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all duration-150',
                canSubmit
                  ? 'opacity-100 hover:opacity-90'
                  : 'cursor-not-allowed opacity-40'
              )}
              style={{
                backgroundColor: 'rgba(91, 200, 138, 0.15)',
                color: '#5BC88A',
                border: '1px solid rgba(91, 200, 138, 0.30)',
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                  Comparing...
                </>
              ) : (
                <>
                  <GitCompare size={14} strokeWidth={2} />
                  Compare
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Results */}
      {(isStreaming || hasResult) && streamedText && (
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Comparison results
          </h2>
          <ComparisonView text={streamedText} isStreaming={isStreaming} />
        </section>
      )}
    </div>
  )
}
