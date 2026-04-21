import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { userProfiles, credentialEvents } from '@/lib/db/schema'
import { eq, count, sum, sql } from 'drizzle-orm'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  CREDENTIAL_LABELS,
  computeDecayMultiplier,
  computeEffectiveWeight,
  type CredentialType,
  type CredentialSummary,
} from '@/lib/credentials'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ displayName: string }> }
) {
  // Rate limit by IP — public endpoint
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const { success } = await checkRateLimit(`users-credentials:${ip}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { displayName } = await params

  const db = getDb()

  // Look up userId from userProfiles by displayName
  const profileRows = await db
    .select({ userId: userProfiles.userId })
    .from(userProfiles)
    .where(eq(userProfiles.displayName, displayName))
    .limit(1)

  if (profileRows.length === 0) {
    return new Response(JSON.stringify({ error: 'Profile not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { userId } = profileRows[0]

  const [breakdownRows, lastActivityRows] = await Promise.all([
    db
      .select({
        type: credentialEvents.credentialType,
        count: count(),
        rawWeight: sum(credentialEvents.weight),
      })
      .from(credentialEvents)
      .where(eq(credentialEvents.userId, userId))
      .groupBy(credentialEvents.credentialType),
    db
      .select({ lastActivity: sql<string>`MAX(created_at)` })
      .from(credentialEvents)
      .where(eq(credentialEvents.userId, userId)),
  ])

  const lastActivityStr = lastActivityRows[0]?.lastActivity ?? null
  const lastActivityAt = lastActivityStr ? new Date(lastActivityStr) : null

  const rawTotal = breakdownRows.reduce((sum, row) => sum + Number(row.rawWeight ?? 0), 0)
  const decayMultiplier = computeDecayMultiplier(lastActivityAt)
  const effectiveTotal = computeEffectiveWeight(rawTotal, lastActivityAt)

  const breakdown = breakdownRows.map((row) => ({
    type: row.type as CredentialType,
    label: CREDENTIAL_LABELS[row.type as CredentialType],
    count: Number(row.count),
    rawWeight: Number(row.rawWeight ?? 0),
  }))

  // No userId in response — public endpoint
  const summary: CredentialSummary = {
    rawTotal,
    effectiveTotal,
    decayMultiplier,
    lastActivityAt,
    breakdown,
  }

  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
