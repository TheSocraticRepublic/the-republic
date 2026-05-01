import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import {
  investigations,
  investigationOutcomes,
  credentialEvents,
} from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { CREDENTIAL_WEIGHTS } from '@/lib/credentials'

const VALID_OUTCOME_TYPES = [
  'fippa_response_received',
  'comment_submitted',
  'council_presentation',
  'media_coverage',
  'policy_change',
  'assessment_decision',
  'other',
] as const

type OutcomeType = (typeof VALID_OUTCOME_TYPES)[number]

export async function POST(
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

  // Verify ownership
  const [investigation] = await db
    .select({ id: investigations.id })
    .from(investigations)
    .where(and(eq(investigations.id, id), eq(investigations.userId, userId)))
    .limit(1)

  if (!investigation) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Parse and validate body
  let body: {
    outcomeType: string
    description: string
    outcomeDate?: string
    satisfaction?: number
    lessonsLearned?: string
  }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { outcomeType, description, outcomeDate, satisfaction, lessonsLearned } =
    body

  if (
    !outcomeType ||
    !VALID_OUTCOME_TYPES.includes(outcomeType as OutcomeType)
  ) {
    return new Response(
      JSON.stringify({
        error: `outcomeType must be one of: ${VALID_OUTCOME_TYPES.join(', ')}`,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (!description?.trim()) {
    return new Response(
      JSON.stringify({ error: 'description is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (description.trim().length > 2000) {
    return new Response(
      JSON.stringify({ error: 'description must be 2000 characters or fewer' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (outcomeDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(outcomeDate)) {
      return new Response(
        JSON.stringify({ error: 'outcomeDate must be YYYY-MM-DD format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    const parsed = new Date(outcomeDate)
    if (isNaN(parsed.getTime())) {
      return new Response(
        JSON.stringify({ error: 'outcomeDate is not a valid date' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  if (satisfaction !== undefined && satisfaction !== null) {
    if (
      !Number.isInteger(satisfaction) ||
      satisfaction < 1 ||
      satisfaction > 5
    ) {
      return new Response(
        JSON.stringify({ error: 'satisfaction must be an integer 1-5' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  // Insert outcome + award credential in a single transaction
  try {
    const result = await db.transaction(async (tx) => {
      const [outcome] = await tx
        .insert(investigationOutcomes)
        .values({
          investigationId: id,
          userId,
          outcomeType: outcomeType as OutcomeType,
          description: description.trim(),
          outcomeDate: outcomeDate || null,
          satisfaction: satisfaction ?? null,
          lessonsLearned: lessonsLearned?.trim() || null,
        })
        .returning()

      // Only award credential on the FIRST outcome for this investigation
      const [existingCredential] = await tx
        .select({ id: credentialEvents.id })
        .from(credentialEvents)
        .where(
          and(
            eq(credentialEvents.userId, userId),
            eq(credentialEvents.credentialType, 'outcome_tracked'),
            eq(credentialEvents.sourceId, id),
            eq(credentialEvents.sourceType, 'outcome'),
          )
        )
        .limit(1)

      if (!existingCredential) {
        await tx.insert(credentialEvents).values({
          userId,
          credentialType: 'outcome_tracked',
          weight: CREDENTIAL_WEIGHTS.outcome_tracked,
          sourceId: id,
          sourceType: 'outcome',
        })
      }

      return outcome
    })

    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[outcomes] Failed to create outcome', err)
    return new Response(
      JSON.stringify({ error: 'Failed to create outcome' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

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

  // Verify ownership
  const [investigation] = await db
    .select({ id: investigations.id })
    .from(investigations)
    .where(and(eq(investigations.id, id), eq(investigations.userId, userId)))
    .limit(1)

  if (!investigation) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const outcomes = await db
    .select()
    .from(investigationOutcomes)
    .where(eq(investigationOutcomes.investigationId, id))
    .orderBy(desc(investigationOutcomes.createdAt))

  return new Response(JSON.stringify(outcomes), {
    headers: { 'Content-Type': 'application/json' },
  })
}
