import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import type { Browser, Page } from 'playwright'

/*
 * UI plan C4, the landing hero, header and closing box, laid out and painted
 * in Chromium against the QA harness's production build, at Jen's eight
 * sizes (C4 design review). Signed out; nothing is submitted. Runs only when
 * this worktree's harness is up; otherwise skipped with a marker, and
 * QA_REQUIRE_HARNESS=1 makes the skip a failure.
 *
 * Contrast is measured as Jen measured it: each line's computed colour
 * (alpha composited onto each pixel) against the pixels behind its own text,
 * captured with the text made transparent and its text-shadow kept, at p5.
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

type Viewport = { width: number; height: number; touch: boolean; phone: boolean; portraitPhone: boolean }
const VIEWPORTS: Viewport[] = [
  { width: 1440, height: 900, touch: false, phone: false, portraitPhone: false },
  { width: 1280, height: 720, touch: false, phone: false, portraitPhone: false },
  { width: 1920, height: 1080, touch: false, phone: false, portraitPhone: false },
  { width: 768, height: 1024, touch: true, phone: false, portraitPhone: false },
  { width: 375, height: 667, touch: true, phone: true, portraitPhone: true },
  { width: 320, height: 568, touch: true, phone: true, portraitPhone: true },
  { width: 667, height: 375, touch: true, phone: true, portraitPhone: false },
  { width: 568, height: 320, touch: true, phone: true, portraitPhone: false },
]

function luminance([r, g, b]: number[]): number {
  const c = [r, g, b].map((v) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

function contrast(a: number[], b: number[]): number {
  const [la, lb] = [luminance(a), luminance(b)]
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** p5 contrast of the H1, tagline and line against their own ground. */
async function heroContrast(page: Page): Promise<Record<string, number>> {
  const sharp = (await import('sharp')).default
  const lines = await page.evaluate(() => {
    const hero = document.querySelector('[data-scroll-section="hero"]')!
    const pick: Record<string, Element> = {
      h1: hero.querySelector('h1')!,
      tagline: Array.from(hero.querySelectorAll('p')).find((p) => p.textContent?.startsWith('A Republic'))!,
      line: hero.querySelector('[data-hero-line]')!,
    }
    // Computed colours can be oklab() (Tailwind's white/90); a 1x1 canvas
    // turns any of them into sRGB bytes plus alpha.
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    const rgba = (css: string) => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = css
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
      return [r, g, b, a / 255]
    }
    const out: Record<string, { color: number[]; box: { x: number; y: number; width: number; height: number } }> = {}
    for (const [name, el] of Object.entries(pick)) {
      const range = document.createRange()
      range.selectNodeContents(el)
      const r = range.getBoundingClientRect()
      out[name] = { color: rgba(getComputedStyle(el).color), box: { x: r.x, y: r.y, width: r.width, height: r.height } }
      ;(el as HTMLElement).dataset.geomHide = '1'
    }
    return out
  })
  // The text goes; its shadow stays, since it is part of the treatment.
  await page.addStyleTag({ content: '[data-geom-hide] { color: transparent !important; }' })
  await page.waitForTimeout(150)
  const result: Record<string, number> = {}
  for (const [name, { color, box }] of Object.entries(lines)) {
    const clip = { x: Math.max(0, Math.floor(box.x)), y: Math.max(0, Math.floor(box.y)), width: Math.ceil(box.width), height: Math.ceil(box.height) }
    const png = await page.screenshot({ clip })
    const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const [r, g, b, a] = color
    const ratios: number[] = []
    for (let i = 0; i < info.width * info.height; i++) {
      const bg = [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]]
      const fg = [r, g, b].map((c, k) => c * a + bg[k] * (1 - a))
      ratios.push(contrast(fg, bg))
    }
    ratios.sort((x, y) => x - y)
    result[name] = Math.round(ratios[Math.floor(ratios.length * 0.05)] * 100) / 100
  }
  return result
}

