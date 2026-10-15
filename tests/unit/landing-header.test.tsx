// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement as h, Fragment } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

/*
 * Jen C4 C4: the header's "Start an investigation" shows only while neither
 * the hero's Start nor the closing box is in view, never on a phone, and
 * never leaves the page with text in the closing box. Real header and
 * closing box in jsdom; IntersectionObserver, matchMedia, fetch and
 * window.location are replaced. Layout is measured on the harness
 * (landing-hero-geometry.test.ts).
 */

const ORIGIN = 'http://127.0.0.1:3177'

let observers: FakeObserver[] = []
class FakeObserver {
  targets: Element[] = []
  constructor(public cb: (entries: Array<{ target: Element; isIntersecting: boolean }>) => void) {
    observers.push(this)
  }
  observe(t: Element) {
    this.targets.push(t)
  }
  disconnect() {}
  unobserve() {}
}

let phone = false
let assign: ReturnType<typeof vi.fn>
const realLocation = window.location

beforeEach(() => {
  observers = []
  phone = false
  vi.stubGlobal('IntersectionObserver', FakeObserver)
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: query.includes('639px') ? phone : false, media: query, addEventListener() {}, removeEventListener() {} }))
  )
  vi.stubGlobal('BroadcastChannel', undefined)
  vi.stubGlobal('fetch', vi.fn(async () => ({ type: 'opaqueredirect', ok: false, status: 0 })))
  assign = vi.fn()
  Object.defineProperty(window, 'location', { configurable: true, value: { origin: ORIGIN, href: `${ORIGIN}/`, pathname: '/', search: '', assign } })
  window.sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
})

async function renderPage() {
  const { LandingHeader } = await import('@/components/landing/landing-header')
  const { LandingCta } = await import('@/components/landing/landing-cta')
  await act(async () => {
    render(h(Fragment, null, h(LandingHeader), h('div', { 'data-hero-start': '' }, 'hero start'), h(LandingCta)))
  })
  // next/link observes its anchors too; ours is the one watching the hero Start.
  const io = observers.find((o) => o.targets.some((t) => t.hasAttribute('data-hero-start')))!
  const [hero, cta] = io.targets
  const report = async (heroIn: boolean, ctaIn: boolean) =>
    act(async () => io.cb([{ target: hero, isIntersecting: heroIn }, { target: cta, isIntersecting: ctaIn }]))
  const headerStart = () => document.querySelector('header')!.querySelector('a[href="/investigate"]')
  return { report, headerStart, io }
}

describe("the header's Start yields to the hero's and the closing box", () => {
  it('watches exactly the hero Start and the closing box', async () => {
    const { io } = await renderPage()
    expect(io.targets.map((t) => t.hasAttribute('data-hero-start') || t.getAttribute('data-scroll-section'))).toEqual([true, 'cta'])
  })

  it('not shown before the observer answers, nor while either is in view; shown when neither is', async () => {
    const { report, headerStart } = await renderPage()
    expect(headerStart()).toBeNull()
    await report(true, false)
    expect(headerStart()).toBeNull()
    await report(false, true)
    expect(headerStart()).toBeNull()
    await report(false, false)
    expect(headerStart()?.textContent).toBe('Start an investigation')
    expect(headerStart()!.className).toContain('pointer-coarse:min-h-11')
    await report(false, true)
    expect(headerStart()).toBeNull()
  })

  it('a viewport change before the observer answers does not show it', async () => {
    const listeners: Array<() => void> = []
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: false, media: query, addEventListener: (_t: string, l: () => void) => listeners.push(l), removeEventListener() {} }))
    )
    const { headerStart } = await renderPage()
    await act(async () => {
      for (const l of listeners) l()
    })
    expect(headerStart()).toBeNull()
  })

  it('never on a phone', async () => {
    phone = true
    const { report, headerStart } = await renderPage()
    await report(false, false)
    expect(headerStart()).toBeNull()
  })
})

describe("the header's Start never discards the closing box's text", () => {
  it('with text in the box, it carries it (record written, login with the handoff), not a bare /investigate', async () => {
    const { report, headerStart } = await renderPage()
    await report(false, false)
    fireEvent.change(screen.getByRole('textbox', { name: 'What concerns you?' }), { target: { value: '  typed below  ' } })
    await act(async () => {
      fireEvent.click(headerStart()!)
    })
    const stored = JSON.parse(window.sessionStorage.getItem('oc:pending-concern')!)
    expect(stored.text).toBe('typed below')
    expect(assign).toHaveBeenCalledTimes(1)
    const to = new URL(assign.mock.calls[0][0])
    expect(to.pathname).toBe('/login')
    expect(to.searchParams.get('redirect')).toBe(`/investigate?handoff=${stored.handoff}`)
  })

  it('with an empty box, it is a plain link (nothing written, default not prevented)', async () => {
    const { report, headerStart } = await renderPage()
    await report(false, false)
    let prevented: boolean | undefined
    headerStart()!.addEventListener('click', (e) => {
      prevented = e.defaultPrevented
      e.preventDefault() // jsdom: do not navigate
    })
    fireEvent.click(headerStart()!)
    expect(prevented).toBe(false)
    expect(window.sessionStorage.getItem('oc:pending-concern')).toBeNull()
  })
})

describe('the closing box (Jen C4 C5)', () => {
  it('busy is readOnly with aria-busy, never disabled; the helper is true signed in or out', async () => {
    let release: () => void = () => {}
    vi.stubGlobal('fetch', vi.fn(() => new Promise((r) => (release = () => r({ type: 'opaqueredirect', ok: false, status: 0 })))))
    await renderPage()
    const box = screen.getByRole('textbox', { name: 'What concerns you?' }) as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: 'busy text' } })
    await act(async () => {
      fireEvent.click(document.querySelector('[data-scroll-section="cta"] button')!)
    })
    expect(box.readOnly).toBe(true)
    expect(box.disabled).toBe(false)
    expect(box.getAttribute('aria-busy')).toBe('true')
    expect(box.className).not.toMatch(/opacity/)
    expect(document.getElementById('landing-concern-helper')?.textContent).toBe('Signing in takes an email code. No password.')
    await act(async () => release())
  })
})
