import { NextRequest } from 'next/server'
import {
  isFederationConfigured,
  followersUrl,
  AP_CONTEXT,
} from '@/lib/activitypub/context'
import { getDb } from '@/lib/db'
import { userProfiles, remoteFollowers } from '@/lib/db/schema'
import { eq, count } from 'drizzle-orm'
import { checkRateLimit } from '@/lib/rate-limit'

const PAGE_SIZE = 50

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

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { success } = await checkRateLimit(`ap-followers:${ip}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { apHandle } = await params
  const db = getDb()

  const profileRows = await db
    .select({ userId: userProfiles.userId })
    .from(userProfiles)
    .where(eq(userProfiles.apHandle, apHandle))
    .limit(1)

  if (profileRows.length === 0) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { userId } = profileRows[0]
  const followers = followersUrl(apHandle)

  const pageParam = request.nextUrl.searchParams.get('page')

  // Without ?page, return summary
  if (!pageParam) {
    const [countRows] = await db
      .select({ n: count() })
      .from(remoteFollowers)
      .where(eq(remoteFollowers.userId, userId))

    return new Response(
      JSON.stringify({
        '@context': AP_CONTEXT,
        id: followers,
        type: 'OrderedCollection',
        totalItems: Number(countRows?.n ?? 0),
        first: `${followers}?page=1`,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/activity+json',
          'Cache-Control': 'public, max-age=60',
        },
      }
    )
  }

  const page = Math.max(1, parseInt(pageParam, 10))
  const offset = (page - 1) * PAGE_SIZE

  const followerRows = await db
    .select({ actorUri: remoteFollowers.actorUri })
    .from(remoteFollowers)
    .where(eq(remoteFollowers.userId, userId))
    .limit(PAGE_SIZE)
    .offset(offset)

  const items = followerRows.map((r) => r.actorUri)
  const hasMore = items.length === PAGE_SIZE

  const collection: Record<string, unknown> = {
    '@context': AP_CONTEXT,
    id: `${followers}?page=${page}`,
    type: 'OrderedCollectionPage',
    partOf: followers,
    orderedItems: items,
  }
  if (hasMore) {
    collection.next = `${followers}?page=${page + 1}`
  }

  return new Response(JSON.stringify(collection), {
    status: 200,
    headers: {
      'Content-Type': 'application/activity+json',
      'Cache-Control': 'public, max-age=60',
    },
  })
}
