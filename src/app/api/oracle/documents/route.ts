import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { documents } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDb()

  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      documentType: documents.documentType,
      pageCount: documents.pageCount,
      wordCount: documents.wordCount,
      extractionQuality: documents.extractionQuality,
      status: documents.status,
      sourceUrl: documents.sourceUrl,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(desc(documents.createdAt))

  return NextResponse.json({ documents: rows })
}
