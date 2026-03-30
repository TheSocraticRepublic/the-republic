import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { gadflySessions, documents, analyses } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

/**
 * POST /api/gadfly/session
 * Create a new Gadfly session.
 */
export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { documentId?: string; title?: string; mode?: 'socratic' | 'direct' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { documentId, mode = 'socratic' } = body
  let { title } = body

  const db = getDb()

  // If a documentId is provided, verify it belongs to the user
  if (documentId) {
    const [doc] = await db
      .select({ id: documents.id, title: documents.title, userId: documents.userId })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1)

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }
    if (doc.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (!title) {
      title = `${doc.title} — Socratic Inquiry`
    }
  }

  if (!title) {
    title = 'New Inquiry'
  }

  const [session] = await db
    .insert(gadflySessions)
    .values({
      userId,
      documentId: documentId ?? null,
      title,
      mode,
    })
    .returning({ id: gadflySessions.id, title: gadflySessions.title })

  return NextResponse.json({ sessionId: session.id, title: session.title }, { status: 201 })
}

/**
 * GET /api/gadfly/session
 * List user's sessions, ordered by most recently updated.
 */
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDb()

  const sessions = await db
    .select({
      id: gadflySessions.id,
      title: gadflySessions.title,
      documentId: gadflySessions.documentId,
      mode: gadflySessions.mode,
      status: gadflySessions.status,
      questionCount: gadflySessions.questionCount,
      insightCount: gadflySessions.insightCount,
      createdAt: gadflySessions.createdAt,
      updatedAt: gadflySessions.updatedAt,
    })
    .from(gadflySessions)
    .where(eq(gadflySessions.userId, userId))
    .orderBy(desc(gadflySessions.updatedAt))

  return NextResponse.json({ sessions })
}
