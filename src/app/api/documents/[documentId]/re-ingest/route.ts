import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { documents, investigations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { checkTightRateLimit } from '@/lib/rate-limit'
import { checkModeratorAccess } from '@/lib/credentials/check-moderator'
import { reIngestDocument } from '@/lib/archive/re-ingest'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  // Auth required
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { documentId } = await params

  // UUID validation
  if (!UUID_REGEX.test(documentId)) {
    return new Response(JSON.stringify({ error: 'Invalid documentId format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Tight rate limit — this endpoint makes external HTTP requests
  const { success } = await checkTightRateLimit(`reingest:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = getDb()

  // Fetch the document — verify it exists and get its investigationId and direct owner
  const [doc] = await db
    .select({
      id: documents.id,
      userId: documents.userId,
      investigationId: documents.investigationId,
    })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1)

  if (!doc) {
    return new Response(JSON.stringify({ error: 'Document not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Verify ownership or moderator access.
  // Ownership can be established two ways:
  //   1. The document's investigationId links to an investigation owned by this user.
  //   2. The document's own userId matches (handles orphaned documents with no investigationId).
  let isAuthorized = false

  // Direct document ownership (covers orphaned documents where investigationId is null)
  if (doc.userId === userId) {
    isAuthorized = true
  }

  if (!isAuthorized && doc.investigationId) {
    // Check if the caller owns the investigation this document belongs to
    const [inv] = await db
      .select({ userId: investigations.userId })
      .from(investigations)
      .where(eq(investigations.id, doc.investigationId))
      .limit(1)

    if (inv && inv.userId === userId) {
      isAuthorized = true
    }
  }

  if (!isAuthorized) {
    const { isModerator } = await checkModeratorAccess(userId)
    isAuthorized = isModerator
  }

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Re-ingest the document
  let result: Awaited<ReturnType<typeof reIngestDocument>>
  try {
    result = await reIngestDocument(documentId, db)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Re-ingestion failed'
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
