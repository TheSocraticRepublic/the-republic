import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyJWT } from './jwt'

export const AUTH_COOKIE = 'republic_token'

/**
 * Middleware handler for authenticated (app) routes.
 * Reads the JWT from the cookie and redirects to /login if missing or invalid.
 */
export async function withAuth(
  request: NextRequest,
  opts: { rewriteTo?: URL } = {},
): Promise<NextResponse> {
  const token = request.cookies.get(AUTH_COOKIE)?.value

  if (!token) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      })
    }
    return redirectToLogin(request)
  }

  const payload = await verifyJWT(token)
  if (!payload) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      })
    }
    return redirectToLogin(request)
  }

  // Pass user identity and current path to downstream route handlers via request headers
  const headers = new Headers(request.headers)
  headers.set('x-user-id', payload.sub)
  headers.set('x-user-email', payload.email)
  headers.set('x-pathname', request.nextUrl.pathname)
  // The query too, always overwritten (a client cannot supply its own): the
  // (app) layout carries an Investigate handoff through onboarding with it
  // (UI plan C4, Razor W2). Readers validate what they take from it.
  headers.set('x-search', request.nextUrl.search)

  // An authenticated request may be served from another route (the gated
  // Forum, src/middleware.ts) with the same identity headers.
  if (opts.rewriteTo) return NextResponse.rewrite(opts.rewriteTo, { request: { headers } })
  return NextResponse.next({ request: { headers } })
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('redirect', request.nextUrl.pathname)
  return NextResponse.redirect(loginUrl)
}
