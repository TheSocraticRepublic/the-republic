import 'server-only'
import { generateKeyPair, exportPKCS8, exportSPKI } from 'jose'
import { getDb } from '@/lib/db'
import { actorKeys } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export interface ActorKeyPair {
  publicKeyPem: string
  privateKeyPem: string
}

/**
 * Generates an RSA-2048 key pair for use in HTTP Signatures.
 * RSA-2048 is used rather than Ed25519 because Mastodon and the majority
 * of the Fediverse only support rsa-sha256 (draft-cavage-http-signatures-12).
 */
export async function generateActorKeyPair(): Promise<ActorKeyPair> {
  const { publicKey, privateKey } = await generateKeyPair('RS256', {
    modulusLength: 2048,
    extractable: true,
  })

  const [publicKeyPem, privateKeyPem] = await Promise.all([
    exportSPKI(publicKey),
    exportPKCS8(privateKey),
  ])

  return { publicKeyPem, privateKeyPem }
}

/**
 * Returns the actor key pair for a user, generating and storing one lazily
 * if it does not yet exist. This handles both new users (keys generated at
 * profile creation) and existing users who predate Phase 1G.
 */
export async function getOrCreateActorKeys(userId: string): Promise<ActorKeyPair> {
  const db = getDb()

  const existing = await db
    .select({
      publicKeyPem: actorKeys.publicKeyPem,
      privateKeyPem: actorKeys.privateKeyPem,
    })
    .from(actorKeys)
    .where(eq(actorKeys.userId, userId))
    .limit(1)

  if (existing.length > 0) {
    return existing[0]
  }

  // Lazy generation for users who predate AP.
  // Use onConflictDoNothing() to handle concurrent inserts (race condition).
  // After insert, re-query to return whatever row is authoritative — whether
  // the insert succeeded or lost to a concurrent insert.
  const pair = await generateActorKeyPair()
  await db
    .insert(actorKeys)
    .values({
      userId,
      publicKeyPem: pair.publicKeyPem,
      privateKeyPem: pair.privateKeyPem,
    })
    .onConflictDoNothing()

  const authoritative = await db
    .select({
      publicKeyPem: actorKeys.publicKeyPem,
      privateKeyPem: actorKeys.privateKeyPem,
    })
    .from(actorKeys)
    .where(eq(actorKeys.userId, userId))
    .limit(1)

  if (authoritative.length === 0) {
    // Should never happen, but fail explicitly rather than silently
    throw new Error(`[AP keys] Failed to retrieve keys for user ${userId} after insert`)
  }

  return authoritative[0]
}
