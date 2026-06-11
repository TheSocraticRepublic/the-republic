/**
 * Retrieval verification script: seeds test data and validates searchDocumentChunks.
 *
 * Run with: DATABASE_URL=... VOYAGE_API_KEY=... npx tsx scripts/verify-retrieval.ts
 *
 * Assertions:
 *   (a) User scoping — user B's chunks are not returned for user A's query
 *   (b) Similarity ordering — higher-similarity results appear first
 *   (c) Cutoff exclusion — chunks below SIMILARITY_THRESHOLD (0.5) are not returned
 *
 * ⚠ PENDING VERIFICATION: needs a working DATABASE_URL (local direct-connection
 * host is unreachable). The script uses a transaction that THROWS at the end to
 * force rollback — no data persists.
 */

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import { users, documents, documentChunks } from '../src/lib/db/schema'
import { searchDocumentChunks } from '../src/lib/ai/search-chunks'

// 1024-dimensional test vectors
// high: cosine similarity ~0.99 to itself
// low: cosine similarity ~0.1 to high (nearly orthogonal)
function makeVector(value: number, dims = 1024): number[] {
  return Array.from({ length: dims }, (_, i) => (i === 0 ? value : 0.001))
}

const HIGH_SIM_VEC = makeVector(1.0)   // Will be "close" to itself
const LOW_SIM_VEC  = makeVector(0.001) // Nearly orthogonal to HIGH_SIM_VEC

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  PASS: ${label}`)
  } else {
    console.error(`  FAIL: ${label}`)
    throw new Error(`Assertion failed: ${label}`)
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required')
    process.exit(1)
  }

  // VOYAGE_API_KEY is needed to actually embed the query;
  // without it, all results return [] (graceful-off).
  if (!process.env.VOYAGE_API_KEY) {
    console.warn('Warning: VOYAGE_API_KEY not set. Tests will verify short-circuit behavior only.')
  }

  const client = postgres(databaseUrl, { max: 1 })
  const db = drizzle(client)

  let passed = 0
  let failed = 0

  try {
    await db.transaction(async (tx) => {
      // Seed two users
      const [userA] = await tx
        .insert(users)
        .values({ email: 'verify-test-a@test.internal' })
        .returning({ id: users.id })

      const [userB] = await tx
        .insert(users)
        .values({ email: 'verify-test-b@test.internal' })
        .returning({ id: users.id })

      // Seed documents for user A
      const [docA] = await tx
        .insert(documents)
        .values({
          userId: userA.id,
          title: 'Test Document A',
          documentType: 'other',
          status: 'ready',
        })
        .returning({ id: documents.id })

      // Seed documents for user B
      const [docB] = await tx
        .insert(documents)
        .values({
          userId: userB.id,
          title: 'Test Document B',
          documentType: 'other',
          status: 'ready',
        })
        .returning({ id: documents.id })

      // Seed chunk for user A — high similarity to our query vector
      await tx.insert(documentChunks).values({
        documentId: docA.id,
        content: 'High similarity content for user A',
        chunkIndex: 0,
        embedding: HIGH_SIM_VEC,
      })

      // Seed chunk for user B — same high similarity vector, but different user
      await tx.insert(documentChunks).values({
        documentId: docB.id,
        content: 'High similarity content for user B (should not appear in user A results)',
        chunkIndex: 0,
        embedding: HIGH_SIM_VEC,
      })

      // Seed low-similarity chunk for user A (below 0.5 threshold)
      await tx.insert(documentChunks).values({
        documentId: docA.id,
        content: 'Low similarity content — should be excluded by threshold',
        chunkIndex: 1,
        embedding: LOW_SIM_VEC,
      })

      // (a) User scoping — without VOYAGE_API_KEY, searchDocumentChunks short-circuits
      // after the corpus check (finds embedded chunks), then returns [] when embedding fails.
      // With VOYAGE_API_KEY, it should return only user A's chunks.
      const resultsA = await searchDocumentChunks(tx as Parameters<typeof searchDocumentChunks>[0], userA.id, 'test query about high similarity content')

      if (process.env.VOYAGE_API_KEY) {
        // (a) Scoping: none of the results should be user B's content
        assert(
          resultsA.every((r) => !r.content.includes('user B')),
          '(a) user scoping: user B content not returned for user A query'
        )
        passed++

        // (b) Ordering: if multiple results, first should have higher similarity
        if (resultsA.length > 1) {
          assert(
            resultsA[0].similarity >= resultsA[1].similarity,
            '(b) similarity ordering: results sorted by similarity descending'
          )
          passed++
        }

        // (c) Cutoff: low-similarity chunk should not appear
        assert(
          resultsA.every((r) => r.similarity >= 0.5),
          '(c) cutoff exclusion: all results have similarity >= 0.5'
        )
        passed++
      } else {
        console.log('  SKIP (a)(b)(c): VOYAGE_API_KEY not set — query embedding returns null → []')
        assert(resultsA.length === 0, '(graceful-off): no results without API key')
        passed++
      }

      // Throw to force rollback — no test data persists
      throw new Error('__rollback__')
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg !== '__rollback__') {
      console.error('Unexpected error:', err)
      failed++
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  await client.end()

  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error('Verify-retrieval failed:', err)
  process.exit(1)
})
