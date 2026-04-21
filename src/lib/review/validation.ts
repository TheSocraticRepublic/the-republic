import { stripHtmlTags } from '@/lib/profile/validation'

export const REVIEW_SCORE_MIN = 1
export const REVIEW_SCORE_MAX = 5
export const REVIEW_SUMMARY_MAX = 2000
export const REVIEW_DIMENSIONS = [
  'factualAccuracy',
  'sourceQuality',
  'missingContext',
  'strategicEffectiveness',
  'jurisdictionalAccuracy',
] as const
export type ReviewDimension = (typeof REVIEW_DIMENSIONS)[number]

export function validateReviewScore(score: unknown): { valid: boolean; error?: string } {
  if (typeof score !== 'number') {
    return { valid: false, error: 'Score must be a number' }
  }
  if (!Number.isInteger(score)) {
    return { valid: false, error: 'Score must be an integer' }
  }
  if (score < REVIEW_SCORE_MIN) {
    return { valid: false, error: `Score must be at least ${REVIEW_SCORE_MIN}` }
  }
  if (score > REVIEW_SCORE_MAX) {
    return { valid: false, error: `Score must be at most ${REVIEW_SCORE_MAX}` }
  }
  return { valid: true }
}

export function validateReviewScores(
  scores: Record<string, unknown>
): { valid: boolean; error?: string } {
  for (const dim of REVIEW_DIMENSIONS) {
    if (!(dim in scores)) {
      return { valid: false, error: `Missing required dimension: ${dim}` }
    }
    const result = validateReviewScore(scores[dim])
    if (!result.valid) {
      return { valid: false, error: `Invalid score for ${dim}: ${result.error}` }
    }
  }
  return { valid: true }
}

export function validateReviewSummary(summary: string): { valid: boolean; error?: string } {
  const stripped = stripHtmlTags(summary)
  if (stripped.length > REVIEW_SUMMARY_MAX) {
    return {
      valid: false,
      error: `Summary must be ${REVIEW_SUMMARY_MAX} characters or fewer`,
    }
  }
  return { valid: true }
}
