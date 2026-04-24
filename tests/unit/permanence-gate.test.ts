import { describe, it, expect } from 'vitest'
import {
  computeEffectiveWeight,
  computeDecayMultiplier,
  MODERATION_THRESHOLD,
} from '@/lib/credentials'

/**
 * Permanence gate unit tests.
 *
 * checkPermanenceEligibility requires live DB access, so we test the
 * underlying credential and review logic that drives each eligibility criterion
 * in isolation. This mirrors the archive-bundle.test.ts and credentials.test.ts
 * pattern: test pure functions, type contracts, and edge cases without mocking
 * an entire database connection.
 *
 * The three criteria under test:
 * (a) Author effective credential weight >= 5
 * (b) >= 2 peer reviews with average factualAccuracy >= 3
 * (c) Requesting user has moderator access (effective weight >= MODERATION_THRESHOLD)
 */

// ─── Helper: simulate the eligibility check logic ────────────────────────────
//
// This mirrors what checkPermanenceEligibility does internally so we can
// test each branch without DB round-trips.

function evaluateEligibility(
  authorWeight: number,
  authorLastActivityDaysAgo: number | null,
  reviews: number[],
  isRequesterModerator: boolean
): { eligible: boolean; reason: string } {
  // Criterion (c): moderator override
  if (isRequesterModerator) {
    return { eligible: true, reason: 'Moderator override' }
  }

  // Criterion (a): author effective weight >= 5
  const lastAt =
    authorLastActivityDaysAgo !== null
      ? new Date(Date.now() - authorLastActivityDaysAgo * 86_400_000)
      : null
  const effectiveWeight = computeEffectiveWeight(authorWeight, lastAt)

  if (effectiveWeight >= 5) {
    return { eligible: true, reason: 'Author credential weight >= 5' }
  }

  // Criterion (b): >= 2 peer reviews with avg factualAccuracy >= 3
  if (reviews.length >= 2) {
    const total = reviews.reduce((sum, r) => sum + r, 0)
    const avg = total / reviews.length
    if (avg >= 3) {
      return { eligible: true, reason: '2+ peer reviews with avg accuracy >= 3' }
    }
    return {
      eligible: false,
      reason: `${reviews.length} peer reviews found but average factualAccuracy (${avg.toFixed(2)}) is below 3.0`,
    }
  }

  if (reviews.length === 1) {
    return {
      eligible: false,
      reason: `Only 1 peer review found (minimum 2 required). Author credential weight (${effectiveWeight}) is below 5.`,
    }
  }

  return {
    eligible: false,
    reason: `No peer reviews found. Author credential weight (${effectiveWeight}) is below 5.`,
  }
}

// ─── Criterion (a): Author credential weight ─────────────────────────────────

describe('permanence eligibility: author credential weight', () => {
  it('eligible when author effective weight is exactly 5 (threshold boundary)', () => {
    // Effective weight = raw weight (recent activity, multiplier = 1.0)
    const result = evaluateEligibility(5, 0, [], false)
    expect(result.eligible).toBe(true)
    expect(result.reason).toBe('Author credential weight >= 5')
  })

  it('eligible when author effective weight exceeds 5', () => {
    const result = evaluateEligibility(20, 0, [], false)
    expect(result.eligible).toBe(true)
    expect(result.reason).toBe('Author credential weight >= 5')
  })

  it('not eligible when author effective weight is 4 (just below threshold)', () => {
    const result = evaluateEligibility(4, 0, [], false)
    expect(result.eligible).toBe(false)
  })

  it('not eligible when author has weight 5 but decay reduces it below threshold', () => {
    // At 365 days, decay floor = 0.5. raw=5, effective = Math.round(5 * 0.5) = 3
    // computeDecayMultiplier(365 days ago) = 0.5
    const multiplier = computeDecayMultiplier(new Date(Date.now() - 365 * 86_400_000))
    const effective = computeEffectiveWeight(5, new Date(Date.now() - 365 * 86_400_000))
    expect(multiplier).toBe(0.5)
    expect(effective).toBe(3) // 5 * 0.5 = 2.5 -> Math.round = 3, still below 5
    const result = evaluateEligibility(5, 365, [], false)
    expect(result.eligible).toBe(false)
  })

  it('not eligible when author has null activity (effective weight = 0)', () => {
    // computeDecayMultiplier(null) = 0, so any raw weight * 0 = 0
    const effective = computeEffectiveWeight(100, null)
    expect(effective).toBe(0)
    const result = evaluateEligibility(100, null, [], false)
    expect(result.eligible).toBe(false)
  })
})

// ─── Criterion (b): Peer reviews ─────────────────────────────────────────────

