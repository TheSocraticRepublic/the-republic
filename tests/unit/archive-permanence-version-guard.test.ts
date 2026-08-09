import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * PRIV-2 / bundle v1.1: the permanence route re-derives the bundle from
 * current DB state and compares its hash against the stored one to detect
 * content drift. The builder can only produce the CURRENT bundle shape, so a
 * record pinned under an earlier shape can never match — it would surface as
 * "content has changed", which is both wrong and unfixable by re-archiving.
 *
 * The route must instead refuse explicitly, naming the version mismatch, before
 * it ever reaches the drift comparison. These tests drive the real handler with
 * the DB and side-effecting dependencies mocked.
 */

const USER_ID = '11111111-1111-4111-8111-111111111111'
const INVESTIGATION_ID = '22222222-2222-4222-8222-222222222222'

const buildArchiveBundle = vi.fn()
let selectResults: unknown[][] = []

vi.mock('@/lib/rate-limit', () => ({
  checkTightRateLimit: vi.fn(async () => ({
    success: true,
    limit: 10,
    remaining: 9,
    reset: 0,
  })),
}))

vi.mock('@/lib/archive/arweave', () => ({
  isArweaveEnabled: () => true,
  permanizeInvestigation: vi.fn(),
}))

vi.mock('@/lib/archive/permanence-gate', () => ({
  checkPermanenceEligibility: vi.fn(async () => ({ eligible: true, reason: null })),
}))

vi.mock('@/lib/credentials/check-moderator', () => ({
  checkModeratorAccess: vi.fn(async () => ({ isModerator: false })),
}))

vi.mock('@/lib/archive/bundle', () => ({ buildArchiveBundle }))

vi.mock('@/lib/db', () => ({
  getDb: () => ({
    select: () => {
      const rows = selectResults.shift() ?? []
      const chain = {
        from: () => chain,
        where: () => chain,
        limit: async () => rows,
      }
      return chain
    },
  }),
}))

function callPermanence() {
  return import('@/app/api/archive/[investigationId]/permanence/route').then(
    ({ POST }) =>
      POST(
        new NextRequest(
          `http://localhost/api/archive/${INVESTIGATION_ID}/permanence`,
          { method: 'POST', headers: { 'x-user-id': USER_ID } }
        ),
        { params: Promise.resolve({ investigationId: INVESTIGATION_ID }) }
      )
  )
}

function archiveRecordRow(metadata: unknown) {
  return {
    id: 'rec-1',
    userId: USER_ID,
    archiveStatus: 'ipfs_pinned',
    ipfsCid: 'bafy-test',
    contentHash: 'a'.repeat(64),
    arweaveTxId: null,
    preservedAt: new Date('2026-01-01T00:00:00.000Z'),
    permanenceAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    metadata,
  }
}

/** Order matters: archive record lookup, then the investigation owner lookup. */
function primeDb(metadata: unknown) {
  selectResults = [[archiveRecordRow(metadata)], [{ userId: USER_ID }]]
}

describe('permanence route — bundle version guard', () => {
  beforeEach(() => {
    buildArchiveBundle.mockReset()
    selectResults = []
  })

  it('returns 409 naming the mismatch for a v1.0 record', async () => {
    primeDb({ bundleVersion: '1.0', republicVersion: '0.1.0' })
    const res = await callPermanence()
    expect(res.status).toBe(409)

    const body = await res.json()
    expect(body.error).toMatch(/predates bundle v1\.1/i)
    expect(body.reason).toContain('1.0')
    expect(body.reason).toMatch(/re-archive/i)

    // The refusal must come BEFORE the drift comparison, not from it.
    expect(buildArchiveBundle).not.toHaveBeenCalled()
  })

  it('returns 409 when metadata is absent entirely', async () => {
    primeDb(null)
    const res = await callPermanence()
    expect(res.status).toBe(409)
    expect((await res.json()).reason).toContain('absent')
    expect(buildArchiveBundle).not.toHaveBeenCalled()
  })

  it('returns 409 when bundleVersion is a malformed non-string', async () => {
    primeDb({ bundleVersion: 11, republicVersion: '0.1.0' })
    const res = await callPermanence()
    expect(res.status).toBe(409)
    expect(buildArchiveBundle).not.toHaveBeenCalled()
  })

  it('lets a v1.1 record through to the drift comparison', async () => {
    // Negative control: proves the guard is version-specific, not a blanket
    // refusal that would make the three tests above vacuous.
    primeDb({ bundleVersion: '1.1', republicVersion: '0.1.0' })
    buildArchiveBundle.mockRejectedValue(new Error('stop here'))
    const res = await callPermanence()
    expect(buildArchiveBundle).toHaveBeenCalledOnce()
    expect(res.status).toBe(500)
  })
})
