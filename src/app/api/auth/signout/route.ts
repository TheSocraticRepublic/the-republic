import { NextRequest, NextResponse } from 'next/server'
import { AUTH_COOKIE } from '@/lib/auth/middleware'
import { env } from '@/lib/env'
import { checkRateLimit } from '@/lib/rate-limit'
import { safeRoute } from '@/lib/api/safe-route'

export const POST = safeRoute(async (request: NextRequest) => {
  const userId = request.headers.get('x-user-id') ?? 'anon'
  const { success } = await checkRateLimit(`signout:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const response = NextResponse.redirect(new URL('/', env.NEXT_PUBLIC_APP_URL))
  response.cookies.delete(AUTH_COOKIE)
  return response
})
