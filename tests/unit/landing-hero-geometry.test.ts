import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import type { Browser } from 'playwright'

/*
 * UI plan C4, the landing hero, header and closing box, laid out and painted
 * in Chromium against the QA harness's production build, at 1440, 768, 375
 * and 320. Signed out; nothing is submitted. Runs only when this worktree's
 * harness is up; otherwise skipped with a marker, and QA_REQUIRE_HARNESS=1
 * makes the skip a failure.
 */

const APP_URL = 'http://127.0.0.1:3177'
const REPO_ROOT = path.resolve(__dirname, '..', '..')

function harnessState(): unknown {
  const stateDir = path.join(os.tmpdir(), `open-cave-qa-${createHash('sha1').update(REPO_ROOT).digest('hex').slice(0, 10)}`)
  try {
    return JSON.parse(fs.readFileSync(path.join(stateDir, 'state.json'), 'utf8'))
  } catch {
    return null
  }
}

async function appReachable(): Promise<boolean> {
  try {
    const r = await fetch(`${APP_URL}/api/health`, { signal: AbortSignal.timeout(3000) })
    return r.ok
  } catch {
    return false
  }
}

const APP_UP = harnessState() !== null && (await appReachable())
if (!APP_UP) {
  const message = '[landing-hero-geometry] SKIPPED: the QA harness is not running for this worktree (npx tsx scripts/qa/harness.ts up).'
  if (process.env.QA_REQUIRE_HARNESS === '1') throw new Error(message.replace('SKIPPED', 'REQUIRED'))
  console.warn(message)
}

const VIEWPORTS = [
  { width: 1440, height: 900, touch: false },
  { width: 768, height: 1024, touch: true },
  { width: 375, height: 667, touch: true },
  { width: 320, height: 568, touch: true },
]

describe.skipIf(!APP_UP)('the landing hero, header and closing box on the harness (Chromium)', () => {
  let browser: Browser

  beforeAll(async () => {
    const { chromium } = await import('playwright')
    browser = await chromium.launch()
  }, 60_000)

  afterAll(async () => {
    await browser?.close()
  })

  it.each(VIEWPORTS)('at $width x $height', async (vp) => {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: vp.touch,
      isMobile: vp.touch,
      deviceScaleFactor: 1,
    })
    try {
      const page = await context.newPage()
      await page.goto(`${APP_URL}/`, { waitUntil: 'networkidle' })
      const m = await page.evaluate(() => {
        const box = (el: Element | null) => {
          if (!el) return null
          const r = el.getBoundingClientRect()
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, shown: r.width > 0 && r.height > 0 }
        }
        const header = document.querySelector('header')!
        return {
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          hero: box(document.querySelector('[data-scroll-section="hero"]')),
          heroStart: box(document.querySelector('[data-scroll-section="hero"] a[href="/investigate"]')),
          overlay: getComputedStyle(document.querySelector('[data-hero-overlay]')!).backgroundImage,
          headerLinks: [...header.querySelectorAll('a')].map((a) => ({ text: a.textContent, ...box(a)! })),
          wordmark: box(header.querySelector('span')),
          pills: [...document.querySelectorAll('[data-scroll-section="cta"] a')].map((a) => box(a)!.height),
          ctaButton: box(document.querySelector('[data-scroll-section="cta"] button')),
        }
      })

      // No horizontal scroll.
      expect(m.scrollWidth).toBe(m.innerWidth)
      // 88svh: the band below shows at the fold.
      expect(Math.abs(m.hero!.height - 0.88 * m.innerHeight)).toBeLessThanOrEqual(1)
      // The hero's action, 44px tall, in view.
      expect(m.heroStart!.height).toBeGreaterThanOrEqual(44)
      expect(m.heroStart!.bottom).toBeLessThanOrEqual(m.innerHeight)
      // The overlay ends at the cave's warm black, #0B0A09 (L14).
      expect(m.overlay).toMatch(/rgb\(11, 10, 9\) 100%\)$/)
      // Every visible header control fits inside the viewport, and none
      // overlaps the wordmark; the header's Start shows from sm (640) up.
      const shown = m.headerLinks.filter((l) => l.shown)
      for (const l of shown) {
        expect(l.left).toBeGreaterThanOrEqual(m.wordmark!.right)
        expect(l.right).toBeLessThanOrEqual(m.innerWidth)
      }
      expect(m.wordmark!.height).toBeLessThan(30) // one line
      const start = m.headerLinks.find((l) => l.text === 'Start an investigation')!
      expect(start.shown).toBe(vp.width >= 640)
      if (start.shown) {
        const signIn = m.headerLinks.find((l) => l.text === 'Sign in')!
        expect(start.right).toBeLessThanOrEqual(signIn.left)
      }
      // Touch-size pills (mobile P2-16): 38px, 44px on a coarse pointer.
      for (const h of m.pills) expect(h).toBeGreaterThanOrEqual(vp.touch ? 44 : 38)
      expect(m.ctaButton!.height).toBeGreaterThanOrEqual(44)
    } finally {
      await context.close()
    }
  }, 60_000)
})
