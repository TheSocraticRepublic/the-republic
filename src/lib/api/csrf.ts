import { NextRequest, NextResponse } from 'next/server'

/**
 * CSRF Origin check extracted from middleware for use in routes excluded
 * from the middleware matcher (e.g. /api/auth/*).
 *
 * Returns null if the request is allowed, or a 403 NextResponse to return.
 */
export function checkCsrfOrigin(request: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV === 'development') return null
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return null

  const origin = request.headers.get('origin')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!origin || !appUrl) {
    return new NextResponse(JSON.stringify({ error: 'Missing origin or app URL' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const allowed = new Set([new URL(appUrl).origin])
  const host = request.headers.get('host')
  if (host) allowed.add(`https://${host}`)
  if (!allowed.has(origin)) {
    return new NextResponse(JSON.stringify({ error: 'Invalid origin' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return null
}
