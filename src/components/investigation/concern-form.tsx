'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Loader2, Search, X } from 'lucide-react'
import { clsx } from 'clsx'
import { CTAButton } from '@/components/ui/cta-button'
import { Field, fieldControlClass } from '@/components/ui/field'
import { hasCoarsePointer, useCoarsePointer, useModifierKeyLabel } from '@/lib/ui/input-modality'
import { useUnsavedWork } from '@/lib/auth/client-sign-out'
import {
  PENDING_CONCERN_MAX_LENGTH,
  handoffFromSearch,
  handoffIsFromHome,
  onPendingConcernRevoked,
  takePendingConcern,
} from '@/lib/pending-concern'

/*
 * The offer's words (orchestrator ruling, C4 fix pass, after Razor W3). Code
 * cannot tell who typed a concern left in a tab before a sign-in, so that
 * offer never claims authorship. A signed-in handoff straight from the home
 * page crossed no login, so it can say whose it is.
 */
export const OFFER_TITLE_LOGIN = 'A concern was written in this tab before signing in.'
export const OFFER_TITLE_HOME = 'Your concern from the home page.'
/** "Use it" with text already in the box: appended, never replaced. */
export const OFFER_APPENDED = 'The earlier concern was added below your text.'
export const OFFER_TOO_LONG = "The earlier concern doesn't fit after your text. Shorten your text or clear the box, then choose Use it."

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
  // The concern carried from the landing through sign-in, held here between
  // the offer and Use or Discard. Storage no longer has it (UI plan C4).
  const [offered, setOffered] = useState<{ text: string; fromHome: boolean } | null>(null)
  // A plain status line about what Use it did (or could not do).
  const [offerStatus, setOfferStatus] = useState<string | null>(null)
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

  // Typed, unsent text is unsaved work: a sign-out in another tab shows the
  // notice here instead of reloading the text away (C3's registry).
  useUnsavedWork(concern.trim().length > 0)

  // The pending concern (UI plan C4). Offered only on a render whose URL
  // `handoff` (validated) matches the stored record, and deleted from storage
  // in the same step: a reload or a later visit finds nothing. Under React's
  // development double-mount the second read finds nothing and changes
  // nothing, so the offer survives it.
  useEffect(() => {
    const record = takePendingConcern(handoffFromSearch(window.location.search))
    // A one-time, destructive read of browser storage after hydration (the
    // server render has no storage, so a lazy initial state would mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (record) setOffered({ text: record.text, fromHome: handoffIsFromHome(window.location.search) })
  }, [])

  // Another tab signed out, or signed in on another handoff: the held copy
  // goes too, not just the stored one.
  useEffect(() => onPendingConcernRevoked(() => setOffered(null)), [])

  // Use it never replaces what is already typed: with text in the box, the
  // carried concern goes after a blank line and the status line says so. If
  // both together would pass the 2,000-character limit, nothing changes and
  // the offer stays, with the reason.
  const acceptOffered = useCallback(() => {
    if (offered === null) return
    if (concern.trim().length === 0) {
      setConcern(offered.text)
      setOfferStatus(null)
    } else {
      const combined = `${concern.replace(/\s+$/, '')}\n\n${offered.text}`
      if (combined.length > PENDING_CONCERN_MAX_LENGTH) {
        setOfferStatus(OFFER_TOO_LONG)
        return
      }
      setConcern(combined)
      setOfferStatus(OFFER_APPENDED)
    }
    setOffered(null)
    textareaRef.current?.focus()
  }, [offered, concern])

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
      {/* The carried concern, offered, never prefilled (UI plan C4). */}
      {offered !== null && (
        <section
          aria-labelledby="pending-concern-title"
          data-pending-concern-offer
          className="rounded-xl border border-border-strong bg-surface-1 px-4 py-3"
        >
          <p id="pending-concern-title" className="text-sm text-text-primary">
            {offered.fromHome ? OFFER_TITLE_HOME : OFFER_TITLE_LOGIN}
          </p>
          <p className="mt-1.5 line-clamp-3 text-sm text-text-muted [overflow-wrap:anywhere]">{offered.text}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <CTAButton onClick={acceptOffered} variant="secondary" size="sm">
              Use it
            </CTAButton>
            <CTAButton onClick={() => setOffered(null)} variant="secondary" size="sm">
              Discard
            </CTAButton>
          </div>
        </section>
      )}
      {/* Always mounted, so a live region announces the change. */}
      <p role="status" data-offer-status className={offerStatus ? 'text-xs text-text-muted' : 'sr-only'}>
        {offerStatus}
      </p>

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

      {/* Jurisdiction selector, on the C2b Field recipe */}
      <Field
        id="concern-jurisdiction"
        label="Jurisdiction"
        optional
        description="The city, district or province your concern is about. It helps find the right documents."
      >
        {(control) =>
          fetchingJurisdictions ? (
            <div className="h-9 animate-pulse rounded-lg bg-surface-1" />
          ) : (
          <div className="relative">
            <select
              {...control}
              value={selectedJurisdictionId}
              onChange={(e) => setSelectedJurisdictionId(e.target.value)}
              className={fieldControlClass('select')}
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
          )
        }
      </Field>

      {/* Postal code (optional, for the vote tracker), on the C2b Field recipe */}
      <Field
        id="concern-postal-code"
        label="Postal code"
        optional
        description="Shows how your MP voted on related issues."
      >
        {(control) => (
        <input
          {...control}
          type="text"
          value={postalCode}
          onChange={(e) => {
            const clean = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6)
            setPostalCode(clean.length > 3 ? `${clean.slice(0, 3)} ${clean.slice(3)}` : clean)
          }}
          placeholder="V8B 0A1"
          className={clsx(fieldControlClass('input'), 'font-mono tracking-wider')}
          disabled={loading}
          maxLength={7}
          autoComplete="postal-code"
        />
        )}
      </Field>

      {/* Actions. Start keeps one box at rest, typed and busy, and Cancel
          never lands inside it, so a second press 250 ms later can only hit
          Start, whose busy guard refuses it (Jen C2). From md, Cancel sits left
          of Start in its row; below md, where Start is full width, it comes
          after Start on its own row (order-last), so Start never moves. */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
        {/* The reason line has its own row under Start at every width: beside
            Start it does not fit a narrow column (352px at 1024), wraps above,
            and Start jumps on the first keystroke (Razor N2). */}
        {!concern.trim() && !loading && (
          <p id="concern-submit-reason" className="order-last basis-full text-right text-xs text-text-muted">
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
