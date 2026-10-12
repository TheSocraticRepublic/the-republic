/**
 * A2: atomic writes, generation compare-and-set, one jurisdiction for legal
 * text. Runs against the QA harness (scripts/qa/README.md): its Postgres on
 * 127.0.0.1:55432 and its AI stub on 127.0.0.1:58080.
 *
 * Two layers:
 *
 * 1. "route handlers on the harness database" imports the real route modules
 *    (safeRoute and all) and calls them with the `x-user-id` header the
 *    middleware sets. The routes use the app's own getDb() pool; the test
 *    holds two more real connections: `db1` seeds and asserts on the stored
 *    row, `db2` holds row locks and commits competing writes, so every overlap
 *    in filings design §4 is forced, not hoped for. Generation streams are held
 *    open by the stub's control endpoint. No test-only code is in the routes.
 *    Because the route modules are imported from source, these tests run the
 *    mutation battery's mutated code.
 *
 * 2. "through the middleware on the running harness app" sends real HTTP to
 *    the production build on 127.0.0.1:3177 (Origin header, minted session
 *    cookie): owner, non-owner and anonymous on every route A2 touches, and the
 *    A2 semantic check. It runs only when this worktree's harness is up (its
 *    state file holds the JWT secret).
 *
 * Every row this file creates belongs to two throwaway users created in
 * beforeAll and deleted (cascade) in afterAll, so the harness seed is left as
 * it was. When the harness is down the file is skipped with an explicit
 * marker; QA_REQUIRE_HARNESS=1 turns that skip into a failure.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import postgres from 'postgres'
import { createHash, randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { assertLocalQaDatabaseUrl } from '../../scripts/lib/local-db-guard'
import {
  AI_STUB_LETTERS,
  AI_STUB_GENERIC_TEXT,
  MARKER_V1_LETTER,
  MISSING_MARKER_LETTER,
  AMBIGUOUS_LETTER,
  LITERAL_MARKER_LETTER,
} from '../fixtures/letters'

const QA_DATABASE_URL = 'postgres://qa_app:qa_app_dummy@127.0.0.1:55432/republic_qa'
const STUB_URL = 'http://127.0.0.1:58080'
const APP_URL = 'http://127.0.0.1:3177'
const REPO_ROOT = path.resolve(__dirname, '..', '..')

// ---------------------------------------------------------------------------
// Is the harness up? (Database and stub for layer 1; plus the app for layer 2.)
// ---------------------------------------------------------------------------

async function databaseReachable(): Promise<boolean> {
  const probe = postgres(QA_DATABASE_URL, { max: 1, connect_timeout: 2, onnotice: () => {} })
  try {
    await probe`select 1`
    return true
  } catch {
    return false
  } finally {
    await probe.end({ timeout: 1 })
  }
}

async function stubReachable(): Promise<boolean> {
  try {
    const r = await fetch(`${STUB_URL}/__qa/health`, { signal: AbortSignal.timeout(2000) })
    return r.ok
  } catch {
    return false
  }
}

/** This worktree's harness state (scripts/qa/harness.ts writes it on `up`). */
function harnessState(): { jwtSecret: string } | null {
  const stateDir = path.join(
    os.tmpdir(),
    `open-cave-qa-${createHash('sha1').update(REPO_ROOT).digest('hex').slice(0, 10)}`
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

const HARNESS_UP = (await databaseReachable()) && (await stubReachable())
const STATE = HARNESS_UP ? harnessState() : null
const APP_UP = HARNESS_UP && STATE !== null && (await appReachable())

if (!HARNESS_UP) {
  const message =
    '[lever-write-races] SKIPPED: the QA harness is not running (npx tsx scripts/qa/harness.ts up). ' +
    'These are A2’s integrity tests; a relay run must not skip them.'
  if (process.env.QA_REQUIRE_HARNESS === '1') throw new Error(message.replace('SKIPPED', 'REQUIRED'))
  console.warn(message)
} else if (!APP_UP) {
  console.warn(
    '[lever-write-races] middleware layer SKIPPED: no running harness app for this worktree (route-handler layer still runs).'
  )
}

// ---------------------------------------------------------------------------
// Environment for the route modules, set BEFORE they are imported. Only
// harness values: the guard refuses anything but the local QA database.
// ---------------------------------------------------------------------------

process.env.DATABASE_URL = QA_DATABASE_URL
process.env.QA_LOCAL_DB = '1'
process.env.JWT_SECRET = STATE?.jwtSecret ?? 'qa-harness-jwt-vitest-unused'
process.env.NEXT_PUBLIC_APP_URL = APP_URL
process.env.ANTHROPIC_API_KEY = 'qa-dummy-anthropic-key'
process.env.ANTHROPIC_BASE_URL = `${STUB_URL}/v1`
process.env.RESEND_API_KEY = 'qa-dummy-resend-key'
// No Redis: in a test process the limiter fails open (rate-limit.ts), so the
// route-handler layer exercises write logic, not quotas.
delete process.env.UPSTASH_REDIS_REST_URL
delete process.env.UPSTASH_REDIS_REST_TOKEN
delete process.env.DIRECT_DATABASE_URL
assertLocalQaDatabaseUrl(process.env.DATABASE_URL, 'DATABASE_URL')

type Handler = (req: import('next/server').NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

let PATCH: Handler
let GENERATE: Handler
let CREATE: Handler
let NextRequestCtor: typeof import('next/server').NextRequest

const NOT_A_DRAFT = 'This letter is no longer a draft'
const CONTENT_CHANGED = 'This letter changed since you opened it'
const UNCLEAN = "Remove the notes that aren't part of your request before you finalise."
const CHOOSE_PROVINCE = 'Choose the province this request goes to'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

let db1: postgres.Sql
let db2: postgres.Sql
const OWNER = { id: randomUUID(), email: `qa-a2-owner-${Date.now()}@example.test` }
const OTHER = { id: randomUUID(), email: `qa-a2-other-${Date.now()}@example.test` }
let BC_INVESTIGATION_ID: string

interface Row {
  id: string
  status: 'draft' | 'final' | 'filed'
  content: string
  metadata: Record<string, unknown> | null
}

async function insertAction(opts: {
  content?: string
  status?: 'draft' | 'final' | 'filed'
  metadata?: Record<string, unknown>
  actionType?: string
  investigationId?: string | null
  userId?: string
}): Promise<string> {
  const [row] = await db1<{ id: string }[]>`
    insert into lever_actions (user_id, action_type, title, content, metadata, status, investigation_id)
    values (
      ${opts.userId ?? OWNER.id},
      ${opts.actionType ?? 'fippa_request'},
      'QA A2 synthetic action',
      ${opts.content ?? ''},
      ${db1.json((opts.metadata ?? { publicBody: 'BC Ministry of Forests', jurisdiction: 'bc', description: 'Synthetic QA request' }) as postgres.JSONValue)},
      ${opts.status ?? 'draft'},
      ${opts.investigationId ?? null}
    )
    returning id`
  return row.id
}

async function readRow(id: string): Promise<Row> {
  const [row] = await db1<Row[]>`select id, status, content, metadata from lever_actions where id = ${id}`
  return row
}

function request(method: string, url: string, userId: string | null, body?: unknown) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (userId) headers['x-user-id'] = userId
  return new NextRequestCtor(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function patch(id: string, body: unknown, userId: string | null = OWNER.id): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await PATCH(request('PATCH', `http://localhost/api/lever/actions/${id}`, userId, body), {
    params: Promise.resolve({ id }),
  })
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

/** Starts a generation. Resolves with the status and the streamed text once the stream ends. */
async function generate(actionId: string, userId: string | null = OWNER.id): Promise<{ status: number; text: string }> {
  const res = await GENERATE(request('POST', 'http://localhost/api/lever/generate', userId, { actionId }), {
    params: Promise.resolve({}),
  })
  return { status: res.status, text: await res.text() }
}

async function create(body: unknown, userId: string | null = OWNER.id): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await CREATE(request('POST', 'http://localhost/api/lever/actions', userId, body), {
    params: Promise.resolve({}),
  })
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

async function stub(pathname: string, body?: unknown): Promise<Record<string, unknown>> {
  const isRead = pathname === '/__qa/held' || pathname === '/__qa/requests'
  const r = await fetch(`${STUB_URL}${pathname}`, {
    method: isRead ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: isRead ? undefined : JSON.stringify(body ?? {}),
  })
  if (!r.ok) throw new Error(`stub ${pathname} -> HTTP ${r.status}`)
  return (await r.json()) as Record<string, unknown>
}

async function waitFor<T>(label: string, probe: () => Promise<T | null | false>, timeoutMs = 15_000): Promise<T> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const v = await probe()
    if (v) return v
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`)
    await new Promise((r) => setTimeout(r, 25))
  }
}

async function heldStreams(n: number): Promise<number[]> {
  return waitFor(`${n} held stream(s)`, async () => {
    const { held } = (await stub('/__qa/held')) as { held: number[] }
    return held.length >= n ? held : null
  })
}

async function letterRequestCount(): Promise<number> {
  const { requests } = (await stub('/__qa/requests')) as { requests: Array<{ kind: string }> }
  return requests.filter((r) => r.kind === 'letter').length
}

/** Waits until `n` UPDATEs on lever_actions are blocked on a row lock. */
async function blockedUpdates(n: number): Promise<void> {
  await waitFor(`${n} blocked UPDATE(s)`, async () => {
    const [{ count }] = await db1<{ count: number }[]>`
      select count(*)::int as count from pg_stat_activity
      where datname = current_database() and wait_event_type = 'Lock'
        and query ilike 'update "lever_actions"%'`
    return count >= n
  })
}

/**
 * Holds a FOR UPDATE lock on the row (connection db2) while `during` runs,
 * then lets `beforeCommit` write inside the same transaction, then commits.
 */
async function withRowLock(
  id: string,
  during: () => Promise<void>,
  beforeCommit?: (tx: postgres.Sql) => Promise<void>
): Promise<void> {
  await db2.begin(async (transaction) => {
    // postgres-js's TransactionSql type drops the call signature (an Omit in
    // its typings); at runtime it is the tagged-template function.
    const tx = transaction as unknown as postgres.Sql
    await tx`select id from lever_actions where id = ${id} for update`
    await during()
    if (beforeCommit) await beforeCommit(tx)
  })
}

// ---------------------------------------------------------------------------

describe.skipIf(!HARNESS_UP)('A2 write integrity (QA harness)', () => {
  beforeAll(async () => {
    db1 = postgres(QA_DATABASE_URL, { max: 1, onnotice: () => {} })
    db2 = postgres(QA_DATABASE_URL, { max: 1, onnotice: () => {} })
    for (const u of [OWNER, OTHER]) {
      await db1`insert into users (id, email) values (${u.id}, ${u.email})`
      const name = `qa-a2-${u.id.slice(0, 8)}`
      await db1`insert into user_profiles (user_id, display_name, ap_handle) values (${u.id}, ${name}, ${name})`
    }
    const [inv] = await db1<{ id: string }[]>`
      insert into investigations (user_id, concern, jurisdiction_name, status)
      values (${OWNER.id}, 'Synthetic QA concern about a water intake', 'Victoria, British Columbia', 'complete')
      returning id`
    BC_INVESTIGATION_ID = inv.id

    const server = await import('next/server')
    NextRequestCtor = server.NextRequest
    PATCH = (await import('@/app/api/lever/actions/[id]/route')).PATCH as unknown as Handler
    GENERATE = (await import('@/app/api/lever/generate/route')).POST as unknown as Handler
    CREATE = (await import('@/app/api/lever/actions/route')).POST as unknown as Handler
    await stub('/__qa/reset')
  }, 30_000)

  afterAll(async () => {
    try {
      await stub('/__qa/reset')
    } catch {
      /* the stub may already be down; nothing is held by this file then */
    }
    if (db1) {
      // Cascades to their actions, investigations, outcomes and credentials.
      await db1`delete from users where id in (${OWNER.id}, ${OTHER.id})`
      await db1.end({ timeout: 5 })
    }
    if (db2) await db2.end({ timeout: 5 })
  })

  describe('route handlers on the harness database', () => {
    // ---------------------------------------------------------------- PATCH

    it('a content edit that loses to a finalise committed meanwhile is a 409, and the content never changes after finalisation', async () => {
      const id = await insertAction({ content: 'Original letter text.' })
      let pending!: Promise<{ status: number; json: Record<string, unknown> }>
      await withRowLock(
        id,
        async () => {
          // The PATCH reads 'draft' (no lock needed to read), then blocks on its UPDATE.
          pending = patch(id, { content: 'Edited after the fact.' })
          await blockedUpdates(1)
        },
        // The competing finalise commits first, on the second connection.
        async (tx) => {
          await tx`update lever_actions set status = 'final' where id = ${id}`
        }
      )
      const result = await pending
      expect(result.status).toBe(409)
      expect(result.json.error).toBe(NOT_A_DRAFT)
      const row = await readRow(id)
      expect(row.status).toBe('final')
      expect(row.content).toBe('Original letter text.')
    })

    it('the same, with the client hash: an unchanged hash does not let an edit past a finalise', async () => {
      const original = 'Original letter text, hashed.'
      const id = await insertAction({ content: original })
      let pending!: Promise<{ status: number; json: Record<string, unknown> }>
      await withRowLock(
        id,
        async () => {
          pending = patch(id, { content: 'Edited.', expectedContentSha256: sha256(original) })
          await blockedUpdates(1)
        },
        async (tx) => {
          await tx`update lever_actions set status = 'final' where id = ${id}`
        }
      )
      const result = await pending
      expect(result.status).toBe(409)
      expect(result.json.error).toBe(NOT_A_DRAFT)
      expect((await readRow(id)).content).toBe(original)
    })

    it('a content edit on a final letter is refused, and a stale hash is "changed since you opened it"', async () => {
      const finalId = await insertAction({ content: 'Final.', status: 'final' })
      const r1 = await patch(finalId, { content: 'x' })
      expect(r1).toEqual({ status: 409, json: { error: NOT_A_DRAFT } })

      const id = await insertAction({ content: 'Current text.' })
      const r2 = await patch(id, { content: 'Mine.', expectedContentSha256: sha256('What I opened.') })
      expect(r2).toEqual({ status: 409, json: { error: CONTENT_CHANGED } })
      expect((await readRow(id)).content).toBe('Current text.')
    })

    it('edit and edit (or insert-address and edit) with the same baseline: one wins, the other is a 409', async () => {
      const original = 'Dear FOI Coordinator,\n[Public body FOI address]\n'
      const id = await insertAction({ content: original })
      const h = sha256(original)
      const results: Array<Promise<{ status: number; json: Record<string, unknown> }>> = []
      await withRowLock(id, async () => {
        results.push(patch(id, { content: 'First edit.', expectedContentSha256: h }))
        await blockedUpdates(1)
        results.push(patch(id, { content: 'Second edit.', expectedContentSha256: h }))
        await blockedUpdates(2)
      })
      const [a, b] = await Promise.all(results)
      expect([a.status, b.status].sort()).toEqual([200, 409])
      const loser = a.status === 409 ? a : b
      expect(loser.json.error).toBe(CONTENT_CHANGED)
      const row = await readRow(id)
      expect(row.content).toBe(a.status === 200 ? 'First edit.' : 'Second edit.')
    })

    it('edit, then finalise in another tab: whichever commits first wins; no content changes after finalisation', async () => {
      const original = 'Letter as both tabs opened it.'
      const id = await insertAction({ content: original, metadata: { publicBody: 'BC Ministry of Forests', jurisdiction: 'bc' } })
      const h = sha256(original)
      const results: Array<Promise<{ status: number; json: Record<string, unknown> }>> = []
      await withRowLock(id, async () => {
        results.push(patch(id, { status: 'final', expectedContentSha256: h }))
        await blockedUpdates(1)
        results.push(patch(id, { content: 'Edited in the other tab.', expectedContentSha256: h }))
        await blockedUpdates(2)
      })
      const [fin, edit] = await Promise.all(results)
      expect([fin.status, edit.status].sort()).toEqual([200, 409])
      const row = await readRow(id)
      if (fin.status === 200) {
        expect(row).toMatchObject({ status: 'final', content: original })
        expect(edit.json.error).toBe(NOT_A_DRAFT)
      } else {
        expect(row).toMatchObject({ status: 'draft', content: 'Edited in the other tab.' })
        expect(fin.json.error).toBe(CONTENT_CHANGED)
      }
    })

    it('a finalise without a client hash is bound to the exact text it checked', async () => {
      const id = await insertAction({
        content: MARKER_V1_LETTER.content,
        metadata: { publicBody: 'BC Ministry of Forests', jurisdiction: 'bc', letterFormat: 'marker-v1' },
      })
      let pending!: Promise<{ status: number; json: Record<string, unknown> }>
      await withRowLock(
        id,
        async () => {
          pending = patch(id, { status: 'final' })
          await blockedUpdates(1)
        },
        // Meanwhile the text loses its marker: the clean split checked no longer holds.
        async (tx) => {
          await tx`update lever_actions set content = ${MISSING_MARKER_LETTER.content} where id = ${id}`
        }
      )
      const result = await pending
      expect(result).toEqual({ status: 409, json: { error: CONTENT_CHANGED } })
      expect((await readRow(id)).status).toBe('draft')
    })

    it('a double "file" files once: one 200, one 409, one outcome, one credential', async () => {
      const [inv] = await db1<{ id: string }[]>`
        insert into investigations (user_id, concern, jurisdiction_name, status)
        values (${OWNER.id}, 'Synthetic QA concern for a double file', 'Victoria, British Columbia', 'complete')
        returning id`
      const id = await insertAction({ content: 'Filed once.', status: 'final', investigationId: inv.id })
      const results: Array<Promise<{ status: number; json: Record<string, unknown> }>> = []
      await withRowLock(id, async () => {
        results.push(patch(id, { status: 'filed' }))
        results.push(patch(id, { status: 'filed' }))
        // Both have read 'final' and are blocked on their UPDATE.
        await blockedUpdates(2)
      })
      const [a, b] = await Promise.all(results)
      expect([a.status, b.status].sort()).toEqual([200, 409])
      const [{ outcomes }] = await db1<{ outcomes: number }[]>`
        select count(*)::int as outcomes from investigation_outcomes where investigation_id = ${inv.id}`
      expect(outcomes).toBe(1)
      const [{ credentials }] = await db1<{ credentials: number }[]>`
        select count(*)::int as credentials from credential_events
        where source_id = ${id} and source_type = 'lever_action' and credential_type = 'foi_filed'`
      expect(credentials).toBe(1)
      const row = await readRow(id)
      expect(row.status).toBe('filed')
      expect(typeof row.metadata?.filedAt).toBe('string')
      expect(row.metadata?.publicBody).toBe('BC Ministry of Forests')
    })

    it('a stored CRLF letter saved unchanged through a textarea (LF) is not a conflict, and stores LF', async () => {
      const stored = 'Dear FOI Coordinator,\r\nI request records.\r\n'
      const id = await insertAction({ content: stored })
      // The client hashes the string as the API returned it, before the textarea.
      const res = await patch(id, { content: stored.replace(/\r\n/g, '\n'), expectedContentSha256: sha256(stored) })
      expect(res.status).toBe(200)
      expect((await readRow(id)).content).toBe('Dear FOI Coordinator,\nI request records.\n')
    })

    it('saving twice without reloading, re-baselined on what was stored, is never a conflict', async () => {
      const id = await insertAction({ content: 'v0' })
      expect((await patch(id, { content: 'v1', expectedContentSha256: sha256('v0') })).status).toBe(200)
      expect((await patch(id, { content: 'v2', expectedContentSha256: sha256('v1') })).status).toBe(200)
      expect((await readRow(id)).content).toBe('v2')
    })

    it('content is bounded at 100,000 characters (413 above it)', async () => {
      const id = await insertAction({ content: '' })
      const over = await patch(id, { content: 'x'.repeat(100_001) })
      expect(over.status).toBe(413)
      expect((await readRow(id)).content).toBe('')
      const at = await patch(id, { content: 'x'.repeat(100_000) })
      expect(at.status).toBe(200)
    })

    it('rejects a malformed hash and non-string content with 400', async () => {
      const id = await insertAction({ content: 'x' })
      expect((await patch(id, { content: 'y', expectedContentSha256: 'not-a-hash' })).status).toBe(400)
      expect((await patch(id, { content: 42 })).status).toBe(400)
      expect((await readRow(id)).content).toBe('x')
    })

    it('finalising needs a clean split for marker-v1; legacy text is never interpreted', async () => {
      const meta = { publicBody: 'BC Ministry of Forests', jurisdiction: 'bc', letterFormat: 'marker-v1' }
      for (const fixture of [MISSING_MARKER_LETTER, AMBIGUOUS_LETTER]) {
        const id = await insertAction({ content: fixture.content, metadata: meta })
        expect(await patch(id, { status: 'final' })).toEqual({ status: 409, json: { error: UNCLEAN } })
        expect((await readRow(id)).status).toBe('draft')
      }
      const clean = await insertAction({ content: MARKER_V1_LETTER.content, metadata: meta })
      expect((await patch(clean, { status: 'final' })).status).toBe(200)
      // A legacy letter quoting the marker finalises: it is never split.
      const legacy = await insertAction({
        content: LITERAL_MARKER_LETTER.content,
        metadata: { publicBody: 'BC Ministry of Forests', jurisdiction: 'bc' },
      })
      expect((await patch(legacy, { status: 'final' })).status).toBe(200)
      // content and status in one request: the split is checked on the new content
      const both = await insertAction({ content: MARKER_V1_LETTER.content, metadata: meta })
      expect(await patch(both, { status: 'final', content: MISSING_MARKER_LETTER.content })).toEqual({
        status: 409,
        json: { error: UNCLEAN },
      })
    })

    it('PATCH never writes letterFormat', async () => {
      const id = await insertAction({ content: 'Legacy draft.' })
      const res = await patch(id, { content: 'Edited legacy draft.', metadata: { letterFormat: 'marker-v1' } })
      expect(res.status).toBe(200)
      const row = await readRow(id)
      expect(row.content).toBe('Edited legacy draft.')
      expect(row.metadata).toEqual({ publicBody: 'BC Ministry of Forests', jurisdiction: 'bc', description: 'Synthetic QA request' })
    })

    it('ownership: another user gets 404 and no header gets 401, and nothing is written', async () => {
      const id = await insertAction({ content: 'Owner text.' })
      expect((await patch(id, { content: 'Theirs.' }, OTHER.id)).status).toBe(404)
      expect((await patch(id, { content: 'Anyone.' }, null)).status).toBe(401)
      expect((await generate(id, OTHER.id)).status).toBe(404)
      expect((await generate(id, null)).status).toBe(401)
      expect((await create({ actionType: 'public_comment', description: 'x' }, null)).status).toBe(401)
      expect((await readRow(id)).content).toBe('Owner text.')
    })

    // ------------------------------------------------------------- generate

    it('the stream closes only after onFinish has saved: a read right after the stream sees the row', async () => {
      await stub('/__qa/reset')
      const id = await insertAction({ content: '' })
      const { status, text } = await generate(id)
      expect(status).toBe(200)
      expect(text).toBe(AI_STUB_LETTERS['marker-v1'])
      const row = await readRow(id)
      expect(row.content).toBe(text)
      expect(row.metadata).toMatchObject({ letterFormat: 'marker-v1', promptVersion: '0.6.0', publicBody: 'BC Ministry of Forests', jurisdiction: 'bc' })
    })

    it('two generates on one draft: the first to commit wins; the second is discarded', async () => {
      await stub('/__qa/reset')
      const id = await insertAction({ content: '' })
      await stub('/__qa/hold', { count: 2 })
      const first = generate(id)
      const [h1] = await heldStreams(1)
      await stub('/__qa/scenario', { letter: 'missing-marker' })
      const second = generate(id)
      const held = await heldStreams(2)
      const h2 = held.find((h) => h !== h1)!
      await stub('/__qa/release', { id: h1 })
      expect((await first).text).toBe(AI_STUB_LETTERS['marker-v1'])
      const warn = vi.spyOn(console, 'warn')
      try {
        await stub('/__qa/release', { id: h2 })
        const secondResult = await second
        expect(secondResult.text).toBe(AI_STUB_LETTERS['missing-marker'])
        expect((await readRow(id)).content).toBe(AI_STUB_LETTERS['marker-v1'])
        // The discard is logged as a structured event, identifiers only.
        const events = warn.mock.calls
          .map((c) => String(c[0]))
          .filter((line) => line.includes('"event":"lever.generate.discarded"'))
        expect(events).toHaveLength(1)
        expect(JSON.parse(events[0])).toMatchObject({ event: 'lever.generate.discarded', actionId: id })
      } finally {
        warn.mockRestore()
      }
    })

    it('generate, then an edit during streaming that commits first: the generation is discarded', async () => {
      await stub('/__qa/reset')
      const id = await insertAction({ content: '' })
      await stub('/__qa/hold', { count: 1 })
      const gen = generate(id)
      await heldStreams(1)
      const edit = await patch(id, { content: 'The citizen typed this.', expectedContentSha256: sha256('') })
      expect(edit.status).toBe(200)
      await stub('/__qa/release', {})
      await gen
      const row = await readRow(id)
      expect(row.content).toBe('The citizen typed this.')
      expect(row.metadata?.letterFormat).toBeUndefined()
    })

    it('generate commits first, then the edit opened before it is a 409 and the generated text stays', async () => {
      await stub('/__qa/reset')
      const id = await insertAction({ content: '' })
      await generate(id)
      const edit = await patch(id, { content: 'Typed while it streamed.', expectedContentSha256: sha256('') })
      expect(edit).toEqual({ status: 409, json: { error: CONTENT_CHANGED } })
      expect((await readRow(id)).content).toBe(AI_STUB_LETTERS['marker-v1'])
    })

    it('a finalise that lands mid-stream: nothing is saved by the generation', async () => {
      await stub('/__qa/reset')
      const id = await insertAction({ content: 'Legacy text, finalised mid-stream.', metadata: { publicBody: 'BC Ministry of Forests', jurisdiction: 'bc' } })
      await stub('/__qa/hold', { count: 1 })
      const gen = generate(id)
      await heldStreams(1)
      expect((await patch(id, { status: 'final' })).status).toBe(200)
      await stub('/__qa/release', {})
      await gen
      const row = await readRow(id)
      expect(row).toMatchObject({ status: 'final', content: 'Legacy text, finalised mid-stream.' })
      expect(row.metadata?.letterFormat).toBeUndefined()
    })

    it('generate on final or filed is a 409 and never reaches the model', async () => {
      await stub('/__qa/reset')
      for (const status of ['final', 'filed'] as const) {
        const id = await insertAction({ content: 'Done.', status })
        const res = await generate(id)
        expect(res.status).toBe(409)
        expect(JSON.parse(res.text)).toEqual({ error: NOT_A_DRAFT })
        expect((await readRow(id)).content).toBe('Done.')
      }
      expect(await letterRequestCount()).toBe(0)
    })

    it('FIPPA with no province and no investigation is refused (409) before any model call: no BC fallback', async () => {
      await stub('/__qa/reset')
      const id = await insertAction({ content: '', metadata: { publicBody: 'BC Ministry of Forests', description: 'x' } })
      const res = await generate(id)
      expect(res.status).toBe(409)
      expect(JSON.parse(res.text)).toEqual({ error: CHOOSE_PROVINCE })
      expect(await letterRequestCount()).toBe(0)
    })

    it('a legacy FIPPA draft takes its province from the investigation, and its aliased body reaches the prompt', async () => {
      await stub('/__qa/reset')
      const id = await insertAction({
        content: '',
        metadata: { publicBody: 'Ministry of Forests', addressee: 'Ministry of Forests', description: 'x' },
        investigationId: BC_INVESTIGATION_ID,
      })
      expect((await generate(id)).status).toBe(200)
      const { requests } = (await stub('/__qa/requests')) as { requests: Array<{ kind: string; body: unknown }> }
      const sent = JSON.stringify(requests.filter((r) => r.kind === 'letter').at(-1)?.body)
      expect(sent).toContain('Public Body: BC Ministry of Forests')
      expect(sent).toContain('RSBC 1996')
    })

    it('a public comment generates as before: content saved, no letterFormat', async () => {
      await stub('/__qa/reset')
      const id = await insertAction({ content: '', actionType: 'public_comment', metadata: { publicBody: null, description: 'x' } })
      const { status, text } = await generate(id)
      expect(status).toBe(200)
      expect(text).toBe(AI_STUB_GENERIC_TEXT)
      const row = await readRow(id)
      expect(row.content).toBe(AI_STUB_GENERIC_TEXT)
      expect(row.metadata).toEqual({ publicBody: null, description: 'x' })
    })

    // --------------------------------------------------------------- create

    it('create: a FIPPA request needs a province, stores it, and stores the body as its exact directory name', async () => {
      const missing = await create({ actionType: 'fippa_request', description: 'Records.', publicBodyName: 'BC Ministry of Forests' })
      expect(missing).toEqual({ status: 400, json: { error: CHOOSE_PROVINCE } })

      const made = await create({
        actionType: 'fippa_request',
        description: 'Records.',
        publicBodyName: 'BC Ministry of Forests',
        jurisdiction: 'bc',
      })
      expect(made.status).toBe(201)
      const row = await readRow(made.json.actionId as string)
      expect(row.metadata).toEqual({
        publicBody: 'BC Ministry of Forests',
        addressee: 'BC Ministry of Forests',
        description: 'Records.',
        jurisdiction: 'bc',
      })

      const other = await create({
        actionType: 'fippa_request',
        description: 'Records.',
        publicBodyName: '  Synthetic Water Board  ',
        jurisdiction: 'on',
      })
      expect(other.status).toBe(201)
      expect((await readRow(other.json.actionId as string)).metadata).toMatchObject({
        publicBody: 'Synthetic Water Board',
        jurisdiction: 'on',
      })

      const comment = await create({ actionType: 'public_comment', description: 'A comment.' })
      expect(comment.status).toBe(201)
      expect((await readRow(comment.json.actionId as string)).metadata).toEqual({
        publicBody: null,
        addressee: null,
        description: 'A comment.',
      })
    })

    it('created through the route, the selected body and province reach the prompt; an AB draft gets no BC citation', async () => {
      await stub('/__qa/reset')
      const bc = await create({ actionType: 'fippa_request', description: 'Records.', publicBodyName: 'BC Ministry of Forests', jurisdiction: 'bc' })
      expect((await generate(bc.json.actionId as string)).status).toBe(200)
      const ab = await create({ actionType: 'fippa_request', description: 'Records.', publicBodyName: 'City of Edmonton', jurisdiction: 'ab' })
      expect((await generate(ab.json.actionId as string)).status).toBe(200)

      const { requests } = (await stub('/__qa/requests')) as { requests: Array<{ kind: string; body: unknown }> }
      const letters = requests.filter((r) => r.kind === 'letter').map((r) => JSON.stringify(r.body))
      expect(letters).toHaveLength(2)
      expect(letters[0]).toContain('Public Body: BC Ministry of Forests')
      expect(letters[0]).toContain('RSBC 1996')
      expect(letters[1]).toContain('Public Body: City of Edmonton')
      expect(letters[1]).toContain('RSA 2000')
      expect(letters[1]).not.toContain('RSBC')
      expect((await readRow(bc.json.actionId as string)).metadata).toMatchObject({ letterFormat: 'marker-v1' })
    })
  })

  // -------------------------------------------------------------------------
  // Layer 2: through the real middleware on the running harness app.
  // -------------------------------------------------------------------------

  describe.skipIf(!APP_UP)('through the middleware on the running harness app', () => {
    let ownerCookie = ''
    let otherCookie = ''

    beforeAll(async () => {
      const { signJWT } = await import('@/lib/auth/jwt')
      const { AUTH_COOKIE } = await import('@/lib/auth/middleware')
      ownerCookie = `${AUTH_COOKIE}=${await signJWT({ sub: OWNER.id, email: OWNER.email })}`
      otherCookie = `${AUTH_COOKIE}=${await signJWT({ sub: OTHER.id, email: OTHER.email })}`
    })

    function http(method: string, pathname: string, cookie: string | null, body?: unknown) {
      const headers: Record<string, string> = { 'content-type': 'application/json' }
      if (cookie) headers.cookie = cookie
      if (method !== 'GET') headers.origin = APP_URL
      return fetch(`${APP_URL}${pathname}`, {
        method,
        redirect: 'manual',
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    }

    it('semantic check: a "BC Ministry of Forests" draft generates through the stub with that body named; an AB draft has no BC citation', async () => {
      await stub('/__qa/reset')
      const bc = await http('POST', '/api/lever/actions', ownerCookie, {
        actionType: 'fippa_request',
        description: 'Inspection reports for the intake.',
        publicBodyName: 'BC Ministry of Forests',
        jurisdiction: 'bc',
      })
      expect(bc.status).toBe(201)
      const bcId = ((await bc.json()) as { actionId: string }).actionId
      const bcGen = await http('POST', '/api/lever/generate', ownerCookie, { actionId: bcId })
      expect(bcGen.status).toBe(200)
      await bcGen.text()

      const ab = await http('POST', '/api/lever/actions', ownerCookie, {
        actionType: 'fippa_request',
        description: 'Inspection reports for the intake.',
        publicBodyName: 'Alberta Energy Regulator',
        jurisdiction: 'ab',
      })
      const abId = ((await ab.json()) as { actionId: string }).actionId
      const abGen = await http('POST', '/api/lever/generate', ownerCookie, { actionId: abId })
      expect(abGen.status).toBe(200)
      await abGen.text()

      const { requests } = (await stub('/__qa/requests')) as { requests: Array<{ kind: string; body: unknown }> }
      const letters = requests.filter((r) => r.kind === 'letter').map((r) => JSON.stringify(r.body))
      expect(letters).toHaveLength(2)
      expect(letters[0]).toContain('Public Body: BC Ministry of Forests')
      expect(letters[0]).toContain('RSBC 1996')
      expect(letters[1]).toContain('Public Body: Alberta Energy Regulator')
      expect(letters[1]).not.toContain('RSBC')

      const bcRow = await readRow(bcId)
      expect(bcRow.metadata).toMatchObject({ letterFormat: 'marker-v1', promptVersion: '0.6.0', jurisdiction: 'bc' })
      expect(bcRow.content).toBe(AI_STUB_LETTERS['marker-v1'])
    })

    it('owner, non-owner and anonymous on PATCH, generate and create', async () => {
      const id = await insertAction({ content: 'Owner text over HTTP.' })
      const owner = await http('PATCH', `/api/lever/actions/${id}`, ownerCookie, {
        content: 'Owner edit over HTTP.',
        expectedContentSha256: sha256('Owner text over HTTP.'),
      })
      expect(owner.status).toBe(200)
      expect((await http('PATCH', `/api/lever/actions/${id}`, otherCookie, { content: 'x' })).status).toBe(404)
      expect((await http('PATCH', `/api/lever/actions/${id}`, null, { content: 'x' })).status).toBe(401)
      expect((await http('POST', '/api/lever/generate', otherCookie, { actionId: id })).status).toBe(404)
      expect((await http('POST', '/api/lever/generate', null, { actionId: id })).status).toBe(401)
      expect((await http('POST', '/api/lever/actions', null, { actionType: 'public_comment', description: 'x' })).status).toBe(401)
      expect((await readRow(id)).content).toBe('Owner edit over HTTP.')
    })

    it('a stale hash over HTTP is a 409 with its reason', async () => {
      const id = await insertAction({ content: 'Server text.' })
      const res = await http('PATCH', `/api/lever/actions/${id}`, ownerCookie, {
        content: 'Mine.',
        expectedContentSha256: sha256('Something else.'),
      })
      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({ error: CONTENT_CHANGED })
    })
  })
})
