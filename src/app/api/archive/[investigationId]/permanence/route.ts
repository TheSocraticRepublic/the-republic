import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { archiveRecords, investigations, userProfiles } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { checkTightRateLimit } from '@/lib/rate-limit'
import { buildArchiveBundle } from '@/lib/archive/bundle'
import { computeContentHash } from '@/lib/archive/hash'
import { isArweaveEnabled, permanizeInvestigation } from '@/lib/archive/arweave'
import { checkPermanenceEligibility } from '@/lib/archive/permanence-gate'
import { checkModeratorAccess } from '@/lib/credentials/check-moderator'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

  // Validate investigationId format before querying the DB
  if (!UUID_REGEX.test(investigationId)) {
    return new Response(
      JSON.stringify({ error: 'Invalid investigationId format' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // Tight rate limit: 5 requests per 60 seconds per user
  const { success } = await checkTightRateLimit(`permanence:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Arweave must be enabled
  if (!isArweaveEnabled()) {
    return new Response(
      JSON.stringify({
        error:
          'Permanence service not configured. Contact the administrator.',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  const db = getDb()

  // Verify an archive record exists with status 'ipfs_pinned'
  // (cannot permanize without first archiving to IPFS)
  const [existingRecord] = await db
    .select({
      id: archiveRecords.id,
      userId: archiveRecords.userId,
      archiveStatus: archiveRecords.archiveStatus,
      ipfsCid: archiveRecords.ipfsCid,
      contentHash: archiveRecords.contentHash,
      arweaveTxId: archiveRecords.arweaveTxId,
      preservedAt: archiveRecords.preservedAt,
      permanenceAt: archiveRecords.permanenceAt,
      createdAt: archiveRecords.createdAt,
      updatedAt: archiveRecords.updatedAt,
      metadata: archiveRecords.metadata,
    })
    .from(archiveRecords)
    .where(eq(archiveRecords.investigationId, investigationId))
    .limit(1)

  if (!existingRecord) {
    return new Response(
      JSON.stringify({
        error:
          'No archive record found. Archive this investigation to IPFS first.',
      }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  if (existingRecord.archiveStatus !== 'ipfs_pinned' && existingRecord.archiveStatus !== 'arweave_permanent') {
    return new Response(
      JSON.stringify({
        error: `Cannot permanize: archive status is '${existingRecord.archiveStatus}'. Status must be 'ipfs_pinned'.`,
      }),
      {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // Idempotent: if already permanent, return the existing record without re-uploading
  if (existingRecord.archiveStatus === 'arweave_permanent') {
    return new Response(
      JSON.stringify({ archiveRecord: { ...existingRecord, investigationId } }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // Ownership check: caller must own the investigation OR have moderator access.
  // This is in addition to the permanence eligibility gate below.
  const [investigation] = await db
    .select({ userId: investigations.userId })
    .from(investigations)
    .where(eq(investigations.id, investigationId))
    .limit(1)

  if (investigation?.userId !== userId) {
    const { isModerator } = await checkModeratorAccess(userId)
    if (!isModerator) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  // Check permanence eligibility
  const { eligible, reason } = await checkPermanenceEligibility(
    investigationId,
    userId,
    db
  )

  if (!eligible) {
    return new Response(
      JSON.stringify({ error: 'Permanence eligibility not met', reason }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // Re-compute the bundle from current DB state to detect content drift.
  //
  // preservedAt IS part of the ArchiveBundle object (bundle.preservedAt) and is
  // therefore part of the canonicalized hash input. We must pass the stored
  // preservedAt so the re-computed hash matches the stored hash when content
  // hasn't changed. Passing a fresh new Date() here would ALWAYS produce a
  // hash mismatch, making the drift check permanently broken.
  //
  // NOTE: We deliberately re-build the bundle from current DB state rather than
  // re-fetching the original serialized bundle. This is intentional: the re-computation
  // verifies that the investigation's content hasn't drifted since archival. If the
  // hash matches, the current state IS what was archived — and that is what we upload
  // to Arweave. The hash check is the integrity guarantee.
  //
  // archiverId is set to the original archiver (existingRecord.userId) to replicate
  // the provenance field exactly as it was when the stored contentHash was computed.
  let currentBundle
  try {
    currentBundle = await buildArchiveBundle(
      investigationId,
      db,
      new Date(existingRecord.preservedAt!)
    )
    currentBundle.provenance.archiverId = existingRecord.userId
  } catch (err) {
    console.error('Failed to build archive bundle for hash comparison', investigationId, err)
    return new Response(
      JSON.stringify({ error: 'Failed to build archive bundle' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  const currentHash = computeContentHash(currentBundle)

  if (currentHash !== existingRecord.contentHash) {
    return new Response(
      JSON.stringify({
        error:
          'Investigation content has changed since archival. Re-archive first.',
      }),
      {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // Atomic compare-and-swap: transition from 'ipfs_pinned' → 'pending' before
  // uploading to Arweave. This prevents double-spend: two concurrent requests
  // can both pass the status check above, but only one can win this CAS. The
  // loser gets zero rows back (.returning() returns nothing) and returns 409.
  const [claimed] = await db
    .update(archiveRecords)
    .set({ archiveStatus: 'pending', updatedAt: sql`NOW()` })
    .where(
      and(
        eq(archiveRecords.investigationId, investigationId),
        eq(archiveRecords.archiveStatus, 'ipfs_pinned')
      )
    )
    .returning({ id: archiveRecords.id })

  if (!claimed) {
    return new Response(
      JSON.stringify({ error: 'Permanence already in progress or completed' }),
      {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // Upload to Arweave. If this fails, reset status back to 'ipfs_pinned' so
  // the investigation can be retried.
  let arweaveTxId: string
  try {
    // W4: Wrap Irys operations in a sanitizing catch so the raw error — which
    // may contain the private key from the Irys constructor — is never logged.
    arweaveTxId = await permanizeInvestigation(currentBundle, currentHash)
  } catch {
    // Sanitize: never propagate or log the raw error, which may expose IRYS_PRIVATE_KEY.
    console.error('Arweave upload failed for investigation', investigationId)

    // Reset status so the caller can retry
    await db
      .update(archiveRecords)
      .set({ archiveStatus: 'ipfs_pinned', updatedAt: sql`NOW()` })
      .where(eq(archiveRecords.investigationId, investigationId))

    return new Response(
      JSON.stringify({ error: 'Arweave upload failed. Check IRYS_PRIVATE_KEY configuration.' }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  const now = new Date()

  // Update archive record to arweave_permanent.
  // N2: Return explicit safe fields only — userId is intentionally excluded.
  // Caller gets displayName via join instead, matching the GET endpoint pattern.
  const [archiveRecord] = await db
    .update(archiveRecords)
    .set({
      archiveStatus: 'arweave_permanent',
      arweaveTxId,
      permanenceAt: now,
      updatedAt: sql`NOW()`,
    })
    .where(eq(archiveRecords.investigationId, investigationId))
    .returning({
      id: archiveRecords.id,
      investigationId: archiveRecords.investigationId,
      archiveStatus: archiveRecords.archiveStatus,
      ipfsCid: archiveRecords.ipfsCid,
      contentHash: archiveRecords.contentHash,
      arweaveTxId: archiveRecords.arweaveTxId,
      preservedAt: archiveRecords.preservedAt,
      permanenceAt: archiveRecords.permanenceAt,
      createdAt: archiveRecords.createdAt,
      updatedAt: archiveRecords.updatedAt,
      metadata: archiveRecords.metadata,
    })

  // Resolve displayName for the archiver — userId stays server-side
  const [profile] = await db
    .select({ displayName: userProfiles.displayName })
    .from(userProfiles)
    .where(eq(userProfiles.userId, existingRecord.userId))
    .limit(1)

  return new Response(
    JSON.stringify({
      archiveRecord: {
        ...archiveRecord,
        archivedBy: profile?.displayName ?? null,
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}
