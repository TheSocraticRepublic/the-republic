import { describe, it, expect } from 'vitest'
import {
  LOGGABLE_EVENTS,
  PROHIBITED_LOGGING,
  isLoggable,
  isProhibited,
} from '@/lib/privacy/logging-policy'

describe('isLoggable', () => {
  it('returns true for every event in LOGGABLE_EVENTS', () => {
    for (const event of LOGGABLE_EVENTS) {
      expect(isLoggable(event), `expected isLoggable("${event}") to be true`).toBe(true)
    }
  })

  it('returns false for every event in PROHIBITED_LOGGING', () => {
    for (const event of PROHIBITED_LOGGING) {
      expect(isLoggable(event), `expected isLoggable("${event}") to be false`).toBe(false)
    }
  })

  it('returns false for unknown events', () => {
    expect(isLoggable('unknown_event')).toBe(false)
    expect(isLoggable('')).toBe(false)
    expect(isLoggable('user_login')).toBe(false)
  })
})

describe('isProhibited', () => {
  it('returns true for every event in PROHIBITED_LOGGING', () => {
    for (const event of PROHIBITED_LOGGING) {
      expect(isProhibited(event), `expected isProhibited("${event}") to be true`).toBe(true)
    }
  })

  it('returns false for every event in LOGGABLE_EVENTS', () => {
    for (const event of LOGGABLE_EVENTS) {
      expect(isProhibited(event), `expected isProhibited("${event}") to be false`).toBe(false)
    }
  })

  it('returns false for unknown events', () => {
    expect(isProhibited('unknown_event')).toBe(false)
    expect(isProhibited('')).toBe(false)
    expect(isProhibited('page_view')).toBe(false)
  })
})

describe('LOGGABLE_EVENTS and PROHIBITED_LOGGING have no overlap', () => {
  it('no event appears in both sets', () => {
    const loggable = new Set<string>(LOGGABLE_EVENTS)
    const prohibited = new Set<string>(PROHIBITED_LOGGING)
    const overlap: string[] = []
    for (const event of loggable) {
      if (prohibited.has(event)) {
        overlap.push(event)
      }
    }
    expect(overlap).toHaveLength(0)
  })
})
