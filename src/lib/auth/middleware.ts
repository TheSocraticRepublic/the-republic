import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyJWT } from './jwt'

export const AUTH_COOKIE = 'republic_token'

/**
 * Middleware handler for authenticated (app) routes.
 * Reads the JWT from the cookie and redirects to /login if missing or invalid.
 */
export async function withAuth(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(AUTH_COOKIE)?.value

  if (!token) {
    return redirectToLogin(request)
  }

  const payload = await verifyJWT(token)
  if (!payload) {
    return redirectToLogin(request)
  }

  // Pass user identity to downstream route handlers via request headers
  const headers = new Headers(request.headers)
  headers.set('x-user-id', payload.sub)
  headers.set('x-user-email', payload.email)

  return NextResponse.next({ request: { headers } })
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('redirect', request.nextUrl.pathname)
  return NextResponse.redirect(loginUrl)
}
