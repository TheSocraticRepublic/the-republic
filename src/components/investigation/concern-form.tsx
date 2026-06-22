'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Loader2, Search, X } from 'lucide-react'
import { clsx } from 'clsx'

interface Jurisdiction {
  id: string
  name: string
  country: string
  province: string | null
  municipalType: string
  population: number | null
  dataPortalUrl: string | null
}

export function ConcernForm() {
  const router = useRouter()
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>([])
  const [fetchingJurisdictions, setFetchingJurisdictions] = useState(true)
  const [selectedJurisdictionId, setSelectedJurisdictionId] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [concern, setConcern] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus the textarea on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Fetch jurisdictions on mount
  useEffect(() => {
    fetch('/api/mirror/jurisdictions')
      .then((r) => r.json())
      .then((data) => {
        const rows: Jurisdiction[] = data.jurisdictions ?? []
        const bc = rows.filter((j) => j.province === 'BC' || j.province === 'British Columbia')
        const others = rows.filter((j) => j.province !== 'BC' && j.province !== 'British Columbia')
        setJurisdictions([...bc, ...others])
      })
      .catch(() => {})
      .finally(() => setFetchingJurisdictions(false))
  }, [])

  const handleStartInvestigation = useCallback(async () => {
    if (!concern.trim() || loading) return

    if (abortRef.current) {
      abortRef.current.abort()
    }
    abortRef.current = new AbortController()

    setLoading(true)
    setSubmitError(null)

    try {
      const res = await fetch('/api/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concern: concern.trim(),
          jurisdictionId: selectedJurisdictionId || undefined,
          postalCode: postalCode.replace(/\s+/g, '').toUpperCase() || undefined,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }))
        console.error('[investigate] request failed:', data.error)
        setSubmitError('Something went wrong. Please try again.')
        setLoading(false)
        return
      }

      // Read the investigation ID from the 202 JSON body
      const data = await res.json().catch(() => null)
      const investigationId: string | undefined = data?.id
      if (!investigationId) {
        console.error('[investigate] missing id in response body')
        setSubmitError('Something went wrong. Please try again.')
        setLoading(false)
        return
      }

      // Redirect to the investigation page — generation runs in the background
      router.push(`/investigate/${investigationId}`)
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('[investigate] request error:', err)
        setSubmitError('Something went wrong. Please try again.')
      }
      setLoading(false)
    }
  }, [concern, selectedJurisdictionId, postalCode, loading, router])

  const handleCancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
    setLoading(false)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleStartInvestigation()
      }
    },
    [handleStartInvestigation]
  )

  const canSubmit = concern.trim().length > 0 && !loading

  return (
    <div className="space-y-4">
      {/* Primary textarea */}
      <div>
        <textarea
          ref={textareaRef}
          value={concern}
          onChange={(e) => setConcern(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g., A gravel mine expansion near the Mamquam River was approved in 2019 but the conditions of approval haven't been publicly reported on."
          rows={6}
          maxLength={2000}
          aria-label="Describe your concern"
          aria-describedby="concern-hint"
          className={clsx(
            'w-full resize-none rounded-xl border bg-surface-1 shadow-sm px-4 py-4 text-base leading-relaxed text-text-primary placeholder-text-faint outline-none transition-all duration-200',
            'focus:border-border-strong',
            loading ? 'opacity-50' : 'border-border'
          )}
          disabled={loading}
        />
        <p id="concern-hint" className="mt-1.5 text-xs text-text-faint">
          Press Cmd+Enter to start
        </p>
      </div>

      {/* Error alert */}
      {submitError && (
        <p role="alert" className="text-xs text-red-400">{submitError}</p>
      )}

      {/* Jurisdiction selector */}
      <div>
        <label htmlFor="concern-jurisdiction" className="mb-1.5 block text-xs font-medium text-text-muted">
          Jurisdiction <span className="text-text-faint">(optional — helps with document discovery)</span>
        </label>
        {fetchingJurisdictions ? (
          <div className="h-9 animate-pulse rounded-lg bg-surface-1" />
        ) : (
          <div className="relative">
            <select
              id="concern-jurisdiction"
              value={selectedJurisdictionId}
              onChange={(e) => setSelectedJurisdictionId(e.target.value)}
              className="w-full appearance-none rounded-lg border border-border bg-surface-1 shadow-sm px-3 py-2 pr-8 text-sm text-text-secondary outline-none focus:border-border-strong focus:ring-0"
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
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-faint"
            />
          </div>
        )}
      </div>

      {/* Postal code (optional — for vote tracker integration) */}
      <div>
        <label htmlFor="concern-postal-code" className="mb-1.5 block text-xs font-medium text-text-muted">
          Postal code <span className="text-text-faint">(optional — shows how your MP voted on related issues)</span>
        </label>
        <input
          id="concern-postal-code"
          type="text"
          value={postalCode}
          onChange={(e) => {
            const clean = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6)
            setPostalCode(clean.length > 3 ? `${clean.slice(0, 3)} ${clean.slice(3)}` : clean)
          }}
          placeholder="V8B 0A1"
          className="w-full rounded-lg border border-border bg-surface-1 shadow-sm px-3 py-2 text-sm text-text-secondary font-mono tracking-wider placeholder-text-faint outline-none focus:border-border-strong"
          disabled={loading}
          maxLength={7}
          autoComplete="postal-code"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-1">
        {loading && (
          <button
            onClick={handleCancel}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-text-muted transition-colors hover:text-text-secondary"
          >
            <X size={12} strokeWidth={2} />
            Cancel
          </button>
        )}
        <button
          onClick={handleStartInvestigation}
          disabled={!canSubmit}
          className={clsx(
            'inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-150',
            canSubmit
              ? 'opacity-100 hover:opacity-90'
              : 'cursor-not-allowed opacity-30'
          )}
          style={{
            backgroundColor: 'var(--surface-3)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-strong)',
          }}
        >
          {loading ? (
            <>
              <Loader2 size={14} strokeWidth={2} className="animate-spin" />
              Starting investigation...
            </>
          ) : (
            <>
              <Search size={14} strokeWidth={2} />
              Start Investigation
            </>
          )}
        </button>
      </div>
    </div>
  )
}
