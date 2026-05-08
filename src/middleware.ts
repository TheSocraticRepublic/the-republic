import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/middleware'

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  )
  return response
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Public routes — no auth required
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/api/archive') ||
    pathname.startsWith('/archive') ||
    pathname.startsWith('/api/users/') ||
    pathname.startsWith('/u/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/landing') ||
    // ActivityPub / WebFinger — public by protocol.
    // Enumerated explicitly so that any new /ap/* routes require a conscious
    // decision to exempt from auth, rather than being public by default.
    pathname.startsWith('/.well-known/') ||
    pathname.startsWith('/ap/users/') ||
    pathname.startsWith('/ap/threads/') ||
    pathname.startsWith('/ap/posts/') ||
    pathname.startsWith('/ap/archive/')
  ) {
    return applySecurityHeaders(NextResponse.next())
  }

  // Root landing page is public
  if (pathname === '/') {
    return applySecurityHeaders(NextResponse.next())
  }

  // CSRF: reject cross-origin state-changing requests (skip in dev)
  if (
    process.env.NODE_ENV !== 'development' &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
  ) {
    const origin = request.headers.get('origin')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (origin && appUrl) {
      const allowed = new Set([new URL(appUrl).origin])
      const host = request.headers.get('host')
      if (host) allowed.add(`https://${host}`)
      if (!allowed.has(origin)) {
        return applySecurityHeaders(
          new NextResponse(
            JSON.stringify({ error: 'Invalid origin' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          )
        )
      }
    }
  }

  // DEV: bypass auth, inject a test user (requires explicit opt-in)
  if (process.env.NODE_ENV === 'development' && process.env.DEV_AUTH_BYPASS === 'true') {
    const headers = new Headers(request.headers)
    headers.set('x-user-id', '00000000-0000-0000-0000-000000000001')
    headers.set('x-user-email', 'dev@republic.local')
    headers.set('x-pathname', pathname)
    return applySecurityHeaders(NextResponse.next({ request: { headers } }))
  }

  // Everything under (app) requires auth
  return applySecurityHeaders(await withAuth(request))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
