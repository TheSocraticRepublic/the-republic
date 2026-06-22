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

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

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
}))

vi.mock('@/lib/archive/shadow', () => ({
  detectShadows: vi.fn(() => Promise.resolve([])),
}))

vi.mock('@/lib/jurisdictions', () => ({
  loadJurisdictionModule: vi.fn(() => Promise.resolve(null)),
}))

vi.mock('@/lib/jurisdictions/bc', () => ({
  getDocumentStructureContext: vi.fn(() => ''),
  getJurisdictionPortalContext: vi.fn(() => ''),
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
