import { describe, it, expect, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * FORUM-1: every /api/forum/* handler and the two AP forum-object endpoints
 * must deny (404) before touching auth, rate limiting, or the database when
 * FORUM_ENABLED is off (the default). Because the gate is the first
 * statement in each handler, these routes are exercised directly — with no
 * request headers, no DB, no Redis — and are expected to short-circuit
 * before any of that machinery is reached. If a handler's gate is ever
 * removed or reordered below other logic, these tests fail loudly instead
 * of quietly reopening an unmoderated, federating surface.
 *
 * Not covered here (would require a live DB / Redis, out of step with this
 * codebase's existing unit-test conventions — see permanence-gate.test.ts):
 * the ALLOWED path when the flag is on. That's exercised by the existing
 * per-route logic tests (forum-rate-limit-tier.test.ts, forum-validation.test.ts)
 * plus manual/staging verification once FORUM_ENABLED=true is actually set.
 */

function req(url = 'http://localhost/api/forum/threads') {
  return new NextRequest(url)
}

function params<T extends Record<string, string>>(p: T) {
  return { params: Promise.resolve(p) }
}

describe('FORUM-1 route gate — /api/forum/*', () => {
  afterEach(() => {
    delete process.env.FORUM_ENABLED
  })

  it('POST /api/forum/threads denies when the flag is off', async () => {
    delete process.env.FORUM_ENABLED
    const { POST } = await import('@/app/api/forum/threads/route')
    const res = await POST(req(), params({}))
    expect(res.status).toBe(404)
  })

  it('GET /api/forum/threads denies when the flag is off', async () => {
    delete process.env.FORUM_ENABLED
    const { GET } = await import('@/app/api/forum/threads/route')
    const res = await GET(req(), params({}))
    expect(res.status).toBe(404)
  })

  it('GET /api/forum/threads/[threadId] (safeRoute-wrapped) denies when the flag is off', async () => {
    delete process.env.FORUM_ENABLED
    const { GET } = await import('@/app/api/forum/threads/[threadId]/route')
    const res = await GET(req(), params({ threadId: 'x' }))
    expect(res.status).toBe(404)
  })

  it('POST /api/forum/threads/[threadId]/posts denies when the flag is off', async () => {
    delete process.env.FORUM_ENABLED
    const { POST } = await import('@/app/api/forum/threads/[threadId]/posts/route')
    const res = await POST(req(), params({ threadId: 'x' }))
    expect(res.status).toBe(404)
  })

  it('PATCH /api/forum/posts/[postId] denies when the flag is off', async () => {
    delete process.env.FORUM_ENABLED
    const { PATCH } = await import('@/app/api/forum/posts/[postId]/route')
    const res = await PATCH(req(), params({ postId: 'x' }))
    expect(res.status).toBe(404)
  })

  it('DELETE /api/forum/posts/[postId] denies when the flag is off', async () => {
    delete process.env.FORUM_ENABLED
    const { DELETE } = await import('@/app/api/forum/posts/[postId]/route')
    const res = await DELETE(req(), params({ postId: 'x' }))
    expect(res.status).toBe(404)
  })

  it('POST /api/forum/reports denies when the flag is off', async () => {
    delete process.env.FORUM_ENABLED
    const { POST } = await import('@/app/api/forum/reports/route')
    const res = await POST(req(), params({}))
    expect(res.status).toBe(404)
  })

  it('GET /api/forum/reports denies when the flag is off', async () => {
    delete process.env.FORUM_ENABLED
    const { GET } = await import('@/app/api/forum/reports/route')
    const res = await GET(req(), params({}))
    expect(res.status).toBe(404)
  })

  it('POST /api/forum/reports/[reportId]/appeal denies when the flag is off', async () => {
    delete process.env.FORUM_ENABLED
    const { POST } = await import('@/app/api/forum/reports/[reportId]/appeal/route')
    const res = await POST(req(), params({ reportId: 'x' }))
    expect(res.status).toBe(404)
  })

  it('POST /api/forum/moderate denies when the flag is off', async () => {
    delete process.env.FORUM_ENABLED
    const { POST } = await import('@/app/api/forum/moderate/route')
    const res = await POST(req(), params({}))
    expect(res.status).toBe(404)
  })
})

describe('FORUM-1 route gate — AP forum-object endpoints', () => {
  afterEach(() => {
    delete process.env.FORUM_ENABLED
  })

  it('GET /ap/threads/[threadId] denies (404) when the flag is off, even with federation configured', async () => {
    delete process.env.FORUM_ENABLED
    process.env.AP_DOMAIN = 'republic.example.com'
    try {
      const { GET } = await import('@/app/ap/threads/[threadId]/route')
      const res = await GET(req('http://localhost/ap/threads/x'), params({ threadId: 'x' }))
      expect(res.status).toBe(404)
    } finally {
      delete process.env.AP_DOMAIN
    }
  })

  it('GET /ap/posts/[postId] denies (404) when the flag is off, even with federation configured', async () => {
    delete process.env.FORUM_ENABLED
    process.env.AP_DOMAIN = 'republic.example.com'
    try {
      const { GET } = await import('@/app/ap/posts/[postId]/route')
      const res = await GET(req('http://localhost/ap/posts/x'), params({ postId: 'x' }))
      expect(res.status).toBe(404)
    } finally {
      delete process.env.AP_DOMAIN
    }
  })
})
