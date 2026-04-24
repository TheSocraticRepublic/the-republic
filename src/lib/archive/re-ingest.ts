/**
 * Document re-ingestion: fetch a document's source URL, compare against stored
 * content, and create a documentVersions record if it has changed.
 *
 * SSRF protection: sourceUrl is validated before any fetch.
 * Timeout: 10 seconds per request.
 * Max size: 50MB response body.
 */

import { getDb } from '@/lib/db'
import { documents, documentVersions } from '@/lib/db/schema'
import { eq, max } from 'drizzle-orm'
import { isValidDocumentUrl } from './url-validation'
import { computeDocumentDiff } from './diff'
import { computeContentHash } from './hash'

const FETCH_TIMEOUT_MS = 10_000
const MAX_RESPONSE_BYTES = 50 * 1024 * 1024  // 50MB
const USER_AGENT = 'TheRepublic/1.0 (https://the-republic.ca; document-monitor)'

export async function reIngestDocument(
  documentId: string,
  db: ReturnType<typeof getDb>
): Promise<{ changed: boolean; version?: typeof documentVersions.$inferSelect }> {
  // Fetch the document from DB
  const [doc] = await db
    .select({
      id: documents.id,
      sourceUrl: documents.sourceUrl,
      rawText: documents.rawText,
    })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1)

  if (!doc) {
    throw new Error(`Document not found: ${documentId}`)
  }

  if (!doc.sourceUrl) {
    throw new Error(`Document ${documentId} has no sourceUrl — cannot re-ingest`)
  }

  // SSRF protection
  if (!isValidDocumentUrl(doc.sourceUrl)) {
    throw new Error(`Invalid or blocked document URL: ${doc.sourceUrl}`)
  }

  // Determine the next version number
  const [maxVersionRow] = await db
    .select({ maxVersion: max(documentVersions.versionNumber) })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))

  const nextVersionNumber = (maxVersionRow?.maxVersion ?? 0) + 1

  // Fetch the latest version of the document
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  let responseText: string
  let is404 = false

  try {
    const response = await fetch(doc.sourceUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    })

    if (response.status === 404) {
      is404 = true
      responseText = ''
    } else if (!response.ok) {
      throw new Error(
        `Source URL returned HTTP ${response.status}: ${doc.sourceUrl}`
      )
    } else {
      // Guard against oversized responses
      const contentLength = response.headers.get('content-length')
      if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
        throw new Error(
          `Source URL response too large (${contentLength} bytes, limit ${MAX_RESPONSE_BYTES}): ${doc.sourceUrl}`
        )
      }

      // Stream with size guard
      const chunks: Uint8Array[] = []
      let totalBytes = 0
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error(`No response body from ${doc.sourceUrl}`)
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          totalBytes += value.byteLength
          if (totalBytes > MAX_RESPONSE_BYTES) {
            reader.cancel()
            throw new Error(
              `Source URL response exceeded 50MB size limit: ${doc.sourceUrl}`
            )
          }
          chunks.push(value)
        }
      }

      const combined = new Uint8Array(totalBytes)
      let offset = 0
      for (const chunk of chunks) {
        combined.set(chunk, offset)
        offset += chunk.byteLength
      }
      responseText = new TextDecoder().decode(combined)
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error(
        `Source URL fetch timed out after ${FETCH_TIMEOUT_MS}ms: ${doc.sourceUrl}`
      )
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }

  // Handle 404: document deleted at source
  if (is404) {
    const [version] = await db
      .insert(documentVersions)
      .values({
        documentId,
        versionNumber: nextVersionNumber,
        contentHash: null,
        previousVersionId: null,
        diffSummary: 'Document no longer available at source URL (404)',
        changeType: 'deleted',
        detectedAt: new Date(),
      })
      .returning()

    return { changed: true, version }
  }

  // Compare against stored rawText
  const storedText = doc.rawText ?? ''
  if (responseText === storedText) {
    return { changed: false }
  }

  // Content has changed — compute diff and create version record
  const diff = computeDocumentDiff(storedText, responseText)
  const newContentHash = computeContentHash(responseText)

  const [version] = await db
    .insert(documentVersions)
    .values({
      documentId,
      versionNumber: nextVersionNumber,
      contentHash: newContentHash,
      previousVersionId: null,
      diffSummary: diff.summary,
      changeType: 'content_changed',
      detectedAt: new Date(),
    })
    .returning()

  return { changed: true, version }
}
