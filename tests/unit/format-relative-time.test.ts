import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatRelativeTime } from '@/lib/format-relative-time'

// Pin Date.now() to a known point so relative calculations are deterministic
const NOW = new Date('2026-04-20T12:00:00Z').getTime()

afterEach(() => {
  vi.restoreAllMocks()
})

function nowMinus(ms: number): Date {
  return new Date(NOW - ms)
}

function withNow(fn: () => void) {
  vi.spyOn(Date, 'now').mockReturnValue(NOW)
  fn()
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const MONTH = 30 * DAY
const YEAR = 365 * DAY

describe('formatRelativeTime', () => {
  it('returns "just now" for 0 seconds ago', () => {
    withNow(() => {
      expect(formatRelativeTime(nowMinus(0))).toBe('just now')
    })
  })

  it('returns "just now" for 59 seconds ago', () => {
    withNow(() => {
      expect(formatRelativeTime(nowMinus(59 * SECOND))).toBe('just now')
    })
  })

  it('returns "1 minute ago" for exactly 60 seconds ago', () => {
    withNow(() => {
      expect(formatRelativeTime(nowMinus(60 * SECOND))).toBe('1 minute ago')
    })
  })

  it('returns "5 minutes ago" for 5 minutes', () => {
    withNow(() => {
      expect(formatRelativeTime(nowMinus(5 * MINUTE))).toBe('5 minutes ago')
    })
  })

  it('returns "59 minutes ago" at the upper boundary of minutes', () => {
    withNow(() => {
      expect(formatRelativeTime(nowMinus(59 * MINUTE))).toBe('59 minutes ago')
    })
  })

  it('returns "1 hour ago" for exactly 60 minutes ago', () => {
    withNow(() => {
      expect(formatRelativeTime(nowMinus(60 * MINUTE))).toBe('1 hour ago')
    })
  })

  it('returns "3 hours ago" for 3 hours', () => {
    withNow(() => {
      expect(formatRelativeTime(nowMinus(3 * HOUR))).toBe('3 hours ago')
    })
  })

  it('returns "23 hours ago" at the upper boundary of hours', () => {
    withNow(() => {
      expect(formatRelativeTime(nowMinus(23 * HOUR))).toBe('23 hours ago')
    })
  })

  it('returns "1 day ago" for exactly 24 hours', () => {
    withNow(() => {
      expect(formatRelativeTime(nowMinus(24 * HOUR))).toBe('1 day ago')
    })
  })

  it('returns "7 days ago" for one week', () => {
    withNow(() => {
      expect(formatRelativeTime(nowMinus(7 * DAY))).toBe('7 days ago')
    })
  })

  it('returns "30 days ago" at the boundary of days range', () => {
    withNow(() => {
      expect(formatRelativeTime(nowMinus(30 * DAY))).toBe('30 days ago')
    })
  })

  it('returns "1 month ago" for 31 days ago', () => {
    withNow(() => {
      expect(formatRelativeTime(nowMinus(31 * DAY))).toBe('1 month ago')
    })
  })

  it('returns "6 months ago" for 6 months', () => {
    withNow(() => {
      expect(formatRelativeTime(nowMinus(6 * MONTH))).toBe('6 months ago')
    })
  })

  it('returns "11 months ago" at the upper boundary of months', () => {
    withNow(() => {
      expect(formatRelativeTime(nowMinus(11 * MONTH))).toBe('11 months ago')
    })
  })

  it('returns "1 year ago" for 12 months', () => {
    withNow(() => {
      expect(formatRelativeTime(nowMinus(12 * MONTH))).toBe('1 year ago')
    })
  })

  it('returns "2 years ago" for approximately 2 years', () => {
    withNow(() => {
      expect(formatRelativeTime(nowMinus(2 * YEAR))).toBe('2 years ago')
    })
  })

  it('accepts a string date', () => {
    withNow(() => {
      const dateString = nowMinus(5 * MINUTE).toISOString()
      expect(formatRelativeTime(dateString)).toBe('5 minutes ago')
    })
  })

  it('accepts a Date object', () => {
    withNow(() => {
      const date = nowMinus(2 * HOUR)
      expect(formatRelativeTime(date)).toBe('2 hours ago')
    })
  })
})
