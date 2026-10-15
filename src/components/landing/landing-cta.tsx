'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Search, Compass, Eye, MessageCircleQuestion, FileText, GitCompare, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { CTAButton } from '@/components/ui/cta-button'
import { usePendingConcernListener } from '@/lib/auth/client-sign-out'
import {
  PENDING_CONCERN_MAX_LENGTH,
  loginUrlForHandoff,
  newHandoffId,
  probeSignedOut,
  signedInHandoffUrl,
  writePendingConcern,
} from '@/lib/pending-concern'

// Arm-accent tokens — this movement is under .light-scope, so they resolve to the light variants.
const armLinks = [
  { name: 'Scout', href: '/scout', icon: Compass, accent: 'var(--accent-scout)' },
  { name: 'Oracle', href: '/oracle', icon: Eye, accent: 'var(--accent-oracle)' },
  { name: 'Gadfly', href: '/gadfly', icon: MessageCircleQuestion, accent: 'var(--accent-gadfly)' },
  { name: 'Lever', href: '/lever', icon: FileText, accent: 'var(--accent-lever)' },
  { name: 'Mirror', href: '/mirror', icon: GitCompare, accent: 'var(--accent-mirror)' },
]

/*
 * M6, the closing box (UI plan C4; landing L4): a real place to write the
 * concern, carried through sign-in.
 *
 * Start an investigation, with text:
 *   1. write the pending concern to this tab's sessionStorage under a fresh
 *      handoff id, FIRST: a sign-out heard while the probe below is in flight
 *      then deletes it, rather than being undone by a write after it (Razor
 *      C4 judge d2);
 *   2. ask whether this browser is signed out (probeSignedOut; the page is
 *      static and cannot know);
 *   3. signed out (or unknown): go to the login with
 *      `/investigate?handoff=<id>` as its redirect;
 *   4. signed in: go straight to `/investigate?handoff=<id>&from=home`
 *      (orchestrator ruling, C4 fix pass). No login is crossed, so the offer
 *      there says "Your concern from the home page."
 * Investigate offers the text once, on that handoff only.
 * Nothing leaves the browser with the text until the citizen submits it on
 * Investigate. A storage failure loses the carry, never the navigation.
 */
/** The closing box's id: the header's Start reads it, so it never leaves
 *  the page with text sitting there (Jen C4 C4). */
export const LANDING_CONCERN_ID = 'landing-concern'

/** The helper under the closing box: true signed in or out (Jen C4 C5). */
export const LANDING_HELPER = 'Signing in takes an email code. No password.'

/*
 * One start at a time, across the header's Start and the closing box (Razor
 * C4 DN1). Without it a double click, or a header click during the box's own
 * start, wrote two records and navigated twice; with the two probes answering
 * out of order, the second record replaced the first under the other
 * navigation's handoff and the concern was lost. Held until the page leaves;
 * released if the navigation throws, or if the page comes back from the
 * back/forward cache (the navigation was left or cancelled).
 */
let handoffInFlight = false

/** Release the in-flight flag: a page restored from the back/forward cache,
 *  and the test seam. */
export function releaseLandingHandoff(): void {
  handoffInFlight = false
}

/**
 * Carry `text` from the landing: write the record, probe, navigate (steps
 * 1-4 above). The closing box and the header's Start both use it. Returns
 * false, doing nothing, while another start is in flight. Throws only if
 * something unexpected does, with the flag released; callers recover.
 */
export async function startLandingHandoff(text: string): Promise<boolean> {
  if (handoffInFlight) return false
  handoffInFlight = true
  try {
    const handoff = newHandoffId()
    writePendingConcern(text, handoff)
    const signedOut = await probeSignedOut()
    const next = signedOut === false ? signedInHandoffUrl(handoff) : loginUrlForHandoff(handoff)
    window.location.assign(new URL(next, window.location.origin).href)
    return true
  } catch (err) {
    handoffInFlight = false
    throw err
  }
}

export function LandingCta() {
  // A record written here waits in this tab; another tab's sign-in or
  // sign-out deletes it.
  usePendingConcernListener()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  // Back from the login page via the back/forward cache: the navigation was
  // left, so the flag and the busy box are released.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return
      releaseLandingHandoff()
      setBusy(false)
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])
  const empty = text.trim().length === 0

  // Not re-checked here: CTAButton's aria-disabled guard refuses the click
  // while the box is empty or a start is in flight, and it is the only caller.
  async function start() {
    setBusy(true)
    try {
      // Another start (the header's) is already carrying the box's text.
      if (!(await startLandingHandoff(text.trim()))) setBusy(false)
    } catch (err) {
      // Nothing above is expected to throw (the probe and storage catch their
      // own failures); if something does, the box comes back rather than
      // staying locked (Razor C4 N5), and the failure is logged by name.
      console.error('[landing] start failed:', err instanceof Error ? err.name : 'unknown error')
      setBusy(false)
    }
  }

  return (
    <section className="px-6 py-24" data-scroll-section="cta">
      <div className="mx-auto flex max-w-[560px] flex-col items-center text-center" data-scroll-fade>
        <h2
          id="landing-concern-heading"
          className="font-display text-[length:clamp(28px,3vw,36px)] leading-[1.15] font-bold tracking-tight text-text-primary"
        >
          What concerns you?
        </h2>
        <p
          className="mt-4 text-text-secondary"
          style={{ fontFamily: 'var(--font-serif)', fontSize: '17px', lineHeight: 1.6 }}
        >
          Describe a civic issue and Open Cave investigates it. Documents,
          analysis, actions, and comparisons in one complete briefing.
        </p>

        <textarea
          id={LANDING_CONCERN_ID}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-labelledby="landing-concern-heading"
          aria-describedby="landing-concern-helper"
          placeholder="A cutting permit on your trail. A rezoning across from the daycare."
          rows={3}
          maxLength={PENDING_CONCERN_MAX_LENGTH}
          // Busy is readOnly, never disabled: the typed concern keeps its
          // rest contrast while the probe and navigation run (Jen C4 C5).
          readOnly={busy}
          aria-busy={busy || undefined}
          className={clsx(
            'mt-8 w-full resize-none rounded-xl border border-border-strong bg-surface-1 px-4 py-3 text-left text-text-primary shadow-sm placeholder-text-faint outline-none focus:ring-0',
            'focus:border-text-faint read-only:cursor-progress'
          )}
          style={{ fontFamily: 'var(--font-serif)', fontSize: '17px', lineHeight: 1.6, minHeight: '112px' }}
        />

        <div className="mt-4 flex w-full flex-col items-center">
          <CTAButton
            onClick={start}
            disabled={empty}
            busy={busy}
            describedBy="landing-concern-reason"
            variant="primary"
            size="md"
            className="min-h-11 w-full justify-center sm:w-auto"
          >
            {busy ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : <Search size={14} strokeWidth={2} />}
            Start an investigation
          </CTAButton>
          {empty && !busy && (
            <p id="landing-concern-reason" className="mt-2 text-xs text-text-muted">
              Describe your concern to start.
            </p>
          )}
          <p id="landing-concern-helper" className="mt-3 text-[13px] text-text-muted">
            {LANDING_HELPER}
          </p>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
          {armLinks.map((arm) => {
            const Icon = arm.icon
            return (
              <Link
                key={arm.name}
                href={arm.href}
                // Touch size (mobile P2-16): 38px with py-2.5, 44px on a coarse pointer.
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary pointer-coarse:min-h-11"
              >
                <Icon size={12} strokeWidth={2} style={{ color: arm.accent }} />
                {arm.name}
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
