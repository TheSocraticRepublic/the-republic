import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { federalBills } from '@/lib/db/schema'
import {
  BILL_SUMMARY_SYSTEM_PROMPT,
  BILL_SUMMARY_PROMPT_VERSION,
} from '@/lib/ai/prompts/vote-tracker-system'
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import { eq, sql } from 'drizzle-orm'

const MODEL = 'claude-sonnet-4-20250514'

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
        content: `Summarize this Canadian federal bill:\n\nBill Number: ${bill.number}\nTitle: ${bill.titleEn}\nSession: ${bill.session}\nStatus: ${bill.statusCode ?? 'Unknown'}\nIntroduced: ${bill.introduced ?? 'Unknown'}\n${bill.shortTitleEn ? `Short Title: ${bill.shortTitleEn}` : ''}\n${bill.legisInfoUrl ? `LEGISinfo: ${bill.legisInfoUrl}` : ''}`,
      },
    ],
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
