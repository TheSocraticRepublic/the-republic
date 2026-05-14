import { NextRequest } from 'next/server'
import { checkTightRateLimit, checkDailyAiGeneralLimit } from '@/lib/rate-limit'
import { getDb } from '@/lib/db'
import {
  federalMps,
  federalMpBallots,
  federalVotes,
  mpVotingPatterns,
} from '@/lib/db/schema'
import {
  MP_PATTERN_SYSTEM_PROMPT,
  MP_PATTERN_PROMPT_VERSION,
} from '@/lib/ai/prompts/mp-analysis-system'
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import { eq, and, desc } from 'drizzle-orm'

const MODEL = 'claude-sonnet-4-20250514'
const CURRENT_SESSION = '45-1'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ mpId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { success } = await checkTightRateLimit(`mp-patterns:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const aiDaily = await checkDailyAiGeneralLimit(userId)
  if (!aiDaily.success) {
    return new Response(JSON.stringify({
      error: 'Daily AI usage limit reached. Please try again tomorrow.',
    }), { status: 429, headers: { 'Content-Type': 'application/json' } })
  }

  const { mpId } = await params
  const db = getDb()

  const [mp] = await db
    .select({ id: federalMps.id, name: federalMps.name, party: federalMps.party })
    .from(federalMps)
    .where(eq(federalMps.id, mpId))
    .limit(1)

  if (!mp) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Check cache
  const [cached] = await db
    .select()
    .from(mpVotingPatterns)
    .where(
      and(
        eq(mpVotingPatterns.mpId, mpId),
        eq(mpVotingPatterns.session, CURRENT_SESSION)
      )
    )
    .limit(1)

  if (cached && cached.promptVersion === MP_PATTERN_PROMPT_VERSION) {
    return new Response(cached.patternAnalysis, {
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // Fetch voting record
  const ballots = await db
    .select({
      date: federalVotes.date,
      descriptionEn: federalVotes.descriptionEn,
      result: federalVotes.result,
      ballot: federalMpBallots.ballot,
      partyVotes: federalVotes.partyVotes,
    })
    .from(federalMpBallots)
    .innerJoin(federalVotes, eq(federalMpBallots.voteId, federalVotes.id))
    .where(eq(federalMpBallots.mpId, mpId))
    .orderBy(desc(federalVotes.date))
    .limit(200)

  if (ballots.length === 0) {
    return new Response(
      JSON.stringify({ error: 'No voting record available for analysis' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const voteRecordText = ballots
    .map((b) => `${b.date} | ${b.ballot.toUpperCase()} | ${b.descriptionEn} | Result: ${b.result}`)
    .join('\n')

  const result = streamText({
    model: anthropic(MODEL),
    system: MP_PATTERN_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Analyze the voting patterns of ${mp.name} (${mp.party}).\n\nVoting record (${ballots.length} most recent votes):\n${voteRecordText}`,
      },
    ],
    maxOutputTokens: 4096,
    onFinish: async ({ text }) => {
      try {
        if (cached) {
          await db
            .update(mpVotingPatterns)
            .set({
              patternAnalysis: text.trim(),
              promptVersion: MP_PATTERN_PROMPT_VERSION,
              generatedAt: new Date(),
            })
            .where(eq(mpVotingPatterns.id, cached.id))
        } else {
          await db.insert(mpVotingPatterns).values({
            mpId,
            session: CURRENT_SESSION,
            patternAnalysis: text.trim(),
            promptVersion: MP_PATTERN_PROMPT_VERSION,
          })
        }
      } catch (err) {
        console.error('Failed to persist voting pattern analysis:', err)
      }
    },
  })

  return result.toTextStreamResponse()
}
