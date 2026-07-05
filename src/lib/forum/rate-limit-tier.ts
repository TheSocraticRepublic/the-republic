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

/** Coarse flood-breaker for forum WRITE endpoints. A cheap Redis gate applied
 *  BEFORE the credential lookup, so a flood is rejected without touching
 *  Postgres. Uses the NORMAL limit (the max any user is allowed), so it never
 *  rejects a legitimate request — it only bounds credential-lookup amplification
 *  under abuse to the normal per-window ceiling. */
export function checkForumWriteFlood(userId: string) {
  return checkRateLimit(`forum-write:${userId}`)
}
