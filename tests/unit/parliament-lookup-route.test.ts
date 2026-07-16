import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/parliament/lookup/route'

/**
 * CRITICAL-1: /api/parliament/lookup moved from GET ?postalCode=... to POST
 * with a JSON body — a postal code in a query string leaks via browser
 * history, Sentry breadcrumbs/spans (instrumentation-client.ts), and Netlify
 * access logs. These tests exercise every gate that runs before the
 * database/Represent-API call (auth, JSON parsing, presence, format), which
 * is what changed. The cache-hit / cache-miss / Represent-API paths are
 * unchanged by this fix and are not re-tested here (no existing DB/network
 * mocking harness for this route — matches the "not covered" carve-out in
 * forum-flag-route-gate.test.ts).
 */

function postReq(
  body: unknown,
  opts: { userId?: string | null; url?: string; rawBody?: string } = {}
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.userId !== null) {
    headers['x-user-id'] = opts.userId ?? 'user-1'
  }
  return new NextRequest(opts.url ?? 'http://localhost/api/parliament/lookup', {
    method: 'POST',
    headers,
    body: opts.rawBody ?? JSON.stringify(body),
  })
}

describe('POST /api/parliament/lookup', () => {
  it('exports POST, not GET', async () => {
    const mod = await import('@/app/api/parliament/lookup/route')
    expect(typeof mod.POST).toBe('function')
    expect((mod as Record<string, unknown>).GET).toBeUndefined()
  })

  it('rejects unauthenticated requests before touching the body', async () => {
    const res = await POST(postReq({ postalCode: 'V8B 0A1' }, { userId: null }))
    expect(res.status).toBe(401)
  })

  it('rejects invalid JSON bodies', async () => {
    const res = await POST(postReq(undefined, { rawBody: 'not json' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Invalid JSON')
  })

  it('requires postalCode in the JSON body — a query string is no longer read', async () => {
    const req = postReq(
      {},
      { url: 'http://localhost/api/parliament/lookup?postalCode=V8B0A1' }
    )
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('postalCode is required')
  })

  it('rejects an invalid Canadian postal code from the body', async () => {
    const res = await POST(postReq({ postalCode: 'not-a-code' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Invalid Canadian postal code')
  })
})
