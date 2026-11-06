import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { SignJWT } from 'jose'
import type { Browser, Page } from 'playwright'
import { interceptSendCode } from '../../scripts/qa/browser'

/*
 * The briefing's "Want to go deeper?" cards, in Chromium against the QA
 * harness's production build (Razor D1 W2). D1 set the archetype label
 * ("THE PERIPATETIC", one unbreakable word) at 11px; in a two-column grid at
 * phone widths it ran past its card. jsdom has no layout, so this is held here:
 * at every width, every card's text stays inside the card's padding box, and no
 * card is wider than its content allows. A control forces the old two-column
 * grid at 375 and must be caught.
 *
 * Signed in as harness user A, whose seeded investigation carries the
 * synthetic briefing. Runs only when this worktree's harness is up; otherwise
 * skipped with a marker, and QA_REQUIRE_HARNESS=1 makes the skip a failure.
 */

const APP_URL = 'http://127.0.0.1:3177'
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const USER_A = 'a0000000-0000-4000-8000-00000000000a'
const INVESTIGATION = '/investigate/c0000000-0000-4000-8000-0000000000c1'

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
  const message = '[briefing-geometry] SKIPPED: the QA harness is not running for this worktree (npx tsx scripts/qa/harness.ts up).'
  if (process.env.QA_REQUIRE_HARNESS === '1') throw new Error(message.replace('SKIPPED', 'REQUIRED'))
  console.warn(message)
}

const WIDTHS = [320, 360, 375, 414, 479, 480, 768, 1023, 1024, 1440]

/** Every Go Deeper card's text against the card's padding box. Empty = everything fits. */
async function overflow(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const grid = document.querySelector('[data-go-deeper]')
    if (!grid) return ['no Go Deeper grid']
    const cards = [...grid.children] as HTMLElement[]
    if (cards.length < 5) return [`only ${cards.length} cards`]
    const problems: string[] = []
    for (const card of cards) {
      const c = card.getBoundingClientRect()
      const cs = getComputedStyle(card)
      const left = c.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft)
      const right = c.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight)
      const name = card.textContent?.trim().slice(0, 12) ?? '?'
      if (card.scrollWidth > card.clientWidth + 0.5) problems.push(`${name}: card scrollWidth ${card.scrollWidth} > ${card.clientWidth}`)
      // Each text run, measured by its glyphs (a Range), not its box.
      const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent?.trim()) continue
        const range = document.createRange()
        range.selectNodeContents(n)
        for (const r of range.getClientRects()) {
          if (r.right > right + 0.5 || r.left < left - 0.5)
            problems.push(`${name}: "${n.textContent.trim().slice(0, 20)}" spans ${r.left.toFixed(1)}-${r.right.toFixed(1)}, card text box ${left.toFixed(1)}-${right.toFixed(1)}`)
        }
      }
    }
    return problems
  })
}

describe.skipIf(!APP_UP)('briefing Go Deeper cards on the harness (Chromium)', () => {
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

  async function open(width: number): Promise<{ page: Page; close: () => Promise<void> }> {
    const mobile = width < 768
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: mobile, hasTouch: mobile })
    await interceptSendCode(context)
    await context.addCookies([
      { name: 'republic_token', value: token, domain: '127.0.0.1', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
    ])
    const page = await context.newPage()
    await page.goto(`${APP_URL}${INVESTIGATION}`, { waitUntil: 'networkidle' })
    await page.locator('[data-go-deeper]').scrollIntoViewIfNeeded()
    return { page, close: () => context.close() }
  }

  for (const width of WIDTHS) {
    it(`${width}: every Go Deeper card's text, the 11px archetype included, stays inside its card`, async () => {
      const { page, close } = await open(width)
      try {
        const size = await page.locator('[data-go-deeper] span', { hasText: /^THE PERIPATETIC$/ }).evaluate((e) => getComputedStyle(e).fontSize)
        expect(size).toBe('11px')
        expect(await overflow(page)).toEqual([])
      } finally {
        await close()
      }
    }, 60_000)
  }

  it('control: the old two-column grid at 375 overflows, and is caught', async () => {
    const { page, close } = await open(375)
    try {
      await page.evaluate(() => {
        ;(document.querySelector('[data-go-deeper]') as HTMLElement).style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))'
      })
      expect((await overflow(page)).length).toBeGreaterThan(0)
    } finally {
      await close()
    }
  }, 60_000)
})
