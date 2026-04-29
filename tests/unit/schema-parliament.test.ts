import { describe, it, expect } from 'vitest'
import {
  federalMps,
  federalVotes,
  federalMpBallots,
  federalBills,
  postalCodeCache,
  voteResultEnum,
  mpBallotEnum,
} from '@/lib/db/schema'

describe('Parliament schema — enums', () => {
  it('voteResultEnum has correct values', () => {
    expect(voteResultEnum.enumValues).toEqual(['passed', 'defeated', 'tie'])
  })

  it('mpBallotEnum has correct values', () => {
    expect(mpBallotEnum.enumValues).toEqual([
      'yes',
      'no',
      'paired',
      'didnt_vote',
    ])
  })
})

describe('Parliament schema — federal_mps', () => {
  it('table is defined', () => {
    expect(federalMps).toBeDefined()
  })

  it('has all required columns', () => {
    const cols = [
      'id',
      'oparlSlug',
      'name',
      'party',
      'ridingName',
      'ridingProvince',
      'email',
      'photoUrl',
      'active',
      'metadata',
      'lastSyncedAt',
      'createdAt',
      'updatedAt',
    ]
    for (const col of cols) {
      expect(federalMps).toHaveProperty(col)
    }
  })

  it('oparlSlug is unique', () => {
    expect(federalMps.oparlSlug.isUnique).toBe(true)
  })
})

describe('Parliament schema — federal_votes', () => {
  it('table is defined', () => {
    expect(federalVotes).toBeDefined()
  })

  it('has all required columns', () => {
    const cols = [
      'id',
      'session',
      'number',
      'date',
      'descriptionEn',
      'result',
      'yeaTotal',
      'nayTotal',
      'pairedTotal',
      'partyVotes',
      'billId',
      'aiExplanation',
      'aiExplanationPromptVersion',
      'lastSyncedAt',
      'createdAt',
    ]
    for (const col of cols) {
      expect(federalVotes).toHaveProperty(col)
    }
  })
})

describe('Parliament schema — federal_mp_ballots', () => {
  it('table is defined', () => {
    expect(federalMpBallots).toBeDefined()
  })

  it('has all required columns', () => {
    const cols = ['id', 'voteId', 'mpId', 'ballot', 'createdAt']
    for (const col of cols) {
      expect(federalMpBallots).toHaveProperty(col)
    }
  })
})

describe('Parliament schema — federal_bills', () => {
  it('table is defined', () => {
    expect(federalBills).toBeDefined()
  })

  it('has all required columns', () => {
    const cols = [
      'id',
      'number',
      'titleEn',
      'titleFr',
      'shortTitleEn',
      'sponsorMpId',
      'session',
      'statusCode',
      'introduced',
      'isLaw',
      'legisInfoUrl',
      'aiSummary',
      'aiSummaryPromptVersion',
      'metadata',
      'lastSyncedAt',
      'createdAt',
      'updatedAt',
    ]
    for (const col of cols) {
      expect(federalBills).toHaveProperty(col)
    }
  })
})

describe('Parliament schema — postal_code_cache', () => {
  it('table is defined', () => {
    expect(postalCodeCache).toBeDefined()
  })

  it('has all required columns', () => {
    const cols = ['id', 'postalCode', 'mpId', 'ridingName', 'metadata', 'cachedAt']
    for (const col of cols) {
      expect(postalCodeCache).toHaveProperty(col)
    }
  })

  it('postalCode is unique', () => {
    expect(postalCodeCache.postalCode.isUnique).toBe(true)
  })
})
