import { NextRequest } from 'next/server'
import { checkTightRateLimit, checkDailyAiGeneralLimit } from '@/lib/rate-limit'
import { getDb } from '@/lib/db'
import { federalBills } from '@/lib/db/schema'
import {
  BILL_SUMMARY_SYSTEM_PROMPT,
  BILL_SUMMARY_PROMPT_VERSION,
} from '@/lib/ai/prompts/vote-tracker-system'
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import { eq } from 'drizzle-orm'
import { MODEL } from '@/lib/ai/model'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ billId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { success } = await checkTightRateLimit(`bill-summarize:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const aiDaily = await checkDailyAiGeneralLimit(userId)
  if (!aiDaily.success) {
    return new Response(JSON.stringify({
      error: 'Daily AI usage limit reached. Try again tomorrow.',
    }), { status: 429, headers: { 'Content-Type': 'application/json' } })
  }

  const { billId } = await params
  const db = getDb()

  const [bill] = await db
    .select()
    .from(federalBills)
    .where(eq(federalBills.id, billId))
    .limit(1)

  if (!bill) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (
    bill.aiSummary &&
    bill.aiSummaryPromptVersion === BILL_SUMMARY_PROMPT_VERSION
  ) {
    return new Response(bill.aiSummary, {
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  const result = streamText({
    model: anthropic(MODEL),
    system: BILL_SUMMARY_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          `Explain what can be determined about this Canadian federal bill from its metadata only. You do not have the bill text.`,
          ``,
          `Bill Number: ${bill.number}`,
          `Title: ${bill.titleEn}`,
          bill.shortTitleEn ? `Short Title: ${bill.shortTitleEn}` : null,
          `Session: ${bill.session}`,
          `Status: ${bill.statusCode ?? 'Unknown'}`,
          `Introduced: ${bill.introduced ?? 'Unknown'}`,
          bill.legisInfoUrl ? `LEGISinfo: ${bill.legisInfoUrl}` : null,
        ].filter(Boolean).join('\n'),
      },
    ],
    maxOutputTokens: 4096,
    onFinish: async ({ text }) => {
      try {
        await db
          .update(federalBills)
          .set({
            aiSummary: text.trim(),
            aiSummaryPromptVersion: BILL_SUMMARY_PROMPT_VERSION,
            updatedAt: new Date(),
          })
          .where(eq(federalBills.id, billId))
      } catch (err) {
        console.error('Failed to persist bill summary:', err)
      }
    },
  })

  return result.toTextStreamResponse()
}
