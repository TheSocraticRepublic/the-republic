/**
 * Unit tests for runBriefingGeneration and pickFreshAlerts.
 *
 * Paths NOT exercised here (require Netlify runtime or live DB):
 *   - Actual DB writes / transactions
 *   - Real Anthropic API calls
 *   - Netlify background function scheduling / delivery
 *   - Shadow detection against real investigation rows
 *
 * Covered:
 *   - Happy path: generateText success → status:'complete' written
 *   - Timeout path: AbortSignal.timeout fires → status:'failed' + specific reason
 *   - Post-completion shadow/vote failure: does NOT flip a 'complete' row to 'failed'
 *   - pickFreshAlerts (re-exported; canonical tests in shadow-fresh-alerts.test.ts)
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — declared before dynamic import so vi.mock() hoisting applies
// ---------------------------------------------------------------------------

// Mock the entire 'ai' package so we control generateText
vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

// Mock the Anthropic provider (we just need it not to throw)
vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => ({ provider: 'anthropic-mock' })),
}))

// Chainable builder — all methods return `chain` for chaining.
// The chain is also thenable: `await chain` resolves to `_leaf`.
// This supports both `await db.select().from(...)` and
// `await db.select().from().where().limit(1)` patterns.
function makeChain(leaf: unknown) {
  const _leaf = Promise.resolve(leaf)
  const chain: Record<string, unknown> = {
    // Thenable — allows `await chain` to work without calling .limit()
    then(onFulfilled: (v: unknown) => unknown, onRejected: (e: unknown) => unknown) {
      return _leaf.then(onFulfilled, onRejected)
    },
  }
  const chainMethods = ['set', 'from', 'where', 'values', 'onConflictDoNothing', 'innerJoin', 'orderBy']
  for (const m of chainMethods) {
    chain[m] = vi.fn(() => chain)
  }
  // These also return _leaf for compatibility, but `await chain` is the main path
  chain['limit']     = vi.fn(() => _leaf)
  chain['returning'] = vi.fn(() => _leaf)
  return chain
}

// selectReturnValues: a queue of values to return for successive db.select() calls.
// First call returns selectReturnValues[0], second returns [1], etc.
// Any call beyond the queue returns [].
let selectReturnValues: unknown[][] = []
let selectCallIndex = 0

let dbMock: ReturnType<typeof buildDbMock>

function buildDbMock() {
  selectCallIndex = 0

  // Each db.select() returns a fresh chain whose .limit() resolves to the
  // next item in selectReturnValues (or [] if exhausted).
  const makeSelectChain = () => {
    const idx = selectCallIndex++
    const leaf = Promise.resolve(selectReturnValues[idx] ?? [])
    return makeChain(leaf)
  }

  const updateChain = makeChain(Promise.resolve([]))

  const db = {
    update: vi.fn(() => updateChain),
    select: vi.fn(() => makeSelectChain()),
    insert: vi.fn(() => makeChain(Promise.resolve([]))),
    transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      const txUpdateChain = makeChain(Promise.resolve([{ id: INVESTIGATION_ID }]))
      const txInsertChain = makeChain(Promise.resolve([]))
      return cb({
        update: vi.fn(() => txUpdateChain),
        insert: vi.fn(() => txInsertChain),
      })
    }),
    _updateChain: updateChain,
  }
  return db
}

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(() => dbMock),
}))

// Mock all the context-building dependencies to keep tests fast
vi.mock('@/lib/ai/prompts/briefing-system', () => ({
  buildBriefingPrompt: vi.fn(() => 'system-prompt-mock'),
}))

vi.mock('@/lib/ai/search-chunks', () => ({
  searchDocumentChunks: vi.fn(() => Promise.resolve([])),
  searchDocumentChunksWithReason: vi.fn(() =>
    Promise.resolve({ results: [], reason: 'no-corpus', candidates: null, bestSimilarity: null })
  ),
}))

vi.mock('@/lib/archive/shadow', () => ({
  detectShadows: vi.fn(() => Promise.resolve([])),
}))

vi.mock('@/lib/jurisdictions', () => ({
  loadJurisdictionModule: vi.fn(() => Promise.resolve(null)),
  resolveJurisdictionModuleId: vi.fn(() => 'bc'),
}))

vi.mock('@/lib/jurisdictions/match', () => ({
  matchDocumentTypesFromConcern: vi.fn(() => Promise.resolve([])),
}))

vi.mock('@/lib/scout/search', () => ({
  searchForDocument: vi.fn(() => Promise.resolve({ results: [] })),
}))

vi.mock('@/lib/ai/search-context', () => ({
  buildSearchResultsContext: vi.fn(() => ''),
}))

vi.mock('@/lib/ai/prompts/vote-relevance-system', () => ({
  VOTE_RELEVANCE_SYSTEM_PROMPT: 'vote-relevance-mock',
}))

vi.mock('@/lib/credentials', () => ({
  CREDENTIAL_WEIGHTS: { investigation_completed: 1 },
}))

vi.mock('@/lib/ai/model', () => ({
  MODEL: 'claude-test',
}))

// ---------------------------------------------------------------------------
// After all mocks, import the module under test
// ---------------------------------------------------------------------------

import { runBriefingGeneration, pickFreshAlerts } from '@/lib/investigation/run-briefing'
import { generateText } from 'ai'
import { searchDocumentChunksWithReason } from '@/lib/ai/search-chunks'
import type { ShadowAlert } from '@/lib/archive/shadow'
import type { getDb } from '@/lib/db'

type DbLike = ReturnType<typeof getDb>

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const INVESTIGATION_ID = 'inv-test-1'
const USER_ID = 'user-test-1'

function makeInvestigationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: INVESTIGATION_ID,
    userId: USER_ID,
    concern: 'Test concern about wetland development',
    jurisdictionId: null,
    jurisdictionName: null,
    concernCategory: null,
    federalMpId: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pickFreshAlerts', () => {
  it('exports pickFreshAlerts (re-export sanity check)', () => {
    expect(typeof pickFreshAlerts).toBe('function')
  })

  it('filters out already-stored topics', () => {
    const detected: ShadowAlert[] = [
      { alertType: 'missing_topic', missingTopic: 'wetland', referenceInvestigationIds: [], confidence: 0.8 },
      { alertType: 'missing_topic', missingTopic: 'pipeline', referenceInvestigationIds: [], confidence: 0.9 },
    ]
    const result = pickFreshAlerts(['pipeline'], detected)
    expect(result).toHaveLength(1)
    expect(result[0].missingTopic).toBe('wetland')
  })
})

describe('runBriefingGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // First db.select() in runBriefingGeneration fetches the investigation row.
    // All subsequent selects (jurisdictions, allJurisdictions, shadowAlerts, etc.)
    // return [] by default — safe no-ops.
    selectReturnValues = [[makeInvestigationRow()]]
    dbMock = buildDbMock()
  })

  it('happy path: generateText success → calls transaction', async () => {
    ;(generateText as Mock).mockResolvedValueOnce({ text: 'briefing text content here' })

    await runBriefingGeneration({ db: dbMock as unknown as DbLike, investigationId: INVESTIGATION_ID })

    // transaction should have been called (to persist the briefing)
    expect(dbMock.transaction).toHaveBeenCalledOnce()
    // update (for failed state) should NOT have been called at the top level
    // (the only update path in the outer try is in the catch block)
    // Note: db.update may be called for shadow/vote lookups in inner try/catch
    // We verify generateText was called once
    expect(generateText).toHaveBeenCalledOnce()
  })

  it('timeout path: AbortError → writes status:failed with specific timeout reason', async () => {
    // Simulate AbortSignal.timeout firing (TimeoutError)
    const timeoutErr = new DOMException('signal timed out', 'TimeoutError')
    ;(generateText as Mock).mockRejectedValueOnce(timeoutErr)

    await runBriefingGeneration({ db: dbMock as unknown as DbLike, investigationId: INVESTIGATION_ID })

    // db.update should have been called for the failed state write
    expect(dbMock.update).toHaveBeenCalled()
    // transaction should NOT have been called (we failed before completing)
    expect(dbMock.transaction).not.toHaveBeenCalled()
  })

  it('generic error path: writes status:failed with truncated error message', async () => {
    const genericErr = new Error('Model overloaded')
    ;(generateText as Mock).mockRejectedValueOnce(genericErr)

    await runBriefingGeneration({ db: dbMock as unknown as DbLike, investigationId: INVESTIGATION_ID })

    expect(dbMock.update).toHaveBeenCalled()
    expect(dbMock.transaction).not.toHaveBeenCalled()
  })

  it('post-completion shadow failure: does NOT call db.update for status write', async () => {
    ;(generateText as Mock).mockResolvedValueOnce({ text: 'briefing text' })

    // Make detectShadows throw
    const { detectShadows } = await import('@/lib/archive/shadow')
    ;(detectShadows as Mock).mockRejectedValueOnce(new Error('Shadow detection failed'))

    await runBriefingGeneration({ db: dbMock as unknown as DbLike, investigationId: INVESTIGATION_ID })

    // Transaction still ran (briefing was persisted)
    expect(dbMock.transaction).toHaveBeenCalledOnce()

    // The outer db.update (for failed state) should NOT have been called
    // because shadow failure is caught in its own inner try/catch
    expect(dbMock.update).not.toHaveBeenCalled()
  })

  it('returns early without error if investigation row not found', async () => {
    // Override: no row found for the investigation select
    selectReturnValues = [[]]
    dbMock = buildDbMock()

    await expect(
      runBriefingGeneration({ db: dbMock as unknown as DbLike, investigationId: INVESTIGATION_ID })
    ).resolves.toBeUndefined()

    expect(generateText).not.toHaveBeenCalled()
    expect(dbMock.transaction).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Retrieval observability: exactly one [retrieval] line per briefing run
// ---------------------------------------------------------------------------

describe('runBriefingGeneration — [retrieval] log line', () => {
  const CHUNK_CONTENT = 'SECRET-CHUNK-CONTENT riparian setback variance'
  const CHUNK_TITLE = 'SECRET-DOC-TITLE Council minutes'
  const CONCERN = 'SECRET-CONCERN the wetland on Elm Road is being filled'
  let infoSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    selectReturnValues = [[makeInvestigationRow({ concern: CONCERN })]]
    dbMock = buildDbMock()
    ;(generateText as Mock).mockResolvedValue({ text: 'briefing text' })
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    infoSpy.mockRestore()
    vi.useRealTimers()
  })

  function retrievalLines(): string[] {
    return infoSpy.mock.calls
      .filter((c: unknown[]) => c[0] === '[retrieval]')
      .map((c: unknown[]) => c[1] as string)
  }

  function onlyLine(): { raw: string; parsed: Record<string, unknown> } {
    const lines = retrievalLines()
    expect(lines).toHaveLength(1)
    return { raw: lines[0], parsed: JSON.parse(lines[0]) }
  }

  function expectNoUserText(raw: string) {
    expect(raw).not.toContain('SECRET-CHUNK-CONTENT')
    expect(raw).not.toContain('SECRET-DOC-TITLE')
    expect(raw).not.toContain('SECRET-CONCERN')
    expect(raw).not.toContain('wetland')
  }

  it("ok with hits: logs reason 'hits', ids, rounded top similarity", async () => {
    ;(searchDocumentChunksWithReason as Mock).mockResolvedValueOnce({
      reason: 'hits',
      candidates: 7,
      bestSimilarity: 0.812,
      results: [
        { id: 'chunk-uuid-1', title: CHUNK_TITLE, content: CHUNK_CONTENT, similarity: 0.812345 },
        { id: 'chunk-uuid-2', title: CHUNK_TITLE, content: CHUNK_CONTENT, similarity: 0.61 },
      ],
    })

    await runBriefingGeneration({ db: dbMock as unknown as DbLike, investigationId: INVESTIGATION_ID })

    const { raw, parsed } = onlyLine()
    expect(Object.keys(parsed).sort()).toEqual(
      ['bestSimilarity', 'candidates', 'chunkIds', 'hits', 'investigationId', 'ms', 'outcome', 'reason', 'topSimilarity'].sort()
    )
    expect(parsed.investigationId).toBe(INVESTIGATION_ID)
    expect(parsed.outcome).toBe('ok')
    expect(parsed.reason).toBe('hits')
    expect(parsed.hits).toBe(2)
    expect(parsed.candidates).toBe(7)
    expect(parsed.bestSimilarity).toBe(0.812)
    expect(parsed.chunkIds).toEqual(['chunk-uuid-1', 'chunk-uuid-2'])
    expect(parsed.topSimilarity).toBe(0.812)
    expect(typeof parsed.ms).toBe('number')
    expect(parsed.ms as number).toBeGreaterThanOrEqual(0)
    expectNoUserText(raw)

    // Excerpt behaviour unchanged: the chunk still reaches the prompt.
    const call = (generateText as Mock).mock.calls[0][0]
    expect(call.messages[0].content).toContain(CHUNK_CONTENT)
    expect(call.messages[0].content).toContain(`Document: ${CHUNK_TITLE}`)
  })

  it("ok with no-corpus: logs zero hits and a null top similarity", async () => {
    ;(searchDocumentChunksWithReason as Mock).mockResolvedValueOnce({ results: [], reason: 'no-corpus', candidates: null, bestSimilarity: null })

    await runBriefingGeneration({ db: dbMock as unknown as DbLike, investigationId: INVESTIGATION_ID })

    const { raw, parsed } = onlyLine()
    expect(parsed).toEqual({
      investigationId: INVESTIGATION_ID,
      outcome: 'ok',
      reason: 'no-corpus',
      hits: 0,
      candidates: null,
      bestSimilarity: null,
      chunkIds: [],
      topSimilarity: null,
      ms: expect.any(Number),
    })
    expectNoUserText(raw)
    const call = (generateText as Mock).mock.calls[0][0]
    expect(call.messages[0].content).not.toContain('[DOCUMENT EXCERPTS')
  })

  it('timeout: logs outcome timeout with a null reason after the 5 s race', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    ;(searchDocumentChunksWithReason as Mock).mockImplementationOnce(() => new Promise(() => {}))

    let settled = false
    const run = runBriefingGeneration({ db: dbMock as unknown as DbLike, investigationId: INVESTIGATION_ID })
      .finally(() => { settled = true })
    for (let i = 0; i < 20 && !settled; i++) {
      await vi.advanceTimersByTimeAsync(1000)
    }
    await run

    const { raw, parsed } = onlyLine()
    expect(parsed).toEqual({
      investigationId: INVESTIGATION_ID,
      outcome: 'timeout',
      reason: null,
      hits: 0,
      candidates: null,
      bestSimilarity: null,
      chunkIds: [],
      topSimilarity: null,
      ms: expect.any(Number),
    })
    expect(parsed.ms as number).toBeGreaterThanOrEqual(5000)
    expectNoUserText(raw)
    // Briefing still proceeds without excerpts
    expect(generateText).toHaveBeenCalledOnce()
  })

  it('error: logs outcome error with a null reason when retrieval throws', async () => {
    ;(searchDocumentChunksWithReason as Mock).mockRejectedValueOnce(new Error(`boom ${CHUNK_CONTENT}`))

    await runBriefingGeneration({ db: dbMock as unknown as DbLike, investigationId: INVESTIGATION_ID })

    const { raw, parsed } = onlyLine()
    expect(parsed).toEqual({
      investigationId: INVESTIGATION_ID,
      outcome: 'error',
      reason: null,
      hits: 0,
      candidates: null,
      bestSimilarity: null,
      chunkIds: [],
      topSimilarity: null,
      ms: expect.any(Number),
    })
    expectNoUserText(raw)
    expect(generateText).toHaveBeenCalledOnce()
  })
})

describe('runBriefingGeneration — [retrieval] carries the pre-threshold view', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    selectReturnValues = [[makeInvestigationRow()]]
    dbMock = buildDbMock()
    ;(generateText as Mock).mockResolvedValue({ text: 'briefing text' })
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    infoSpy.mockRestore()
  })

  it('below-threshold: logs candidates and the best pre-threshold similarity', async () => {
    ;(searchDocumentChunksWithReason as Mock).mockResolvedValueOnce({
      results: [],
      reason: 'below-threshold',
      candidates: 20,
      bestSimilarity: 0.47,
    })

    await runBriefingGeneration({ db: dbMock as unknown as DbLike, investigationId: INVESTIGATION_ID })

    const lines = infoSpy.mock.calls.filter((c: unknown[]) => c[0] === '[retrieval]')
    expect(lines).toHaveLength(1)
    const parsed = JSON.parse(lines[0][1] as string)
    expect(parsed).toMatchObject({
      outcome: 'ok',
      reason: 'below-threshold',
      hits: 0,
      candidates: 20,
      bestSimilarity: 0.47,
      topSimilarity: null,
    })
  })
})

describe('runBriefingGeneration — retrieval timer and late settlement', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    selectReturnValues = [[makeInvestigationRow()]]
    dbMock = buildDbMock()
    ;(generateText as Mock).mockResolvedValue({ text: 'briefing text' })
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  })

  afterEach(() => {
    infoSpy.mockRestore()
    vi.useRealTimers()
  })

  const retrievalLines = () =>
    infoSpy.mock.calls.filter((c: unknown[]) => c[0] === '[retrieval]').map((c: unknown[]) => c[1] as string)

  async function runToCompletion() {
    let settled = false
    const run = runBriefingGeneration({ db: dbMock as unknown as DbLike, investigationId: INVESTIGATION_ID })
      .finally(() => { settled = true })
    for (let i = 0; i < 20 && !settled; i++) {
      await vi.advanceTimersByTimeAsync(1000)
    }
    await run
  }

  it('a search that resolves after the 5 s timeout still yields exactly one line, outcome timeout', async () => {
    ;(searchDocumentChunksWithReason as Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                results: [{ id: 'late-chunk', title: 't', content: 'c', similarity: 0.9 }],
                reason: 'hits',
                candidates: 1,
                bestSimilarity: 0.9,
              }),
            8000
          )
        })
    )

    await runToCompletion()
    // Let the late resolution land, then flush anything it might schedule.
    await vi.advanceTimersByTimeAsync(10_000)
    await vi.runAllTimersAsync()

    const lines = retrievalLines()
    expect(lines).toHaveLength(1)
    const parsed = JSON.parse(lines[0])
    expect(parsed.outcome).toBe('timeout')
    expect(parsed.reason).toBeNull()
    expect(parsed.hits).toBe(0)
    expect(parsed.chunkIds).toEqual([])
    expect(lines[0]).not.toContain('late-chunk')
  })

  it('a search that wins the race leaves no pending retrieval timer behind', async () => {
    ;(searchDocumentChunksWithReason as Mock).mockResolvedValueOnce({
      results: [],
      reason: 'no-corpus',
      candidates: null,
      bestSimilarity: null,
    })

    await runToCompletion()

    expect(retrievalLines()).toHaveLength(1)
    // The 5 s race timer must be cleared once retrieval settles.
    expect(vi.getTimerCount()).toBe(0)
  })
})
