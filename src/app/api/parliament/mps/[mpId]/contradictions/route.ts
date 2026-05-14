import { NextRequest } from 'next/server'
import { checkTightRateLimit } from '@/lib/rate-limit'
import { getDb } from '@/lib/db'
import {
  federalMps,
  federalMpBallots,
  federalVotes,
  mpVotingPatterns,
} from '@/lib/db/schema'
import {
  CONTRADICTION_SYSTEM_PROMPT,
  CONTRADICTION_PROMPT_VERSION,
} from '@/lib/ai/prompts/mp-analysis-system'
import { fetchPaginated } from '@/lib/parliament/client'
import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { eq, and, desc } from 'drizzle-orm'

const MODEL = 'claude-sonnet-4-20250514'
const CURRENT_SESSION = '45-1'

interface Speech {
  url: string
  time?: string
  heading?: { en: string }
  content_en?: string
}

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

  const { success } = await checkTightRateLimit(`mp-contradictions:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { mpId } = await params
  const db = getDb()

  const [mp] = await db
    .select()
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

  if (cached?.contradictions && cached.promptVersion === CONTRADICTION_PROMPT_VERSION) {
    return new Response(JSON.stringify({ contradictions: cached.contradictions }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Fetch voting record
  const ballots = await db
    .select({
      date: federalVotes.date,
      descriptionEn: federalVotes.descriptionEn,
      ballot: federalMpBallots.ballot,
    })
    .from(federalMpBallots)
    .innerJoin(federalVotes, eq(federalMpBallots.voteId, federalVotes.id))
    .where(eq(federalMpBallots.mpId, mpId))
    .orderBy(desc(federalVotes.date))
    .limit(100)

  // Fetch recent speeches from openparliament.ca
  let speechContext = ''
  try {
    const speeches = await fetchPaginated<Speech>(
      '/speeches/',
      { politician: mp.oparlSlug, limit: '20' },
      2
    )
    if (speeches.length > 0) {
      speechContext = speeches
        .filter((s) => s.content_en)
        .slice(0, 15)
        .map((s) => {
          const heading = s.heading?.en ?? 'Unknown topic'
          const content = (s.content_en ?? '').slice(0, 500)
          return `[${s.time ?? 'Unknown date'}] ${heading}: ${content}`
        })
        .join('\n\n')
    }
  } catch {
    // Non-fatal — proceed without speech data
  }

  if (ballots.length === 0) {
    return new Response(
      JSON.stringify({ error: 'No voting record available' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const voteRecordText = ballots
    .map((b) => `${b.date} | ${b.ballot.toUpperCase()} | ${b.descriptionEn}`)
    .join('\n')

  const userMessage = [
    `Analyze ${mp.name} (${mp.party}, ${mp.ridingName}) for contradictions between statements and votes.`,
    `\nVOTING RECORD (${ballots.length} recent votes):\n${voteRecordText}`,
    speechContext
      ? `\nHANSARD DEBATE EXCERPTS:\n${speechContext}`
      : '\nNo Hansard speech data available — analysis limited to voting record patterns only.',
  ].join('\n')

  try {
    const { text } = await generateText({
      model: anthropic(MODEL),
      system: CONTRADICTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 2048,
    })

    let contradictions: unknown[]
    try {
      const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
      contradictions = JSON.parse(cleaned)
      if (!Array.isArray(contradictions)) contradictions = []
    } catch {
      contradictions = []
    }

    // Persist to cache
    if (cached) {
      await db
        .update(mpVotingPatterns)
        .set({
          contradictions,
          promptVersion: CONTRADICTION_PROMPT_VERSION,
          generatedAt: new Date(),
        })
        .where(eq(mpVotingPatterns.id, cached.id))
    }

    return new Response(JSON.stringify({ contradictions }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Contradiction analysis failed:', err)
    return new Response(
      JSON.stringify({ error: 'Analysis failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
