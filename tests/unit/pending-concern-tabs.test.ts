import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import postgres from 'postgres'
import type { Browser, BrowserContext, Page } from 'playwright'
import { interceptSendCode } from '../../scripts/qa/browser'
import { assertLocalQaDatabaseUrl } from '../../scripts/lib/local-db-guard'

/*
 * UI plan C4: the pending concern in two REAL tabs (two pages of one Chromium
 * context: one cookie jar, one BroadcastChannel origin, a sessionStorage each,
 * as in a browser), against the QA harness's production build.
 *
 * Every login is real: the landing box, the probe, the login page,
 * POST /api/auth/verify-code and the redirect all run as shipped. Only two
 * things are not production: send-code is answered in the browser (no email
 * leaves; browser.ts), and the code the citizen types is one this test writes
 * to the harness database first (sha-256, as magic-code.ts stores it), for
 * the seeded synthetic users A and B. Runs only when this worktree's harness
 * is up; otherwise skipped with a marker, and QA_REQUIRE_HARNESS=1 makes the
 * skip a failure.
 */

const APP_URL = 'http://127.0.0.1:3177'
const QA_DATABASE_URL = 'postgres://qa_app:qa_app_dummy@127.0.0.1:55432/republic_qa'
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const KEY = 'oc:pending-concern'
const USER_A = 'qa-owner-a@example.test'
const USER_B = 'qa-other-b@example.test'
const CODE = '13572468'

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
  const message = '[pending-concern-tabs] SKIPPED: the QA harness is not running for this worktree (npx tsx scripts/qa/harness.ts up).'
  if (process.env.QA_REQUIRE_HARNESS === '1') throw new Error(message.replace('SKIPPED', 'REQUIRED'))
  console.warn(message)
}

