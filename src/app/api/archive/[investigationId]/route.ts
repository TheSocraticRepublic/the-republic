import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import {
  archiveRecords,
  investigations,
  credentialEvents,
} from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { checkRateLimit } from '@/lib/rate-limit'
import { checkModeratorAccess } from '@/lib/credentials/check-moderator'
import { CREDENTIAL_WEIGHTS } from '@/lib/credentials'
import { buildArchiveBundle } from '@/lib/archive/bundle'
import { computeContentHash } from '@/lib/archive/hash'
import { pinInvestigation, isPinataConfigured } from '@/lib/archive/ipfs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ investigationId: string }> }
) {
  // Auth required
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { investigationId } = await params

  // Rate limit
  const { success } = await checkRateLimit(`archive:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Pinata must be configured
  if (!isPinataConfigured()) {
    return new Response(
      JSON.stringify({
        error: 'Archiving service not configured. Contact the administrator.',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  const db = getDb()

  // Fetch the investigation — verify it exists
  const [investigation] = await db
    .select({
      id: investigations.id,
      userId: investigations.userId,
      preservedAt: investigations.preservedAt,
    })
    .from(investigations)
    .where(eq(investigations.id, investigationId))
    .limit(1)

  if (!investigation) {
    return new Response(JSON.stringify({ error: 'Investigation not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Caller must own the investigation OR have moderator access
  if (investigation.userId !== userId) {
    const { isModerator } = await checkModeratorAccess(userId)
    if (!isModerator) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  // Build the bundle
  let bundle
  try {
    bundle = await buildArchiveBundle(investigationId, db)
  } catch (err) {
    console.error('Failed to build archive bundle', investigationId, err)
    return new Response(JSON.stringify({ error: 'Failed to build archive bundle' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Set the archiver
  bundle.provenance.archiverId = userId

  // Compute content hash
  const contentHash = computeContentHash(bundle)

  // Pin to IPFS
  let ipfsCid: string
  try {
    ipfsCid = await pinInvestigation(bundle, contentHash)
  } catch (err) {
    console.error('Failed to pin investigation to IPFS', investigationId, err)
    return new Response(JSON.stringify({ error: 'Failed to pin to IPFS' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const now = new Date()

  // Determine if this is a new archive or a re-archive (for status code)
  const [existing] = await db
    .select({ id: archiveRecords.id })
    .from(archiveRecords)
    .where(eq(archiveRecords.investigationId, investigationId))
    .limit(1)

  const isNewArchive = !existing

  // UPSERT the archive record
  const [archiveRecord] = await db
    .insert(archiveRecords)
    .values({
      investigationId,
      userId,
      archiveStatus: 'ipfs_pinned',
      ipfsCid,
      contentHash,
      preservedAt: now,
      metadata: { bundleVersion: bundle.version, republicVersion: bundle.republicVersion },
    })
    .onConflictDoUpdate({
      target: archiveRecords.investigationId,
      set: {
        ipfsCid,
        contentHash,
        archiveStatus: 'ipfs_pinned',
        preservedAt: now,
        updatedAt: sql`NOW()`,
      },
    })
    .returning()

  // Set investigations.preservedAt on first archive (COALESCE: only when null)
  await db
    .update(investigations)
    .set({
      preservedAt: sql`COALESCE(${investigations.preservedAt}, ${now})`,
      updatedAt: sql`NOW()`,
    })
    .where(eq(investigations.id, investigationId))

  // Award investigation_archived credential — deduplicated via sourceId check
  // (one credential per investigation, not per archive attempt)
  const existingCredential = await db
    .select({ id: credentialEvents.id })
    .from(credentialEvents)
    .where(
      and(
        eq(credentialEvents.userId, userId),
        eq(credentialEvents.credentialType, 'investigation_archived'),
        eq(credentialEvents.sourceId, investigationId)
      )
    )
    .limit(1)

  if (existingCredential.length === 0) {
    await db.insert(credentialEvents).values({
      userId,
      credentialType: 'investigation_archived',
      weight: CREDENTIAL_WEIGHTS.investigation_archived,
      sourceId: investigationId,
      sourceType: 'archive_record',
    })
  }

  return new Response(JSON.stringify({ archiveRecord }), {
    status: isNewArchive ? 201 : 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ investigationId: string }> }
) {
  const { investigationId } = await params
  const db = getDb()

  const [archiveRecord] = await db
    .select()
    .from(archiveRecords)
    .where(eq(archiveRecords.investigationId, investigationId))
    .limit(1)

  if (!archiveRecord) {
    return new Response(JSON.stringify({ error: 'Archive record not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ archiveRecord }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
