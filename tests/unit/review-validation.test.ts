import { describe, it, expect } from 'vitest'
import {
  validateReviewScore,
  validateReviewScores,
  validateReviewSummary,
  REVIEW_SUMMARY_MAX,
} from '@/lib/review/validation'

describe('validateReviewScore', () => {
  it('accepts valid scores 1 through 5', () => {
    expect(validateReviewScore(1).valid).toBe(true)
    expect(validateReviewScore(2).valid).toBe(true)
    expect(validateReviewScore(3).valid).toBe(true)
    expect(validateReviewScore(4).valid).toBe(true)
    expect(validateReviewScore(5).valid).toBe(true)
  })

  it('rejects 0 (below minimum)', () => {
    const result = validateReviewScore(0)
    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('rejects 6 (above maximum)', () => {
    const result = validateReviewScore(6)
    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('rejects negative values', () => {
    expect(validateReviewScore(-1).valid).toBe(false)
  })

  it('rejects non-integer floats', () => {
    const result = validateReviewScore(3.5)
    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('rejects null', () => {
    expect(validateReviewScore(null).valid).toBe(false)
  })

  it('rejects undefined', () => {
    expect(validateReviewScore(undefined).valid).toBe(false)
  })

  it('rejects string "3"', () => {
    expect(validateReviewScore('3').valid).toBe(false)
  })
})

describe('validateReviewScores', () => {
  const validScores = {
    factualAccuracy: 4,
    sourceQuality: 3,
    missingContext: 5,
    strategicEffectiveness: 2,
    jurisdictionalAccuracy: 4,
  }

  it('accepts all five valid dimensions', () => {
    expect(validateReviewScores(validScores).valid).toBe(true)
  })

  it('rejects when a dimension is missing', () => {
    const { factualAccuracy: _omit, ...partial } = validScores
    const result = validateReviewScores(partial as Record<string, unknown>)
    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('rejects when only 3 of 5 dimensions are present', () => {
    const partial = {
      factualAccuracy: 3,
      sourceQuality: 4,
      missingContext: 2,
    }
    const result = validateReviewScores(partial)
    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('rejects when a score value is invalid', () => {
    const invalid = { ...validScores, factualAccuracy: 0 }
    const result = validateReviewScores(invalid)
    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
  })
})

describe('validateReviewSummary', () => {
  it('accepts empty string', () => {
    expect(validateReviewSummary('').valid).toBe(true)
  })

  it('accepts summary at exactly 2000 characters', () => {
    const summary = 'x'.repeat(REVIEW_SUMMARY_MAX)
    expect(validateReviewSummary(summary).valid).toBe(true)
  })

  it('rejects summary at 2001 characters', () => {
    const summary = 'x'.repeat(REVIEW_SUMMARY_MAX + 1)
    const result = validateReviewSummary(summary)
    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('strips HTML before measuring length — 2001 visible chars rejected', () => {
    // Wrap 2001 x's in a tag — still 2001 visible chars after strip
    const summary = `<p>${'x'.repeat(REVIEW_SUMMARY_MAX + 1)}</p>`
    expect(validateReviewSummary(summary).valid).toBe(false)
  })

  it('strips HTML before measuring length — tag overhead does not inflate count', () => {
    // 2000 visible chars with HTML wrapper — should still be valid
    const summary = `<p>${'x'.repeat(REVIEW_SUMMARY_MAX)}</p>`
    expect(validateReviewSummary(summary).valid).toBe(true)
  })
})
