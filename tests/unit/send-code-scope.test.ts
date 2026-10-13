import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * send-code's 429s say which limit fired (B3a design fix, Razor DN2), so the
 * login page can name the real wait: per IP is 30 per sliding 60 s, the
 * global cap is a 5 minute window. The limiters and the code issuer are
 * stubbed; the route, its CSRF check and safeRoute are real.
 */

const APP_URL = 'http://127.0.0.1:3177'
process.env.NEXT_PUBLIC_APP_URL = APP_URL

const limits = { ip: true, global: true }
const sendMagicCode = vi.fn(async () => ({ sent: true as const }))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => ({ success: limits.ip })),
  checkGlobalSendCodeLimit: vi.fn(async () => ({ success: limits.global })),
}))
vi.mock('@/lib/auth/magic-code', () => ({ sendMagicCode }))

const { POST } = await import('@/app/api/auth/send-code/route')
const { NextRequest } = await import('next/server')

async function send() {
  const req = new NextRequest(`${APP_URL}/api/auth/send-code`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: APP_URL, 'x-nf-client-connection-ip': '203.0.113.10' },
    body: JSON.stringify({ email: 'qa-scope@example.test' }),
  })
  const res = await (POST as unknown as (r: typeof req) => Promise<Response>)(req)
  return { status: res.status, body: await res.json() }
}

describe('send-code 429 scope', () => {
  beforeEach(() => {
    limits.ip = true
    limits.global = true
    sendMagicCode.mockClear()
  })

  it('the per-IP limit answers 429 with scope "ip" and issues nothing', async () => {
    limits.ip = false
    const r = await send()
    expect(r.status).toBe(429)
    expect(r.body.scope).toBe('ip')
    expect(sendMagicCode).not.toHaveBeenCalled()
  })

  it('the global limit answers 429 with scope "global" and issues nothing', async () => {
    limits.global = false
    const r = await send()
    expect(r.status).toBe(429)
    expect(r.body.scope).toBe('global')
    expect(sendMagicCode).not.toHaveBeenCalled()
  })

  it('under both limits the code is issued and the response says it was sent', async () => {
    const r = await send()
    expect(r).toEqual({ status: 200, body: { ok: true, sent: true } })
    expect(sendMagicCode).toHaveBeenCalledWith('qa-scope@example.test')
  })
})
