import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { userProfiles, investigations, peerReviews, credentialEvents } from '@/lib/db/schema'
import { eq, and, count, sum } from 'drizzle-orm'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ displayName: string }> }
) {
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

  // Aggregate stats in parallel
  const [investigationResult, reviewResult, weightResult] = await Promise.all([
    db
      .select({ count: count() })
      .from(investigations)
      .where(and(eq(investigations.userId, userId), eq(investigations.status, 'active'))),
    db
      .select({ count: count() })
      .from(peerReviews)
      .where(eq(peerReviews.reviewerId, userId)),
    db
      .select({ total: sum(credentialEvents.weight) })
      .from(credentialEvents)
      .where(eq(credentialEvents.userId, userId)),
  ])

  const investigationCount = investigationResult[0]?.count ?? 0
  const reviewCount = reviewResult[0]?.count ?? 0
  const credentialWeight = Number(weightResult[0]?.total ?? 0)

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
        investigationCount,
        reviewCount,
        credentialWeight,
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}
