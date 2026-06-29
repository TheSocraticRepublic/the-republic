import { NextRequest } from 'next/server'
import { checkTightRateLimit, checkDailyAiGeneralLimit } from '@/lib/rate-limit'
import { getDb } from '@/lib/db'
import { federalMps, federalVotes, federalMpBallots, leverActions } from '@/lib/db/schema'
import {
  VOTE_LETTER_SYSTEM_PROMPT,
  VOTE_LETTER_PROMPT_VERSION,
} from '@/lib/ai/prompts/vote-letter-system'
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import { eq, and, inArray } from 'drizzle-orm'
import { MODEL } from '@/lib/ai/model'

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

  const { success } = await checkTightRateLimit(`mp-letter:${userId}`)
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

  let body: { concern: string; voteIds?: string[]; investigationId?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!body.concern?.trim()) {
    return new Response(JSON.stringify({ error: 'concern is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = getDb()

  const [mp] = await db
    .select()
    .from(federalMps)
    .where(eq(federalMps.id, mpId))
    .limit(1)

  if (!mp) {
    return new Response(JSON.stringify({ error: 'MP not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Build vote context
  let voteContext = ''
  if (body.voteIds && body.voteIds.length > 0) {
    const votes = await db
      .select({
        id: federalVotes.id,
        date: federalVotes.date,
        descriptionEn: federalVotes.descriptionEn,
        result: federalVotes.result,
      })
      .from(federalVotes)
      .where(inArray(federalVotes.id, body.voteIds))

    // Batch-fetch all ballots for this MP across all voteIds in a single query.
    // The composite (voteId, mpId) unique index makes this fast and dedup-safe.
    const voteIds = votes.map((v) => v.id)
    const ballotRows = voteIds.length > 0
      ? await db
          .select({ voteId: federalMpBallots.voteId, ballot: federalMpBallots.ballot })
          .from(federalMpBallots)
          .where(
            and(
              inArray(federalMpBallots.voteId, voteIds),
              eq(federalMpBallots.mpId, mpId)
            )
          )
      : []
    const ballotMap = new Map(ballotRows.map((b) => [b.voteId, b.ballot]))

    const votesWithBallots = votes.map((v) => ({
      ...v,
      mpBallot: ballotMap.get(v.id) ?? 'unknown',
    }))

    if (votesWithBallots.length > 0) {
      voteContext = `\n\nRELEVANT VOTES:\n${votesWithBallots
        .map(
          (v) =>
            `- ${v.date}: ${v.descriptionEn} — MP voted ${v.mpBallot.toUpperCase()} (result: ${v.result})`
        )
        .join('\n')}`
    }
  }

  // Build constituency office address context
  const metadata = (mp.metadata ?? {}) as Record<string, unknown>
  const otherInfo = (metadata.otherInfo ?? {}) as Record<string, string[]>
  const offices = otherInfo.constituency_offices ?? []
  const officeContext = offices.length > 0
    ? `\n\nCONSTITUENCY OFFICE:\n${offices[0]}`
    : ''

  const userMessage = [
    `Write a letter to ${mp.name}, MP for ${mp.ridingName}, ${mp.ridingProvince} (${mp.party}).`,
    `\nCITIZEN'S CONCERN:\n${body.concern.trim()}`,
    `\nMP'S EMAIL: ${mp.email ?? 'Not available'}`,
    officeContext,
    voteContext,
  ].join('\n')

  const result = streamText({
    model: anthropic(MODEL),
    system: VOTE_LETTER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    maxOutputTokens: 4096,
    onFinish: async ({ text }) => {
      try {
        await db.insert(leverActions).values({
          userId,
          actionType: 'mp_letter',
          title: `Letter to ${mp.name} — ${body.concern.trim().slice(0, 80)}`,
          content: text.trim(),
          investigationId: body.investigationId ?? null,
          metadata: {
            mpId,
            mpName: mp.name,
            voteIds: body.voteIds ?? [],
            promptVersion: VOTE_LETTER_PROMPT_VERSION,
          },
          status: 'draft',
        })
      } catch (err) {
        console.error('Failed to persist MP letter:', err)
      }
    },
  })

  return result.toTextStreamResponse()
}
