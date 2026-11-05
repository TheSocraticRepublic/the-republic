import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchDocumentChunks, searchDocumentChunksWithReason } from '@/lib/ai/search-chunks'

// Mock the voyage client — searchDocumentChunks imports it via relative path
vi.mock('@/lib/ai/voyage', () => ({
  voyageEmbed: vi.fn(),
}))

import { voyageEmbed } from '@/lib/ai/voyage'
const mockVoyageEmbed = vi.mocked(voyageEmbed)

// Build a mock db that can be configured per test
function makeMockDb({
  corpusFound = false,
  executeError = false,
  searchRows = [] as Array<{ id?: string; title: string; content: string; similarity: number }>,
  searchError = false,
}: {
  corpusFound?: boolean
  executeError?: boolean
  searchRows?: Array<{ id?: string; title: string; content: string; similarity: number }>
  searchError?: boolean
} = {}) {
  const mockFrom = vi.fn()
  const mockWhere = vi.fn()
  const mockLimit = vi.fn()
  const mockOrderBy = vi.fn()
  const mockInnerJoin = vi.fn()
  const mockSelect = vi.fn()

  // Chain: db.execute(sql) — used for corpus check
  const mockExecute = vi.fn().mockImplementation(() => {
    if (executeError) return Promise.reject(new Error('DB error'))
    return Promise.resolve({ rows: [{ found: corpusFound }] })
  })

  // Chain: db.select().from().innerJoin().where().orderBy().limit()
  mockLimit.mockImplementation(() => {
    if (searchError) return Promise.reject(new Error('Search DB error'))
    return Promise.resolve(searchRows)
  })
  mockOrderBy.mockReturnValue({ limit: mockLimit })
  mockWhere.mockReturnValue({ orderBy: mockOrderBy })
  mockInnerJoin.mockReturnValue({ where: mockWhere })
  mockFrom.mockReturnValue({ innerJoin: mockInnerJoin })
  mockSelect.mockReturnValue({ from: mockFrom })

  return {
    execute: mockExecute,
    select: mockSelect,
  } as unknown as Parameters<typeof searchDocumentChunks>[0]
}

describe('searchDocumentChunks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns empty array when corpus has no embedded chunks (short-circuit)', async () => {
    const db = makeMockDb({ corpusFound: false })
    mockVoyageEmbed.mockResolvedValue([null])

    const result = await searchDocumentChunks(db, 'user-1', 'test query')
    expect(result).toEqual([])
    // Voyage should NOT be called when corpus is empty
    expect(mockVoyageEmbed).not.toHaveBeenCalled()
  })

  it('returns empty array when corpus check throws (graceful-off)', async () => {
    const db = makeMockDb({ executeError: true })
    const result = await searchDocumentChunks(db, 'user-1', 'test query')
    expect(result).toEqual([])
    expect(mockVoyageEmbed).not.toHaveBeenCalled()
  })

  it('returns empty array when query embedding returns null (no API key)', async () => {
    const db = makeMockDb({ corpusFound: true })
    mockVoyageEmbed.mockResolvedValue([null])

    const result = await searchDocumentChunks(db, 'user-1', 'test query')
    expect(result).toEqual([])
  })

  it('returns empty array when Voyage throws on query embedding', async () => {
    const db = makeMockDb({ corpusFound: true })
    mockVoyageEmbed.mockRejectedValue(new Error('Network error'))

    const result = await searchDocumentChunks(db, 'user-1', 'test query')
    expect(result).toEqual([])
  })

  it('returns empty array when similarity search throws (graceful-off)', async () => {
    const db = makeMockDb({ corpusFound: true, searchError: true })
    mockVoyageEmbed.mockResolvedValue([Array.from({ length: 1024 }, () => 0.1)])

    const result = await searchDocumentChunks(db, 'user-1', 'test query')
    expect(result).toEqual([])
  })

  it('returns results with correct shape when search succeeds', async () => {
    const searchRows = [
      { id: 'chunk-a', title: 'Doc A', content: 'Content A', similarity: 0.9 },
      { id: 'chunk-b', title: 'Doc B', content: 'Content B', similarity: 0.7 },
    ]
    const db = makeMockDb({ corpusFound: true, searchRows })
    mockVoyageEmbed.mockResolvedValue([Array.from({ length: 1024 }, () => 0.1)])

    const result = await searchDocumentChunks(db, 'user-1', 'test query')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ id: 'chunk-a', title: 'Doc A', content: 'Content A', similarity: 0.9 })
  })

  it('filters results below similarity threshold (0.5)', async () => {
    const searchRows = [
      { title: 'Doc A', content: 'Content A', similarity: 0.9 },
      { title: 'Doc B', content: 'Content B', similarity: 0.4 }, // below threshold
      { title: 'Doc C', content: 'Content C', similarity: 0.6 },
    ]
    const db = makeMockDb({ corpusFound: true, searchRows })
    mockVoyageEmbed.mockResolvedValue([Array.from({ length: 1024 }, () => 0.1)])

    const result = await searchDocumentChunks(db, 'user-1', 'test query')
    expect(result).toHaveLength(2)
    expect(result.every((r) => r.similarity >= 0.5)).toBe(true)
  })

  it('respects k limit — returns at most k results', async () => {
    const searchRows = Array.from({ length: 20 }, (_, i) => ({
      title: `Doc ${i}`,
      content: `Content ${i}`,
      similarity: 0.9 - i * 0.01,
    }))
    const db = makeMockDb({ corpusFound: true, searchRows })
    mockVoyageEmbed.mockResolvedValue([Array.from({ length: 1024 }, () => 0.1)])

    const result = await searchDocumentChunks(db, 'user-1', 'test query', 5)
    expect(result).toHaveLength(5)
  })

  it('passes query input_type to Voyage (not document)', async () => {
    const db = makeMockDb({ corpusFound: true, searchRows: [] })
    mockVoyageEmbed.mockResolvedValue([Array.from({ length: 1024 }, () => 0.1)])

    await searchDocumentChunks(db, 'user-1', 'civic query')

    expect(mockVoyageEmbed).toHaveBeenCalledWith(
      ['civic query'],
      'query',
      expect.objectContaining({ timeoutMs: expect.any(Number) })
    )
  })
})