describe.skipIf(!APP_UP)('the landing hero, header and closing box on the harness (Chromium)', () => {
  let browser: Browser

  beforeAll(async () => {
    const { chromium } = await import('playwright')
    browser = await chromium.launch()
  }, 60_000)

  afterAll(async () => {
    await browser?.close()
  })

  async function open(vp: Viewport) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: vp.touch,
      isMobile: vp.touch,
      deviceScaleFactor: 1,
    })
    const page = await context.newPage()
    await page.goto(`${APP_URL}/`, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => {
      const img = document.querySelector('[data-scroll-hero-image] img') as HTMLImageElement | null
      return !!img && img.complete && img.naturalWidth > 0
    })
    return { context, page }
  }

  it.each(VIEWPORTS)('layout at $width x $height', async (vp) => {
    const { context, page } = await open(vp)
    try {
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
          h1: box(document.querySelector('[data-scroll-section="hero"] h1')),
          header: box(header),
          heroStart: box(document.querySelector('[data-scroll-section="hero"] a[href="/investigate"]')),
          overlay: getComputedStyle(document.querySelector('[data-hero-overlay]')!).backgroundImage,
          headerLinks: [...header.querySelectorAll('a')].map((a) => ({ text: a.textContent, ...box(a)! })),
          wordmark: box(header.querySelector('span')),
          pills: [...document.querySelectorAll('[data-scroll-section="cta"] a')].map((a) => box(a)!.height),
          ctaButton: box(document.querySelector('[data-scroll-section="cta"] button')),
        }
      })

      expect(m.scrollWidth).toBe(m.innerWidth)
      // 88svh at least (the hero grows where its content is taller).
      expect(m.hero!.height).toBeGreaterThanOrEqual(Math.floor(0.88 * m.innerHeight))
      // Jen C1: the H1 clears the fixed header by 16px.
      expect(m.h1!.top - m.header!.bottom, 'H1 top minus header bottom').toBeGreaterThanOrEqual(16)
      // The hero's action is 44px, and on portrait phones it is above the fold.
      expect(m.heroStart!.height).toBeGreaterThanOrEqual(44)
      if (vp.portraitPhone || !vp.phone) expect(m.heroStart!.bottom).toBeLessThanOrEqual(m.innerHeight)
      expect(m.overlay).toMatch(/rgb\(11, 10, 9\) 100%\)$/)
      // Header: on one line, inside the viewport, clear of the wordmark.
      for (const l of m.headerLinks.filter((x) => x.shown)) {
        expect(l.left).toBeGreaterThanOrEqual(m.wordmark!.right)
        expect(l.right).toBeLessThanOrEqual(m.innerWidth)
        if (vp.touch) expect(l.height, `${l.text} on touch`).toBeGreaterThanOrEqual(44)
      }
      expect(m.wordmark!.height).toBeLessThan(30)
      // Jen C4: at the top the hero's Start is in view, so the header's is not shown.
      const start = m.headerLinks.find((l) => l.text === 'Start an investigation')
      expect(start?.shown ?? false).toBe(false)
      for (const h of m.pills) expect(h).toBeGreaterThanOrEqual(vp.touch ? 44 : 38)
      expect(m.ctaButton!.height).toBeGreaterThanOrEqual(44)
    } finally {
      await context.close()
    }
  }, 60_000)

  it.each(VIEWPORTS)('Jen C2: hero type contrast at $width x $height (H1 3:1, tagline and line 4.5:1, p5)', async (vp) => {
    const { context, page } = await open(vp)
    try {
      const c = await heroContrast(page)
      expect(c.h1, `H1 ${JSON.stringify(c)}`).toBeGreaterThanOrEqual(3)
      expect(c.tagline, `tagline ${JSON.stringify(c)}`).toBeGreaterThanOrEqual(4.5)
      expect(c.line, `line ${JSON.stringify(c)}`).toBeGreaterThanOrEqual(4.5)
    } finally {
      await context.close()
    }
  }, 60_000)

  it.each(VIEWPORTS)('Jen C4: never two "Start an investigation" in view at $width x $height', async (vp) => {
    const { context, page } = await open(vp)
    try {
      const height = await page.evaluate(() => document.documentElement.scrollHeight)
      let headerShownSomewhere = false
      for (let y = 0; y < height; y += Math.round(vp.height / 3)) {
        await page.evaluate((top) => window.scrollTo(0, top), y)
        await page.waitForTimeout(250)
        const visible = await page.evaluate(() => {
          const inView = (el: Element) => {
            const r = el.getBoundingClientRect()
            return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && getComputedStyle(el).visibility !== 'hidden'
          }
          const all = [
            ...document.querySelectorAll('a, button'),
          ].filter((el) => el.textContent?.trim() === 'Start an investigation' && inView(el))
          const header = all.filter((el) => el.closest('header'))
          return { count: all.length, header: header.length }
        })
        expect(visible.count, `at scroll ${y}`).toBeLessThanOrEqual(1)
        if (visible.header > 0) headerShownSomewhere = true
      }
      // From sm up it does appear mid-page; on phones never.
      expect(headerShownSomewhere).toBe(vp.width >= 640 && !vp.phone)
    } finally {
      await context.close()
    }
  }, 120_000)
})
