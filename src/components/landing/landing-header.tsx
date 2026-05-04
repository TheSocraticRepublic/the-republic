'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 40)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 z-50 flex w-full items-center justify-between px-8 py-5 transition-all duration-300 ${
        scrolled
          ? 'bg-surface-0/80 backdrop-blur-md border-b border-border'
          : 'bg-transparent'
      }`}
    >
      <span
        className="text-sm font-semibold tracking-tight text-text-muted"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        The Republic
      </span>
      <Link
        href="/login"
        className="rounded-lg border border-border-strong px-4 py-2 text-sm text-text-secondary transition-colors hover:border-text-faint hover:text-text-primary"
      >
        Sign in
      </Link>
    </header>
  )
}
