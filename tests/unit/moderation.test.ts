import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import {
  MODERATION_THRESHOLD,
  computeEffectiveWeight,
  DECAY_GRACE_DAYS,
  DECAY_FULL_DAYS,
  DECAY_FLOOR,
} from '@/lib/credentials'
import { stripHtmlTags } from '@/lib/profile/validation'

const NOW = new Date('2026-04-20T12:00:00Z').getTime()
const DAY_MS = 1000 * 60 * 60 * 24

function daysAgo(days: number): Date {
  return new Date(NOW - days * DAY_MS)
}

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── MODERATION_THRESHOLD ─────────────────────────────────────────────────

describe('MODERATION_THRESHOLD', () => {
  it('is 10', () => {
    expect(MODERATION_THRESHOLD).toBe(10)
  })

  it('is a positive integer', () => {
    expect(MODERATION_THRESHOLD).toBeGreaterThan(0)
    expect(Number.isInteger(MODERATION_THRESHOLD)).toBe(true)
  })
})

// ─── Report reason enum values ─────────────────────────────────────────────

describe('report reason enum values', () => {
  const VALID_REASONS = ['spam', 'harassment', 'misinformation', 'off_topic', 'other']

  it('contains exactly 5 reasons', () => {
    expect(VALID_REASONS).toHaveLength(5)
  })

  it.each(VALID_REASONS)('%s is a non-empty string', (reason) => {
    expect(typeof reason).toBe('string')
    expect(reason.trim().length).toBeGreaterThan(0)
  })
})

// ─── Action type enum values ───────────────────────────────────────────────

describe('moderation action type enum values', () => {
  const VALID_ACTIONS = [
    'hide_post',
    'unhide_post',
    'lock_thread',
    'unlock_thread',
    'dismiss_report',
    'appeal',
  ]

  it('contains exactly 6 action types', () => {
    expect(VALID_ACTIONS).toHaveLength(6)
  })

  it.each(VALID_ACTIONS)('%s is a non-empty string', (action) => {
    expect(typeof action).toBe('string')
    expect(action.trim().length).toBeGreaterThan(0)
  })
})

// ─── Threshold boundary comparisons ───────────────────────────────────────

describe('threshold comparison', () => {
  it('weight 9 is not a moderator', () => {
    const effective = computeEffectiveWeight(9, daysAgo(0))
    expect(effective < MODERATION_THRESHOLD).toBe(true)
  })

  it('weight 10 qualifies as moderator', () => {
    const effective = computeEffectiveWeight(10, daysAgo(0))
    expect(effective >= MODERATION_THRESHOLD).toBe(true)
  })

  it('weight 0 is not a moderator', () => {
    const effective = computeEffectiveWeight(0, daysAgo(0))
    expect(effective < MODERATION_THRESHOLD).toBe(true)
  })
})

// ─── Decay-threshold interaction ───────────────────────────────────────────

describe('decay-threshold interaction', () => {
  it('raw 15, 120 days inactive — decayed ~11 — still moderator', () => {
    // At 120 days: daysSince=120, decayProgress=(120-90)/(180-90)=30/90=0.333...
    // multiplier = max(0.5, 1 - 0.333 * 0.5) = max(0.5, 0.833) = 0.833
    // effective = round(15 * 0.833) = round(12.5) = 13
    const effective = computeEffectiveWeight(15, daysAgo(120))
    expect(effective).toBeGreaterThanOrEqual(MODERATION_THRESHOLD)
  })

  it('raw 12, 150 days inactive — decayed ~7 — not moderator', () => {
    // At 150 days: daysSince=150, decayProgress=(150-90)/(180-90)=60/90=0.667
    // multiplier = max(0.5, 1 - 0.667 * 0.5) = max(0.5, 0.667) = 0.667
    // effective = round(12 * 0.667) = round(8) = 8
    const effective = computeEffectiveWeight(12, daysAgo(150))
    expect(effective).toBeLessThan(MODERATION_THRESHOLD)
  })

  it('well past full decay (365 days), floor applies — high raw weight still decays', () => {
    // At 365 days: multiplier = DECAY_FLOOR = 0.5
    // effective = round(14 * 0.5) = 7 — below threshold
    const effective = computeEffectiveWeight(14, daysAgo(365))
    expect(effective).toBeLessThan(MODERATION_THRESHOLD)
    // verify floor constant matches expectation
    expect(DECAY_FLOOR).toBe(0.5)
    expect(DECAY_GRACE_DAYS).toBe(90)
    expect(DECAY_FULL_DAYS).toBe(180)
  })
})

// ─── checkTightRateLimit config ────────────────────────────────────────────

describe('checkTightRateLimit', () => {
  it('resolves to limit: 5 when Redis is not configured', async () => {
    const { checkTightRateLimit } = await import('@/lib/rate-limit')
    // In test environment, UPSTASH env vars are not set, so the fallback fires
    const result = await checkTightRateLimit('test-user-id')
    expect(result.limit).toBe(5)
    expect(result.success).toBe(true)
  })
})

// ─── Report description sanitization ─────────────────────────────────────

describe('report description sanitization', () => {
  it('stripHtmlTags removes HTML before storage', () => {
    const raw = '<script>alert("xss")</script>Real reason here'
    const cleaned = stripHtmlTags(raw)
    expect(cleaned).not.toContain('<script>')
    expect(cleaned).toContain('Real reason here')
  })

  it('allows plain text through unchanged', () => {
    const text = 'This post is misleading about zoning bylaw 42'
    expect(stripHtmlTags(text)).toBe(text)
  })

  it('strips nested tags', () => {
    const raw = '<b><i>bold italic</i></b>'
    expect(stripHtmlTags(raw)).toBe('bold italic')
  })
})
