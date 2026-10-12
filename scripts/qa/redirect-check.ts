/**
 * Browser check for redirect targets on a running QA harness (UI plan S1).
 *
 *   npx tsx scripts/qa/redirect-check.ts
 *
 * Drives the real profile-setup flow in Chromium on 127.0.0.1: open
 * /profile/setup?redirect=<value> signed in, submit the form, let the page
 * navigate with whatever safeRedirectTarget() returned, and read
 * `location.origin` once navigation settles. Every hostile value must end on
 * the app's origin; `/investigate?x=1#h` must keep its path, query and hash.
 *
 * A control case shows the check can fail: it performs the assignment the old
 * page-local helper made (`location.href = '/\\evil.example'`) in the same
 * browser and reports the origin Chromium lands on.
 *
 * Needs a harness started with `harness.ts up` from this worktree. It reads
 * the harness's JWT_SECRET from the harness state file to mint sessions, and
 * between cases it clears the seeded users' `display_name_changed_at` inside
 * the harness Postgres container (the page always re-submits the display
 * name, and the API allows one change per 30 days). That write goes through
 * `docker compose exec` on this worktree's compose project only, never
 * through a database URL.
 *
 * Nothing leaves the machine: requests to the hostile host are answered in
 * the browser, and `/api/auth/send-code` is intercepted as every harness
 * browser test must (browser.ts).
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as url from 'node:url'
import { interceptSendCode } from './browser'
import { QA_JWT_SECRET_PREFIX, QA_USER_A, QA_USER_B } from './seed-local'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..', '..')
// Same derivation as harness.ts: the state directory and compose project are
// scoped to this worktree.
const STATE_DIR = path.join(
  os.tmpdir(),
  `open-cave-qa-${createHash('sha1').update(REPO_ROOT).digest('hex').slice(0, 10)}`
)
const STATE_FILE = path.join(STATE_DIR, 'state.json')
const COMPOSE_PROJECT = path.basename(STATE_DIR)
const COMPOSE_VARS = path.join(STATE_DIR, 'compose-vars-empty')
const COMPOSE_FILE = path.join(REPO_ROOT, 'docker-compose.qa.yml')
const APP_HOST = '127.0.0.1'
const APP_URL = `http://${APP_HOST}:3177`
const NODE = process.execPath
const TSX = path.join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const HOSTILE_HOST = 'evil.example'

/** The values the helper must contain (S1 browser check). */
const HOSTILE = ['/.//evil.example', '/a/..//evil.example', '/%2e//evil.example', '/%5Cevil.example', '/\\evil.example']
const KEEPS = { value: '/investigate?x=1#h', expect: `${APP_URL}/investigate?x=1#h` }

function fail(message: string): never {
  console.error(`[redirect-check] ${message}`)
  process.exit(1)
}

function compose(args: string[]): string {
  const r = spawnSync('docker', ['compose', '-p', COMPOSE_PROJECT, '--env-file', COMPOSE_VARS, '-f', COMPOSE_FILE, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })
  if (r.status !== 0) fail(`docker compose ${args.join(' ')} failed: ${r.stderr.trim()}`)
  return r.stdout.trim()
}

