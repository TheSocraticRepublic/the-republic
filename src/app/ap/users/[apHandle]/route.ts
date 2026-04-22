import { NextRequest } from 'next/server'
import { isFederationConfigured } from '@/lib/activitypub/context'
import { buildActorJson } from '@/lib/activitypub/actor'
import { getOrCreateActorKeys } from '@/lib/activitypub/keys'
import { getDb } from '@/lib/db'
import { userProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { checkRateLimit } from '@/lib/rate-limit'

const AP_MEDIA_TYPES = ['application/activity+json', 'application/ld+json']

function wantsActivityJson(request: NextRequest): boolean {
  const accept = request.headers.get('accept') ?? ''
  return AP_MEDIA_TYPES.some((t) => accept.includes(t))
}

interface RouteContext {
  params: Promise<{ apHandle: string }>
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  if (!isFederationConfigured()) {
    return new Response(JSON.stringify({ error: 'Federation not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const { success } = await checkRateLimit(`ap-actor:${ip}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { apHandle } = await params

  const db = getDb()
  const rows = await db
    .select({
      apHandle: userProfiles.apHandle,
      displayName: userProfiles.displayName,
      bio: userProfiles.bio,
      avatarUrl: userProfiles.avatarUrl,
      userId: userProfiles.userId,
    })
    .from(userProfiles)
    .where(eq(userProfiles.apHandle, apHandle))
    .limit(1)

  if (rows.length === 0) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const profile = rows[0]

  // Content negotiation: AP clients get JSON-LD; browsers get redirected to the web UI
  if (!wantsActivityJson(request)) {
    return new Response(null, {
      status: 301,
      headers: { Location: `/u/${profile.displayName}` },
    })
  }

  const { publicKeyPem } = await getOrCreateActorKeys(profile.userId)

  const actor = buildActorJson(
    {
      apHandle: profile.apHandle!,
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
    },
    publicKeyPem
  )

  return new Response(JSON.stringify(actor), {
    status: 200,
    headers: {
      'Content-Type': 'application/activity+json',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
