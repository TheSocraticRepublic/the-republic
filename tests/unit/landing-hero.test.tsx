import { describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

/*
 * UI plan C4, the landing hero and header (landing L3, L14), as the server
 * renders them. jsdom drops gradients and color-mix from inline styles, so
 * these read the server markup, where the style string is React's own
 * serialisation of what ships. Layout and the painted result are measured on
 * the harness (landing-hero-geometry.test.ts).
 */

vi.mock('next/image', () => ({
  default: (props: { src: string; alt: string }) => h('img', { src: props.src, alt: props.alt }),
}))

describe('the hero', () => {
  it('is 88svh, not a full screen', async () => {
    const { Hero } = await import('@/components/landing/hero')
    const html = renderToStaticMarkup(h(Hero))
    expect(html).toContain('min-h-[88svh]')
    // Clears the fixed header (Jen C1).
    expect(html).toMatch(/class="[^"]*\bpt-24\b[^"]*\bpb-12\b/)
    expect(html).not.toContain('min-h-screen')
  })

  it('says what Open Cave does, and offers "Start an investigation" to /investigate', async () => {
    const { Hero } = await import('@/components/landing/hero')
    const html = renderToStaticMarkup(h(Hero))
    expect(html).toContain('Bring a civic concern. Leave with the documents behind it, the questions to ask, and a filing you can send.')
    expect(html).toMatch(/<a [^>]*href="\/investigate"[^>]*>Start an investigation<\/a>/)
    expect(html).toContain('min-h-11')
  })

  it('the overlay ends at the cave token, the colour movement 2 starts from (L14), never a hex', async () => {
    const { Hero } = await import('@/components/landing/hero')
    const html = renderToStaticMarkup(h(Hero))
    const overlay = html.match(/data-hero-overlay="[^"]*"[^>]*style="([^"]*)"/)?.[1] ?? html.match(/style="([^"]*)"[^>]*data-hero-overlay/)?.[1]
    expect(overlay).toBeDefined()
    expect(overlay).toContain('color-mix(in srgb, var(--journey-cave) 60%, transparent) 82%')
    expect(overlay).toContain('var(--journey-cave) 100%')
    expect(overlay).not.toMatch(/#0B0A09/i)
  })

  it('has the radial scrim behind the type (L3) and keeps the light shaft', async () => {
    const { Hero } = await import('@/components/landing/hero')
    const html = renderToStaticMarkup(h(Hero))
    const scrim = html.match(/data-hero-scrim="[^"]*"[^>]*style="([^"]*)"/)?.[1] ?? html.match(/style="([^"]*)"[^>]*data-hero-scrim/)?.[1]
    expect(scrim).toContain('radial-gradient(ellipse 70% 55% at 50% 46%, color-mix(in srgb, var(--journey-cave) 80%, transparent), transparent 70%)')
    expect(html).toContain('light-shaft')
  })
})

describe('the hero type (Jen C2)', () => {
  it('the tagline is white/90 and the line is text-primary', async () => {
    const { Hero, HERO_LINE } = await import('@/components/landing/hero')
    const html = renderToStaticMarkup(h(Hero))
    expect(html).toMatch(/<p class="[^"]*\btext-white\/90\b[^"]*"[^>]*>A Republic for the examined institution\.<\/p>/)
    expect(html).toMatch(new RegExp(`<p [^>]*class="[^"]*\\btext-text-primary\\b[^"]*"[^>]*>${HERO_LINE}</p>`))
  })
})

describe('the landing header, as the server renders it', () => {
  it('renders Sign in, and no Start until an IntersectionObserver has answered (Jen C4 C4)', async () => {
    const { LandingHeader } = await import('@/components/landing/landing-header')
    const html = renderToStaticMarkup(h(LandingHeader))
    expect(html).toContain('>Sign in</a>')
    expect(html).not.toContain('Start an investigation')
    expect(html).toMatch(/<a [^>]*class="[^"]*pointer-coarse:min-h-11[^"]*"[^>]*>Sign in<\/a>/)
  })
})
