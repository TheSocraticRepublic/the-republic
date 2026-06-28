import { describe, it, expect } from 'vitest'
import {
  validateApDateHeader,
  MAX_REQUEST_AGE_MS,
  MAX_FUTURE_SKEW_MS,
} from '@/lib/activitypub/date-guard'

const NOW = 1_700_000_000_000 // fixed epoch ms for deterministic tests

describe('validateApDateHeader', () => {
  it('accepts a valid date within the freshness window', () => {
    const date = new Date(NOW - 60_000).toUTCString() // 1 minute ago
    expect(validateApDateHeader(date, NOW)).toEqual({ ok: true })
  })

  it('rejects a missing Date header', () => {
    const result = validateApDateHeader(undefined, NOW)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
      expect(result.error).toBe('Date header required')
    }
  })

  it('rejects a null Date header', () => {
    const result = validateApDateHeader(null, NOW)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('Date header required')
  })

  it('rejects a malformed Date header (isNaN guard — replay bypass closure)', () => {
    // Security-critical: a non-parseable date yields NaN; without the isNaN
    // guard the age/skew checks both evaluate to NaN which is never > threshold,
    // allowing the request through. The guard must catch this.
    const result = validateApDateHeader('not-a-date', NOW)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
      expect(result.error).toBe('Invalid Date header')
    }
  })

  it('rejects an empty string Date header', () => {
    const result = validateApDateHeader('', NOW)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('Date header required')
  })

  it('accepts a Date header exactly at the age limit (strict > comparison)', () => {
    // The guard uses age > MAX_REQUEST_AGE_MS (strict greater-than), so
    // a request that is exactly MAX_REQUEST_AGE_MS old is still accepted.
    const date = new Date(NOW - MAX_REQUEST_AGE_MS).toUTCString()
    expect(validateApDateHeader(date, NOW)).toEqual({ ok: true })
  })

  it('rejects a request older than the 12-hour window', () => {
    const date = new Date(NOW - MAX_REQUEST_AGE_MS - 1_000).toUTCString()
    const result = validateApDateHeader(date, NOW)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
      expect(result.error).toBe('Request too old')
    }
  })

  it('accepts a request 1 ms before the age limit', () => {
    const date = new Date(NOW - MAX_REQUEST_AGE_MS + 1).toUTCString()
    expect(validateApDateHeader(date, NOW)).toEqual({ ok: true })
  })

  it('rejects a timestamp too far in the future', () => {
    const date = new Date(NOW + MAX_FUTURE_SKEW_MS + 1_000).toUTCString()
    const result = validateApDateHeader(date, NOW)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
      expect(result.error).toBe('Request timestamp too far in future')
    }
  })

  it('accepts a timestamp within the future skew allowance', () => {
    const date = new Date(NOW + MAX_FUTURE_SKEW_MS - 1_000).toUTCString()
    expect(validateApDateHeader(date, NOW)).toEqual({ ok: true })
  })
})
