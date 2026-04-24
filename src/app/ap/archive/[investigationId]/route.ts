import { NextRequest } from 'next/server'
import { isFederationConfigured, archiveUrl, getApDomain, AP_CONTEXT } from '@/lib/activitypub/context'
import { getDb } from '@/lib/db'
import { archiveRecords, investigations, userProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { checkRateLimit } from '@/lib/rate-limit'

interface RouteContext {
  params: Promise<{ investigationId: string }>
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  if (!isFederationConfigured()) {
    return new Response(JSON.stringify({ error: 'Federation not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { success } = await checkRateLimit(`ap-archive:${ip}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { investigationId } = await params
  const db = getDb()

  const rows = await db
    .select({
      concern: investigations.concern,
      briefingText: investigations.briefingText,
      createdAt: investigations.createdAt,
      briefingCompletedAt: investigations.briefingCompletedAt,
      archiveStatus: archiveRecords.archiveStatus,
      preservedAt: archiveRecords.preservedAt,
      ipfsCid: archiveRecords.ipfsCid,
      arweaveTxId: archiveRecords.arweaveTxId,
      archivedByHandle: userProfiles.apHandle,
    })
    .from(archiveRecords)
    .innerJoin(investigations, eq(archiveRecords.investigationId, investigations.id))
    .innerJoin(userProfiles, eq(archiveRecords.userId, userProfiles.userId))
    .where(eq(archiveRecords.investigationId, investigationId))
    .limit(1)

  if (rows.length === 0) {
    return new Response(JSON.stringify({ error: 'Archive record not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const record = rows[0]

  if (record.archiveStatus !== 'ipfs_pinned' && record.archiveStatus !== 'arweave_permanent') {
    return new Response(JSON.stringify({ error: 'Archive record not yet available' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const domain = getApDomain()
  const url = archiveUrl(investigationId)

  // Content negotiation: AP clients get JSON-LD, browsers get a redirect
  const accept = request.headers.get('accept') ?? ''
  const wantsAp =
    accept.includes('application/activity+json') ||
    accept.includes('application/ld+json')

  if (!wantsAp) {
    return new Response(null, {
      status: 301,
      headers: { Location: `/archive/${investigationId}` },
    })
  }

  const attributedTo = record.archivedByHandle
    ? `https://${domain}/ap/users/${record.archivedByHandle}`
    : `https://${domain}/ap/users/republic`

  const article = {
    '@context': AP_CONTEXT,
    id: `https://${domain}/ap/archive/${investigationId}`,
    type: 'Article',
    mediaType: 'text/plain',
    attributedTo,
    name: record.concern,
    content: record.briefingText ?? record.concern,
    published: (record.preservedAt ?? record.createdAt).toISOString(),
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    cc: [`${attributedTo}/followers`],
    url,
    // Archive-specific extensions
    'republic:archiveStatus': record.archiveStatus,
    ...(record.ipfsCid ? { 'republic:ipfsCid': record.ipfsCid } : {}),
    ...(record.arweaveTxId ? { 'republic:arweaveTxId': record.arweaveTxId } : {}),
  }

  return new Response(JSON.stringify(article), {
    status: 200,
    headers: {
      'Content-Type': 'application/activity+json',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
