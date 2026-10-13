/**
 * B3a design fix (Razor design-check W1): "Send a new code" after a lockout.
 *
 * Runs the real send-code and verify-code route handlers (safeRoute, CSRF
 * check, magic-code.ts) against the QA harness Postgres on 127.0.0.1:55432.
 * Only the outbound email is replaced: `@/lib/email` is mocked so the
 * plaintext code is captured instead of sent to Resend. No Redis: in a test
 * process the limiters fail open, so these tests exercise the dedup and the
 * per-email hourly cap in magic-code.ts, not the IP/global quotas.
 *
 * Every row belongs to throwaway addresses and is deleted in afterAll. When
 * the harness is down the file is skipped with an explicit marker;
 * QA_REQUIRE_HARNESS=1 turns that skip into a failure.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import postgres from 'postgres'
import { createHash } from 'node:crypto'
import { assertLocalQaDatabaseUrl } from '../../scripts/lib/local-db-guard'

const QA_DATABASE_URL = 'postgres://qa_app:qa_app_dummy@127.0.0.1:55432/republic_qa'
const APP_URL = 'http://127.0.0.1:3177'

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

const HARNESS_UP = await databaseReachable()
if (!HARNESS_UP) {
  const message =
    '[send-code-resend] SKIPPED: the QA harness database is not running (npx tsx scripts/qa/harness.ts up).'
  if (process.env.QA_REQUIRE_HARNESS === '1') throw new Error(message.replace('SKIPPED', 'REQUIRED'))
  console.warn(message)
}

process.env.DATABASE_URL = QA_DATABASE_URL
process.env.QA_LOCAL_DB = '1'
process.env.JWT_SECRET = 'qa-harness-jwt-vitest-send-code-resend'
process.env.NEXT_PUBLIC_APP_URL = APP_URL
process.env.RESEND_API_KEY = 'qa-dummy-resend-key'
// env.ts validates the whole schema on first getDb(); no model is called here.
process.env.ANTHROPIC_API_KEY = 'qa-dummy-anthropic-key'
delete process.env.UPSTASH_REDIS_REST_URL
delete process.env.UPSTASH_REDIS_REST_TOKEN
delete process.env.DIRECT_DATABASE_URL
assertLocalQaDatabaseUrl(process.env.DATABASE_URL, 'DATABASE_URL')

/** Every code the route "emailed", by address, newest last. */
const mailed = new Map<string, string[]>()
vi.mock('@/lib/email', () => ({
  sendMagicCodeEmail: vi.fn(async (to: string, code: string) => {
    mailed.set(to, [...(mailed.get(to) ?? []), code])
  }),
}))

type Handler = (req: import('next/server').NextRequest) => Promise<Response>
let SEND: Handler
let VERIFY: Handler
let NextRequestCtor: typeof import('next/server').NextRequest
let db: postgres.Sql

const RUN = Date.now()
const addresses: string[] = []
function address(tag: string): string {
  const a = `qa-b3a-${tag}-${RUN}@example.test`
  addresses.push(a)
  return a
}

