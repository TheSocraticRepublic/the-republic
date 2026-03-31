'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronDown, Loader2, Search, X } from 'lucide-react'
import { clsx } from 'clsx'
import { BriefingView } from './briefing-view'

interface Jurisdiction {
  id: string
  name: string
  country: string
  province: string | null
  municipalType: string
  population: number | null
  dataPortalUrl: string | null
}

export function BriefingForm() {
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>([])
  const [fetchingJurisdictions, setFetchingJurisdictions] = useState(false)
  const [selectedJurisdictionId, setSelectedJurisdictionId] = useState('')
  const [concern, setConcern] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamedText, setStreamedText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [hasResult, setHasResult] = useState(false)
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

  const handleInvestigate = useCallback(async () => {
    if (!concern.trim() || loading) return

    if (abortRef.current) {
      abortRef.current.abort()
    }
    abortRef.current = new AbortController()

    setLoading(true)
    setIsStreaming(true)
    setStreamedText('')
    setHasResult(false)

    try {
      const res = await fetch('/api/briefing', {
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
        console.error('[briefing] request failed:', data.error)
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
        console.error('[briefing] stream error:', err)
      }
    } finally {
      setIsStreaming(false)
      setLoading(false)
    }
  }, [concern, selectedJurisdictionId, loading])

  const handleCancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleInvestigate()
      }
    },
    [handleInvestigate]
  )

  const canSubmit = concern.trim().length > 0 && !loading
  const showResult = (isStreaming || hasResult) && streamedText

  return (
    <div className="space-y-10">
      {/* Form — fades slightly when result is showing */}
      <section
        className={clsx(
          'transition-all duration-500',
          showResult ? 'opacity-60' : 'opacity-100'
        )}
      >
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
              className={clsx(
                'w-full resize-none rounded-xl border bg-black/60 px-4 py-4 text-base leading-relaxed text-neutral-200 placeholder-neutral-600 outline-none backdrop-blur-md transition-all duration-200',
                'focus:border-white/20',
                loading ? 'opacity-50' : 'border-white/[0.1]'
              )}
              disabled={loading}
            />
            <p className="mt-1.5 text-xs text-neutral-600">
              Press Cmd+Enter to investigate
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
            {isStreaming && (
              <button
                onClick={handleCancel}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-neutral-500 transition-colors hover:text-neutral-300"
              >
                <X size={12} strokeWidth={2} />
                Cancel
              </button>
            )}
            <button
              onClick={handleInvestigate}
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
                  Investigating...
                </>
              ) : (
                <>
                  <Search size={14} strokeWidth={2} />
                  Investigate
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Result */}
      {showResult && (
        <section>
          <div
            className="mb-6 h-px w-full"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)' }}
          />
          <BriefingView text={streamedText} isStreaming={isStreaming} />
        </section>
      )}
    </div>
  )
}
