import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest'
import { NextRequest } from 'next/server'

/*
 * The Forum page gate lives in middleware (Razor W1). While the gate is off,
 * every /forum URL is rewritten, after auth, to /forum-opens-later: a route
 * outside the forum segment, so no Forum page, generateMetadata or query runs.
 * These tests drive the real middleware function with a real session token.
 * The HTTP-level proof against a production build is forum-gate-http.test.ts.
 */

process.env.JWT_SECRET = 'forum-gate-test-secret-0123456789abcdef'

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound() called')
  },
}))

const { middleware } = await import('@/middleware')
const { default: ForumOpensLaterPage } = await import('@/app/(app)/forum-opens-later/page')
const { isForumPath, FORUM_GATED_PATH } = await import('@/lib/forum/gate-path')
const { signJWT } = await import('@/lib/auth/jwt')

let token: string
beforeAll(async () => {
  token = await signJWT({ sub: 'a0000000-0000-4000-8000-00000000000a', email: 'a@example.test' })
})

afterEach(() => {
  delete process.env.FORUM_ENABLED
})

function get(path: string, signedIn = true, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { ...extra }
  if (signedIn) headers.cookie = `republic_token=${token}`
  return middleware(new NextRequest(`http://127.0.0.1:3177${path}`, { headers }))
}

const rewriteOf = (res: Response) => res.headers.get('x-middleware-rewrite')

describe('isForumPath', () => {
  it('matches every way of spelling a Forum URL', () => {
    for (const p of [
      '/forum', '/forum/', '/forum/new', '/forum/policy', '/forum/moderation',
      '/forum/7d6f0c1e-0000-4000-8000-000000000001', '/Forum', '/FORUM/new',
      '/%66orum', '/%66orum/new', '/forum%2Fnew', '//forum', '//forum//policy', '/forum.rsc',
      // Undecodable, but could be the Forum: fail closed (Razor RN1).
      '/forum%E0', '/forum/%E0%A4%A', '/FORUM%E0', '/%66orum%E0', '/%46ORUM/x%E0', '//forum%E0',
    ]) {
      expect(isForumPath(p), p).toBe(true)
    }
  })

  it('leaves malformed non-Forum paths to the app, not the honest page (Razor RN1)', () => {
    for (const p of ['/votes%E0', '/%E0%A4%A', '/api/forum%E0', '/api/lever/actions/%E0', '/lever/%E0', '/%E0forum', '/x/forum%E0']) {
      expect(isForumPath(p), p).toBe(false)
    }
  })

  it('leaves every other route alone, including the honest page itself', () => {
    for (const p of ['/', '/forums', '/forumx', FORUM_GATED_PATH, '/votes', '/foundations', '/investigate', '/api/forum/threads']) {
      expect(isForumPath(p), p).toBe(false)
    }
  })
})

describe('middleware Forum gate', () => {
  it('rewrites signed-in Forum requests to the honest page while gated', async () => {
    for (const p of ['/forum', '/forum/new', '/forum/policy', '/forum/moderation', '/forum/some-thread-id', '/%66orum/policy']) {
      const res = await get(p)
      expect(new URL(rewriteOf(res) ?? 'http://x/none').pathname, p).toBe(FORUM_GATED_PATH)
    }
  })

  it('rewrites RSC (client navigation) requests too', async () => {
    const res = await get('/forum/some-thread-id?page=2', true, { RSC: '1' })
    const target = new URL(rewriteOf(res)!)
    expect(target.pathname).toBe(FORUM_GATED_PATH)
    expect(target.searchParams.get('page')).toBe('2')
  })

  it('keeps the identity headers on the rewritten request', async () => {
    const res = await get('/forum/new')
    expect(res.headers.get('x-middleware-request-x-user-id')).toBe('a0000000-0000-4000-8000-00000000000a')
  })

  it('is fail-closed: any FORUM_ENABLED but "true" still rewrites', async () => {
    for (const v of ['1', 'yes', 'TRUE', '']) {
      process.env.FORUM_ENABLED = v
      expect(rewriteOf(await get('/forum')), v).toContain(FORUM_GATED_PATH)
    }
  })

  it('serves the Forum itself once the gate opens', async () => {
    process.env.FORUM_ENABLED = 'true'
    const res = await get('/forum/new')
    expect(rewriteOf(res)).toBeNull()
    expect(res.headers.get('x-middleware-next')).toBe('1')
  })

  it('does not rewrite a malformed non-Forum URL (Razor RN1)', async () => {
    for (const p of ['/votes%E0', '/lever/%E0']) {
      expect(rewriteOf(await get(p)), p).toBeNull()
    }
    expect(new URL(rewriteOf(await get('/forum%E0'))!).pathname).toBe(FORUM_GATED_PATH)
  })

  it('leaves other app routes unrewritten', async () => {
    const res = await get('/votes')
    expect(rewriteOf(res)).toBeNull()
    expect(res.headers.get('x-middleware-next')).toBe('1')
  })

  it('still sends a signed-out visitor to login first', async () => {
    const res = await get('/forum/new', false)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login?redirect=%2Fforum%2Fnew')
    expect(rewriteOf(res)).toBeNull()
  })
})

describe('the honest route itself', () => {
  it('renders the honest page while gated', () => {
    const el = ForumOpensLaterPage()
    expect(el).toBeTruthy()
  })

  it('has nothing true to say once the Forum opens: it 404s', () => {
    process.env.FORUM_ENABLED = 'true'
    expect(() => ForumOpensLaterPage()).toThrow('notFound() called')
  })
})
