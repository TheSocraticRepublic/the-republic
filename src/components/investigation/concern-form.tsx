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
  const [fetchingJurisdictions, setFetchingJurisdictions] = useState(false)
  const [selectedJurisdictionId, setSelectedJurisdictionId] = useState('')
  const [concern, setConcern] = useState('')
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus the textarea on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Fetch jurisdictions on mount
  useEffect(() => {
    setFetchingJurisdictions(true)
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

    try {
      const res = await fetch('/api/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concern: concern.trim(),
          jurisdictionId: selectedJurisdictionId || undefined,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }))
        console.error('[investigate] request failed:', data.error)
        setLoading(false)
        return
      }

      // Read the investigation ID from the response header before consuming the body
      const investigationId = res.headers.get('X-Investigation-Id')
      if (!investigationId) {
        console.error('[investigate] missing X-Investigation-Id header')
        setLoading(false)
        return
      }

      // Drain the stream body (we don't render it here — the [id] page will
      // show static briefingText once it's persisted by onFinish)
      if (res.body) {
        const reader = res.body.getReader()
        while (true) {
          const { done } = await reader.read()
          if (done) break
        }
      }

      // Redirect to the investigation page once streaming is complete
      router.push(`/investigate/${investigationId}`)
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('[investigate] stream error:', err)
      }
      setLoading(false)
    }
  }, [concern, selectedJurisdictionId, loading, router])

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
          placeholder="e.g., I got towed for parking 5 minutes over a meter in Squamish. $300."
          rows={6}
          maxLength={2000}
          aria-label="Describe your concern"
          aria-describedby="concern-hint"
          className={clsx(
            'w-full resize-none rounded-xl border bg-black/60 px-4 py-4 text-base leading-relaxed text-neutral-200 placeholder-neutral-600 outline-none backdrop-blur-md transition-all duration-200',
            'focus:border-white/20',
            loading ? 'opacity-50' : 'border-white/[0.1]'
          )}
          disabled={loading}
        />
        <p id="concern-hint" className="mt-1.5 text-xs text-neutral-600">
          Press Cmd+Enter to start
        </p>
      </div>

      {/* Jurisdiction selector */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-neutral-500">
          Jurisdiction <span className="text-neutral-700">(optional — helps with document discovery)</span>
        </label>
        {fetchingJurisdictions ? (
          <div className="h-9 animate-pulse rounded-lg bg-white/[0.04]" />
        ) : (
          <div className="relative">
            <select
              value={selectedJurisdictionId}
              onChange={(e) => setSelectedJurisdictionId(e.target.value)}
              className="w-full appearance-none rounded-lg border border-white/[0.08] bg-black/60 px-3 py-2 pr-8 text-sm text-neutral-300 outline-none focus:border-white/20 focus:ring-0"
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
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-600"
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-1">
        {loading && (
          <button
            onClick={handleCancel}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-neutral-500 transition-colors hover:text-neutral-300"
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
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            color: '#f4f4f5',
            border: '1px solid rgba(255, 255, 255, 0.15)',
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
