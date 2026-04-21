import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { credentialEvents } from '@/lib/db/schema'
import { eq, count, sum, sql } from 'drizzle-orm'
import {
  CREDENTIAL_LABELS,
  computeDecayMultiplier,
  computeEffectiveWeight,
  type CredentialType,
  type CredentialSummary,
} from '@/lib/credentials'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { success } = await checkRateLimit(`credentials-get:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too Many Requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = getDb()

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
