import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { userProfiles, credentialEvents } from '@/lib/db/schema'
import { eq, sum, sql } from 'drizzle-orm'
import { checkRateLimit } from '@/lib/rate-limit'
import { computeEffectiveWeight, computeDecayMultiplier } from '@/lib/credentials'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ displayName: string }> }
) {
  // Rate limit by IP — unauthenticated public endpoint
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const { success } = await checkRateLimit(`users-profile:${ip}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { displayName } = await params

  const db = getDb()

  // Look up profile by displayName (case-sensitive UNIQUE column match)
  const profileRows = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.displayName, displayName))
    .limit(1)

  if (profileRows.length === 0) {
    return new Response(JSON.stringify({ error: 'Profile not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const profile = profileRows[0]
  const userId = profile.userId

  // Credential weight with decay applied
  const [weightResult, lastActivityResult] = await Promise.all([
    db
      .select({ total: sum(credentialEvents.weight) })
      .from(credentialEvents)
      .where(eq(credentialEvents.userId, userId)),
    db
      .select({ lastActivity: sql<string>`MAX(created_at)` })
      .from(credentialEvents)
      .where(eq(credentialEvents.userId, userId)),
  ])

  const rawTotal = Number(weightResult[0]?.total ?? 0)
  const lastActivityStr = lastActivityResult[0]?.lastActivity ?? null
  const lastActivityAt = lastActivityStr ? new Date(lastActivityStr) : null
  const credentialWeight = computeEffectiveWeight(rawTotal, lastActivityAt)

  // NEVER include email or userId in response
  return new Response(
    JSON.stringify({
      profile: {
        displayName: profile.displayName,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        createdAt: profile.createdAt,
      },
      stats: {
        credentialWeight,
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}
