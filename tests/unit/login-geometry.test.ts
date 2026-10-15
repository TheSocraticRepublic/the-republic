import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import type { Browser, BrowserContext, Page } from 'playwright'
import { interceptSendCode } from '../../scripts/qa/browser'

/*
 * The login's geometry and its contrast on the photograph, in Chromium against
 * the QA harness's production build (Jen's C3 design review). jsdom has no
 * layout, so these floors can only be held here:
 *   - C1: at 320x568 and 375x667 on a touch phone, the page is never wider
 *     than the viewport (the brand scrim once widened it to 423px), on the
 *     email step, the code step and after a wrong code; and "Open Cave" sits
 *     at least 16px below "Back" in every one of those states.
 *   - C2: at 1280x720, 1440x900 and 1920x1080, every line on the photo
 *     ("Back", the wordmark, the tagline, the instruction) measures at least
 *     4.5:1 at the 5th percentile against the pixels behind its own text,
 *     captured with that text made transparent.
 *   - C3: on the paper, the unavailable button shares neither fill nor border
 *     with the empty field.
 *   - C9: "Send a new code" and "Use a different email" are at least 44px
 *     tall on a touch phone and 24px with a fine pointer.
 *
 * Signed out. Nothing reaches the server's write paths: send-code is
 * intercepted (browser.ts) and verify-code is answered in the browser with
 * the real route's wrong-code body. Runs only when this worktree's harness is
 * up; otherwise it is skipped with a marker, and QA_REQUIRE_HARNESS=1 makes
 * the skip a failure.
 */

const APP_URL = 'http://127.0.0.1:3177'
const REPO_ROOT = path.resolve(__dirname, '..', '..')