describe.skipIf(!APP_UP)('the pending concern in two real tabs (Chromium, harness)', () => {
  let browser: Browser
  let db: postgres.Sql

  beforeAll(async () => {
    assertLocalQaDatabaseUrl(QA_DATABASE_URL, 'QA_DATABASE_URL')
    db = postgres(QA_DATABASE_URL, { max: 1, onnotice: () => {} })
    const { chromium } = await import('playwright')
    browser = await chromium.launch()
  }, 60_000)

  afterAll(async () => {
    await browser?.close()
    await db?.end({ timeout: 2 })
  })

  /** A login code for `email`, as magic-code.ts would store one; any earlier
   *  unused code is retired first (verify reads the first active one). */
  async function issueCode(email: string) {
    await db`update magic_codes set used_at = now() where email = ${email} and used_at is null`
    const hash = createHash('sha256').update(CODE).digest('hex')
    await db`insert into magic_codes (email, code, expires_at) values (${email}, ${hash}, now() + interval '10 minutes')`
  }

  async function newContext(): Promise<BrowserContext> {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    await interceptSendCode(context)
    return context
  }

  /** Sign in on whatever /login URL `page` is on (or plain /login). */
  async function signIn(page: Page, email: string, loginUrl?: string) {
    if (loginUrl) await page.goto(loginUrl)
    await issueCode(email)
    await page.locator('#email').fill(email)
    await page.getByRole('button', { name: 'Send code' }).click()
    await page.locator('#code').fill(CODE)
    await page.getByRole('button', { name: 'Verify code' }).click()
    await page.waitForURL((u) => u.pathname === '/investigate', { timeout: 30_000 })
    await page.waitForLoadState('networkidle')
  }

  /** On the landing: write a concern in the closing box and press Start. */
  async function writeOnLanding(page: Page, text: string) {
    await page.goto(`${APP_URL}/`)
    const box = page.getByRole('textbox', { name: 'What concerns you?' })
    await box.fill(text)
    await page.locator('[data-scroll-section="cta"]').getByRole('button', { name: 'Start an investigation' }).click()
    await page.waitForURL((u) => u.pathname === '/login', { timeout: 30_000 })
  }

  const stored = (page: Page) => page.evaluate((k) => window.sessionStorage.getItem(k), KEY)
  const offer = (page: Page) => page.locator('[data-pending-concern-offer]')

  /** A value on `window` that a reload would erase. */
  const mark = (page: Page) => page.evaluate(() => ((window as unknown as { __c4: number }).__c4 = 1))
  const marked = (page: Page) => page.evaluate(() => (window as unknown as { __c4?: number }).__c4 === 1)

  it('A writes in tab 1, signs in in tab 1, is offered it once; a reload loses it', async () => {
    const context = await newContext()
    try {
      const tab1 = await context.newPage()
      await writeOnLanding(tab1, 'C4 harness: a gravel pit by the river')
      const record = JSON.parse((await stored(tab1))!)
      expect(record).toMatchObject({ v: 1, text: 'C4 harness: a gravel pit by the river' })
      expect(record.handoff).toMatch(/^[0-9a-f]{32}$/)
      // The handoff rides the redirect through safeRedirectTarget.
      expect(new URL(tab1.url()).searchParams.get('redirect')).toBe(`/investigate?handoff=${record.handoff}`)

      await signIn(tab1, USER_A)
      expect(tab1.url()).toBe(`${APP_URL}/investigate?handoff=${record.handoff}`)
      await expect.poll(() => offer(tab1).count()).toBe(1)
      expect(await offer(tab1).innerText()).toContain('A concern was written in this tab before signing in.')
      expect(await offer(tab1).innerText()).toContain('C4 harness: a gravel pit by the river')
      // Not prefilled, and gone from storage the moment it is offered.
      expect(await tab1.getByLabel('Describe your concern').inputValue()).toBe('')
      expect(await stored(tab1)).toBeNull()

      await tab1.reload({ waitUntil: 'networkidle' })
      expect(await offer(tab1).count()).toBe(0)
      expect(await stored(tab1)).toBeNull()
    } finally {
      await context.close()
    }
  }, 120_000)

  it('Use it fills the box with the carried text', async () => {
    const context = await newContext()
    try {
      const tab1 = await context.newPage()
      await writeOnLanding(tab1, 'C4 harness: use me')
      await signIn(tab1, USER_A)
      await offer(tab1).getByRole('button', { name: 'Use it' }).click()
      expect(await tab1.getByLabel('Describe your concern').inputValue()).toBe('C4 harness: use me')
      expect(await offer(tab1).count()).toBe(0)
    } finally {
      await context.close()
    }
  }, 120_000)

  it('A writes in tab 1 and abandons; signs in and out in tab 2; B signs in in tab 1 without the handoff: nothing offered, storage empty', async () => {
    const context = await newContext()
    try {
      const tab1 = await context.newPage()
      await writeOnLanding(tab1, 'C4 harness: abandoned by A')
      expect(await stored(tab1)).not.toBeNull()

      const tab2 = await context.newPage()
      await signIn(tab2, USER_A, `${APP_URL}/login`)
      // Tab 2's sign-in completed no handoff: tab 1's record is deleted.
      await expect.poll(() => stored(tab1)).toBeNull()
      await tab2.getByRole('button', { name: 'Sign out' }).click()
      await tab2.waitForURL((u) => u.pathname === '/login', { timeout: 30_000 })
      expect(await stored(tab1)).toBeNull()

      await signIn(tab1, USER_B, `${APP_URL}/login`)
      expect(new URL(tab1.url()).search).toBe('')
      expect(await offer(tab1).count()).toBe(0)
      expect(await stored(tab1)).toBeNull()
    } finally {
      await context.close()
    }
  }, 120_000)

  it('W1: A abandons in tab 1; B signs in on plain /login in that same tab: nothing offered, storage empty, A\'s handoff URL offers nothing', async () => {
    const context = await newContext()
    try {
      const tab1 = await context.newPage()
      await writeOnLanding(tab1, 'C4 harness: abandoned on this tab by A')
      const handoff = JSON.parse((await stored(tab1))!).handoff as string
      await signIn(tab1, USER_B, `${APP_URL}/login`)
      expect(new URL(tab1.url()).search).toBe('')
      expect(await offer(tab1).count()).toBe(0)
      expect(await stored(tab1)).toBeNull()
      // Razor's P3: B then reaching A's handoff URL (Back, history) gets nothing.
      await tab1.goto(`${APP_URL}/investigate?handoff=${handoff}`, { waitUntil: 'networkidle' })
      expect(await offer(tab1).count()).toBe(0)
    } finally {
      await context.close()
    }
  }, 120_000)

  it('tab 1 holds a handoff; tab 2 completes a different login: tab 1\'s record is deleted, tab 2 is offered its own', async () => {
    const context = await newContext()
    try {
      const tab1 = await context.newPage()
      await writeOnLanding(tab1, 'C4 harness: tab one')
      const first = JSON.parse((await stored(tab1))!)

      const tab2 = await context.newPage()
      await writeOnLanding(tab2, 'C4 harness: tab two')
      const second = JSON.parse((await stored(tab2))!)
      expect(second.handoff).not.toBe(first.handoff)

      await signIn(tab2, USER_A)
      await expect.poll(() => stored(tab1)).toBeNull()
      expect(await offer(tab2).innerText()).toContain('C4 harness: tab two')
      expect(await offer(tab2).innerText()).not.toContain('tab one')
    } finally {
      await context.close()
    }
  }, 120_000)

  it('a failed sign-out still clears every tab, and reloads none', async () => {
    const context = await newContext()
    try {
      // Tab 1 holds a record on the login page.
      const tab1 = await context.newPage()
      await writeOnLanding(tab1, 'C4 harness: before a failed sign-out')
      // Tab 2 and tab 3 are signed in. Tab 2's sign-out will fail (500).
      const tab2 = await context.newPage()
      await signIn(tab2, USER_A, `${APP_URL}/login`)
      const tab3 = await context.newPage()
      await tab3.goto(`${APP_URL}/investigate`, { waitUntil: 'networkidle' })
      // Tab 2's sign-in deleted tab 1's record, and signed in the landing
      // writes nothing, so tab 1 is seeded directly for this case, in the
      // shape the landing writes (the module validates it on every read).
      await tab1.evaluate((k) => {
        const handoff = '0123456789abcdef0123456789abcdef'
        window.sessionStorage.setItem(k, JSON.stringify({ v: 1, text: 'held', savedAt: Date.now(), handoff }))
      }, KEY)
      expect(await stored(tab1)).not.toBeNull()
      await mark(tab1)
      await mark(tab3)

      await tab2.route('**/api/auth/signout', (r) =>
        r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Internal server error"}' })
      )
      await tab2.getByRole('button', { name: 'Sign out' }).click()
      await tab2.getByText("You're still signed in.", { exact: false }).first().waitFor()

      await expect.poll(() => stored(tab1)).toBeNull()
      expect(await stored(tab2)).toBeNull()
      // Nobody reloaded and nobody moved: clear-pending is not signed-out.
      expect(await marked(tab1)).toBe(true)
      expect(await marked(tab3)).toBe(true)
      expect(new URL(tab2.url()).pathname).toBe('/investigate')
      expect(new URL(tab3.url()).pathname).toBe('/investigate')
    } finally {
      await context.close()
    }
  }, 120_000)

  it('signed in, the landing box writes nothing and goes straight to Investigate', async () => {
    const context = await newContext()
    try {
      const tab1 = await context.newPage()
      await signIn(tab1, USER_A, `${APP_URL}/login`)
      await tab1.goto(`${APP_URL}/`)
      await tab1.getByRole('textbox', { name: 'What concerns you?' }).fill('C4 harness: signed in')
      await tab1.locator('[data-scroll-section="cta"]').getByRole('button', { name: 'Start an investigation' }).click()
      await tab1.waitForURL(`${APP_URL}/investigate`, { timeout: 30_000 })
      expect(await stored(tab1)).toBeNull()
    } finally {
      await context.close()
    }
  }, 120_000)
})
