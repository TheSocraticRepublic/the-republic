import { describe, it, expect } from 'vitest'
import { getClientIp } from '@/lib/api/ip'

/**
 * Minimal stand-in for the subset of the Fetch API `Headers` interface
 * `getClientIp` depends on. Case-insensitive lookup mirrors real `Headers`
 * behaviour (header names arrive lowercased over HTTP/2 and Next.js
 * normalizes to lowercase either way, but we don't want the test to rely
 * on that incidentally).
 */
function mockRequest(headers: Record<string, string>): {
  headers: { get(name: string): string | null }
} {
  return {
    headers: {
      get(name: string) {
        const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase())
        return key !== undefined ? headers[key] : null
      },
    },
  }
}

describe('getClientIp — precedence (SEC-1)', () => {
  it('prefers x-nf-client-connection-ip over everything else', () => {
    const req = mockRequest({
      'x-nf-client-connection-ip': '203.0.113.1',
      'x-real-ip': '203.0.113.2',
      'x-forwarded-for': '203.0.113.3, 203.0.113.4',
    })
    expect(getClientIp(req)).toBe('203.0.113.1')
  })

  it('falls back to x-real-ip when x-nf-client-connection-ip is absent', () => {
    const req = mockRequest({
      'x-real-ip': '203.0.113.2',
      'x-forwarded-for': '203.0.113.3, 203.0.113.4',
    })
    expect(getClientIp(req)).toBe('203.0.113.2')
  })

  it('falls back to the LAST x-forwarded-for hop when neither trusted header is present', () => {
    const req = mockRequest({
      'x-forwarded-for': '203.0.113.3, 203.0.113.4, 203.0.113.5',
    })
    expect(getClientIp(req)).toBe('203.0.113.5')
  })

  it('does NOT take the first x-forwarded-for hop — that hop is client-controllable', () => {
    // A client can set X-Forwarded-For to anything on the initial request;
    // only hops appended by trusted infra downstream of the client are
    // safe to trust. Taking split(',')[0] (the old behaviour) let any
    // caller spoof their rate-limit bucket by sending a chosen first hop.
    const req = mockRequest({
      'x-forwarded-for': 'attacker-chosen-spoof, 203.0.113.9',
    })
    expect(getClientIp(req)).not.toBe('attacker-chosen-spoof')
    expect(getClientIp(req)).toBe('203.0.113.9')
  })

  it('trims whitespace and ignores a trailing empty hop', () => {
    const req = mockRequest({
      'x-forwarded-for': '203.0.113.3,  203.0.113.6 , ',
    })
    expect(getClientIp(req)).toBe('203.0.113.6')
  })

  it('single x-forwarded-for hop is used when it is the only signal', () => {
    const req = mockRequest({ 'x-forwarded-for': '203.0.113.7' })
    expect(getClientIp(req)).toBe('203.0.113.7')
  })
})

describe('getClientIp — no-header fallback (C2, per-request isolation)', () => {
  it('returns a value even when no IP headers are present', () => {
    const req = mockRequest({})
    expect(getClientIp(req)).toBeTruthy()
  })

  it('does NOT return a shared constant like "unknown"', () => {
    const req = mockRequest({})
    expect(getClientIp(req)).not.toBe('unknown')
  })

  it('returns a DIFFERENT value on every call — not a fixed fallback string', () => {
    const first = getClientIp(mockRequest({}))
    const second = getClientIp(mockRequest({}))
    expect(first).not.toBe(second)
  })

  it('isolates every no-header request into its own bucket across many calls', () => {
    const values = new Set(Array.from({ length: 50 }, () => getClientIp(mockRequest({}))))
    expect(values.size).toBe(50)
  })

  it('also isolates per-request when x-forwarded-for is present but empty', () => {
    // An empty XFF header (or one that reduces to zero hops after
    // trimming) must hit the same per-request fallback as no header at
    // all — never fall through to a shared constant.
    const first = getClientIp(mockRequest({ 'x-forwarded-for': '' }))
    const second = getClientIp(mockRequest({ 'x-forwarded-for': ' , ,' }))
    expect(first).not.toBe(second)
    expect(first).not.toBe('unknown')
    expect(second).not.toBe('unknown')
  })
})