function post(path: string, body: unknown) {
  return new NextRequestCtor(`${APP_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: APP_URL, 'x-nf-client-connection-ip': '203.0.113.9' },
    body: JSON.stringify(body),
  })
}

async function send(email: string) {
  const res = await SEND(post('/api/auth/send-code', { email }))
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

async function verify(email: string, code: string) {
  const res = await VERIFY(post('/api/auth/verify-code', { email, code }))
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

function wrongCode(right: string): string {
  return right === '11111111' ? '22222222' : '11111111'
}

describe.skipIf(!HARNESS_UP)('send-code resend on the harness database (B3a, Razor design-check W1)', () => {
  beforeAll(async () => {
    db = postgres(QA_DATABASE_URL, { max: 1, onnotice: () => {} })
    const server = await import('next/server')
    NextRequestCtor = server.NextRequest
    SEND = (await import('@/app/api/auth/send-code/route')).POST as unknown as Handler
    VERIFY = (await import('@/app/api/auth/verify-code/route')).POST as unknown as Handler
  }, 30_000)

  afterAll(async () => {
    if (!db) return
    try {
      await db`delete from magic_codes where email in ${db(addresses)}`
      await db`delete from users where email in ${db(addresses)}`
    } finally {
      await db.end({ timeout: 2 })
    }
  })

  it('locked out inside the dedup window, a resend issues a fresh code that signs in', async () => {
    const email = address('locked')
    const first = await send(email)
    expect(first).toEqual({ status: 200, body: { ok: true, sent: true } })
    const [code1] = mailed.get(email)!

    // Five wrong codes, well inside 30 s of the send.
    for (let i = 0; i < 5; i++) {
      expect((await verify(email, wrongCode(code1))).body).toEqual({ error: 'invalid' })
    }
    expect(await verify(email, code1)).toEqual({ status: 401, body: { error: 'too_many_attempts' } })

    const resend = await send(email)
    expect(resend).toEqual({ status: 200, body: { ok: true, sent: true } })
    const codes = mailed.get(email)!
    expect(codes).toHaveLength(2)
    const code2 = codes[1]

    // The locked code was retired, not left active alongside the new one.
    const rows = await db<{ used: boolean; attempts: number }[]>`
      select used_at is not null as used, attempts from magic_codes where email = ${email} order by created_at`
    expect(rows).toEqual([
      { used: true, attempts: 5 },
      { used: false, attempts: 0 },
    ])

    const ok = await verify(email, code2)
    expect(ok).toEqual({ status: 200, body: { ok: true } })
  })

  it('a resend inside the window, with the code still usable, sends nothing and says sent: false', async () => {
    const email = address('recent')
    expect(await send(email)).toEqual({ status: 200, body: { ok: true, sent: true } })
    const again = await send(email)
    expect(again).toEqual({ status: 200, body: { ok: true, sent: false, reason: 'recent' } })
    expect(mailed.get(email)).toHaveLength(1)
    const [{ count }] = await db<{ count: number }[]>`select count(*)::int as count from magic_codes where email = ${email}`
    expect(count).toBe(1)
    // The code it points the citizen back to still works.
    expect(await verify(email, mailed.get(email)![0])).toEqual({ status: 200, body: { ok: true } })
  })

  it('a code with some wrong attempts left is still deduplicated', async () => {
    const email = address('partial')
    await send(email)
    const [code1] = mailed.get(email)!
    for (let i = 0; i < 4; i++) await verify(email, wrongCode(code1))
    expect((await send(email)).body).toEqual({ ok: true, sent: false, reason: 'recent' })
    expect(await verify(email, code1)).toEqual({ status: 200, body: { ok: true } })
  })

  it('the per-email hourly cap still applies to a locked-out resend', async () => {
    const email = address('capped')
    // Five codes in the last hour, the newest locked out and inside the window.
    for (let i = 4; i >= 0; i--) {
      await db`
        insert into magic_codes (email, code, expires_at, created_at, attempts, used_at)
        values (${email}, ${createHash('sha256').update(`x${i}`).digest('hex')},
                now() + interval '10 minutes', now() - (${i} * interval '1 minute'),
                ${i === 0 ? 5 : 0}, ${i === 0 ? null : new Date()})`
    }
    const res = await send(email)
    expect(res.status).toBe(429)
    expect(res.body.error).toBe('Too many codes requested. Try again later.')
    expect(mailed.get(email)).toBeUndefined()
  })

  it('the response is the same shape for an address with and without an account', async () => {
    const known = address('known')
    await db`insert into users (email) values (${known})`
    const unknown = address('unknown')
    const a = await send(known)
    const b = await send(unknown)
    expect(a).toEqual(b)
    expect(await send(known)).toEqual(await send(unknown))
  })
})
