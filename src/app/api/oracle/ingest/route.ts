import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { documents, documentChunks } from '@/lib/db/schema'
import { parsePDF } from '@/lib/documents/parser'
import { chunkDocument } from '@/lib/documents/chunker'
import { eq } from 'drizzle-orm'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.pdf$/i, '')
  return base
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

export async function POST(request: NextRequest) {
  // Auth: middleware injects x-user-id for protected routes
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 413 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const title = titleFromFilename(file.name)
  const db = getDb()

  // Insert document record with processing status
  const [doc] = await db
    .insert(documents)
    .values({
      userId,
      title,
      documentType: 'other',
      status: 'processing',
    })
    .returning({ id: documents.id })

  try {
    const parsed = await parsePDF(buffer)
    const chunks = chunkDocument(parsed.text)

    // Update document with parsed data
    await db
      .update(documents)
      .set({
        rawText: parsed.text,
        pageCount: parsed.pageCount,
        wordCount: parsed.wordCount,
        extractionQuality: parsed.extractionQuality === 'high' ? 0.9 : 0.3,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, doc.id))

    // Insert chunks (embeddings are null — provider not configured)
    if (chunks.length > 0) {
      await db.insert(documentChunks).values(
        chunks.map((chunk) => ({
          documentId: doc.id,
          content: chunk.content,
          chunkIndex: chunk.chunkIndex,
          sectionHeading: chunk.sectionHeading ?? null,
          tokenCount: Math.ceil(chunk.content.length / 4), // rough estimate
        }))
      )
    }

    // Mark as ready
    await db
      .update(documents)
      .set({ status: 'ready', updatedAt: new Date() })
      .where(eq(documents.id, doc.id))

    return NextResponse.json({
      documentId: doc.id,
      title,
      pageCount: parsed.pageCount,
      wordCount: parsed.wordCount,
      chunkCount: chunks.length,
      extractionQuality: parsed.extractionQuality,
    })
  } catch (err) {
    console.error('[oracle/ingest] Parse error:', err)
    await db
      .update(documents)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(documents.id, doc.id))

    return NextResponse.json({ error: 'Failed to parse document' }, { status: 500 })
  }
}
