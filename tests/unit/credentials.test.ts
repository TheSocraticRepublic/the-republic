import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import {
  computeDecayMultiplier,
  computeEffectiveWeight,
  CREDENTIAL_WEIGHTS,
  CREDENTIAL_LABELS,
  DECAY_GRACE_DAYS,
  DECAY_FLOOR,
  DECAY_FULL_DAYS,
  type CredentialType,
} from '@/lib/credentials'

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

// ─── computeDecayMultiplier ────────────────────────────────────────────────

describe('computeDecayMultiplier', () => {
  it('returns 0 for null lastActivityAt', () => {
    expect(computeDecayMultiplier(null)).toBe(0)
  })

  it('returns 1.0 for 0 days ago (just now)', () => {
    expect(computeDecayMultiplier(daysAgo(0))).toBe(1.0)
  })

  it('returns 1.0 for 89 days ago (within grace period)', () => {
    expect(computeDecayMultiplier(daysAgo(89))).toBe(1.0)
  })

  it('returns 1.0 for exactly 90 days ago (boundary of grace period)', () => {
    expect(computeDecayMultiplier(daysAgo(90))).toBe(1.0)
  })

  it('returns slightly below 1.0 for 91 days ago (just past grace period)', () => {
    const result = computeDecayMultiplier(daysAgo(91))
    expect(result).toBeLessThan(1.0)
    expect(result).toBeGreaterThan(DECAY_FLOOR)
  })

  it('returns 0.75 for 135 days ago (halfway through decay window)', () => {
    // At 135 days: daysSince=135, decayProgress=(135-90)/(180-90)=45/90=0.5
    // result = max(0.5, 1.0 - 0.5 * 0.5) = max(0.5, 0.75) = 0.75
    const result = computeDecayMultiplier(daysAgo(135))
    expect(result).toBeCloseTo(0.75, 10)
  })

  it('returns 0.5 (floor) for exactly 180 days ago', () => {
    // At 180 days: decayProgress=1, result = max(0.5, 1 - 1*0.5) = 0.5
    const result = computeDecayMultiplier(daysAgo(180))
    expect(result).toBeCloseTo(0.5, 10)
  })

  it('returns 0.5 (floor) for 365 days ago (well past full decay)', () => {
    const result = computeDecayMultiplier(daysAgo(365))
    expect(result).toBe(DECAY_FLOOR)
  })
})

// ─── computeEffectiveWeight ───────────────────────────────────────────────

describe('computeEffectiveWeight', () => {
  it('returns full weight when multiplier is 1.0 (recent activity)', () => {
    expect(computeEffectiveWeight(100, daysAgo(0))).toBe(100)
  })

  it('returns floor-decayed weight at 365 days (floor = 0.5)', () => {
    // 100 * 0.5 = 50, rounded = 50
    expect(computeEffectiveWeight(100, daysAgo(365))).toBe(50)
  })

  it('returns 0 for totalWeight 0 regardless of lastActivityAt', () => {
    expect(computeEffectiveWeight(0, daysAgo(0))).toBe(0)
    expect(computeEffectiveWeight(0, daysAgo(365))).toBe(0)
  })

  it('returns 0 for null lastActivityAt', () => {
    // computeDecayMultiplier(null) = 0, so 100 * 0 = 0
    expect(computeEffectiveWeight(100, null)).toBe(0)
  })

  it('rounds to nearest integer', () => {
    // At 135 days, multiplier = 0.75. 7 * 0.75 = 5.25 -> rounds to 5
    const result = computeEffectiveWeight(7, daysAgo(135))
    expect(result).toBe(5)
  })

  it('rounds 0.5 cases correctly using Math.round', () => {
    // At 135 days, multiplier = 0.75. 2 * 0.75 = 1.5 -> Math.round(1.5) = 2
    const result = computeEffectiveWeight(2, daysAgo(135))
    expect(result).toBe(2)
  })
})

// ─── CREDENTIAL_WEIGHTS ───────────────────────────────────────────────────

describe('CREDENTIAL_WEIGHTS', () => {
  const ALL_TYPES: CredentialType[] = [
    'investigation_completed',
    'foi_filed',
    'foi_response_shared',
    'campaign_used',
    'outcome_tracked',
    'forum_contribution',
    'peer_review',
    'jurisdiction_contributed',
    'code_contributed',
    'bug_report',
    'translation',
  ]

  it('defines weights for all 11 credential types', () => {
    expect(Object.keys(CREDENTIAL_WEIGHTS)).toHaveLength(11)
  })

  it.each(ALL_TYPES)('%s has a positive integer weight', (type) => {
    const weight = CREDENTIAL_WEIGHTS[type]
    expect(typeof weight).toBe('number')
    expect(weight).toBeGreaterThan(0)
    expect(Number.isInteger(weight)).toBe(true)
  })
})

// ─── CREDENTIAL_LABELS ────────────────────────────────────────────────────

describe('CREDENTIAL_LABELS', () => {
  const ALL_TYPES: CredentialType[] = [
    'investigation_completed',
    'foi_filed',
    'foi_response_shared',
    'campaign_used',
    'outcome_tracked',
    'forum_contribution',
    'peer_review',
    'jurisdiction_contributed',
    'code_contributed',
    'bug_report',
    'translation',
  ]

  it('defines labels for all 11 credential types', () => {
    expect(Object.keys(CREDENTIAL_LABELS)).toHaveLength(11)
  })

  it.each(ALL_TYPES)('%s has a non-empty string label', (type) => {
    const label = CREDENTIAL_LABELS[type]
    expect(typeof label).toBe('string')
    expect(label.trim().length).toBeGreaterThan(0)
  })
})

// ─── Constants sanity checks ─────────────────────────────────────────────

describe('decay constants', () => {
  it('DECAY_GRACE_DAYS is 90', () => {
    expect(DECAY_GRACE_DAYS).toBe(90)
  })

  it('DECAY_FLOOR is 0.5', () => {
    expect(DECAY_FLOOR).toBe(0.5)
  })

  it('DECAY_FULL_DAYS is 180 and greater than DECAY_GRACE_DAYS', () => {
    expect(DECAY_FULL_DAYS).toBe(180)
    expect(DECAY_FULL_DAYS).toBeGreaterThan(DECAY_GRACE_DAYS)
  })
})
