'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [overLight, setOverLight] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 40)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const targets = [
      document.querySelector('[data-movement="light"]'),
      document.querySelector('[data-movement="return"]'),
    ].filter((el): el is Element => el !== null)

    if (targets.length === 0) return

    const intersecting = new Set<Element>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            intersecting.add(entry.target)
          } else {
            intersecting.delete(entry.target)
          }
        }
        setOverLight(intersecting.size > 0)
      },
      { rootMargin: '-64px 0px 0px 0px', threshold: 0 }
    )

    targets.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
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
            ? 'border-stone-900/30 text-stone-900 hover:border-stone-900 hover:text-stone-900'
            : 'border-border-strong text-text-secondary hover:border-text-faint hover:text-text-primary'
        }`}
      >
        Sign in
      </Link>
    </header>
  )
}
