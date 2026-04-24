import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { archiveRecords } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { checkTightRateLimit } from '@/lib/rate-limit'
import { buildArchiveBundle } from '@/lib/archive/bundle'
import { computeContentHash } from '@/lib/archive/hash'
import { isArweaveEnabled, permanizeInvestigation } from '@/lib/archive/arweave'
import { checkPermanenceEligibility } from '@/lib/archive/permanence-gate'

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

  // Re-compute content hash from current DB state to detect content drift.
  // buildArchiveBundle uses a fresh timestamp here — for hash comparison purposes
  // the exact timestamp doesn't matter because we compare against the stored hash
  // which was computed at original archive time (without timestamp in hash input).
  //
  // NOTE: The stored contentHash was computed with bundle.provenance.archiverId
  // set by the caller. We replicate that here by setting it to the original userId.
  // Since we're using the stored hash for comparison (not rebuilding identity),
  // we only need to reproduce the bundle content that was hashed.
  let currentBundle
  try {
    currentBundle = await buildArchiveBundle(investigationId, db)
    // archiverId must be set consistently with how the original bundle was hashed.
    // We use the userId from the archive record (the original archiver).
    const [archiveRow] = await db
      .select({ userId: archiveRecords.userId })
      .from(archiveRecords)
      .where(eq(archiveRecords.investigationId, investigationId))
      .limit(1)
    currentBundle.provenance.archiverId = archiveRow?.userId ?? userId
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

  // Upload to Arweave
  let arweaveTxId: string
  try {
    arweaveTxId = await permanizeInvestigation(currentBundle, currentHash)
  } catch (err) {
    console.error('Failed to upload investigation to Arweave', investigationId, err)
    return new Response(
      JSON.stringify({ error: 'Failed to upload to Arweave' }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  const now = new Date()

  // Update archive record to arweave_permanent
  const [archiveRecord] = await db
    .update(archiveRecords)
    .set({
      archiveStatus: 'arweave_permanent',
      arweaveTxId,
      permanenceAt: now,
      updatedAt: sql`NOW()`,
    })
    .where(eq(archiveRecords.investigationId, investigationId))
    .returning()

  return new Response(JSON.stringify({ archiveRecord }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
