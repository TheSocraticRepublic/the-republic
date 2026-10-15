'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Search, Compass, Eye, MessageCircleQuestion, FileText, GitCompare, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { CTAButton } from '@/components/ui/cta-button'
import { usePendingConcernListener } from '@/lib/auth/client-sign-out'
import {
  PENDING_CONCERN_MAX_LENGTH,
  loginUrlForHandoff,
  newHandoffId,
  probeSignedOut,
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
 *   1. ask whether this browser is signed out (probeSignedOut; the page is
 *      static and cannot know);
 *   2. signed out (or unknown): write the pending concern to this tab's
 *      sessionStorage under a fresh handoff id, and go to the login with
 *      `/investigate?handoff=<id>` as its redirect. Investigate offers the
 *      text once, on that handoff only;
 *   3. signed in: no record is written (the carry is for the anonymous-to-
 *      login handoff only), and the tab goes straight to Investigate.
 * Nothing leaves the browser with the text until the citizen submits it on
 * Investigate. A storage failure loses the carry, never the navigation.
 */
export function LandingCta() {
  // A record written here waits in this tab; another tab's sign-in or
  // sign-out deletes it.
  usePendingConcernListener()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const empty = text.trim().length === 0

  async function start() {
    if (empty || busy) return
    setBusy(true)
    const signedOut = await probeSignedOut()
    if (signedOut === false) {
      window.location.assign(new URL('/investigate', window.location.origin).href)
      return
    }
    const handoff = newHandoffId()
    writePendingConcern(text.trim(), handoff)
    window.location.assign(new URL(loginUrlForHandoff(handoff), window.location.origin).href)
  }

  return (
    <section className="px-6 py-24" data-scroll-section="cta">
      <div className="mx-auto flex max-w-[560px] flex-col items-center text-center" data-scroll-fade>
        <h2
          id="landing-concern-heading"
          className="font-bold tracking-tight text-text-primary"
          style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 3vw, 36px)', lineHeight: 1.15 }}
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
          id="landing-concern"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-labelledby="landing-concern-heading"
          aria-describedby="landing-concern-helper"
          placeholder="A cutting permit on your trail. A rezoning across from the daycare."
          rows={3}
          maxLength={PENDING_CONCERN_MAX_LENGTH}
          disabled={busy}
          className={clsx(
            'mt-8 w-full resize-none rounded-xl border border-border-strong bg-surface-1 px-4 py-3 text-left text-text-primary shadow-sm placeholder-text-faint outline-none focus:ring-0',
            'focus:border-text-faint disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-2 disabled:text-text-muted'
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
            You&apos;ll sign in with an email code. No password.
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
