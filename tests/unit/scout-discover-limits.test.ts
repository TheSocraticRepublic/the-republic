import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/*
 * /api/scout/discover's two 429s (UI plan C1, Jen C4). They share a status, so
 * the body says which one it is: `code`, and for the daily limit the instant it
 * resets. The daily limit is @upstash/ratelimit's fixedWindow('24 h'), bucketed
 * on floor(now / 24 h), so that instant is the next 00:00 UTC, which is why the
 * route no longer says "tomorrow". Only the limiters are stubbed; the route
 * returns before any database, search or model call.
 */

const tight = vi.fn()
const daily = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkTightRateLimit: (...a: unknown[]) => tight(...a),
  checkDailyAiGeneralLimit: (...a: unknown[]) => daily(...a),
}))

import { POST } from '@/app/api/scout/discover/route'

const RESET = Date.UTC(2026, 9, 13, 0, 0, 0)

function request() {
  return new NextRequest('http://127.0.0.1:3177/api/scout/discover', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-user-id': 'a0000000-0000-4000-8000-00000000000a' },
    body: JSON.stringify({ concern: 'budget' }),
  })
}

beforeEach(() => {
  tight.mockReset().mockResolvedValue({ success: true, limit: 5, remaining: 4, reset: 0 })
  daily.mockReset().mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: RESET })
})

describe('scout discover rate limits', () => {
  it('the per-minute limit says so: 429 with code rate_limited', async () => {
    tight.mockResolvedValue({ success: false, limit: 5, remaining: 0, reset: 0 })
    const res = await POST(request(), { params: Promise.resolve({}) })
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'Too many requests', code: 'rate_limited' })
  })

  it('the daily limit says so, with its real reset and no "tomorrow"', async () => {
    daily.mockResolvedValue({ success: false, limit: 10, remaining: 0, reset: RESET })
    const res = await POST(request(), { params: Promise.resolve({}) })
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body).toEqual({ error: 'Daily AI usage limit reached.', code: 'daily_limit', reset: RESET })
    expect(JSON.stringify(body)).not.toMatch(/tomorrow/i)
  })
})
