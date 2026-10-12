import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { SignJWT } from 'jose'
import { assertLocalQaDatabaseUrl } from '../../scripts/lib/local-db-guard'

/*
 * Razor W1 / N6: the Forum gate, proven over HTTP against the QA harness's
 * production build, not by calling a function. Signed in as user A with the
 * gate off, every Forum URL must return the honest page and carry NONE of the
 * Forum's data, in the HTML or in the RSC payload: no thread title in
 * <title>, no post body, no author id, no policy text. A canary thread and
 * post (written by user B) are inserted for the run and deleted afterwards.
 *
 * Runs only when this worktree's harness is up (scripts/qa/README.md);
 * otherwise it is skipped with an explicit marker, and QA_REQUIRE_HARNESS=1
 * turns that skip into a failure.
 */

const QA_DATABASE_URL = 'postgres://qa_app:qa_app_dummy@127.0.0.1:55432/republic_qa'
const APP_URL = 'http://127.0.0.1:3177'
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const USER_A = 'a0000000-0000-4000-8000-00000000000a'
const USER_B = 'b0000000-0000-4000-8000-00000000000b'

const CANARY_TITLE = `FGCANARY thread title ${Date.now()}`
const CANARY_BODY = `FGCANARY-POST-BODY ${Date.now()}`
const POLICY_TEXT = 'Forum Content Policy'
const HONEST = 'The Forum opens later. Nothing here yet.'

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
    '[forum-gate-http] SKIPPED: the QA harness is not running for this worktree (npx tsx scripts/qa/harness.ts up). ' +
    'This is the HTTP proof of the Forum gate; a relay run must not skip it.'
  if (process.env.QA_REQUIRE_HARNESS === '1') throw new Error(message.replace('SKIPPED', 'REQUIRED'))
  console.warn(message)
}

describe.skipIf(!APP_UP)('Forum gate over HTTP on the harness (signed in, gate off)', () => {
  let db: postgres.Sql
  let threadId: string
  let cookie: string

  beforeAll(async () => {
    assertLocalQaDatabaseUrl(QA_DATABASE_URL, 'QA_DATABASE_URL')
    db = postgres(QA_DATABASE_URL, { max: 1, onnotice: () => {} })
    const [thread] = await db<{ id: string }[]>`
      insert into forum_threads (author_id, title, post_count, last_post_at)
      values (${USER_B}, ${CANARY_TITLE}, 1, now())
      returning id`
    threadId = thread.id
    await db`insert into forum_posts (thread_id, author_id, content) values (${threadId}, ${USER_B}, ${CANARY_BODY})`
    const token = await new SignJWT({ email: 'qa-owner-a@example.test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_A)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(STATE!.jwtSecret))
    cookie = `republic_token=${token}`
  })

  afterAll(async () => {
    if (db) {
      if (threadId) await db`delete from forum_threads where id = ${threadId}`
      await db.end({ timeout: 2 })
    }
  })

  async function fetchText(pathname: string, rsc = false): Promise<{ status: number; text: string; location: string | null }> {
    const headers: Record<string, string> = { cookie }
    if (rsc) headers.RSC = '1'
    const res = await fetch(`${APP_URL}${pathname}`, { headers, redirect: 'manual' })
    return { status: res.status, text: await res.text(), location: res.headers.get('location') }
  }

  function assertNoForumData(label: string, text: string) {
    expect(text, `${label}: thread title`).not.toContain(CANARY_TITLE)
    expect(text, `${label}: post body`).not.toContain(CANARY_BODY)
    expect(text, `${label}: author id`).not.toContain(USER_B)
    expect(text, `${label}: policy text`).not.toContain(POLICY_TEXT)
  }

  it('the canary is really in the database (so the absence checks mean something)', async () => {
    const [row] = await db<{ title: string }[]>`select title from forum_threads where id = ${threadId}`
    expect(row.title).toBe(CANARY_TITLE)
  })

  const paths = () => ['/forum', `/forum/${threadId}`, '/forum/new', '/forum/policy', '/forum/moderation']

  it('every Forum URL returns the honest page and none of the Forum data (HTML)', async () => {
    for (const p of paths()) {
      const { status, text } = await fetchText(p)
      expect(status, p).toBe(200)
      expect(text, p).toContain(HONEST)
      const title = /<title>([^<]*)<\/title>/.exec(text)?.[1] ?? ''
      expect(title, `${p} <title>`).toContain('Forum')
      expect(title, `${p} <title>`).not.toContain('FGCANARY')
      assertNoForumData(p, text)
    }
  })

  it('the RSC payload a client navigation receives carries none of it either', async () => {
    for (const p of paths()) {
      // Next strips its `_rsc` cache-busting param before middleware, so the
      // rewritten RSC request is answered with a 307 to the honest route with
      // the expected `_rsc` (the client's fetch follows it). Neither hop may
      // carry Forum data; the hop the client lands on is the honest page.
      const first = await fetchText(`${p}?_rsc`, true)
      assertNoForumData(`${p} (RSC, first hop)`, first.text)
      let final = first
      if (first.status === 307) {
        const res = await fetch(new URL(first.location!, APP_URL), { headers: { cookie, RSC: '1' }, redirect: 'manual' })
        final = { status: res.status, text: await res.text(), location: res.headers.get('location') }
        expect(new URL(first.location!, APP_URL).pathname, p).toBe('/forum-opens-later')
      }
      expect(final.status, p).toBe(200)
      expect(final.text, p).toContain('opens later')
      assertNoForumData(`${p} (RSC)`, final.text)
    }
  })

  it('encoded and doubled spellings are gated the same way', async () => {
    for (const p of [`/%66orum/${threadId}`, `//forum/${threadId}`, `/forum%2F${threadId}`]) {
      const { status, text } = await fetchText(p)
      // Whatever Next does with the spelling, it must not leak the thread.
      expect([200, 307, 308, 400, 404], p).toContain(status)
      assertNoForumData(p, text)
    }
  })

  it('the API stays 404 while gated', async () => {
    for (const p of ['/api/forum/threads', `/api/forum/threads/${threadId}`]) {
      const res = await fetch(`${APP_URL}${p}`, { headers: { cookie } })
      expect(res.status, p).toBe(404)
      const body = await res.text()
      expect(body, p).not.toContain(CANARY_TITLE)
    }
  })
})
