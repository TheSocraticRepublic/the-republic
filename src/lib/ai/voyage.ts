/**
 * Voyage AI embedding client.
 *
 * Intentionally NO 'server-only' import — this module must be usable
 * from scripts run under tsx (e.g. scripts/backfill-embeddings.ts),
 * which cannot resolve Next.js server-only stubs.
 *
 * Graceful-off contract: missing VOYAGE_API_KEY or any failure → nulls.
 * Never throws. All embedding errors are swallowed here.
 */

const VOYAGE_ENDPOINT = 'https://api.voyageai.com/v1/embeddings'
const VOYAGE_MODEL = 'voyage-4-lite'
const MAX_BATCH_SIZE = 128
const DEFAULT_TIMEOUT_MS = 4000

export type VoyageInputType = 'document' | 'query'

export interface VoyageClientOptions {
  apiKey?: string
  timeoutMs?: number
}

/**
 * Embed a batch of texts. Returns an aligned array of embeddings or nulls.
 * A null at position i means that text failed to embed (or the key is absent).
 *
 * @param texts - Input strings to embed (max 128 per call, caller must batch)
 * @param inputType - 'document' for indexing, 'query' for retrieval queries
 * @param options - Optional override for apiKey and timeoutMs
 */
export async function voyageEmbed(
  texts: string[],
  inputType: VoyageInputType,
  options: VoyageClientOptions = {}
): Promise<(number[] | null)[]> {
  if (texts.length === 0) return []

  const apiKey = options.apiKey ?? process.env.VOYAGE_API_KEY
  if (!apiKey) {
    // No key configured — graceful-off, not an error
    return texts.map(() => null)
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  try {
    const res = await fetch(VOYAGE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: texts,
        model: VOYAGE_MODEL,
        input_type: inputType,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!res.ok) {
      console.warn(`[voyage] HTTP ${res.status} from embedding API`)
      return texts.map(() => null)
    }

    const data = (await res.json()) as {
      data: Array<{ embedding: number[]; index: number }>
    }

    // Build aligned result array — Voyage returns objects with an index field
    const result: (number[] | null)[] = texts.map(() => null)
    for (const item of data.data ?? []) {
      if (typeof item.index === 'number' && Array.isArray(item.embedding)) {
        result[item.index] = item.embedding
      }
    }
    return result
  } catch (err) {
    console.warn('[voyage] Embedding request failed:', err instanceof Error ? err.message : err)
    return texts.map(() => null)
  }
}

/**
 * Embed texts in batches of up to MAX_BATCH_SIZE, returning a flat aligned array.
 * Per-batch failures produce nulls for that batch; other batches are unaffected.
 *
 * @param texts - All input strings
 * @param inputType - 'document' or 'query'
 * @param options - Optional override for apiKey and timeoutMs
 */
export async function voyageEmbedBatched(
  texts: string[],
  inputType: VoyageInputType,
  options: VoyageClientOptions = {}
): Promise<(number[] | null)[]> {
  if (texts.length === 0) return []

  const results: (number[] | null)[] = new Array(texts.length).fill(null)

  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batchTexts = texts.slice(i, i + MAX_BATCH_SIZE)
    const batchResults = await voyageEmbed(batchTexts, inputType, options)
    for (let j = 0; j < batchResults.length; j++) {
      results[i + j] = batchResults[j]
    }
  }

  return results
}
