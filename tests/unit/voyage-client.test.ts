import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { voyageEmbed, voyageEmbedBatched } from '@/lib/ai/voyage'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeVoyageResponse(embeddings: number[][]): Response {
  const body = JSON.stringify({
    data: embeddings.map((embedding, index) => ({ embedding, index })),
  })
  return new Response(body, { status: 200 })
}

function makeErrorResponse(status: number): Response {
  return new Response(JSON.stringify({ error: 'API error' }), { status })
}

describe('voyageEmbed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns nulls for all inputs when VOYAGE_API_KEY is missing', async () => {
    vi.stubEnv('VOYAGE_API_KEY', '')
    const result = await voyageEmbed(['hello', 'world'], 'document')
    expect(result).toEqual([null, null])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns null array when no API key is provided via options', async () => {
    vi.stubEnv('VOYAGE_API_KEY', '')
    const result = await voyageEmbed(['text'], 'query', { apiKey: undefined })
    expect(result).toEqual([null])
  })

  it('uses apiKey from options when provided, overriding env', async () => {
    vi.stubEnv('VOYAGE_API_KEY', 'env-key')
    const embeddings = [[0.1, 0.2, 0.3]]
    mockFetch.mockResolvedValueOnce(makeVoyageResponse(embeddings))

    const result = await voyageEmbed(['text'], 'document', { apiKey: 'options-key' })
    expect(result).toEqual([embeddings[0]])

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer options-key')
  })

  it('returns aligned embeddings for successful response', async () => {
    vi.stubEnv('VOYAGE_API_KEY', 'test-key')
    const embeddings = [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]]
    mockFetch.mockResolvedValueOnce(makeVoyageResponse(embeddings))

    const result = await voyageEmbed(['a', 'b', 'c'], 'document')
    expect(result).toEqual(embeddings)
  })

  it('preserves index alignment when Voyage returns out-of-order', async () => {
    vi.stubEnv('VOYAGE_API_KEY', 'test-key')
    // Voyage returns index 2 first, then 0, then 1
    const body = JSON.stringify({
      data: [
        { embedding: [0.5, 0.6], index: 2 },
        { embedding: [0.1, 0.2], index: 0 },
        { embedding: [0.3, 0.4], index: 1 },
      ],
    })
    mockFetch.mockResolvedValueOnce(new Response(body, { status: 200 }))

    const result = await voyageEmbed(['a', 'b', 'c'], 'document')
    expect(result[0]).toEqual([0.1, 0.2])
    expect(result[1]).toEqual([0.3, 0.4])
    expect(result[2]).toEqual([0.5, 0.6])
  })

  it('returns nulls on HTTP error (non-200)', async () => {
    vi.stubEnv('VOYAGE_API_KEY', 'test-key')
    mockFetch.mockResolvedValueOnce(makeErrorResponse(500))

    const result = await voyageEmbed(['text'], 'document')
    expect(result).toEqual([null])
  })

  it('returns nulls on HTTP 429 rate limit', async () => {
    vi.stubEnv('VOYAGE_API_KEY', 'test-key')
    mockFetch.mockResolvedValueOnce(makeErrorResponse(429))

    const result = await voyageEmbed(['text'], 'document')
    expect(result).toEqual([null])
  })

  it('returns nulls when fetch throws (network error)', async () => {
    vi.stubEnv('VOYAGE_API_KEY', 'test-key')
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const result = await voyageEmbed(['text'], 'document')
    expect(result).toEqual([null])
  })

  it('returns nulls on timeout (AbortError)', async () => {
    vi.stubEnv('VOYAGE_API_KEY', 'test-key')
    const abortError = new DOMException('The operation was aborted', 'AbortError')
    mockFetch.mockRejectedValueOnce(abortError)

    const result = await voyageEmbed(['text'], 'document')
    expect(result).toEqual([null])
  })

  it('passes input_type correctly to API', async () => {
    vi.stubEnv('VOYAGE_API_KEY', 'test-key')
    mockFetch.mockResolvedValueOnce(makeVoyageResponse([[0.1]]))

    await voyageEmbed(['query text'], 'query')

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(options.body as string)
    expect(body.input_type).toBe('query')
    expect(body.model).toBe('voyage-4-lite')
  })

  it('returns empty array for empty input', async () => {
    vi.stubEnv('VOYAGE_API_KEY', 'test-key')
    const result = await voyageEmbed([], 'document')
    expect(result).toEqual([])
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('voyageEmbedBatched — batching math', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('makes a single call for inputs within one batch (≤128)', async () => {
    vi.stubEnv('VOYAGE_API_KEY', 'test-key')
    const texts = Array.from({ length: 10 }, (_, i) => `text-${i}`)
    const embeddings = texts.map(() => [0.1, 0.2])
    mockFetch.mockResolvedValueOnce(makeVoyageResponse(embeddings))

    const result = await voyageEmbedBatched(texts, 'document')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(10)
  })

  it('makes multiple calls when inputs exceed 128', async () => {
    vi.stubEnv('VOYAGE_API_KEY', 'test-key')
    const texts = Array.from({ length: 300 }, (_, i) => `text-${i}`)

    // 3 batches: 128, 128, 44
    for (let i = 0; i < 3; i++) {
      const batchSize = i < 2 ? 128 : 44
      const batchEmbeddings = Array.from({ length: batchSize }, () => [0.1, 0.2])
      mockFetch.mockResolvedValueOnce(makeVoyageResponse(batchEmbeddings))
    }

    const result = await voyageEmbedBatched(texts, 'document')
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(result).toHaveLength(300)
  })

  it('continues processing remaining batches when one batch fails', async () => {
    vi.stubEnv('VOYAGE_API_KEY', 'test-key')
    const texts = Array.from({ length: 200 }, (_, i) => `text-${i}`)

    // First batch fails
    mockFetch.mockResolvedValueOnce(makeErrorResponse(500))
    // Second batch succeeds
    const secondBatchEmbeddings = Array.from({ length: 72 }, () => [0.9, 0.8])
    mockFetch.mockResolvedValueOnce(makeVoyageResponse(secondBatchEmbeddings))

    const result = await voyageEmbedBatched(texts, 'document')
    expect(result).toHaveLength(200)
    // First batch (0-127) should be nulls
    expect(result[0]).toBeNull()
    expect(result[127]).toBeNull()
    // Second batch (128-199) should have embeddings
    expect(result[128]).toEqual([0.9, 0.8])
    expect(result[199]).toEqual([0.9, 0.8])
  })

  it('returns all nulls without API key (no fetch calls)', async () => {
    vi.stubEnv('VOYAGE_API_KEY', '')
    const texts = Array.from({ length: 5 }, (_, i) => `text-${i}`)

    const result = await voyageEmbedBatched(texts, 'document')
    expect(mockFetch).not.toHaveBeenCalled()
    expect(result).toEqual([null, null, null, null, null])
  })
})
