import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { SignJWT } from 'jose'
import type { Browser, BrowserContext, Page } from 'playwright'
import { interceptSendCode } from '../../scripts/qa/browser'

/*
 * The front door's geometry, in Chromium against the QA harness's production
 * build (UI plan C1, Jen's design review C1-C3, C5-C7, C9). jsdom has no
 * layout, so these floors can only be held here:
 *   - Start keeps one box at rest, typed and busy, Cancel never intersects
 *     it, and a second press 250 ms after Start never cancels, at 375, 768
 *     1024 and 1440 (C2; 1024 is the narrowest two-column form, Razor N2);
 *   - at 768 with activity, the form is not squeezed into a half column (C3);
 *   - Scout's field keeps its width at rest, typed and busy, and its button
 *     paints no opacity (C1);
 *   - Cancel sits under the query row and hands focus back to it (C5);
 *   - no UA clear control in the field (C6); the placeholder shows whole at
 *     320, 360 and 375 (C7);
 *   - on a 375x667 phone, a search from Enter keeps focus off BODY and brings
 *     the results heading and its first line into view (C9).
 *
 * Signed in as harness user A, who has seeded activity. Nothing reaches the
 * server's write paths: /api/investigate is held in the browser and never
 * answered, /api/scout/discover is answered in the browser, and send-code is
 * intercepted (browser.ts). Runs only when this worktree's harness is up;
 * otherwise it is skipped with a marker, and QA_REQUIRE_HARNESS=1 makes the
 * skip a failure.
 */

const APP_URL = 'http://127.0.0.1:3177'
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const USER_A = 'a0000000-0000-4000-8000-00000000000a'

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
  const message = '[front-door-geometry] SKIPPED: the QA harness is not running for this worktree (npx tsx scripts/qa/harness.ts up).'
  if (process.env.QA_REQUIRE_HARNESS === '1') throw new Error(message.replace('SKIPPED', 'REQUIRED'))
  console.warn(message)
}

type Box = { x: number; y: number; width: number; height: number }
type Viewport = { name: string; width: number; height: number; touch: boolean }

const PHONE: Viewport = { name: '375 coarse', width: 375, height: 667, touch: true }
const TABLET: Viewport = { name: '768', width: 768, height: 1024, touch: false }
const DESKTOP: Viewport = { name: '1440', width: 1440, height: 900, touch: false }
/** The narrowest two-column form: lg:grid-cols-2 splits 752px into 352px
 *  columns, where the reason line cannot sit beside Start (Razor N2). */
const NARROW_DESKTOP: Viewport = { name: '1024', width: 1024, height: 768, touch: false }

function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

function round(b: Box): Box {
  return { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) }
}

