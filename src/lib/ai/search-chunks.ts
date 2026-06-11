/**
 * Document chunk retrieval via cosine similarity.
 *
 * NO 'server-only' import — this module is used by scripts run under tsx.
 * Takes db as a parameter (never calls getDb internally) for testability.
 *
 * Design decisions:
 * - Uses raw sql`${col} <=> ${JSON.stringify(vec)}::vector` rather than
 *   Drizzle's cosineDistance helper. Drizzle serialises the array with
 *   JSON.stringify and inlines it into the SQL template, but omits the
 *   ::vector cast the pgvector driver requires; the raw form is explicit.
 * - Empty-corpus short-circuit avoids a Voyage API call when there are
 *   no embedded chunks to search against.
 */

import { sql, eq, and, isNotNull } from 'drizzle-orm'
import type { PgDatabase } from 'drizzle-orm/pg-core'
import { documents, documentChunks } from '../db/schema'
import { voyageEmbed } from './voyage'

export interface ChunkSearchResult {
  title: string
  content: string
  similarity: number
}

// Cosine similarity threshold — chunks below this are not returned
const SIMILARITY_THRESHOLD = 0.5

// Maximum number of results to return
const DEFAULT_K = 5

// Timeout for the query embedding call (milliseconds)
const QUERY_EMBED_TIMEOUT_MS = 2500

/**
 * Search document chunks owned by a user using cosine similarity.
 *
 * Per-user scoping is non-negotiable: the WHERE clause filters both
 * documents.userId and documents.status so a user can never retrieve
 * another user's chunks.
 *
 * @param db - Drizzle database instance (direct-connection or pooled)
 * @param userId - The authenticated user's UUID
 * @param query - The search query text
 * @param k - Maximum number of results to return (default: 5)
 * @param _queryVec - Optional pre-computed query vector (bypasses Voyage; used by tests)
 * @returns Array of matching chunks with title, content, and similarity
 */
export async function searchDocumentChunks(
  // PgDatabase is the common base for both drizzle-orm/postgres-js and pooled variants.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: PgDatabase<any, any, any>,
  userId: string,
  query: string,
  k: number = DEFAULT_K,
  _queryVec?: number[]
): Promise<ChunkSearchResult[]> {
  // --- Empty-corpus short-circuit ---
  // Skip the Voyage call entirely if the user has no embedded chunks.
  try {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1
        FROM ${documentChunks}
        INNER JOIN ${documents} ON ${documentChunks.documentId} = ${documents.id}
        WHERE ${documents.userId} = ${userId}
          AND ${documents.status} = 'ready'
          AND ${documentChunks.embedding} IS NOT NULL
      ) AS found
    `)
    const found = result.rows?.[0]?.found ?? result[0]?.found ?? false
    if (!found) return []
  } catch (err) {
    console.warn('[search-chunks] corpus-check failed:', err instanceof Error ? err.message : err)
    return []
  }

  // --- Embed the query (or use a pre-computed vector for testing) ---
  let queryVec: number[] | null = _queryVec ?? null
  if (!queryVec) {
    try {
      const [vec] = await voyageEmbed([query], 'query', { timeoutMs: QUERY_EMBED_TIMEOUT_MS })
      queryVec = vec ?? null
    } catch {
      return []
    }
    if (!queryVec) return []
  }

  // --- Cosine similarity search ---
  // Raw SQL with explicit ::vector cast — see module comment for rationale.
  // Similarity = 1 - cosine_distance (pgvector's <=> returns distance, not similarity).
  const vecLiteral = JSON.stringify(queryVec)

  try {
    const rows = await db
      .select({
        title: documents.title,
        content: documentChunks.content,
        similarity: sql<number>`1 - (${documentChunks.embedding} <=> ${vecLiteral}::vector)`.as('similarity'),
      })
      .from(documentChunks)
      .innerJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(
        and(
          eq(documents.userId, userId),
          eq(documents.status, 'ready'),
          isNotNull(documentChunks.embedding)
        )
      )
      .orderBy(sql`${documentChunks.embedding} <=> ${vecLiteral}::vector`)
      // Fetch more than k to apply threshold filter after retrieval
      .limit(k * 4)

    // Apply similarity threshold and return top-k
    return rows
      .filter((r) => r.similarity >= SIMILARITY_THRESHOLD)
      .slice(0, k)
      .map((r) => ({
        title: r.title,
        content: r.content,
        similarity: r.similarity,
      }))
  } catch (err) {
    console.warn('[search-chunks] similarity search failed:', err instanceof Error ? err.message : err)
    return []
  }
}
