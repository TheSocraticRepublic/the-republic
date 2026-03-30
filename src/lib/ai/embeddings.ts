import 'server-only'

/**
 * Embedding stub — ready for Voyage AI or OpenAI plug-in.
 * Returns null until an embedding provider is configured.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  console.warn('Embedding provider not configured — semantic search disabled')
  void text
  return null
}

export async function generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  console.warn('Embedding provider not configured — semantic search disabled')
  return texts.map(() => null)
}