function harnessState(): { jwtSecret: string } | null {
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

const STATE = harnessState()
const APP_UP = STATE !== null && (await appReachable())

if (!APP_UP) {
  const message = '[login-geometry] SKIPPED: the QA harness is not running for this worktree (npx tsx scripts/qa/harness.ts up).'
  if (process.env.QA_REQUIRE_HARNESS === '1') throw new Error(message.replace('SKIPPED', 'REQUIRED'))
  console.warn(message)
}

type Viewport = { width: number; height: number; touch: boolean }

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

describe.skipIf(!APP_UP)('login geometry and photo contrast on the harness (Chromium)', () => {
  let browser: Browser

  beforeAll(async () => {
    const { chromium } = await import('playwright')
    browser = await chromium.launch()
  }, 60_000)

  afterAll(async () => {
    await browser?.close()
  })

  async function open(vp: Viewport): Promise<{ context: BrowserContext; page: Page }> {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: vp.touch,
      isMobile: vp.touch,
      deviceScaleFactor: 1,
    })
    await interceptSendCode(context)
    // verify-code's own wrong-code answer (401 {error:'invalid'}), in the browser.
    await context.route('**/api/auth/verify-code', (r) =>
      r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"invalid"}' })
    )
    const page = await context.newPage()
    await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle' })
    return { context, page }
  }

  async function toCodeStep(page: Page) {
    await page.locator('#email').fill('qa-owner-a@example.test')
    await page.getByRole('button', { name: 'Send code' }).click()
    await page.locator('#code').waitFor()
  }

  async function wrongCode(page: Page) {
    await page.locator('#code').fill('12345678')
    await page.getByRole('button', { name: 'Verify code' }).click()
    await page.getByRole('alert').waitFor()
  }

  async function layout(page: Page) {
    return page.evaluate(() => {
      const back = document.querySelector('a[href="/"]')!.getBoundingClientRect()
      const h1 = document.querySelector('h1')!.getBoundingClientRect()
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        gap: h1.top - back.bottom,
      }
    })
  }

  for (const vp of [
    { width: 320, height: 568, touch: true },
    { width: 375, height: 667, touch: true },
  ]) {
    it(`C1 at ${vp.width}x${vp.height} touch: no sideways overflow, and "Open Cave" clears "Back" by 16px, in every state`, async () => {
      const { context, page } = await open(vp)
      try {
        const states: Record<string, Awaited<ReturnType<typeof layout>>> = {}
        states.email = await layout(page)
        await toCodeStep(page)
        states.code = await layout(page)
        await wrongCode(page)
        states.error = await layout(page)
        for (const [name, m] of Object.entries(states)) {
          expect({ state: name, scrollWidth: m.scrollWidth }).toEqual({ state: name, scrollWidth: vp.width })
          expect({ state: name, innerWidth: m.innerWidth }).toEqual({ state: name, innerWidth: vp.width })
          expect(m.gap, `${name}: H1 top minus Back bottom`).toBeGreaterThanOrEqual(16)
        }
      } finally {
        await context.close()
      }
    }, 60_000)
  }

  /** p5 contrast of each photo line against its own ground, text hidden. */
  async function photoLineContrast(page: Page): Promise<Record<string, number>> {
    const sharp = (await import('sharp')).default
    const lines = await page.evaluate(() => {
      const pick: Record<string, Element> = {
        back: document.querySelector('a[href="/"]')!,
        wordmark: document.querySelector('h1')!,
        tagline: Array.from(document.querySelectorAll('p')).find((p) => p.textContent?.startsWith('A Republic'))!,
        instruction: Array.from(document.querySelectorAll('p')).find((p) =>
          /^(Enter your email|Code sent to)/.test(p.textContent ?? '')
        )!,
      }
      const out: Record<string, { color: string; box: { x: number; y: number; width: number; height: number } }> = {}
      for (const [name, el] of Object.entries(pick)) {
        const range = document.createRange()
        range.selectNodeContents(el)
        const r = range.getBoundingClientRect()
        out[name] = { color: getComputedStyle(el).color, box: { x: r.x, y: r.y, width: r.width, height: r.height } }
        ;(el as HTMLElement).dataset.geomHide = '1'
      }
      return out
    })
    await page.addStyleTag({ content: '[data-geom-hide], [data-geom-hide] * { color: transparent !important; text-shadow: none !important; }' })
    await page.waitForTimeout(100)
    const result: Record<string, number> = {}
    for (const [name, { color, box }] of Object.entries(lines)) {
      const clip = {
        x: Math.max(0, Math.floor(box.x)),
        y: Math.max(0, Math.floor(box.y)),
        width: Math.ceil(box.width),
        height: Math.ceil(box.height),
      }
      const png = await page.screenshot({ clip })
      const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
      const fg = (color.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number)
      const ratios: number[] = []
      for (let i = 0; i < info.width * info.height; i++) {
        ratios.push(contrast(fg, [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]]))
      }
      ratios.sort((a, b) => a - b)
      result[name] = Math.round(ratios[Math.floor(ratios.length * 0.05)] * 100) / 100
    }
    return result
  }

  for (const vp of [
    { width: 1280, height: 720, touch: false },
    { width: 1440, height: 900, touch: false },
    { width: 1920, height: 1080, touch: false },
  ]) {
    it(`C2 at ${vp.width}x${vp.height}: every line on the photo is at least 4.5:1 (p5), both steps`, async () => {
      for (const step of ['email', 'code'] as const) {
        const { context, page } = await open(vp)
        try {
          if (step === 'code') await toCodeStep(page)
          // The photograph must have painted before the ground is sampled.
          await page.waitForFunction(() => {
            const img = new Image()
            img.src = '/landing/cave-login.jpg'
            return img.complete
          })
          const measured = await photoLineContrast(page)
          for (const [line, p5] of Object.entries(measured)) {
            expect(p5, `${vp.width} ${step} ${line}`).toBeGreaterThanOrEqual(4.5)
          }
        } finally {
          await context.close()
        }
      }
    }, 90_000)
  }

  it('C3: the unavailable button shares neither fill nor border with the empty field', async () => {
    const { context, page } = await open({ width: 1440, height: 900, touch: false })
    try {
      const style = (sel: string) =>
        page.locator(sel).evaluate((el) => {
          const s = getComputedStyle(el)
          return { bg: s.backgroundColor, border: s.borderTopColor, borderWidth: s.borderTopWidth, color: s.color }
        })
      const field = await style('#email')
      const button = await style('button:has-text("Send code")')
      expect(await page.getByRole('button', { name: 'Send code' }).getAttribute('aria-disabled')).toBe('true')
      expect(button.bg).not.toBe(field.bg)
      expect(button.border).not.toBe(field.border)
      expect(button.border).toBe('rgba(0, 0, 0, 0)')
      const fg = (button.color.match(/\d+/g) ?? []).slice(0, 3).map(Number)
      const bg = (button.bg.match(/\d+/g) ?? []).slice(0, 3).map(Number)
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5)
      expect(await page.getByRole('button', { name: 'Send code' }).evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
    } finally {
      await context.close()
    }
  }, 60_000)

  for (const [vp, floor] of [
    [{ width: 375, height: 667, touch: true }, 44],
    [{ width: 1440, height: 900, touch: false }, 24],
  ] as const) {
    it(`C9 at ${vp.width}${vp.touch ? ' touch' : ''}: the code step's text buttons are at least ${floor}px tall`, async () => {
      const { context, page } = await open(vp)
      try {
        await toCodeStep(page)
        for (const name of ['Send a new code', 'Use a different email']) {
          const h = await page.getByRole('button', { name }).evaluate((el) => el.getBoundingClientRect().height)
          expect(h, name).toBeGreaterThanOrEqual(floor)
        }
      } finally {
        await context.close()
      }
    }, 60_000)
  }
})
