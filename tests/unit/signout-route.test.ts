import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/*
 * Razor C3 W1: the sign-out route must never refuse a citizen because
 * somebody else made requests. The old limiter keyed on `x-user-id`, which
 * this route never receives (the middleware skips /api/auth/), so every
 * sign-out shared one site-wide bucket: 30 anonymous curls a minute and
 * nobody could sign out.
 *
 * `@/lib/rate-limit` is replaced by a real per-key bucket (30 per window,
 * like the production limiter), so if a limiter is ever put back on a shared
 * key this test fails; per-requester keys would pass. The route itself, the
 * CSRF check and the cookie deletion are the real ones.
 */

const APP = 'http://127.0.0.1:3177'
const buckets = new Map<string, number>()
const limiterKeys: string[] = []
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: async (key: string) => {
    limiterKeys.push(key)
    const n = (buckets.get(key) ?? 0) + 1
    buckets.set(key, n)
    return { success: n <= 30 }
  },
}))

const prevAppUrl = process.env.NEXT_PUBLIC_APP_URL
beforeAll(() => {
  process.env.NEXT_PUBLIC_APP_URL = APP
})
afterAll(() => {
  process.env.NEXT_PUBLIC_APP_URL = prevAppUrl
})

const { POST } = await import('@/app/api/auth/signout/route')

function signOutRequest(ip: string, opts: { cookie?: string; origin?: string | null } = {}) {
  const headers: Record<string, string> = { 'x-nf-client-connection-ip': ip }
  if (opts.origin !== null) headers.origin = opts.origin ?? APP
  if (opts.cookie) headers.cookie = `republic_token=${opts.cookie}`
  return new NextRequest(`${APP}/api/auth/signout`, { method: 'POST', headers })
}

const ctx = { params: Promise.resolve({}) }

/** The Set-Cookie that expires the session cookie, or null. */
function clearedCookie(res: Response): string | null {
  const set = res.headers.get('set-cookie') ?? ''
  return /republic_token=;/.test(set) && /Expires=Thu, 01 Jan 1970/.test(set) ? set : null
}

describe('POST /api/auth/signout', () => {
  it('answers 200 {signedOut:true} and expires the session cookie', async () => {
    const res = await POST(signOutRequest('203.0.113.9', { cookie: 'tok' }), ctx)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ signedOut: true })
    expect(clearedCookie(res)).not.toBeNull()
    expect(res.headers.get('location')).toBeNull()
  })

  it('60 anonymous POSTs from one IP do not stop a signed-in citizen signing out from another IP', async () => {
    for (let i = 0; i < 60; i++) {
      const r = await POST(signOutRequest('198.51.100.66'), ctx)
      expect(r.status).toBe(200)
    }
    const alice = await POST(signOutRequest('203.0.113.42', { cookie: 'alice-token' }), ctx)
    expect(alice.status).toBe(200)
    expect(await alice.json()).toEqual({ signedOut: true })
    expect(clearedCookie(alice)).not.toBeNull()
  })

  it('still refuses a missing or foreign Origin (403), clearing nothing', async () => {
    for (const origin of [null, 'https://evil.example']) {
      const res = await POST(signOutRequest('203.0.113.9', { cookie: 'tok', origin }), ctx)
      expect(res.status).toBe(403)
      expect(clearedCookie(res)).toBeNull()
    }
  })
})
