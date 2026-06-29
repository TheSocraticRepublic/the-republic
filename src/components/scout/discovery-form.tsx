'use client'

import { useState, useEffect, useCallback, useRef, useId } from 'react'
import { ChevronDown, Compass, Loader2, X } from 'lucide-react'
import { clsx } from 'clsx'
import { ScoutResultView } from './scout-result-view'

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

interface Jurisdiction {
  id: string
  name: string
  country: string
  province: string | null
  municipalType: string
  population: number | null
  dataPortalUrl: string | null
}

export function DiscoveryForm() {
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>([])
  const [fetchingJurisdictions, setFetchingJurisdictions] = useState(false)
  const [selectedJurisdictionId, setSelectedJurisdictionId] = useState('')
  const [policyArea, setPolicyArea] = useState('')
  const [concern, setConcern] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamedText, setStreamedText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [hasResult, setHasResult] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const concernId = useId()
  const jurisdictionId = useId()
  const policyAreaId = useId()
  const abortRef = useRef<AbortController | null>(null)

  // Fetch jurisdictions on mount (reuse Mirror's endpoint)
  useEffect(() => {
    setFetchingJurisdictions(true)
    fetch('/api/mirror/jurisdictions')
      .then((r) => r.json())
      .then((data) => {
        const rows: Jurisdiction[] = data.jurisdictions ?? []
        // BC municipalities first, then others
        const bc = rows.filter((j) => j.province === 'BC' || j.province === 'British Columbia')
        const others = rows.filter((j) => j.province !== 'BC' && j.province !== 'British Columbia')
        setJurisdictions([...bc, ...others])
      })
      .catch(() => {})
      .finally(() => setFetchingJurisdictions(false))
  }, [])

  const handleDiscover = useCallback(async () => {
    if (!concern.trim() || loading) return

    // Cancel any in-progress request
    if (abortRef.current) {
      abortRef.current.abort()
    }
    abortRef.current = new AbortController()

    setLoading(true)
    setIsStreaming(true)
    setStreamedText('')
    setHasResult(false)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/scout/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concern: concern.trim(),
          jurisdictionId: selectedJurisdictionId || undefined,
          policyArea: policyArea || undefined,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }))
        setErrorMessage(data.error ?? 'Discovery failed. Please try again.')
        setIsStreaming(false)
        setLoading(false)
        return
      }

      if (!res.body) {
        setErrorMessage('No response received. Please try again.')
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
        setErrorMessage('An unexpected error occurred. Please try again.')
      }
    } finally {
      setIsStreaming(false)
      setLoading(false)
    }
  }, [concern, selectedJurisdictionId, policyArea, loading])

  const handleCancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
  }, [])

  const canSubmit = concern.trim().length > 0 && !loading

  return (
    <div className="space-y-8">
      {/* Form */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-muted">
          Describe your concern
        </h2>

        <div className="space-y-4">
          {/* Concern textarea — primary input */}
          <div>
            <label htmlFor={concernId} className="mb-1.5 block text-xs font-medium text-text-secondary">
              What concerns you?
            </label>
            <textarea
              id={concernId}
              value={concern}
              onChange={(e) => setConcern(e.target.value)}
              placeholder="e.g., A gravel mine expansion near the Mamquam River was approved in 2019 but the conditions haven't been reported on."
              rows={5}
              className="w-full resize-none rounded-lg border border-border-strong bg-surface-1 shadow-sm px-3 py-2.5 text-sm text-text-primary placeholder-text-faint outline-none focus:border-[var(--accent-scout)]/40"
              disabled={loading}
            />
          </div>

          {/* Jurisdiction selector */}
          <div>
            <label htmlFor={jurisdictionId} className="mb-1.5 block text-xs font-medium text-text-secondary">
              Jurisdiction <span className="text-text-faint">(optional)</span>
            </label>
            {fetchingJurisdictions ? (
              <div className="h-9 animate-pulse rounded-lg bg-surface-1" />
            ) : (
              <div className="relative">
                <select
                  id={jurisdictionId}
                  value={selectedJurisdictionId}
                  onChange={(e) => setSelectedJurisdictionId(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-border-strong bg-surface-1 shadow-sm px-3 py-2 pr-8 text-sm text-text-primary outline-none focus:border-[var(--accent-scout)]/40 focus:ring-0"
                  disabled={loading}
                >
                  <option value="">Any jurisdiction</option>
                  {jurisdictions.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.name}
                      {j.province ? ` — ${j.province}` : ''}
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
          </div>

          {/* Policy area */}
          <div>
            <label htmlFor={policyAreaId} className="mb-1.5 block text-xs font-medium text-text-secondary">
              Policy area <span className="text-text-faint">(optional)</span>
            </label>
            <div className="relative">
              <select
                id={policyAreaId}
                value={policyArea}
                onChange={(e) => setPolicyArea(e.target.value)}
                className="w-full appearance-none rounded-lg border border-border-strong bg-surface-1 shadow-sm px-3 py-2 pr-8 text-sm text-text-primary outline-none focus:border-[var(--accent-scout)]/40 focus:ring-0"
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
          </div>

          {/* Error state */}
          {errorMessage && (
            <p role="alert" className="text-xs text-red-400 mt-1">{errorMessage}</p>
          )}

          {/* Submit / Cancel */}
          <div className="flex items-center justify-end gap-3">
            {isStreaming && (
              <button
                onClick={handleCancel}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-text-muted transition-colors hover:text-text-secondary"
              >
                <X size={12} strokeWidth={2} />
                Cancel
              </button>
            )}
            <button
              onClick={handleDiscover}
              disabled={!canSubmit}
              className={clsx(
                'inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all duration-150',
                canSubmit
                  ? 'opacity-100 hover:opacity-90'
                  : 'cursor-not-allowed opacity-40'
              )}
              style={{
                backgroundColor: 'color-mix(in srgb, var(--accent-scout) 15%, transparent)',
                color: 'var(--accent-scout)',
                border: '1px solid color-mix(in srgb, var(--accent-scout) 30%, transparent)',
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                  Scouting...
                </>
              ) : (
                <>
                  <Compass size={14} strokeWidth={2} />
                  Scout
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Results */}
      {(isStreaming || hasResult) && streamedText && (
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-muted">
            Discovery results
          </h2>
          <ScoutResultView text={streamedText} isStreaming={isStreaming} />
        </section>
      )}
    </div>
  )
}
