import { describe, it, expect, beforeAll } from 'vitest'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { SignJWT } from 'jose'

/*
 * The two server components that render CrossArmActions, fetched for real from
 * the QA harness's production build. Both crashed with "Functions cannot be
 * passed directly to Client Components" (digest 3702761282) while they passed
 * lucide icon components as props; every ready Oracle document page did, on
 * the live site too as far as the code shows. They now pass string keys.
 *
 * - The seeded ready Oracle document: 200, its analysis, and both cross-arm
 *   actions with their icons, and no error card.
 * - A Lever action linked to that document (created through the app's own
 *   POST /api/lever/actions in the disposable harness database, synthetic):
 *   200, and its "Compare governments" action with its icon.
 *
 * Runs only when this worktree's harness is up; otherwise skipped with a
 * marker, and QA_REQUIRE_HARNESS=1 makes the skip a failure.
 */

const APP_URL = 'http://127.0.0.1:3177'
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const USER_A = 'a0000000-0000-4000-8000-00000000000a'
const SEEDED_SUMMARY = 'A synthetic watershed plan that makes monitoring voluntary and lets the district approve permits after notice.'

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
  const message = '[cross-arm-pages-http] SKIPPED: the QA harness is not running for this worktree (npx tsx scripts/qa/harness.ts up).'
  if (process.env.QA_REQUIRE_HARNESS === '1') throw new Error(message.replace('SKIPPED', 'REQUIRED'))
  console.warn(message)
}

/** What a crashed render shows instead of the page. */
function expectNoErrorCard(html: string) {
  expect(html).not.toContain('Something went wrong')
  expect(html).not.toContain('Functions cannot be passed')
  expect(html).not.toMatch(/Reference: \d+/)
}

describe.skipIf(!APP_UP)('server pages that render CrossArmActions, on the harness', () => {
  let cookie: string
  let documentId: string

  const get = (p: string) => fetch(`${APP_URL}${p}`, { headers: { cookie }, redirect: 'manual' })

  beforeAll(async () => {
    const token = await new SignJWT({ email: 'qa-owner-a@example.test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_A)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(STATE!.jwtSecret))
    cookie = `republic_token=${token}`
    const res = await get('/api/oracle/documents')
    expect(res.status).toBe(200)
    const { documents } = (await res.json()) as { documents: { id: string; status: string; title: string }[] }
    const ready = documents.find((d) => d.status === 'ready' && d.title.includes('synthetic QA document'))
    expect(ready, 'the seeded ready Oracle document').toBeTruthy()
    documentId = ready!.id
  }, 60_000)

  it('a ready Oracle document renders its analysis and both cross-arm actions', async () => {
    const res = await get(`/oracle/${documentId}`)
    expect(res.status).toBe(200)
    const html = await res.text()
    expectNoErrorCard(html)
    expect(html).toContain(SEEDED_SUMMARY)
    expect(html).toContain('Continue your inquiry')
    expect(html).toContain('Ask about this')
    expect(html).toContain('Compare with other jurisdictions')
    expect(html).toContain('lucide-message-circle-question')
    expect(html).toContain('lucide-git-compare')
    expect(html).toContain(`href="/mirror?documentId=${documentId}"`)
  }, 60_000)

  it('a Lever action linked to a document renders its "Compare governments" action', async () => {
    const create = await fetch(`${APP_URL}/api/lever/actions`, {
      method: 'POST',
      headers: { cookie, origin: APP_URL, 'content-type': 'application/json' },
      body: JSON.stringify({
        actionType: 'public_comment',
        documentId,
        description: 'Synthetic QA public comment linked to the watershed document (C2a cross-arm test).',
      }),
    })
    expect(create.status).toBe(201)
    const { actionId } = (await create.json()) as { actionId: string }
    expect(actionId).toBeTruthy()

    const res = await get(`/lever/${actionId}`)
    expect(res.status).toBe(200)
    const html = await res.text()
    expectNoErrorCard(html)
    expect(html).toContain('Synthetic QA public comment linked')
    expect(html).toContain('Compare governments')
    expect(html).toContain('lucide-git-compare')
    expect(html).toContain(`href="/mirror?documentId=${documentId}"`)
  }, 60_000)
})
