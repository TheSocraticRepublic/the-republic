/**
 * Date freshness guard for ActivityPub inbox requests.
 *
 * Extracted as a pure helper so it can be unit-tested without mocking the
 * full Next.js route. The route imports and calls validateApDateHeader().
 *
 * Rejects:
 *   - missing Date header
 *   - malformed/unparseable Date header (isNaN guard — security-critical,
 *     closes a replay-window bypass where invalid dates would yield NaN and
 *     pass the age/skew comparisons)
 *   - requests older than MAX_REQUEST_AGE_MS (replay protection)
 *   - requests with timestamps too far in the future (clock-skew protection)
 */

export const MAX_REQUEST_AGE_MS = 12 * 60 * 60 * 1000 // 12 hours
export const MAX_FUTURE_SKEW_MS = 60 * 60 * 1000// 1 hour

export type DateGuardResult =
  | { ok: true }
  | { ok: false; status: 401; error: string }

/**
 * Validates the Date header of an incoming AP request.
 *
 * @param dateHeader - the raw value of the Date header (or undefined if absent)
 * @param now - current epoch ms (injectable for testing; defaults to Date.now())
 */
export function validateApDateHeader(
  dateHeader: string | undefined | null,
  now: number = Date.now()
): DateGuardResult {
  if (!dateHeader) {
    return { ok: false, status: 401, error: 'Date header required' }
  }

  const requestTime = new Date(dateHeader).getTime()
  if (isNaN(requestTime)) {
    return { ok: false, status: 401, error: 'Invalid Date header' }
  }

  const age = now - requestTime
  if (age > MAX_REQUEST_AGE_MS) {
    return { ok: false, status: 401, error: 'Request too old' }
  }

  if (requestTime - now > MAX_FUTURE_SKEW_MS) {
    return { ok: false, status: 401, error: 'Request timestamp too far in future' }
  }

  return { ok: true }
}
