import { NextRequest } from 'next/server'
import {
  isFederationConfigured,
  actorUrl,
  AP_CONTEXT,
} from '@/lib/activitypub/context'
import { verifyHttpSignature } from '@/lib/activitypub/signatures'
import { deliverActivity, buildKeyId } from '@/lib/activitypub/delivery'
import { getOrCreateActorKeys } from '@/lib/activitypub/keys'
import { isValidFederationUrl } from '@/lib/activitypub/url-validation'
import { getDb } from '@/lib/db'
import { userProfiles, remoteFollowers } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { checkRateLimit } from '@/lib/rate-limit'

const MAX_REQUEST_AGE_MS = 12 * 60 * 60 * 1000  // 12 hours
const MAX_FUTURE_SKEW_MS = 60 * 60 * 1000         // 1 hour

interface RouteContext {
  params: Promise<{ apHandle: string }>
}

/**
 * Resolves the public key PEM for an incoming request, enforcing:
 *   1. SSRF protection — keyId base URL and actor URL must pass isValidFederationUrl
 *   2. keyId/actor cross-check — the actor derived from keyId must match activity.actor
 *   3. Key specificity — extracts the publicKey matching the full keyId (not just any key)
 *
 * Returns the PEM string on success, or null to signal rejection.
 */
async function resolveAndVerifyPublicKey(
  signatureHeader: string,
  activityActor: string
): Promise<string | null> {
  // Parse keyId from the Signature header
  const keyIdMatch = signatureHeader.match(/keyId="([^"]+)"/)
  if (!keyIdMatch) return null
  const keyId = keyIdMatch[1]

  // Derive the actor URL from keyId by stripping the #fragment
  const keyIdUrl = new URL(keyId)
  keyIdUrl.hash = ''
  const keyIdActorUrl = keyIdUrl.toString()

  // C-1: keyId-derived actor must match activity.actor
  if (keyIdActorUrl !== activityActor) {
    console.warn(
      `[AP inbox] keyId actor mismatch: keyId derived "${keyIdActorUrl}" != activity.actor "${activityActor}"`
    )
    return null
  }

  // C-2: SSRF — both the actor URL and keyId base must be valid federation URLs
  if (!isValidFederationUrl(keyIdActorUrl)) {
    console.warn('[AP inbox] Blocked SSRF via keyId actor URL:', keyIdActorUrl)
    return null
  }

  try {
    const response = await fetch(keyIdActorUrl, {
      headers: { Accept: 'application/activity+json' },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return null
    const actor = await response.json()

    // Extract the specific key matching the full keyId
    const publicKey = actor?.publicKey
    if (!publicKey) return null

    // publicKey may be an object or array — handle both
    if (Array.isArray(publicKey)) {
      const match = publicKey.find((k: { id?: string }) => k.id === keyId)
      return match?.publicKeyPem ?? null
    }

    // Single key object — verify its id matches the requested keyId
    if (publicKey.id && publicKey.id !== keyId) return null
    return publicKey?.publicKeyPem ?? null
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

  // N-3: extract first IP only — x-forwarded-for may be a comma-separated list
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
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

  // Collect headers once — used for both key resolution and signature verification
  const headersObj: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headersObj[key.toLowerCase()] = value
  })

  const rawSignatureHeader = headersObj['signature'] ?? ''

  // C-1 + C-2: Resolve public key with keyId/actor cross-check and SSRF protection
  const publicKeyPem = await resolveAndVerifyPublicKey(rawSignatureHeader, activity.actor)
  if (!publicKeyPem) {
    return new Response(JSON.stringify({ error: 'Could not fetch actor public key' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Verify HTTP Signature
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

  // W-1: Date freshness check — prevent replay attacks
  const dateHeader = headersObj['date']
  if (dateHeader) {
    const requestTime = new Date(dateHeader).getTime()
    if (!isNaN(requestTime)) {
      const now = Date.now()
      const age = now - requestTime
      if (age > MAX_REQUEST_AGE_MS) {
        return new Response(JSON.stringify({ error: 'Request too old' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (requestTime - now > MAX_FUTURE_SKEW_MS) {
        return new Response(JSON.stringify({ error: 'Request timestamp too far in future' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }
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

  // Fetch the remote actor to get inbox details.
  // C-2: actorUri has already been validated via resolveAndVerifyPublicKey; re-validate
  // here as defence-in-depth since handleFollow is called directly from POST.
  let actorInbox: string
  let sharedInbox: string | null = null
  let displayName: string | null = null

  if (!isValidFederationUrl(actorUri)) {
    console.warn('[AP inbox] Blocked Follow from invalid actor URL:', actorUri)
    return
  }

  try {
    const response = await fetch(actorUri, {
      headers: { Accept: 'application/activity+json' },
      signal: AbortSignal.timeout(5000),
    })
    if (response.ok) {
      const remoteActor = await response.json()
      const rawInbox: unknown = remoteActor.inbox ?? actorUri
      const rawSharedInbox: unknown = remoteActor?.endpoints?.sharedInbox ?? null

      // W-4: Validate inbox URLs before storing to prevent SSRF via stored data
      const inboxStr = typeof rawInbox === 'string' ? rawInbox : actorUri
      actorInbox = isValidFederationUrl(inboxStr) ? inboxStr : actorUri

      const sharedInboxStr = typeof rawSharedInbox === 'string' ? rawSharedInbox : null
      sharedInbox =
        sharedInboxStr !== null && isValidFederationUrl(sharedInboxStr)
          ? sharedInboxStr
          : null

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
