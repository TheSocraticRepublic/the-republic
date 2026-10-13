'use client'

import { useState, useEffect, useCallback, useRef, useId } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Compass, Loader2, X } from 'lucide-react'
import { CTAButton } from '@/components/ui/cta-button'
import { hasCoarsePointer } from '@/lib/ui/input-modality'
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


/** A signed-out search goes to login and comes back here (the B3a path). */
const LOGIN_FOR_SCOUT = '/login?redirect=%2Fscout'

/**
 * Every failure a citizen can see, in Scout's plain-instructional register:
 * the fact, then the action. No server or browser string reaches the page
 * (Jen C4). The daily limit is a fixed 24 h window in @upstash/ratelimit,
 * bucketed on floor(now / 24 h), so it resets at 00:00 UTC; the route sends
 * that instant as `reset` and the page names it in the reader's own time.
 */
export const SCOUT_COPY = {
  rateLimited: 'Too many searches in the last minute. Wait a minute, then search again.',
  dailyLimit: (time: string) => `You've reached the daily limit on AI requests. It resets at ${time}.`,
  unavailable: "Scout can't search right now. Search again later.",
  failed: "Scout couldn't finish that search. Search again.",
  unreadable: "Scout couldn't read that search. Search again.",
  offline: "Open Cave can't be reached. Check your connection, then search again.",
} as const

const DAY_MS = 24 * 60 * 60 * 1000

/** The message for a non-OK, non-401 answer. `body` is the parsed JSON body,
 *  or null when it was not JSON. */
export function scoutErrorMessage(status: number, body: unknown, now: number = Date.now()): string {
  const data = (body && typeof body === 'object' ? body : {}) as { code?: unknown; reset?: unknown }
  if (status === 429 && data.code === 'daily_limit') {
    const reset = typeof data.reset === 'number' ? data.reset : NaN
    // A reset that is not in the next day is not a real window (the limiter
    // fails closed with reset = now when Redis is down): name no time.
    if (!(reset > now && reset <= now + DAY_MS)) return SCOUT_COPY.unavailable
    const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(reset)
    return SCOUT_COPY.dailyLimit(time)
  }
  if (status === 429) return SCOUT_COPY.rateLimited
  if (status === 400) return SCOUT_COPY.unreadable
  return SCOUT_COPY.failed
}

/** The nearest ancestor that scrolls (the app shell's content column), or
 *  the document's scrolling element. */
function scrollParent(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const overflowY = getComputedStyle(p).overflowY
    if ((overflowY === 'auto' || overflowY === 'scroll') && p.scrollHeight > p.clientHeight) return p
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement
}

/** Space kept above the results heading when it is scrolled into view. */
const RESULTS_TOP_GAP = 16
/** How much of the results must be visible for no scroll to be needed: the
 *  heading and its first line. */
const RESULTS_FIRST_LINE = 64

