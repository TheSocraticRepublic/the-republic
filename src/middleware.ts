import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/middleware'

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Public routes — no auth required
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // Root landing page is public
  if (pathname === '/') {
    return NextResponse.next()
  }

  // DEV: bypass auth, inject a test user
  if (process.env.NODE_ENV === 'development') {
    const headers = new Headers(request.headers)
    headers.set('x-user-id', '00000000-0000-0000-0000-000000000001')
    headers.set('x-user-email', 'dev@republic.local')
    return NextResponse.next({ request: { headers } })
  }

  // Everything under (app) requires auth
  return withAuth(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
