import 'server-only'
import { voyageEmbed, voyageEmbedBatched } from './voyage'

/**
 * Server-only embedding wrapper over the Voyage AI client.
 *
 * Public interface is unchanged from the stub — callers see the same
 * generateEmbedding / generateEmbeddings signatures.
 *
 * Graceful-off: when VOYAGE_API_KEY is absent or the Voyage client
 * fails, both functions return null(s) — never throw.
 */

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const [result] = await voyageEmbed([text], 'document')
  return result ?? null
}

export async function generateEmbeddings(
  texts: string[]
): Promise<(number[] | null)[]> {
  return voyageEmbedBatched(texts, 'document')
}
