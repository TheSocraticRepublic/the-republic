import { NextRequest } from 'next/server'
import {
  isFederationConfigured,
  actorUrl,
  AP_CONTEXT,
} from '@/lib/activitypub/context'
import { verifyHttpSignature } from '@/lib/activitypub/signatures'
import { deliverActivity, buildKeyId } from '@/lib/activitypub/delivery'
import { getOrCreateActorKeys } from '@/lib/activitypub/keys'
import { getDb } from '@/lib/db'
import { userProfiles, remoteFollowers } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { checkRateLimit } from '@/lib/rate-limit'

interface RouteContext {
  params: Promise<{ apHandle: string }>
}

/**
 * Fetches the public key PEM for a remote actor from their actor document.
 * Used to verify HTTP Signatures on incoming activities.
 */
async function fetchRemotePublicKey(actorUri: string): Promise<string | null> {
  try {
    const response = await fetch(actorUri, {
      headers: { Accept: 'application/activity+json' },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return null
    const actor = await response.json()
    return actor?.publicKey?.publicKeyPem ?? null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  if (!isFederationConfigured()) {
    return new Response(JSON.stringify({ error: 'Federation not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const { success } = await checkRateLimit(`ap-inbox:${ip}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { apHandle } = await params
  const db = getDb()

  // Verify the target user exists
  const profileRows = await db
    .select({ userId: userProfiles.userId, apHandle: userProfiles.apHandle })
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

  // Read body as text for signature verification
  const rawBody = await request.text()

  let activity: {
    type?: string
    id?: string
    actor?: string
    object?: unknown
  }
  try {
    activity = JSON.parse(rawBody)
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!activity.actor || typeof activity.actor !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing actor' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Fetch the remote actor's public key for signature verification
  const publicKeyPem = await fetchRemotePublicKey(activity.actor)
  if (!publicKeyPem) {
    return new Response(JSON.stringify({ error: 'Could not fetch actor public key' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Verify HTTP Signature
  const headersObj: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headersObj[key.toLowerCase()] = value
  })

  const signatureValid = await verifyHttpSignature({
    method: 'POST',
    url: request.url,
    headers: headersObj,
    body: rawBody,
    publicKeyPem,
  })

  if (!signatureValid) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Handle activity types
  const activityType = activity.type

  if (activityType === 'Follow') {
    await handleFollow(activity as FollowActivity, userId, apHandle)
  } else if (activityType === 'Undo') {
    const object = activity.object
    if (
      typeof object === 'object' &&
      object !== null &&
      (object as { type?: string }).type === 'Follow'
    ) {
      await handleUnfollow(activity.actor, userId)
    }
  }
  // Other activity types are accepted and ignored for Phase 1G

  // Respond 202 Accepted — we process asynchronously
  return new Response(null, { status: 202 })
}

interface FollowActivity {
  id?: string
  type: 'Follow'
  actor: string
  object?: unknown
}

async function handleFollow(
  activity: FollowActivity,
  localUserId: string,
  localApHandle: string
) {
  const db = getDb()
  const actorUri = activity.actor

  // Fetch the remote actor to get inbox details
  let actorInbox: string
  let sharedInbox: string | null = null
  let displayName: string | null = null

  try {
    const response = await fetch(actorUri, {
      headers: { Accept: 'application/activity+json' },
      signal: AbortSignal.timeout(5000),
    })
    if (response.ok) {
      const remoteActor = await response.json()
      actorInbox = remoteActor.inbox ?? actorUri
      sharedInbox = remoteActor?.endpoints?.sharedInbox ?? null
      displayName = remoteActor?.preferredUsername ?? remoteActor?.name ?? null
    } else {
      // Fall back: use actorUri as inbox (will likely fail but we store what we know)
      actorInbox = actorUri
    }
  } catch {
    actorInbox = actorUri
  }

  // Upsert the follower record
  try {
    await db
      .insert(remoteFollowers)
      .values({
        userId: localUserId,
        actorUri,
        actorInbox,
        sharedInbox,
        displayName,
      })
      .onConflictDoNothing()
  } catch (err) {
    console.error('[AP inbox] Failed to store remote follower', err)
  }

  // Deliver Accept activity back to the remote actor
  const { privateKeyPem } = await getOrCreateActorKeys(localUserId)
  const keyId = buildKeyId(localApHandle)
  const localActorUrl = actorUrl(localApHandle)
  const acceptId = `${localActorUrl}#accept-${Date.now()}`

  const accept = {
    '@context': AP_CONTEXT,
    id: acceptId,
    type: 'Accept',
    actor: localActorUrl,
    object: {
      id: activity.id,
      type: 'Follow',
      actor: actorUri,
      object: localActorUrl,
    },
  }

  // Fire-and-forget
  deliverActivity(accept, actorInbox, privateKeyPem, keyId).catch((err) => {
    console.error('[AP inbox] Failed to deliver Accept', err)
  })
}

async function handleUnfollow(actorUri: string, localUserId: string) {
  const db = getDb()
  try {
    await db
      .delete(remoteFollowers)
      .where(
        and(
          eq(remoteFollowers.userId, localUserId),
          eq(remoteFollowers.actorUri, actorUri)
        )
      )
  } catch (err) {
    console.error('[AP inbox] Failed to remove remote follower', err)
  }
}
