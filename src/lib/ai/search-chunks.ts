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
import { voyageEmbed, resolveVoyageApiKey } from './voyage'

export interface ChunkSearchResult {
  /** documentChunks.id: an opaque uuid, not citizen content. */
  id: string
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
 * Why a retrieval returned what it returned. Every return path of
 * searchDocumentChunksWithReason carries exactly one of these.
 */
export type RetrievalReason =
  | 'hits'
  | 'no-corpus'
  | 'corpus-check-failed'
  | 'no-api-key'
  | 'embed-failed'
  | 'below-threshold'
  | 'search-failed'

export interface ChunkSearchOutcome {
  results: ChunkSearchResult[]
  reason: RetrievalReason
  /** Rows the similarity query returned before the threshold; null if it never ran. */
  candidates: number | null
  /** Best pre-threshold similarity, rounded to 3 places; null if no rows or never ran. */
  bestSimilarity: number | null
}

const round3 = (n: number) => Math.round(n * 1000) / 1000

/**
 * A log-safe description of a DB error: its name and code only.
 * Never the message: a DrizzleQueryError message is "Failed query: <sql>
 * params: <params>", and here the params are the userId and the embedding of
 * the citizen's concern.
 */
function errorTag(err: unknown): string {
  if (!(err instanceof Error)) return typeof err
  const e = err as Error & { code?: unknown; cause?: { code?: unknown } }
  const code = e.code ?? e.cause?.code
  return code === undefined ? e.name : `${e.name} code=${String(code)}`
}

/** An outcome for a path that never reached the similarity query. */
const empty = (reason: RetrievalReason): ChunkSearchOutcome => ({
  results: [],
  reason,
  candidates: null,
  bestSimilarity: null,
})

/**
 * Search document chunks owned by a user using cosine similarity.
 * Thin wrapper over searchDocumentChunksWithReason that drops the reason.
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
 * @returns Array of matching chunks with id, title, content, and similarity
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
  const { results } = await searchDocumentChunksWithReason(db, userId, query, k, _queryVec)
  return results
}

/**
 * Same search as searchDocumentChunks, with each return tagged by the reason
 * it took. Used by the briefing pipeline to log what retrieval did.
 */
export async function searchDocumentChunksWithReason(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: PgDatabase<any, any, any>,
  userId: string,
  query: string,
  k: number = DEFAULT_K,
  _queryVec?: number[]
): Promise<ChunkSearchOutcome> {
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
    if (!found) return empty('no-corpus')
  } catch (err) {
    console.warn('[search-chunks] corpus-check failed:', errorTag(err))
    return empty('corpus-check-failed')
  }

  // --- Embed the query (or use a pre-computed vector for testing) ---
  let queryVec: number[] | null = _queryVec ?? null
  if (!queryVec) {
    // voyageEmbed never throws: a missing key, an HTTP error, a network failure
    // and a timeout all come back as [null]. The reason is decided from the key
    // check voyageEmbed itself applies, taken before the call, not from the null.
    // Same options object for both, so the key check cannot drift from the call.
    const embedOptions = { timeoutMs: QUERY_EMBED_TIMEOUT_MS }
    const hasApiKey = Boolean(resolveVoyageApiKey(embedOptions))
    try {
      const [vec] = await voyageEmbed([query], 'query', embedOptions)
      queryVec = vec ?? null
    } catch {
      // Defensive: the client's contract says it never throws.
      return empty('embed-failed')
    }
    if (!queryVec) return empty(hasApiKey ? 'embed-failed' : 'no-api-key')
  }

  // --- Cosine similarity search ---
  // Raw SQL with explicit ::vector cast — see module comment for rationale.
  // Similarity = 1 - cosine_distance (pgvector's <=> returns distance, not similarity).
  const vecLiteral = JSON.stringify(queryVec)

  try {
    const rows = await db
      .select({
        id: documentChunks.id,
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
    const results = rows
      .filter((r) => r.similarity >= SIMILARITY_THRESHOLD)
      .slice(0, k)
      .map((r) => ({
        id: r.id,
        title: r.title,
        content: r.content,
        similarity: r.similarity,
      }))
    // Pre-threshold view: candidates=0 with a corpus present points at recall
    // (e.g. HNSW post-filtering); candidates>0 with a best under the threshold
    // points at the threshold. Neither needs its own reason.
    const best = rows.reduce<number | null>(
      (m, r) => (m === null || r.similarity > m ? r.similarity : m),
      null
    )
    return {
      results,
      reason: results.length > 0 ? 'hits' : 'below-threshold',
      candidates: rows.length,
      bestSimilarity: best === null ? null : round3(best),
    }
  } catch (err) {
    console.warn('[search-chunks] similarity search failed:', errorTag(err))
    return empty('search-failed')
  }
}
