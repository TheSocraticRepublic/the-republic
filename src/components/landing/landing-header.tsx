'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { CTAButton } from '@/components/ui/cta-button'
import { LANDING_CONCERN_ID, startLandingHandoff } from '@/components/landing/landing-cta'

/** Where the header's Start never shows: phones, portrait (below sm) or
 *  landscape (a coarse pointer on a short screen). */
const PHONE_QUERY = '(max-width: 639px), (pointer: coarse) and (max-height: 499px)'

/** What the header's Start yields to: the hero's own Start and the closing
 *  box. While either is in view, the header's is not rendered at all. */
const YIELDS_TO = '[data-hero-start], [data-scroll-section="cta"]'

/**
 * Whether the header's "Start an investigation" is shown (Jen C4 C4): only
 * when neither the hero's Start nor the closing box intersects the viewport,
 * and never on a phone, so two never show together. Not rendered until an
 * IntersectionObserver has answered (none, or no matchMedia: never shown;
 * the hero and the closing box carry the action). It appears and leaves
 * without any animation, so reduced motion has nothing to reduce.
 */
function useHeaderStart(): boolean {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (typeof IntersectionObserver !== 'function' || typeof window.matchMedia !== 'function') return
    const phone = window.matchMedia(PHONE_QUERY)
    const targets = Array.from(document.querySelectorAll(YIELDS_TO))
    const inView = new Set<Element>()
    let answered = false
    const update = () => setShow(answered && !phone.matches && inView.size === 0)
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) inView.add(e.target)
        else inView.delete(e.target)
      }
      answered = true
      update()
    })
    for (const t of targets) observer.observe(t)
    phone.addEventListener('change', update)
    return () => {
      observer.disconnect()
      phone.removeEventListener('change', update)
    }
  }, [])
  return show
}

/**
 * The header's Start never leaves the page with text sitting in the closing
 * box (Jen C4 C4): if there is any, it carries it exactly as the box's own
 * Start does. A capture handler on the wrapper prevents the link's
 * navigation (next/link skips a default-prevented click).
 */
function carryClosingBoxText(event: React.MouseEvent) {
  const box = document.getElementById(LANDING_CONCERN_ID) as HTMLTextAreaElement | null
  const text = box?.value.trim() ?? ''
  if (text.length === 0) return
  event.preventDefault()
  startLandingHandoff(text).catch((err) => {
    console.error('[landing] header start failed:', err instanceof Error ? err.name : 'unknown error')
  })
}

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [overLight, setOverLight] = useState(false)
  const showStart = useHeaderStart()

  useEffect(() => {
    // The header sits ~72px from the top. Flip to the light (ink) variant only
    // when a light movement actually crosses UNDER that line — not merely when
    // it first peeks in at the bottom of the viewport (which would put an ink
    // header over the still-dark fog).
    const HEADER_LINE = 72
    const lightMovements = Array.from(
      document.querySelectorAll('[data-movement="light"], [data-movement="return"]')
    )

    function onScroll() {
      setScrolled(window.scrollY > 40)
      setOverLight(
        lightMovements.some((el) => {
          const r = el.getBoundingClientRect()
          return r.top <= HEADER_LINE && r.bottom > HEADER_LINE
        })
      )
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 z-50 flex w-full items-center justify-between px-8 py-5 transition-all duration-300 ${
        scrolled
          ? overLight
            ? 'bg-island-bg/80 backdrop-blur-md border-b border-border'
            : 'bg-surface-0/80 backdrop-blur-md border-b border-border'
          : 'bg-transparent'
      }`}
    >
      <span
        className={`whitespace-nowrap text-sm font-semibold tracking-tight ${
          overLight ? 'text-stone-900' : 'text-text-muted'
        }`}
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Open Cave
      </span>
      {/* The filled primary, "Start an investigation", to the left of the
          ghost "Sign in" (UI plan C4, landing L3), shown only mid-page (see
          useHeaderStart). Over the light movements the primary's tokens
          resolve under .light-scope, so it turns to full ink on paper. On
          phones it never shows: with the wordmark and Sign in it needs about
          340px, and the hero carries the same action at the same words. */}
      <div className="flex items-center gap-2 sm:gap-3">
        {showStart && (
          <span data-header-start className={clsx('hidden sm:inline', overLight && 'light-scope')} onClickCapture={carryClosingBoxText}>
            <CTAButton href="/investigate" variant="primary" size="sm" className="min-h-10 justify-center pointer-coarse:min-h-11">
              Start an investigation
            </CTAButton>
          </span>
        )}
        <Link
          href="/login"
          className={`inline-flex min-h-10 items-center rounded-lg border px-3 py-2 text-sm whitespace-nowrap transition-colors pointer-coarse:min-h-11 sm:px-4 ${
            overLight
              ? 'border-stone-900/30 text-stone-900 hover:border-stone-900 hover:text-stone-900 focus-visible:outline-stone-900'
              : 'border-border-strong text-text-secondary hover:border-text-faint hover:text-text-primary'
          }`}
        >
          Sign in
        </Link>
      </div>
    </header>
  )
}