describe.skipIf(!APP_UP)('front door geometry on the harness (Chromium)', () => {
  let browser: Browser
  let token: string

  beforeAll(async () => {
    const { chromium } = await import('playwright')
    browser = await chromium.launch()
    token = await new SignJWT({ email: 'qa-owner-a@example.test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_A)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(STATE!.jwtSecret))
  }, 60_000)

  afterAll(async () => {
    await browser?.close()
  })

  async function open(vp: Viewport, pathname: string): Promise<{ context: BrowserContext; page: Page }> {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: vp.touch,
      isMobile: vp.touch,
    })
    await interceptSendCode(context)
    await context.addCookies([
      { name: 'republic_token', value: token, domain: '127.0.0.1', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
    ])
    const page = await context.newPage()
    await page.goto(`${APP_URL}${pathname}`, { waitUntil: 'networkidle' })
    return { context, page }
  }

  // ─── Investigate: Start and Cancel (C2) ──────────────────────────────────

  /** A box in the app's scroll content, not the viewport: the content
   *  column scrolls (app-shell), and typing can scroll it, which must not
   *  read as Start moving. */
  async function contentBox(page: Page, selector: string): Promise<Box> {
    // Settled: the 150ms transition-all never changes the box, but wait it out.
    await page.waitForTimeout(250)
    const box = await page.locator(selector).first().evaluate((el) => {
      const r = el.getBoundingClientRect()
      let scroll = 0
      for (let p = el.parentElement; p; p = p.parentElement) {
        const o = getComputedStyle(p).overflowY
        if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) {
          scroll = p.scrollTop
          break
        }
      }
      return { x: r.x, y: r.y + scroll, width: r.width, height: r.height }
    })
    return round(box)
  }

  const START = 'button:has-text("Start Investigation")'

  /** Start's box in the viewport, after scrolling it into view (at 375x667 it
   *  sits below the fold). */
  async function startOnScreen(page: Page): Promise<Box> {
    await page.locator(START).scrollIntoViewIfNeeded()
    await page.waitForTimeout(250)
    return (await page.locator(START).boundingBox())!
  }

  async function press(page: Page, vp: Viewport, x: number, y: number) {
    if (vp.touch) await page.touchscreen.tap(x, y)
    else await page.mouse.click(x, y)
  }

  for (const vp of [PHONE, TABLET, NARROW_DESKTOP, DESKTOP]) {
    it(`${vp.name}: Start keeps one box at rest, typed and busy, and Cancel never intersects it`, async () => {
      const { context, page } = await open(vp, '/investigate')
      let posts = 0
      await page.route('**/api/investigate', (route) => {
        if (route.request().method() === 'POST') posts++
        // Never answered: the investigation is never created.
      })
      const rest = await contentBox(page, START)
      await page.getByLabel('Describe your concern').fill('A gravel mine expansion near the river was approved.')
      const typed = await contentBox(page, START)
      const onScreen = await startOnScreen(page)
      await press(page, vp, onScreen.x + onScreen.width / 2, onScreen.y + onScreen.height / 2)
      await page.locator('button[aria-busy="true"]').waitFor()
      const busy = await contentBox(page, 'button[aria-busy="true"]')
      const cancel = await contentBox(page, 'button:has-text("Cancel")')
      expect({ typed, busy }).toEqual({ typed: rest, busy: rest })
      expect(intersects(cancel, rest), `Cancel ${JSON.stringify(cancel)} vs Start ${JSON.stringify(rest)}`).toBe(false)
      expect(posts).toBe(1)
      await context.close()
    }, 60_000)

    for (const fraction of [0.08, 0.5, 0.92]) {
      it(`${vp.name}: a second press 250 ms after Start, ${Math.round(fraction * 100)}% across, never cancels`, async () => {
        const { context, page } = await open(vp, '/investigate')
        await page.route('**/api/investigate', () => {})
        await page.getByLabel('Describe your concern').fill('A gravel mine expansion near the river was approved.')
        const rest = await startOnScreen(page)
        const y = rest.y + rest.height / 2
        await press(page, vp, rest.x + rest.width / 2, y)
        await page.waitForTimeout(250)
        await press(page, vp, rest.x + rest.width * fraction, y)
        await page.waitForTimeout(300)
        expect(await page.locator('button[aria-busy="true"]').count()).toBe(1)
        expect(await page.getByRole('button', { name: 'Cancel' }).count()).toBe(1)
        await context.close()
      }, 60_000)
    }
  }

  // Controls: the same measurements must fail on the layouts Jen measured.
  // The old layout is put back as injected CSS, since these tests read the
  // harness build and a source mutation never reaches it.
  it('control, 375 coarse: Cancel ordered before Start (the pre-fix wrap) moves Start and is caught', async () => {
    const { context, page } = await open(PHONE, '/investigate')
    await page.route('**/api/investigate', () => {})
    await page.addStyleTag({ content: 'button:has(> svg.lucide-x){order:-1 !important}' })
    await page.getByLabel('Describe your concern').fill('A gravel mine expansion near the river was approved.')
    const typed = await contentBox(page, START)
    const onScreen = await startOnScreen(page)
    await press(page, PHONE, onScreen.x + onScreen.width / 2, onScreen.y + onScreen.height / 2)
    await page.locator('button[aria-busy="true"]').waitFor()
    const busy = await contentBox(page, 'button[aria-busy="true"]')
    expect(busy).not.toEqual(typed)
    await context.close()
  }, 60_000)

  it('control, 1440: a busy label narrower than the rest label shrinks Start into Cancel, and is caught', async () => {
    const { context, page } = await open(DESKTOP, '/investigate')
    await page.route('**/api/investigate', () => {})
    await page.addStyleTag({ content: 'button > span.grid > span[aria-hidden="true"]{display:none !important}' })
    await page.getByLabel('Describe your concern').fill('A gravel mine expansion near the river was approved.')
    const typed = await contentBox(page, START)
    const onScreen = await startOnScreen(page)
    await press(page, DESKTOP, onScreen.x + onScreen.width / 2, onScreen.y + onScreen.height / 2)
    await page.locator('button[aria-busy="true"]').waitFor()
    const busy = await contentBox(page, 'button[aria-busy="true"]')
    const cancel = await contentBox(page, 'button:has-text("Cancel")')
    expect(busy.width).toBeLessThan(typed.width)
    expect(intersects(cancel, typed)).toBe(true)
    // ...and a second press on Start's old left edge cancels.
    await page.mouse.click(onScreen.x + onScreen.width * 0.08, onScreen.y + onScreen.height / 2)
    await page.waitForTimeout(300)
    expect(await page.locator('button[aria-busy="true"]').count()).toBe(0)
    await context.close()
  }, 60_000)

  it('control, 1024: the reason line back beside Start (pre-N2) moves Start on the first keystroke, and is caught', async () => {
    const { context, page } = await open(NARROW_DESKTOP, '/investigate')
    await page.addStyleTag({ content: '#concern-submit-reason{order:0 !important;flex-basis:auto !important}' })
    const rest = await contentBox(page, START)
    await page.getByLabel('Describe your concern').fill('A gravel mine expansion near the river was approved.')
    const typed = await contentBox(page, START)
    expect(typed).not.toEqual(rest)
    await context.close()
  }, 60_000)

  it('768 with activity: the form gets the full width, Recent Activity follows below (C3)', async () => {
    const { context, page } = await open(TABLET, '/investigate')
    const textarea = (await page.getByLabel('Describe your concern').boundingBox())!
    const activity = (await page.getByRole('heading', { name: 'Recent Activity' }).boundingBox())!
    expect(textarea.width).toBeGreaterThanOrEqual(327)
    expect(activity.y).toBeGreaterThan(textarea.y + textarea.height)
    // The placeholder's longest line fits the field: no horizontal overflow.
    const fits = await page.getByLabel('Describe your concern').evaluate((el) => el.scrollWidth <= el.clientWidth)
    expect(fits).toBe(true)
    await context.close()
  }, 60_000)

  // ─── Scout (C1, C5, C6, C7, C9) ──────────────────────────────────────────

  const RESULT = '## Documents\n\nCouncil minutes, 2024: one record.\n'

  for (const vp of [{ name: '320 coarse', width: 320, height: 640, touch: true }, PHONE, DESKTOP]) {
    it(`${vp.name}: the Scout field keeps its width at rest, typed and busy; the button paints no opacity`, async () => {
      const { context, page } = await open(vp, '/scout')
      await page.route('**/api/scout/discover', () => {}) // held
      const field = page.getByLabel('What documents are you looking for?')
      const button = page.getByRole('button', { name: 'Scout' })
      const widths: number[] = []
      const opacities: string[] = []
      const read = async () => {
        await page.waitForTimeout(250)
        widths.push(Math.round((await field.boundingBox())!.width))
        opacities.push(await button.evaluate((el) => getComputedStyle(el).opacity))
      }
      await read()
      await field.fill('budget 2024')
      await read()
      await button.click()
      await page.locator('button[aria-busy="true"]').waitFor()
      await read()
      expect(new Set(widths).size, `widths ${widths}`).toBe(1)
      expect(opacities).toEqual(['1', '1', '1'])
      expect(await button.evaluate((el) => (el as HTMLButtonElement).disabled)).toBe(false)
      await context.close()
    }, 60_000)
  }

  for (const width of [320, 360, 375]) {
    it(`${width} coarse: the placeholder shows whole beside the button, and there is no UA clear control (C6, C7)`, async () => {
      const { context, page } = await open({ name: `${width}`, width, height: 740, touch: true }, '/scout')
      const field = page.getByLabel('What documents are you looking for?')
      const fit = await field.evaluate((el) => {
        const input = el as HTMLInputElement
        const cs = getComputedStyle(input)
        const ctx = document.createElement('canvas').getContext('2d')!
        ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
        const room = input.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
        return { need: ctx.measureText(input.placeholder).width, room }
      })
      expect(fit.need).toBeLessThanOrEqual(fit.room)
      await field.fill('rental bylaws')
      // Chromium's getComputedStyle does not resolve this pseudo-element, so
      // read the CSSOM: a compiled rule that matches this input must set
      // appearance none on its cancel button.
      const hidden = await field.evaluate((el) => {
        const PSEUDO = '::-webkit-search-cancel-button'
        for (const sheet of Array.from(document.styleSheets)) {
          let rules: CSSRuleList
          try {
            rules = sheet.cssRules
          } catch {
            continue
          }
          const walk = (list: CSSRuleList): boolean => {
            for (const rule of Array.from(list)) {
              if ('cssRules' in rule && walk((rule as CSSGroupingRule).cssRules)) return true
              const style = rule as CSSStyleRule
              if (!style.selectorText?.includes(PSEUDO)) continue
              const host = style.selectorText.replace(PSEUDO, '')
              if (el.matches(host) && style.style.getPropertyValue('appearance') === 'none') return true
            }
            return false
          }
          if (walk(rules)) return true
        }
        return false
      })
      expect(hidden).toBe(true)
      await context.close()
    }, 60_000)
  }

  for (const vp of [PHONE, DESKTOP]) {
    it(`${vp.name}: Cancel sits under the query row and hands focus back to the field (C5)`, async () => {
      const { context, page } = await open(vp, '/scout')
      await page.route('**/api/scout/discover', () => {}) // held
      const field = page.getByLabel('What documents are you looking for?')
      await field.fill('budget 2024')
      await page.getByRole('button', { name: 'Scout' }).click()
      const cancel = page.getByRole('button', { name: 'Cancel' })
      await cancel.waitFor()
      const row = (await field.boundingBox())!
      const box = (await cancel.boundingBox())!
      expect(box.y - (row.y + row.height)).toBeLessThanOrEqual(24)
      expect(box.y).toBeGreaterThanOrEqual(row.y + row.height)
      expect(box.height).toBeGreaterThanOrEqual(vp.touch ? 44 : 24)
      await cancel.focus()
      await page.keyboard.press('Enter')
      await page.waitForTimeout(250)
      expect(await field.evaluate((el) => document.activeElement === el)).toBe(true)
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe('Scout')
      // ...and by pointer: a real tap or click on Cancel, the request still held.
      await page.waitForTimeout(250)
      await page.getByRole('button', { name: 'Scout' }).click()
      await cancel.waitFor()
      const again = (await cancel.boundingBox())!
      const x = again.x + again.width / 2
      const y = again.y + again.height / 2
      if (vp.touch) await page.touchscreen.tap(x, y)
      else await page.mouse.click(x, y)
      await page.waitForTimeout(250)
      expect(await field.evaluate((el) => document.activeElement === el)).toBe(true)
      await context.close()
    }, 60_000)
  }

  it('375x667 coarse: a search from Enter keeps focus off BODY and brings the results heading and first line into view (C9)', async () => {
    const { context, page } = await open(PHONE, '/scout')
    await page.route('**/api/scout/discover', (route) =>
      route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body: RESULT })
    )
    await page.emulateMedia({ reducedMotion: 'reduce' }) // the jump, so the read below is final
    const field = page.getByLabel('What documents are you looking for?')
    await field.fill('budget 2024')
    await field.press('Enter')
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY')
    const heading = page.getByRole('heading', { name: 'Discovery results' })
    await heading.waitFor()
    await page.waitForTimeout(300)
    const h = (await heading.boundingBox())!
    const line = (await page.getByText('Council minutes, 2024: one record.').boundingBox())!
    expect(h.y).toBeGreaterThanOrEqual(0)
    expect(line.y + line.height).toBeLessThanOrEqual(667)
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY')
    await context.close()
  }, 60_000)
})
