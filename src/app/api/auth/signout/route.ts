import { NextRequest, NextResponse } from 'next/server'
import { AUTH_COOKIE } from '@/lib/auth/middleware'
import { safeRoute } from '@/lib/api/safe-route'
import { checkCsrfOrigin } from '@/lib/api/csrf'

/*
 * Sign-out: expire the caller's own session cookie. Nothing else.
 *
 * No rate limit (Razor C3 W1). The old limiter keyed on `x-user-id`, which
 * this route never receives (the middleware matcher skips /api/auth/), so
 * every sign-out on the site shared one bucket, and one curl loop denied
 * sign-out to everyone. Keying by IP would still let a neighbour on the same
 * library or campus NAT spend a citizen's bucket, and the limiter fails
 * closed when Redis is down. The route touches no database, no Redis and no
 * email, and only ever affects the requester's own cookie, so there is
 * nothing for a limit to protect. The Origin check stays.
 *
 * The answer is 200 `{ signedOut: true }`, not a redirect (Razor C3 N1): the
 * client helper fetches with `redirect: 'manual'` and accepts only this body,
 * so a redirect from anywhere else (a platform rewrite, a middleware change)
 * can never read as a sign-out.
 */
export const POST = safeRoute(async (request: NextRequest) => {
  const csrfReject = checkCsrfOrigin(request)
  if (csrfReject) return csrfReject

  const response = NextResponse.json({ signedOut: true })
  response.cookies.delete(AUTH_COOKIE)
  return response
})
