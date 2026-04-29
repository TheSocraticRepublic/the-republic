import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { federalVotes } from '@/lib/db/schema'
import {
  VOTE_EXPLANATION_SYSTEM_PROMPT,
  VOTE_EXPLANATION_PROMPT_VERSION,
} from '@/lib/ai/prompts/vote-tracker-system'
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import { eq } from 'drizzle-orm'

const MODEL = 'claude-sonnet-4-20250514'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ voteId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { voteId } = await params
  const db = getDb()

  const [vote] = await db
    .select()
    .from(federalVotes)
    .where(eq(federalVotes.id, voteId))
    .limit(1)

  if (!vote) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (
    vote.aiExplanation &&
    vote.aiExplanationPromptVersion === VOTE_EXPLANATION_PROMPT_VERSION
  ) {
    return new Response(vote.aiExplanation, {
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  const partyContext = Array.isArray(vote.partyVotes)
    ? `\n\nParty vote breakdown:\n${(vote.partyVotes as any[])
        .map((pv: any) => {
          const name = pv?.party?.short_name?.en ?? pv?.party?.name?.en ?? 'Unknown'
          return `- ${name}: ${pv?.vote ?? 'Unknown'} (disagreement: ${pv?.disagreement ?? 'N/A'})`
        })
        .join('\n')}`
    : ''

  const result = streamText({
    model: anthropic(MODEL),
    system: VOTE_EXPLANATION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Explain this recorded division in the Canadian House of Commons:\n\nVote: ${vote.session}/${vote.number}\nDate: ${vote.date}\nDescription: ${vote.descriptionEn}\nResult: ${vote.result}\nYea: ${vote.yeaTotal}, Nay: ${vote.nayTotal}, Paired: ${vote.pairedTotal ?? 0}${partyContext}`,
      },
    ],
    onFinish: async ({ text }) => {
      try {
        await db
          .update(federalVotes)
          .set({
            aiExplanation: text.trim(),
            aiExplanationPromptVersion: VOTE_EXPLANATION_PROMPT_VERSION,
          })
          .where(eq(federalVotes.id, voteId))
      } catch (err) {
        console.error('Failed to persist vote explanation:', err)
      }
    },
  })

  return result.toTextStreamResponse()
}