function psql(sql: string): string {
  return compose(['exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'republic_qa', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql])
}

function mint(jwtSecret: string, user: 'a' | 'b'): { name: string; value: string } {
  const env = {
    PATH: `${path.dirname(NODE)}:/usr/bin:/bin`,
    HOME: path.join(STATE_DIR, 'home'),
    NODE_ENV: 'production',
    QA_LOCAL_DB: '1',
    JWT_SECRET: jwtSecret,
    NEXT_PUBLIC_APP_URL: APP_URL,
  }
  const argv = Object.entries(env).map(([k, v]) => `${k}=${v}`)
  const r = spawnSync(
    '/usr/bin/env',
    ['-i', ...argv, NODE, TSX, '--conditions=react-server', path.join(REPO_ROOT, 'scripts', 'qa', 'mint-session.ts'), '--user', user],
    { cwd: REPO_ROOT, encoding: 'utf8' }
  )
  if (r.status !== 0) fail(`mint-session ${user} failed: ${r.stderr.trim()}`)
  return JSON.parse(r.stdout.trim().split('\n').pop() as string)
}

interface CaseResult {
  value: string
  user: 'a' | 'b'
  url: string
  patchStatus: number | null
  finalUrl: string
  origin: string
  hostileRequests: string[]
  pass: boolean
}

async function main() {
  let state: { jwtSecret?: string }
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  } catch {
    fail(`no running harness for this worktree (${STATE_FILE}); start one with: npx tsx scripts/qa/harness.ts up`)
  }
  if (!state.jwtSecret?.startsWith(QA_JWT_SECRET_PREFIX)) fail('harness state has no QA JWT secret')
  const health = await fetch(`${APP_URL}/api/health`)
  if (health.status !== 200) fail(`/api/health -> HTTP ${health.status}; the harness is not ready`)

  const cookies = { a: mint(state.jwtSecret, 'a'), b: mint(state.jwtSecret, 'b') }
  const ids = { a: QA_USER_A.id, b: QA_USER_B.id }

  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const results: CaseResult[] = []
  let failed = false

  async function runCase(value: string, user: 'a' | 'b', expectHref?: string): Promise<CaseResult> {
    // One display-name change per 30 days: clear the clock so the submit succeeds.
    psql(`update user_profiles set display_name_changed_at = null where user_id = '${ids[user]}'`)
    const context = await browser.newContext()
    await interceptSendCode(context)
    await context.addCookies([{ ...cookies[user], domain: APP_HOST, path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }])
    const hostileRequests: string[] = []
    await context.route(`**://${HOSTILE_HOST}/**`, async (route) => {
      hostileRequests.push(route.request().url())
      await route.fulfill({ status: 200, contentType: 'text/html', body: '<p>hostile host</p>' })
    })
    const page = await context.newPage()
    let patchStatus: number | null = null
    page.on('response', (res) => {
      if (res.url() === `${APP_URL}/api/profile` && res.request().method() === 'PATCH') patchStatus = res.status()
    })
    const target = `${APP_URL}/profile/setup?redirect=${encodeURIComponent(value)}`
    await page.goto(target)
    await page.getByRole('button', { name: 'Save changes' }).click()
    await page.waitForURL((u) => u.pathname !== '/profile/setup', { timeout: 30_000 })
    await page.waitForLoadState('load')
    const origin = await page.evaluate(() => location.origin)
    const finalUrl = page.url()
    await context.close()
    const pass =
      patchStatus === 200 &&
      origin === APP_URL &&
      hostileRequests.length === 0 &&
      (expectHref === undefined || finalUrl === expectHref)
    return { value, user, url: target, patchStatus, finalUrl, origin, hostileRequests, pass }
  }

  try {
    // Alternate users: the profile PATCH limit is 5 per 60 s per user.
    const users: Array<'a' | 'b'> = ['a', 'b']
    let i = 0
    for (const value of HOSTILE) results.push(await runCase(value, users[i++ % 2]))
    results.push(await runCase(KEEPS.value, users[i++ % 2], KEEPS.expect))

    for (const r of results) {
      console.log(
        `${r.pass ? 'PASS' : 'FAIL'}  redirect=${JSON.stringify(r.value)} (user ${r.user})\n` +
          `      opened   ${r.url}\n` +
          `      PATCH /api/profile -> ${r.patchStatus}\n` +
          `      landed   ${r.finalUrl}\n` +
          `      location.origin = ${r.origin}; requests to ${HOSTILE_HOST}: ${r.hostileRequests.length}`
      )
      if (!r.pass) failed = true
    }

    // Control: the old helper's assignment, to show this check can fail.
    const context = await browser.newContext()
    await interceptSendCode(context)
    await context.route(`**://${HOSTILE_HOST}/**`, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<p>hostile host</p>' })
    )
    const page = await context.newPage()
    await page.goto(`${APP_URL}/privacy`)
    await Promise.all([
      page.waitForURL((u) => u.host !== `${APP_HOST}:3177`, { timeout: 15_000 }),
      page.evaluate(() => {
        // Deliberately the old, unsafe assignment: this is the control.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = '/\\evil.example'
      }),
    ])
    const controlOrigin = await page.evaluate(() => location.origin)
    await context.close()
    console.log(
      `CONTROL  old helper's assignment location.href = "/\\evil.example" lands on origin ${controlOrigin}` +
        ` (${controlOrigin === APP_URL ? 'UNEXPECTED: the check could not tell' : 'the check would have failed'})`
    )
    if (controlOrigin === APP_URL) failed = true
  } finally {
    await browser.close()
  }

  console.log(failed ? 'redirect-check: FAILED' : `redirect-check: all ${results.length} cases on ${APP_URL}`)
  process.exit(failed ? 1 : 0)
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
  main().catch((err) => fail(err instanceof Error ? err.stack ?? err.message : String(err)))
}
