import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import {
  investigations,
  issueTracking,
  regulatoryProcesses,
  issueEventTypeEnum,
} from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { mergeTimelineEvents } from '@/lib/timeline/merge'

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

  const issueEvents = await db
    .select({
      id: issueTracking.id,
      eventType: issueTracking.eventType,
      title: issueTracking.title,
      description: issueTracking.description,
      eventDate: issueTracking.eventDate,
      status: issueTracking.status,
    })
    .from(issueTracking)
    .where(eq(issueTracking.investigationId, id))
    .orderBy(asc(issueTracking.eventDate))

  const regProcesses = await db
    .select({
      id: regulatoryProcesses.id,
      projectName: regulatoryProcesses.projectName,
      commentPeriodOpens: regulatoryProcesses.commentPeriodOpens,
      commentPeriodCloses: regulatoryProcesses.commentPeriodCloses,
      status: regulatoryProcesses.status,
    })
    .from(regulatoryProcesses)
    .where(eq(regulatoryProcesses.investigationId, id))

  const events = mergeTimelineEvents(issueEvents, regProcesses)

  return new Response(JSON.stringify({ events }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

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

  let body: { eventType?: string; title?: string; description?: string; eventDate?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { eventType, title, description, eventDate } = body

  if (!eventType || !title || !eventDate) {
    return new Response(
      JSON.stringify({ error: 'eventType, title, and eventDate are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const validTypes = issueEventTypeEnum.enumValues
  if (!validTypes.includes(eventType as typeof validTypes[number])) {
    return new Response(
      JSON.stringify({ error: `Invalid eventType. Must be one of: ${validTypes.join(', ')}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const db = getDb()

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

  const [created] = await db
    .insert(issueTracking)
    .values({
      investigationId: id,
      userId,
      eventType: eventType as typeof validTypes[number],
      title: title.trim().slice(0, 500),
      description: description?.trim().slice(0, 2000) || null,
      eventDate,
    })
    .returning({
      id: issueTracking.id,
      eventType: issueTracking.eventType,
      title: issueTracking.title,
      description: issueTracking.description,
      eventDate: issueTracking.eventDate,
      status: issueTracking.status,
    })

  return new Response(JSON.stringify({ event: created }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  })
}
