import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import {
  investigations,
  investigationVotes,
  federalVotes,
  federalMps,
  federalMpBallots,
} from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { id } = await params
  const db = getDb()

  const [investigation] = await db
    .select({
      id: investigations.id,
      concern: investigations.concern,
      federalMpId: investigations.federalMpId,
      postalCode: investigations.postalCode,
    })
    .from(investigations)
    .where(and(eq(investigations.id, id), eq(investigations.userId, userId)))
    .limit(1)

  if (!investigation) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Get MP info if available
  let mp: { id: string; name: string; party: string; ridingName: string; photoUrl: string | null } | null = null
  if (investigation.federalMpId) {
    const [mpRow] = await db
      .select({
        id: federalMps.id,
        name: federalMps.name,
        party: federalMps.party,
        ridingName: federalMps.ridingName,
        photoUrl: federalMps.photoUrl,
      })
      .from(federalMps)
      .where(eq(federalMps.id, investigation.federalMpId))
      .limit(1)
    mp = mpRow ?? null
  }

  // Get relevant votes with MP ballot
  const relevantVotes = await db
    .select({
      voteId: federalVotes.id,
      date: federalVotes.date,
      descriptionEn: federalVotes.descriptionEn,
      result: federalVotes.result,
      relevanceExplanation: investigationVotes.relevanceExplanation,
    })
    .from(investigationVotes)
    .innerJoin(federalVotes, eq(investigationVotes.voteId, federalVotes.id))
    .where(eq(investigationVotes.investigationId, id))

  // Get MP ballots for these votes
  const votesWithBallots = await Promise.all(
    relevantVotes.map(async (rv) => {
      let ballot: string | null = null
      if (investigation.federalMpId) {
        const [b] = await db
          .select({ ballot: federalMpBallots.ballot })
          .from(federalMpBallots)
          .where(
            and(
              eq(federalMpBallots.voteId, rv.voteId),
              eq(federalMpBallots.mpId, investigation.federalMpId)
            )
          )
          .limit(1)
        ballot = b?.ballot ?? null
      }
      return { ...rv, mpBallot: ballot }
    })
  )

  return new Response(
    JSON.stringify({ mp, votes: votesWithBallots, concern: investigation.concern }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}
