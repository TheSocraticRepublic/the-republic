import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { feedback } from '@/lib/db/schema'
import { checkRateLimit } from '@/lib/rate-limit'

const VALID_FEEDBACK_TYPES = ['bug', 'suggestion'] as const
type FeedbackType = (typeof VALID_FEEDBACK_TYPES)[number]

const MAX_DESCRIPTION_LENGTH = 5000

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { success } = await checkRateLimit(`feedback:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: {
    feedbackType?: unknown
    description?: unknown
    pageContext?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const feedbackType = body.feedbackType as string
  const rawDescription = typeof body.description === 'string' ? body.description.trim() : ''
  const rawPageContext = typeof body.pageContext === 'string' ? body.pageContext.trim() : null

  if (!VALID_FEEDBACK_TYPES.includes(feedbackType as FeedbackType)) {
    return new Response(
      JSON.stringify({ error: 'feedbackType must be "bug" or "suggestion"' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (!rawDescription) {
    return new Response(JSON.stringify({ error: 'description is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (rawDescription.length > MAX_DESCRIPTION_LENGTH) {
    return new Response(
      JSON.stringify({ error: `description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const db = getDb()

  try {
    await db.insert(feedback).values({
      userId,
      feedbackType: feedbackType as FeedbackType,
      description: rawDescription,
      pageContext: rawPageContext || null,
    })

    return new Response(JSON.stringify({ ok: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Failed to submit feedback', err)
    return new Response(JSON.stringify({ error: 'Failed to submit feedback' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