describe('searchDocumentChunksWithReason', () => {
  const VEC = () => Array.from({ length: 1024 }, () => 0.1)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Each case asserts the tagged reason AND that the plain wrapper still
  // returns the same array it always did for the same inputs.
  async function both(db: ReturnType<typeof makeMockDb>, queryVec?: number[]) {
    const tagged = await searchDocumentChunksWithReason(db, 'user-1', 'test query', 5, queryVec)
    const plain = await searchDocumentChunks(db, 'user-1', 'test query', 5, queryVec)
    return { tagged, plain }
  }

  it("reason 'hits' when at least one result clears the threshold", async () => {
    const db = makeMockDb({
      corpusFound: true,
      searchRows: [
        { id: 'chunk-1', title: 'Doc A', content: 'Content A', similarity: 0.82 },
        { id: 'chunk-2', title: 'Doc B', content: 'Content B', similarity: 0.3 },
      ],
    })
    mockVoyageEmbed.mockResolvedValue([VEC()])
    const { tagged, plain } = await both(db)
    expect(tagged.reason).toBe('hits')
    expect(tagged.results).toEqual([{ id: 'chunk-1', title: 'Doc A', content: 'Content A', similarity: 0.82 }])
    expect(plain).toEqual(tagged.results)
  })

  it('every result carries the chunk id', async () => {
    const db = makeMockDb({
      corpusFound: true,
      searchRows: [
        { id: 'chunk-1', title: 'Doc A', content: 'Content A', similarity: 0.9 },
        { id: 'chunk-2', title: 'Doc B', content: 'Content B', similarity: 0.8 },
      ],
    })
    mockVoyageEmbed.mockResolvedValue([VEC()])
    const { tagged, plain } = await both(db)
    expect(tagged.results.map((r) => r.id)).toEqual(['chunk-1', 'chunk-2'])
    expect(plain.map((r) => r.id)).toEqual(['chunk-1', 'chunk-2'])
  })

  it("reason 'no-corpus' when the user has no embedded chunks", async () => {
    const db = makeMockDb({ corpusFound: false })
    const { tagged, plain } = await both(db)
    expect(tagged).toEqual({ results: [], reason: 'no-corpus' })
    expect(plain).toEqual([])
    expect(mockVoyageEmbed).not.toHaveBeenCalled()
  })

  it("reason 'corpus-check-failed' when the corpus check throws", async () => {
    const db = makeMockDb({ executeError: true })
    const { tagged, plain } = await both(db)
    expect(tagged).toEqual({ results: [], reason: 'corpus-check-failed' })
    expect(plain).toEqual([])
  })

  it("reason 'no-query-vector' when Voyage returns no vector (no key)", async () => {
    const db = makeMockDb({ corpusFound: true })
    mockVoyageEmbed.mockResolvedValue([null])
    const { tagged, plain } = await both(db)
    expect(tagged).toEqual({ results: [], reason: 'no-query-vector' })
    expect(plain).toEqual([])
  })

  it("reason 'embed-failed' when Voyage throws", async () => {
    const db = makeMockDb({ corpusFound: true })
    mockVoyageEmbed.mockRejectedValue(new Error('Network error'))
    const { tagged, plain } = await both(db)
    expect(tagged).toEqual({ results: [], reason: 'embed-failed' })
    expect(plain).toEqual([])
  })

  it("reason 'below-threshold' when every row is under 0.5", async () => {
    const db = makeMockDb({
      corpusFound: true,
      searchRows: [
        { id: 'chunk-1', title: 'Doc A', content: 'Content A', similarity: 0.49 },
        { id: 'chunk-2', title: 'Doc B', content: 'Content B', similarity: 0.2 },
      ],
    })
    const { tagged, plain } = await both(db, VEC())
    expect(tagged).toEqual({ results: [], reason: 'below-threshold' })
    expect(plain).toEqual([])
  })

  it("reason 'search-failed' when the similarity query throws", async () => {
    const db = makeMockDb({ corpusFound: true, searchError: true })
    const { tagged, plain } = await both(db, VEC())
    expect(tagged).toEqual({ results: [], reason: 'search-failed' })
    expect(plain).toEqual([])
  })
})
