import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { SignJWT } from 'jose'
import type { Browser, BrowserContext, Page } from 'playwright'
import { interceptSendCode } from '../../scripts/qa/browser'

/*
 * The arm rooms and the `?new=1` dialogs, in Chromium against the QA harness's
 * production build (UI plan C2a; Razor's C2a review W1, W2, N4). jsdom has no
 * layout and no real history, so these are held here:
 *   - every arm landing's room is the page, not a column: as wide as the
 *     shell's scroll box, at least as tall as it, and as tall as the content
 *     when the content is longer, at 1440 and 375. A control injects
 *     `height: 100%` in place of `min-height` and must be caught (N4);
 *   - closing a dialog the empty-state link opened leaves keyboard focus on
 *     the dialog's trigger, not on <body> (W1);
 *   - after a create from a `?new=1` dialog, Back lands on the list with no
 *     dialog open and no `new` flag (W2), and the link plus a close leave no
 *     dead Back step (N2).
 *
 * Signed in as harness user B, whose Oracle and Gadfly are empty. The create
 * POSTs are answered in the browser, so nothing reaches the server's write
 * paths; send-code is intercepted (browser.ts). Runs only when this worktree's
 * harness is up; otherwise skipped with a marker, and QA_REQUIRE_HARNESS=1
 * makes the skip a failure.
 */

const APP_URL = 'http://127.0.0.1:3177'
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const USER_A = 'a0000000-0000-4000-8000-00000000000a'
const USER_B = 'b0000000-0000-4000-8000-00000000000b'

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
  const message = '[arm-rooms-geometry] SKIPPED: the QA harness is not running for this worktree (npx tsx scripts/qa/harness.ts up).'
  if (process.env.QA_REQUIRE_HARNESS === '1') throw new Error(message.replace('SKIPPED', 'REQUIRED'))
  console.warn(message)
}

type Viewport = { name: string; width: number; height: number; touch: boolean }
const VIEWPORTS: Viewport[] = [
  { name: '1440', width: 1440, height: 900, touch: false },
  { name: '375 coarse', width: 375, height: 667, touch: true },
  { name: '768', width: 768, height: 1024, touch: false },
]
const LANDINGS = ['/scout', '/oracle', '/gadfly', '/lever', '/mirror', '/votes']

/**
 * The arm subpages (Jen C2a C5), each reached the way a citizen reaches it:
 * the first link of its kind on the page before. `/oracle/[id]` is not here:
 * the seeded document's page errors on the harness before any room renders
 * (digest 3702761282, routed separately; see the C2a report), so its wrapper
 * is held by the structure test in arm-pages.test.tsx only.
 */
const SUBPAGES: { from: string; link: string }[] = [
  { from: '/lever', link: 'a[href^="/lever/"]' },
  { from: '/votes/mp', link: 'a[href^="/votes/mp/"]' },
  { from: '/votes/recent', link: 'a[href^="/votes/vote/"]' },
  { from: '/votes/recent', link: 'a[href^="/votes/bill/"]' },
]
const LISTS = ['/votes/mp', '/votes/recent']

/** The room against the shell's scroll box, scrolled to the bottom so a room
 *  that stops short of the content shows it. Empty = the room is the page. */
async function roomProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const room = document.querySelector('[data-arm]') as HTMLElement | null
    const scroller = document.querySelector('#main-content > div') as HTMLElement | null
    if (!room || !scroller) return ['no room or no scroll box']
    scroller.scrollTop = scroller.scrollHeight
    const r = room.getBoundingClientRect()
    const s = scroller.getBoundingClientRect()
    const problems: string[] = []
    if (Math.round(r.left) !== Math.round(s.left) || Math.round(r.width) !== Math.round(s.width))
      problems.push(`room x ${Math.round(r.left)} w ${Math.round(r.width)} vs scroll box x ${Math.round(s.left)} w ${Math.round(s.width)}`)
    if (Math.round(r.height) < Math.round(s.height)) problems.push(`room h ${Math.round(r.height)} < scroll box h ${Math.round(s.height)}`)
    // the room reaches the end of the scrolled content: no bare shell under a long page
    if (Math.round(r.bottom) < Math.round(s.bottom)) problems.push(`room ends ${Math.round(s.bottom - r.bottom)}px above the scroll box bottom`)
    if (Math.round(r.height) < scroller.scrollHeight - 1) problems.push(`room h ${Math.round(r.height)} < content ${scroller.scrollHeight}`)
    return problems
  })
}

