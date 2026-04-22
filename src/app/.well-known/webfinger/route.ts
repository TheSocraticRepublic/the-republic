import { NextRequest } from 'next/server'
import { isFederationConfigured, getApDomain } from '@/lib/activitypub/context'
import { parseWebfingerResource, buildWebfingerResponse } from '@/lib/activitypub/webfinger'
import { getDb } from '@/lib/db'
import { userProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  if (!isFederationConfigured()) {
    return new Response(JSON.stringify({ error: 'Federation not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const { success } = await checkRateLimit(`webfinger:${ip}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const apDomain = getApDomain()
  const resource = request.nextUrl.searchParams.get('resource')
  const handle = parseWebfingerResource(resource, apDomain)

  if (!handle) {
    return new Response(JSON.stringify({ error: 'Invalid or missing resource parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Look up the user by apHandle
  const db = getDb()
  const rows = await db
    .select({ apHandle: userProfiles.apHandle })
    .from(userProfiles)
    .where(eq(userProfiles.apHandle, handle))
    .limit(1)

  if (rows.length === 0) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const jrd = buildWebfingerResponse(handle, apDomain)

  return new Response(JSON.stringify(jrd), {
    status: 200,
    headers: {
      'Content-Type': 'application/jrd+json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
