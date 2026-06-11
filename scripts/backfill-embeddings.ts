/**
 * Backfill script: generates Voyage AI embeddings for document chunks that have
 * embedding IS NULL.
 *
 * Run with: npx tsx scripts/backfill-embeddings.ts
 *
 * Requirements:
 *   DATABASE_URL=... VOYAGE_API_KEY=... npx tsx scripts/backfill-embeddings.ts
 *
 * DO NOT RUN in automated CI — this script makes live Voyage API calls and
 * writes to the production database. Intended for one-time backfill after
 * VOYAGE_API_KEY is first configured.
 *
 * ⚠ PENDING VERIFICATION: needs a working DATABASE_URL (local direct-connection
 * host is unreachable; run against a staging or production DB with correct URL).
 */

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { isNull, eq } from 'drizzle-orm'
import { documentChunks, documents } from '../src/lib/db/schema'
import { voyageEmbedBatched } from '../src/lib/ai/voyage'

const BATCH_SIZE = 64
const MAX_RETRIES_ON_429 = 3
const BASE_BACKOFF_MS = 2000

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function embedWithRetry(
  texts: string[],
  apiKey: string,
  attempt = 0
): Promise<(number[] | null)[]> {
  const result = await voyageEmbedBatched(texts, 'document', { apiKey })

  // voyageEmbedBatched returns nulls on HTTP errors (including 429).
  // If every result is null it likely means a 429 — retry with backoff.
  const allNull = result.every((r) => r === null)
  if (allNull && attempt < MAX_RETRIES_ON_429) {
    const backoff = BASE_BACKOFF_MS * 2 ** attempt
    console.warn(`  [backfill] all nulls (possible 429), backing off ${backoff}ms...`)
    await sleep(backoff)
    return embedWithRetry(texts, apiKey, attempt + 1)
  }

  return result
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required')
    process.exit(1)
  }

  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) {
    console.error('VOYAGE_API_KEY environment variable is required')
    process.exit(1)
  }

  const client = postgres(databaseUrl, { max: 1 })
  const db = drizzle(client)

  // Fetch all chunks with missing embeddings
  const nullChunks = await db
    .select({
      id: documentChunks.id,
      content: documentChunks.content,
    })
    .from(documentChunks)
    .innerJoin(documents, eq(documentChunks.documentId, documents.id))
    .where(isNull(documentChunks.embedding))

  const total = nullChunks.length
  if (total === 0) {
    console.log('No chunks with missing embeddings found. Nothing to do.')
    await client.end()
    return
  }

  console.log(`Found ${total} chunks with missing embeddings. Processing in batches of ${BATCH_SIZE}...`)

  let embedded = 0
  let skipped = 0

  for (let i = 0; i < nullChunks.length; i += BATCH_SIZE) {
    const batch = nullChunks.slice(i, i + BATCH_SIZE)
    const texts = batch.map((c) => c.content)

    console.log(`  batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(total / BATCH_SIZE)}: ${batch.length} chunks`)

    const embeddings = await embedWithRetry(texts, apiKey)

    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j]
      const embedding = embeddings[j]

      if (!embedding) {
        console.warn(`    skip chunk ${chunk.id} (embedding failed)`)
        skipped++
        continue
      }

      await db
        .update(documentChunks)
        .set({ embedding })
        .where(eq(documentChunks.id, chunk.id))

      embedded++
    }
  }

  console.log(`\nDone. ${embedded} embedded, ${skipped} skipped.`)
  await client.end()
}

main().catch((err) => {
  console.error('Backfill failed:', err)
  process.exit(1)
})
