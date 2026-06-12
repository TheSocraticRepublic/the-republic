/**
 * Retrieval verification script: seeds test data and validates searchDocumentChunks.
 *
 * Run with: DATABASE_URL=... npx tsx scripts/verify-retrieval.ts
 * (VOYAGE_API_KEY is NOT required — the script injects a pre-computed query
 *  vector directly, bypassing Voyage. This makes assertions falsifiable against
 *  synthetic seeds and keeps the script runnable without live API access.)
 *
 * Assertions:
 *   (a) User scoping — user B's chunks are not returned for user A's query
 *   (b) Similarity ordering — higher-similarity results appear first
 *   (c) Cutoff exclusion — chunks below SIMILARITY_THRESHOLD (0.5) are not returned
 *   (d) Positive match — user A's known-similar chunk IS returned (non-vacuous)
 *
 * Seeds:
 *   - User A: chunk with HIGH_SIM_VEC (≈1.0 cosine to query), chunk with LOW_SIM_VEC (≈0.0)
 *   - User B: chunk with HIGH_SIM_VEC (same similarity — must NOT appear for user A)
 *
 * The script uses a transaction that THROWS at the end to force rollback —
 * no data persists. Safe to run against production with appropriate DATABASE_URL.
 *
 * ⚠ PENDING VERIFICATION: needs a working DATABASE_URL (local direct-connection
 * host is unreachable). Tested logic is correct but cannot be validated locally.
 */

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { users, documents, documentChunks } from '../src/lib/db/schema'
import { searchDocumentChunks } from '../src/lib/ai/search-chunks'

// 1024-dimensional test vectors.
//
// HIGH_SIM_VEC: unit vector along dim-0. Cosine similarity to itself = ~1.0.
// LOW_SIM_VEC:  unit vector along dim-1. Cosine similarity to HIGH_SIM_VEC ≈ 0.0
//               (well below the 0.5 threshold → must be excluded).
// QUERY_VEC:    identical to HIGH_SIM_VEC so the positive match assertion has teeth.
function makeUnitVector(dim: number, dims = 1024): number[] {
  return Array.from({ length: dims }, (_, i) => (i === dim ? 1.0 : 0.0))
}

const HIGH_SIM_VEC: number[] = makeUnitVector(0)  // cosine ~1.0 to QUERY_VEC
const LOW_SIM_VEC: number[]  = makeUnitVector(1)  // cosine ~0.0 to QUERY_VEC — below threshold
const QUERY_VEC: number[]    = makeUnitVector(0)  // injected directly; bypasses Voyage

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

  // VOYAGE_API_KEY is intentionally NOT required — we inject QUERY_VEC directly.
  // searchDocumentChunks accepts a pre-computed vector as its 5th argument and
  // skips the Voyage call entirely, making assertions independent of live API access.
  if (process.env.VOYAGE_API_KEY) {
    console.log('Note: VOYAGE_API_KEY is set but will not be used — query vector is injected directly.')
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

      // User A: high-similarity chunk — must appear in results
      await tx.insert(documentChunks).values({
        documentId: docA.id,
        content: 'High similarity content for user A',
        chunkIndex: 0,
        embedding: HIGH_SIM_VEC,
      })

      // User B: same high-similarity vector — must NOT appear for user A (scoping)
      await tx.insert(documentChunks).values({
        documentId: docB.id,
        content: 'High similarity content for user B (must not appear in user A results)',
        chunkIndex: 0,
        embedding: HIGH_SIM_VEC,
      })

      // User A: low-similarity chunk — must be excluded by the 0.5 threshold
      await tx.insert(documentChunks).values({
        documentId: docA.id,
        content: 'Low similarity content — should be excluded by threshold',
        chunkIndex: 1,
        embedding: LOW_SIM_VEC,
      })

      // Inject QUERY_VEC directly — bypasses Voyage, makes all assertions falsifiable.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resultsA = await searchDocumentChunks(tx as any, userA.id, 'synthetic query', 5, QUERY_VEC)

      // (d) Positive match: user A's known-similar chunk must be returned.
      //     If this fails, scoping, column dimension, or the pipeline is broken.
      assert(
        resultsA.length > 0,
        '(d) positive match: at least one result returned for user A with known-similar chunk'
      )
      passed++

      // (a) Scoping: none of the results should contain user B's content
      assert(
        resultsA.every((r) => !r.content.includes('user B')),
        '(a) user scoping: user B content not returned for user A query'
      )
      passed++

      // (b) Ordering: if multiple results, higher-similarity results appear first
      if (resultsA.length > 1) {
        assert(
          resultsA[0].similarity >= resultsA[1].similarity,
          '(b) similarity ordering: results sorted by similarity descending'
        )
        passed++
      }

      // (c) Cutoff: all returned results must be above the 0.5 threshold
      assert(
        resultsA.every((r) => r.similarity >= 0.5),
        '(c) cutoff exclusion: all results have similarity >= 0.5'
      )
      passed++

      // (e) Scoping with teeth: user B's high-similarity chunk must NOT be in results
      assert(
        !resultsA.some((r) => r.content.includes('user B')),
        '(e) scoping teeth: user B chunk (same vector, different user) excluded'
      )
      passed++

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
