import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { investigations, peerReviews, credentialEvents, userProfiles } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  validateReviewScores,
  validateReviewSummary,
  REVIEW_DIMENSIONS,
} from '@/lib/review/validation'
import { stripHtmlTags } from '@/lib/profile/validation'

// Postgres unique violation code
const PG_UNIQUE_VIOLATION = '23505'

function isPgError(err: unknown): err is { code: string } {
  return typeof err === 'object' && err !== null && 'code' in err
}

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id } = await params

  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { success } = await checkRateLimit(`review-post:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Extract scores from body
  const scores: Record<string, unknown> = {}
  for (const dim of REVIEW_DIMENSIONS) {
    scores[dim] = body[dim]
  }

  const scoresValidation = validateReviewScores(scores)
  if (!scoresValidation.valid) {
    return new Response(JSON.stringify({ error: scoresValidation.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const rawSummary = typeof body.summary === 'string' ? body.summary : ''
  if (rawSummary) {
    const summaryValidation = validateReviewSummary(rawSummary)
    if (!summaryValidation.valid) {
      return new Response(JSON.stringify({ error: summaryValidation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const db = getDb()

  // Fetch investigation — only active investigations accept reviews
  const [investigation] = await db
    .select({ id: investigations.id, userId: investigations.userId })
    .from(investigations)
    .where(and(eq(investigations.id, id), eq(investigations.status, 'active')))
    .limit(1)

  if (!investigation) {
    return new Response(JSON.stringify({ error: 'Investigation not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (investigation.userId === userId) {
    return new Response(
      JSON.stringify({ error: 'You cannot review your own investigation' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [review] = await tx
        .insert(peerReviews)
        .values({
          investigationId: id,
          reviewerId: userId,
          factualAccuracy: scores.factualAccuracy as number,
          sourceQuality: scores.sourceQuality as number,
          missingContext: scores.missingContext as number,
          strategicEffectiveness: scores.strategicEffectiveness as number,
          jurisdictionalAccuracy: scores.jurisdictionalAccuracy as number,
          summary: rawSummary ? stripHtmlTags(rawSummary) : null,
        })
        .returning({ id: peerReviews.id })

      await tx.insert(credentialEvents).values({
        userId,
        credentialType: 'peer_review',
        weight: 2,
        sourceId: review.id,
        sourceType: 'peer_review',
      })

      return review
    })

    return new Response(JSON.stringify({ review: result }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    if (isPgError(err) && err.code === PG_UNIQUE_VIOLATION) {
      return new Response(
        JSON.stringify({ error: 'You have already reviewed this investigation' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      )
    }
    console.error('Failed to create peer review', err)
    return new Response(JSON.stringify({ error: 'Failed to create review' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params

  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = getDb()

  // Only return reviews for active investigations
  const [investigation] = await db
    .select({ id: investigations.id })
    .from(investigations)
    .where(and(eq(investigations.id, id), eq(investigations.status, 'active')))
    .limit(1)

  if (!investigation) {
    return new Response(JSON.stringify({ error: 'Investigation not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const rows = await db
    .select({
      id: peerReviews.id,
      reviewerId: peerReviews.reviewerId,
      factualAccuracy: peerReviews.factualAccuracy,
      sourceQuality: peerReviews.sourceQuality,
      missingContext: peerReviews.missingContext,
      strategicEffectiveness: peerReviews.strategicEffectiveness,
      jurisdictionalAccuracy: peerReviews.jurisdictionalAccuracy,
      summary: peerReviews.summary,
      createdAt: peerReviews.createdAt,
      reviewerDisplayName: userProfiles.displayName,
    })
    .from(peerReviews)
    .innerJoin(userProfiles, eq(peerReviews.reviewerId, userProfiles.userId))
    .where(eq(peerReviews.investigationId, id))
    .orderBy(desc(peerReviews.createdAt))

  // Determine if the current user has reviewed — server-side, never exposed to client
  const currentUserHasReviewed = rows.some((r) => r.reviewerId === userId)

  // Strip reviewerId before sending to client
  const safeRows = rows.map(({ reviewerId: _rid, ...rest }) => rest)

  if (rows.length === 0) {
    return new Response(
      JSON.stringify({ reviews: [], aggregate: null, currentUserHasReviewed }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // Compute aggregates in JS
  const count = rows.length
  const sum = {
    factualAccuracy: 0,
    sourceQuality: 0,
    missingContext: 0,
    strategicEffectiveness: 0,
    jurisdictionalAccuracy: 0,
  }
  for (const row of rows) {
    sum.factualAccuracy += row.factualAccuracy
    sum.sourceQuality += row.sourceQuality
    sum.missingContext += row.missingContext
    sum.strategicEffectiveness += row.strategicEffectiveness
    sum.jurisdictionalAccuracy += row.jurisdictionalAccuracy
  }

  const round1 = (n: number) => Math.round(n * 10) / 10

  const aggregate = {
    count,
    averages: {
      factualAccuracy: round1(sum.factualAccuracy / count),
      sourceQuality: round1(sum.sourceQuality / count),
      missingContext: round1(sum.missingContext / count),
      strategicEffectiveness: round1(sum.strategicEffectiveness / count),
      jurisdictionalAccuracy: round1(sum.jurisdictionalAccuracy / count),
    },
  }

  return new Response(
    JSON.stringify({ reviews: safeRows, aggregate, currentUserHasReviewed }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}