export function DiscoveryForm() {
  const router = useRouter()
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>([])
  const [fetchingJurisdictions, setFetchingJurisdictions] = useState(false)
  const [selectedJurisdictionId, setSelectedJurisdictionId] = useState('')
  const [policyArea, setPolicyArea] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamedText, setStreamedText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [hasResult, setHasResult] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const queryId = useId()
  const headingId = useId()
  const errorId = useId()
  const jurisdictionId = useId()
  const policyAreaId = useId()
  const abortRef = useRef<AbortController | null>(null)
  // In flight, read synchronously: two key events dispatched in one task both
  // see `loading` false (it is render state), so the guard reads this ref.
  const busyRef = useRef(false)
  const queryRef = useRef<HTMLInputElement>(null)
  const submitRef = useRef<HTMLButtonElement>(null)
  const resultsRef = useRef<HTMLElement>(null)
  // The results are brought into view once per search, on the first chunk.
  const scrolledRef = useRef(false)

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
    if (!query.trim() || busyRef.current) return
    busyRef.current = true
    scrolledRef.current = false

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
        // The route still names the field `concern`.
        body: JSON.stringify({
          concern: query.trim(),
          jurisdictionId: selectedJurisdictionId || undefined,
          policyArea: policyArea || undefined,
        }),
        signal: abortRef.current.signal,
      })

      if (res.status === 401) {
        router.push(LOGIN_FOR_SCOUT)
        return
      }

      if (!res.ok) {
        // A body that is not JSON (an HTML 502 from the edge) maps by status.
        const data: unknown = await res.json().catch(() => null)
        setErrorMessage(scoutErrorMessage(res.status, data))
        return
      }

      if (!res.body) {
        setErrorMessage(SCOUT_COPY.failed)
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
      // An abort is the citizen's own Cancel: nothing to report. Anything else
      // thrown by fetch or the stream is the network.
      if (!(err instanceof Error && err.name === 'AbortError')) {
        setErrorMessage(SCOUT_COPY.offline)
      }
    } finally {
      busyRef.current = false
      setIsStreaming(false)
      setLoading(false)
    }
  }, [query, selectedJurisdictionId, policyArea, router])

  const handleCancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
    // Cancel unmounts itself; keep the place in the search row (Jen C5).
    queryRef.current?.focus()
  }, [])

  // On a phone the results start below the fold: bring the heading and its
  // first line into view on the first chunk, once per search (Jen C9). By
  // arithmetic on the scroll container, not scrollIntoView, which would also
  // scroll the page behind the app shell.
  useEffect(() => {
    const section = resultsRef.current
    if (!streamedText || !section || scrolledRef.current) return
    scrolledRef.current = true
    const container = scrollParent(section)
    const box = container.getBoundingClientRect()
    const top = section.getBoundingClientRect().top
    if (top + RESULTS_FIRST_LINE <= box.bottom) return
    const reduce =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    container.scrollTo({
      top: container.scrollTop + (top - box.top) - RESULTS_TOP_GAP,
      behavior: reduce ? 'auto' : 'smooth',
    })
  }, [streamedText])

  const handleQueryKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // A single-line search field: Enter searches. Not a <form>, so nothing
      // else turns Enter into a submit (the app avoids <form> submits; see the
      // login page). handleDiscover refuses an empty query or a busy search.
      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
        e.preventDefault()
        // On a touch screen, move focus to Scout first: that closes the soft
        // keyboard over the results and keeps the place in the search row
        // (Jen C9; the concern form's shortcut pattern). With a keyboard,
        // focus stays in the field.
        if (query.trim() && !busyRef.current && hasCoarsePointer()) submitRef.current?.focus()
        handleDiscover()
      }
    },
    [handleDiscover, query]
  )

  const showSlot = loading || errorMessage !== null

  return (
    <div className="space-y-8">
      {/* Search: one query field first, filters after */}
      <section role="search" aria-labelledby={headingId}>
        <h2 id={headingId} className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-muted">
          Search public records
        </h2>

        <div className="space-y-4">
          {/* Query — the one primary field, with its action beside it */}
          <div>
            <label htmlFor={queryId} className="mb-1.5 block text-xs font-medium text-text-secondary">
              What documents are you looking for?
            </label>
            <div className="flex items-stretch gap-2">
              <input
                ref={queryRef}
                id={queryId}
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleQueryKeyDown}
                // Shows whole at 320 beside the button (Jen C7).
                placeholder="Rental bylaws"
                // No UA clear glyph: Chromium draws a white one flush against
                // the text, outside the tokens (Jen C6). Escape still clears.
                className="min-w-0 flex-1 rounded-lg border border-border-strong bg-surface-1 shadow-sm px-3 py-3 text-base text-text-primary placeholder-text-faint outline-none focus:border-[var(--accent-scout)]/40 [&::-webkit-search-cancel-button]:appearance-none"
                // Locked while searching, but never natively disabled: a
                // disabled field drops focus to the body, and Enter is pressed
                // here (Jen C3's lesson on the concern form). readOnly keeps
                // focus and the caret; aria-disabled says it is unavailable.
                readOnly={loading}
                aria-disabled={loading ? 'true' : undefined}
                aria-describedby={errorMessage !== null ? errorId : undefined}
              />
              {/* The arm recipe (Jen C1): no opacity in any state, the ring at
                  full ink, and the same label busy or not, so the field keeps
                  its width. The working state is announced in the slot below. */}
              <CTAButton
                ref={submitRef}
                variant="arm"
                arm="scout"
                onClick={handleDiscover}
                disabled={!query.trim()}
                busy={loading}
                className="shrink-0 justify-center"
              >
                {loading ? (
                  <Loader2 size={14} strokeWidth={2} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Compass size={14} strokeWidth={2} aria-hidden="true" />
                )}
                Scout
              </CTAButton>
            </div>
            {/* Announces the start of a search to a screen reader; the visible
                line below is the same words, hidden from the tree. */}
            <p role="status" className="sr-only">
              {loading ? 'Scouting…' : ''}
            </p>
          </div>

          {/* The one slot under the query row: the working line with Cancel,
              or the error that the field is described by (Jen C4, C5). */}
          {showSlot && (
            <div className="flex min-h-6 items-center justify-between gap-3">
              {loading && (
                <>
                  <p aria-hidden="true" className="text-xs text-text-muted">
                    Scouting…
                  </p>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="inline-flex min-h-6 items-center gap-1.5 rounded-lg px-3 text-xs text-text-muted transition-colors hover:text-text-secondary [@media(pointer:coarse)]:min-h-11"
                  >
                    <X size={12} strokeWidth={2} aria-hidden="true" />
                    Cancel
                  </button>
                </>
              )}
              {!loading && errorMessage !== null && (
                <p id={errorId} role="alert" className="text-xs text-status-danger">
                  {errorMessage}
                </p>
              )}
            </div>
          )}

          {/* Filters — after the query, both optional */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          </div>

        </div>
      </section>

      {/* Results */}
      {(isStreaming || hasResult) && streamedText && (
        <section ref={resultsRef}>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-muted">
            Discovery results
          </h2>
          <ScoutResultView text={streamedText} isStreaming={isStreaming} />
        </section>
      )}
    </div>
  )
}
