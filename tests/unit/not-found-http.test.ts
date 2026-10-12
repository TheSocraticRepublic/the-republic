import { describe, it, expect, beforeAll } from 'vitest'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { SignJWT } from 'jose'

/*
 * Razor DN1 / DN2, over HTTP against the QA harness's production build: the
 * SERVER-rendered HTML of a 404 must already carry the card (no JavaScript
 * involved), and its action must follow the real session.
 *
 * Runs only when this worktree's harness is up (scripts/qa/README.md);
 * otherwise it is skipped with an explicit marker, and QA_REQUIRE_HARNESS=1
 * turns that skip into a failure.
 */

const APP_URL = 'http://127.0.0.1:3177'
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const USER_A = 'a0000000-0000-4000-8000-00000000000a'
const MISSING_UUID = '00000000-0000-4000-8000-0000000d4041'

function harnessState(): { jwtSecret: string } | null {
  const stateDir = path.join(
    os.tmpdir(),
    `open-cave-qa-${createHash('sha1').update(REPO_ROOT).digest('hex').slice(0, 10)}`,
  )
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
  const message =
    '[not-found-http] SKIPPED: the QA harness is not running for this worktree (npx tsx scripts/qa/harness.ts up).'
  if (process.env.QA_REQUIRE_HARNESS === '1') throw new Error(message.replace('SKIPPED', 'REQUIRED'))
  console.warn(message)
}

/** The server HTML up to the first script: what a visitor without JS sees. */
function serverMarkup(html: string): string {
  const body = html.slice(html.indexOf('<body'))
  return body.replace(/<script[\s\S]*?<\/script>/g, '')
}

describe.skipIf(!APP_UP)('404s over HTTP on the harness', () => {
  let cookie: string

  beforeAll(async () => {
    const token = await new SignJWT({ email: 'qa-owner-a@example.test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_A)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(STATE!.jwtSecret))
    cookie = `republic_token=${token}`
  })

  async function get(pathname: string, signedIn: boolean) {
    const res = await fetch(`${APP_URL}${pathname}`, {
      headers: signedIn ? { cookie } : {},
      redirect: 'manual',
    })
    return { status: res.status, html: await res.text() }
  }

  it('an unknown /archive/<id> is a 404 whose server HTML carries the card (Razor DN1)', async () => {
    for (const signedIn of [false, true]) {
      // Twice: the first render and the ISR-cached one.
      for (let i = 0; i < 2; i++) {
        const { status, html } = await get(`/archive/${MISSING_UUID}`, signedIn)
        const markup = serverMarkup(html)
        expect(status, `signed in: ${signedIn}, run ${i}`).toBe(404)
        expect(markup).toContain('data-not-found-card')
        expect(markup).toContain('Page not found')
        expect(markup).toMatch(/<a[^>]+href="\/"[^>]*>Go to the home page<\/a>/)
        expect(markup.match(/<main/g)?.length).toBe(1)
      }
    }
  })

  it('an unknown /u/<name> sends a signed-out visitor home, a signed-in one to their investigations (Razor DN2)', async () => {
    const out = serverMarkup((await get('/u/no-such-person-d4042', false)).html)
    expect(out).toContain('data-not-found-card')
    expect(out).toMatch(/<a[^>]+href="\/"[^>]*>Go to the home page<\/a>/)
    expect(out).not.toContain('Go to your investigations')

    const inside = serverMarkup((await get('/u/no-such-person-d4042', true)).html)
    expect(inside).toContain('data-not-found-card')
    expect(inside).toMatch(/<a[^>]+href="\/investigations"[^>]*>Go to your investigations<\/a>/)
  })
})