describe.skipIf(!APP_UP)('arm rooms and ?new=1 dialogs on the harness (Chromium)', () => {
  let browser: Browser
  let token: string
  let tokenA: string

  beforeAll(async () => {
    const { chromium } = await import('playwright')
    browser = await chromium.launch()
    token = await new SignJWT({ email: 'qa-other-b@example.test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_B)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(STATE!.jwtSecret))
    tokenA = await new SignJWT({ email: 'qa-owner-a@example.test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_A)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(STATE!.jwtSecret))
  }, 60_000)

  afterAll(async () => {
    await browser?.close()
  })

  async function open(vp: Viewport, pathname: string, as: 'a' | 'b' = 'b'): Promise<{ context: BrowserContext; page: Page }> {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: vp.touch,
      isMobile: vp.touch,
    })
    await interceptSendCode(context)
    await context.addCookies([
      { name: 'republic_token', value: as === 'a' ? tokenA : token, domain: '127.0.0.1', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
    ])
    const page = await context.newPage()
    await page.goto(`${APP_URL}${pathname}`, { waitUntil: 'networkidle' })
    return { context, page }
  }

  for (const vp of VIEWPORTS) {
    it(`${vp.name}: every arm landing's room is as wide as the scroll box and fills it, content included`, async () => {
      const { context, page } = await open(vp, LANDINGS[0])
      const found: string[] = []
      try {
        for (const route of LANDINGS) {
          if (route !== LANDINGS[0]) await page.goto(`${APP_URL}${route}`, { waitUntil: 'networkidle' })
          for (const p of await roomProblems(page)) found.push(`${route}: ${p}`)
        }
      } finally {
        await context.close()
      }
      expect(found).toEqual([])
    }, 120_000)
  }

  for (const vp of VIEWPORTS) {
    it(`${vp.name}: the room doesn't shrink one click in: every arm subpage fills the scroll box too (Jen C5)`, async () => {
      const { context, page } = await open(vp, LISTS[0], 'a')
      const found: string[] = []
      const visited: string[] = []
      try {
        for (const route of LISTS) {
          if (route !== LISTS[0]) await page.goto(`${APP_URL}${route}`, { waitUntil: 'networkidle' })
          visited.push(route)
          for (const p of await roomProblems(page)) found.push(`${route}: ${p}`)
        }
        for (const { from, link } of SUBPAGES) {
          await page.goto(`${APP_URL}${from}`, { waitUntil: 'networkidle' })
          const href = await page.locator(link).first().getAttribute('href')
          expect(href, `${from} has a ${link}`).toBeTruthy()
          await page.goto(`${APP_URL}${href}`, { waitUntil: 'networkidle' })
          visited.push(href!)
          for (const p of await roomProblems(page)) found.push(`${href}: ${p}`)
        }
      } finally {
        await context.close()
      }
      expect(visited).toHaveLength(LISTS.length + SUBPAGES.length)
      expect(found).toEqual([])
    }, 180_000)
  }

  for (const vp of [VIEWPORTS[0], VIEWPORTS[1]]) {
    it(`${vp.name}: the empty-state action is 14px, at least 24px tall, 44px on a coarse pointer (Jen C6)`, async () => {
      const { context, page } = await open(vp, '/gadfly')
      try {
        const link = page.getByRole('link', { name: 'Begin your first inquiry' })
        const m = await link.evaluate((el) => {
          const b = el.getBoundingClientRect()
          const msg = el.closest('div')!.querySelector('p')!
          return { h: b.height, size: getComputedStyle(el).fontSize, msgSize: getComputedStyle(msg).fontSize }
        })
        expect(m.size).toBe('14px')
        expect(parseFloat(m.size)).toBeGreaterThanOrEqual(parseFloat(m.msgSize))
        expect(m.h).toBeGreaterThanOrEqual(vp.touch ? 44 : 24)
      } finally {
        await context.close()
      }
    }, 120_000)
  }

  it('control: a room sized height: 100% instead of min-height is caught on a long page and an overflowing phone', async () => {
    // Mirror's form and user B's Oracle both overflow 375x667, so a room that
    // stops at one scroll-box height leaves bare shell under the content.
    const caught: string[] = []
    for (const [vp, route] of [[VIEWPORTS[1], '/mirror'], [VIEWPORTS[1], '/oracle']] as const) {
      const { context, page } = await open(vp, route)
      try {
        await page.addStyleTag({ content: '[data-arm] { min-height: 0 !important; height: 100% !important; }' })
        caught.push(...(await roomProblems(page)))
      } finally {
        await context.close()
      }
    }
    expect(caught.length).toBeGreaterThan(0)
  }, 120_000)

  for (const vp of VIEWPORTS) {
    it(`${vp.name}: Gadfly's empty-state link opens the dialog; Escape hands focus back to New Inquiry and leaves no dead Back step`, async () => {
      const { context, page } = await open(vp, '/oracle')
      try {
        await page.goto(`${APP_URL}/gadfly`, { waitUntil: 'networkidle' })
        await page.getByRole('link', { name: 'Begin your first inquiry' }).click()
        await page.getByRole('dialog').waitFor()
        expect(new URL(page.url()).search).toBe('?new=1')
        await page.keyboard.press('Escape')
        await page.waitForURL((u) => u.pathname === '/gadfly' && u.search === '')
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(300)
        const focused = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null
          return { tag: el?.tagName ?? null, text: el?.textContent?.trim() ?? null }
        })
        expect(focused).toEqual({ tag: 'BUTTON', text: 'New Inquiry' })
        expect(await page.getByRole('dialog').count()).toBe(0)
        // the link replaced /gadfly and the close replaced the flag: one Back goes to /oracle
        await page.goBack({ waitUntil: 'networkidle' })
        expect(new URL(page.url()).pathname).toBe('/oracle')
      } finally {
        await context.close()
      }
    }, 120_000)
  }

  it('Gadfly: after a create from the empty-state dialog, Back lands on the list with no dialog and no flag', async () => {
    const { context, page } = await open(VIEWPORTS[0], '/gadfly')
    try {
      await page.route('**/api/gadfly/session', (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sessionId: 'c2a00000-0000-4000-8000-000000000001' }) })
          : route.continue(),
      )
      await page.getByRole('link', { name: 'Begin your first inquiry' }).click()
      await page.getByRole('dialog').waitFor()
      await page.getByRole('dialog').getByRole('button', { name: 'Begin Inquiry' }).click()
      await page.waitForURL((u) => u.pathname === '/gadfly/c2a00000-0000-4000-8000-000000000001')
      await page.goBack({ waitUntil: 'networkidle' })
      await page.waitForTimeout(300)
      expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe('/gadfly')
      expect(await page.getByRole('dialog').count()).toBe(0)
    } finally {
      await context.close()
    }
  }, 120_000)

  it('Lever: after a create from a ?new=1 dialog, Back lands on the list with no dialog and no flag', async () => {
    const { context, page } = await open(VIEWPORTS[0], '/lever?new=1')
    try {
      await page.route('**/api/lever/actions', (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ actionId: 'c2a00000-0000-4000-8000-000000000002' }) })
          : route.continue(),
      )
      const dialog = page.getByRole('dialog')
      await dialog.waitFor()
      await dialog.getByLabel('Province').selectOption('bc')
      await dialog.getByLabel('What records do you want?').fill('Synthetic records request.')
      await dialog.getByRole('button', { name: 'Generate' }).click()
      await page.waitForURL((u) => u.pathname === '/lever/c2a00000-0000-4000-8000-000000000002')
      await page.goBack({ waitUntil: 'networkidle' })
      await page.waitForTimeout(300)
      expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe('/lever')
      expect(await page.getByRole('dialog').count()).toBe(0)
    } finally {
      await context.close()
    }
  }, 120_000)
})
