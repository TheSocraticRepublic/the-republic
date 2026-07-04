'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [overLight, setOverLight] = useState(false)

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
            ? 'bg-[#FAFAF9]/80 backdrop-blur-md border-b border-border'
            : 'bg-surface-0/80 backdrop-blur-md border-b border-border'
          : 'bg-transparent'
      }`}
    >
      <span
        className={`text-sm font-semibold tracking-tight ${
          overLight ? 'text-stone-900' : 'text-text-muted'
        }`}
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Open Cave
      </span>
      <Link
        href="/login"
        className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
          overLight
            ? 'border-stone-900/30 text-stone-900 hover:border-stone-900 hover:text-stone-900 focus-visible:outline-stone-900'
            : 'border-border-strong text-text-secondary hover:border-text-faint hover:text-text-primary'
        }`}
      >
        Sign in
      </Link>
    </header>
  )
}
