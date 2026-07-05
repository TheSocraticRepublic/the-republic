import { checkRateLimit, checkTightRateLimit } from '@/lib/rate-limit'

/**
 * Forum create actions (thread, post, report) get a tighter rate limit for
 * low-credential accounts (effective weight below the threshold) to blunt
 * spam / sock-puppet floods, and the normal limit for established
 * contributors. Single source of truth for the tier decision across thread
 * creation, post creation, and report submission — do not re-inline this
 * ternary per route.
 */
export const FORUM_LOW_WEIGHT_THRESHOLD = 5

export function pickForumRateLimit(effectiveWeight: number) {
  return effectiveWeight < FORUM_LOW_WEIGHT_THRESHOLD ? checkTightRateLimit : checkRateLimit
}
