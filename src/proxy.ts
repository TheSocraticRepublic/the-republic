import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/middleware'

export async function proxy(request: NextRequest): Promise<NextResponse> {
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

  // Everything under (app) requires auth
  return withAuth(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
