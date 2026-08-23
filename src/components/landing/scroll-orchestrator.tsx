'use client'

import { useRef, useEffect, type ReactNode } from 'react'
import { useReducedMotion } from '@/lib/landing/use-reduced-motion'

export function ScrollOrchestrator({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const elements = document.querySelectorAll('[data-scroll-fade]')

    if (reducedMotion || !containerRef.current) {
      elements.forEach((el) => el.classList.add('in-view'))
      return () => {
        elements.forEach((el) => el.classList.remove('in-view'))
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -10% 0px' }
    )

    document.querySelectorAll('[data-scroll-fade]').forEach((el) => {
      observer.observe(el)
    })

    let gsapCtx: { revert: () => void } | null = null

    async function initGsap() {
      try {
        const { gsap } = await import('gsap')
        const { ScrollTrigger } = await import('gsap/ScrollTrigger')
        gsap.registerPlugin(ScrollTrigger)

        gsapCtx = gsap.context(() => {
          ScrollTrigger.matchMedia({
            '(min-width: 768px)': () => {
              // Hero image parallax — image moves at 0.3x scroll speed
              const heroImage = document.querySelector(
                '[data-scroll-hero-image]'
              )
              if (heroImage) {
                gsap.to(heroImage, {
                  y: '30%',
                  ease: 'none',
                  scrollTrigger: {
                    trigger: '[data-scroll-section="hero"]',
                    start: 'top top',
                    end: 'bottom top',
                    scrub: true,
                  },
                })
              }
            },
          })

          // The dark -> light journey now lives in pure CSS: each movement
          // wrapper in page.tsx carries its `.movement-*` ground and blends to
          // the next in its top boundary band (globals.css). That renders with
          // GSAP off and is reduced-motion safe, so there is no scroll-driven
          // background animation here — only parallax + reveal above.
        }, containerRef)
      } catch {
        document.querySelectorAll('[data-scroll-fade]').forEach((el) => {
          el.classList.add('in-view')
        })
      }
    }

    initGsap()

    return () => {
      observer.disconnect()
      gsapCtx?.revert()
    }
  }, [reducedMotion])

  return (
    <div ref={containerRef} className="relative">
      {children}
    </div>
  )
}