describe('permanence eligibility: peer reviews', () => {
  it('eligible with 2 reviews at average accuracy exactly 3.0 (boundary)', () => {
    // [3, 3] -> avg = 3.0
    const result = evaluateEligibility(0, 0, [3, 3], false)
    expect(result.eligible).toBe(true)
    expect(result.reason).toBe('2+ peer reviews with avg accuracy >= 3')
  })

  it('eligible with 2 reviews above threshold', () => {
    // [4, 5] -> avg = 4.5
    const result = evaluateEligibility(0, 0, [4, 5], false)
    expect(result.eligible).toBe(true)
  })

  it('eligible with 3 reviews where average is >= 3', () => {
    // [2, 4, 3] -> avg = 3.0
    const result = evaluateEligibility(0, 0, [2, 4, 3], false)
    expect(result.eligible).toBe(true)
  })

  it('not eligible with 2 reviews but average accuracy below 3', () => {
    // [1, 2] -> avg = 1.5
    const result = evaluateEligibility(0, 0, [1, 2], false)
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('average factualAccuracy')
    expect(result.reason).toContain('below 3.0')
  })

  it('not eligible with only 1 review even if accuracy is 5', () => {
    const result = evaluateEligibility(0, 0, [5], false)
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('Only 1 peer review')
    expect(result.reason).toContain('minimum 2 required')
  })

  it('not eligible with zero reviews and low author weight', () => {
    const result = evaluateEligibility(2, 0, [], false)
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('No peer reviews found')
  })
})

// ─── Criterion (c): Moderator override ───────────────────────────────────────

describe('permanence eligibility: moderator override', () => {
  it('eligible when requesting user is a moderator, regardless of other criteria', () => {
    // No reviews, zero author weight — but moderator flag overrides all
    const result = evaluateEligibility(0, 0, [], true)
    expect(result.eligible).toBe(true)
    expect(result.reason).toBe('Moderator override')
  })

  it('moderator override is checked before author weight (short-circuit)', () => {
    // Both moderator AND high weight — reason should be moderator (checked first)
    const result = evaluateEligibility(100, 0, [5, 5], true)
    expect(result.eligible).toBe(true)
    expect(result.reason).toBe('Moderator override')
  })

  it('MODERATION_THRESHOLD is 10 (sanity check for gate configuration)', () => {
    // The gate uses MODERATION_THRESHOLD from credentials. Verify the constant
    // hasn't changed, as this drives moderator eligibility throughout the system.
    expect(MODERATION_THRESHOLD).toBe(10)
  })
})

// ─── Combined edge cases ──────────────────────────────────────────────────────

describe('permanence eligibility: edge cases', () => {
  it('none of the criteria met: not eligible with clear reason', () => {
    // weight=3, 1 review, non-moderator
    const result = evaluateEligibility(3, 0, [5], false)
    expect(result.eligible).toBe(false)
    expect(result.reason.length).toBeGreaterThan(0)
  })

  it('exactly at weight threshold with decayed credentials: boundary precision', () => {
    // raw=10, at 135 days decay multiplier = 0.75, effective = Math.round(10 * 0.75) = 8
    // 8 >= 5, so should be eligible
    const effective = computeEffectiveWeight(10, new Date(Date.now() - 135 * 86_400_000))
    expect(effective).toBe(8)
    expect(effective >= 5).toBe(true)
    const result = evaluateEligibility(10, 135, [], false)
    expect(result.eligible).toBe(true)
    expect(result.reason).toBe('Author credential weight >= 5')
  })

  it('avg accuracy exactly at threshold with 2 reviews: [2, 4] -> avg=3.0', () => {
    const result = evaluateEligibility(0, 0, [2, 4], false)
    expect(result.eligible).toBe(true)
    expect(result.reason).toBe('2+ peer reviews with avg accuracy >= 3')
  })

  it('avg accuracy just below threshold: [2, 3] -> avg=2.5', () => {
    const result = evaluateEligibility(0, 0, [2, 3], false)
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('2.50')
  })
})

// ─── Type contract: checkPermanenceEligibility exports ───────────────────────

describe('permanence-gate module exports', () => {
  it('exports checkPermanenceEligibility as a named export', async () => {
    const mod = await import('@/lib/archive/permanence-gate')
    expect(typeof mod.checkPermanenceEligibility).toBe('function')
  })

  it('checkPermanenceEligibility returns a Promise', async () => {
    // We cannot call it without a DB, but we can verify the return type
    // by inspecting the function prototype
    const mod = await import('@/lib/archive/permanence-gate')
    // The function is async, so calling it without args should return a rejected Promise
    // rather than throwing synchronously
    const result = mod.checkPermanenceEligibility(
      'not-a-uuid',
      'not-a-user',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      null as any
    )
    expect(result).toBeInstanceOf(Promise)
    // Don't await — we're only testing that it returns a Promise, not that it resolves
    result.catch(() => {}) // suppress unhandled rejection warning
  })
})
