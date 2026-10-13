'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Loader2, Search, X } from 'lucide-react'
import { clsx } from 'clsx'
import { CTAButton } from '@/components/ui/cta-button'
import { hasCoarsePointer, useCoarsePointer, useModifierKeyLabel } from '@/lib/ui/input-modality'

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
  const submitRef = useRef<HTMLButtonElement>(null)
  const coarsePointer = useCoarsePointer()
  const modifierKey = useModifierKeyLabel()
  // The shortcut hint names a key, so it shows only where there is a keyboard
  // to press it on (not on a coarse pointer) and once the platform is known
  // ("Cmd" on Apple, "Ctrl" elsewhere). The textarea is described by it only
  // while it is shown (mobile P2-9).
  const showShortcutHint = modifierKey !== null && !coarsePointer

  // Focus the textarea on mount on a fine pointer only. On a touch screen it
  // would raise the keyboard over the page, and a screen-reader user would
  // land past the heading and intro (mobile P2-11, the login page's rule).
  useEffect(() => {
    if (!hasCoarsePointer()) textareaRef.current?.focus()
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

  // The one predicate every submit path checks before dispatching: the
  // button (CTAButton's aria-disabled click guard) and the Cmd/Ctrl+Enter
  // shortcut below. handleStartInvestigation itself does not re-check it, so
  // each path's own guard is what stands between it and a request.
  const canSubmit = concern.trim().length > 0 && !loading

  const handleStartInvestigation = useCallback(async () => {
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
        setSubmitError('Something went wrong. Try again.')
        setLoading(false)
        return
      }

      // Read the investigation ID from the 202 JSON body
      const data = await res.json().catch(() => null)
      const investigationId: string | undefined = data?.id
      if (!investigationId) {
        console.error('[investigate] missing id in response body')
        setSubmitError('Something went wrong. Try again.')
        setLoading(false)
        return
      }

      // Redirect to the investigation page — generation runs in the background
      router.push(`/investigate/${investigationId}`)
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('[investigate] request error:', err)
        setSubmitError('Something went wrong. Try again.')
      }
      setLoading(false)
    }
  }, [concern, selectedJurisdictionId, postalCode, router])

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
        if (!canSubmit) return
        // The textarea locks while loading, which would drop focus to the
        // body; move it to the Start button first, which scrolls the busy
        // state into view and keeps the place after an error (Jen C3).
        submitRef.current?.focus()
        handleStartInvestigation()
      }
    },
    [canSubmit, handleStartInvestigation]
  )

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
          aria-describedby={showShortcutHint ? 'concern-hint' : undefined}
          className={clsx(
            'w-full resize-none rounded-xl border bg-surface-1 shadow-sm px-4 py-4 text-base leading-relaxed text-text-primary placeholder-text-faint outline-none transition-all duration-200',
            'focus:border-border-strong',
            loading ? 'opacity-50' : 'border-border'
          )}
          disabled={loading}
        />
        {showShortcutHint && (
          <p id="concern-hint" className="mt-1.5 text-xs text-text-faint">
            Press {modifierKey}+Enter to start.
          </p>
        )}
      </div>

      {/* Error alert */}
      {submitError && (
        <p role="alert" className="text-xs text-status-danger">{submitError}</p>
      )}

      {/* Jurisdiction selector */}
      <div>
        <label htmlFor="concern-jurisdiction" className="mb-1.5 block text-xs font-medium text-text-muted">
          Jurisdiction <span className="text-text-faint">(optional)</span>
        </label>
        {fetchingJurisdictions ? (
          <div className="h-9 animate-pulse rounded-lg bg-surface-1" />
        ) : (
          <div className="relative">
            <select
              id="concern-jurisdiction"
              value={selectedJurisdictionId}
              onChange={(e) => setSelectedJurisdictionId(e.target.value)}
              aria-describedby="concern-jurisdiction-hint"
              className="w-full appearance-none rounded-lg border border-border bg-surface-1 shadow-sm px-3 py-2 pr-8 text-sm text-text-primary outline-none focus:border-border-strong focus:ring-0"
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
        <p id="concern-jurisdiction-hint" className="mt-1.5 text-xs text-text-muted">
          The city, district or province your concern is about. It helps find the right documents.
        </p>
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
          className="w-full rounded-lg border border-border bg-surface-1 shadow-sm px-3 py-2 text-sm text-text-primary font-mono tracking-wider placeholder-text-faint outline-none focus:border-border-strong"
          disabled={loading}
          maxLength={7}
          autoComplete="postal-code"
        />
      </div>

      {/* Actions. Start keeps one box at rest, typed and busy, and Cancel
          never lands inside it, so a second press 250 ms later can only hit
          Start, whose busy guard refuses it (Jen C2). From md, Cancel and the
          reason sit left of Start in its row; below md, where Start is full
          width, they come after it on their own row (order-last), so Start
          never moves. */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
        {!concern.trim() && !loading && (
          <p id="concern-submit-reason" className="order-last text-xs text-text-muted md:order-none">
            Describe your concern to start.
          </p>
        )}
        {loading && (
          <button
            type="button"
            onClick={handleCancel}
            className="order-last inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-text-muted transition-colors hover:text-text-secondary md:order-none"
          >
            <X size={12} strokeWidth={2} />
            Cancel
          </button>
        )}
        <CTAButton
          ref={submitRef}
          onClick={handleStartInvestigation}
          disabled={!concern.trim()}
          busy={loading}
          describedBy="concern-submit-reason"
          size="md"
          variant="primary"
          className="w-full justify-center md:w-auto"
        >
          {/* Both labels share one grid cell; the one not showing is
              invisible and out of the accessible name, so the button is as
              wide as its wider label in every state. */}
          <span className="grid">
            <span
              aria-hidden={loading ? 'true' : undefined}
              className={clsx('col-start-1 row-start-1 inline-flex items-center justify-center gap-2', loading && 'invisible')}
            >
              <Search size={14} strokeWidth={2} />
              Start Investigation
            </span>
            <span
              aria-hidden={loading ? undefined : 'true'}
              className={clsx('col-start-1 row-start-1 inline-flex items-center justify-center gap-2', !loading && 'invisible')}
            >
              <Loader2 size={14} strokeWidth={2} className={clsx(loading && 'animate-spin')} />
              Starting…
            </span>
          </span>
        </CTAButton>
      </div>
    </div>
  )
}
