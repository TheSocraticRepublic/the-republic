import { NextResponse } from 'next/server'
import { AUTH_COOKIE } from '@/lib/auth/middleware'

export async function POST() {
  const response = NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'))
  response.cookies.delete(AUTH_COOKIE)
  return response
}
