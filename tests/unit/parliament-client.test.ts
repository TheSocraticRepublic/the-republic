import { describe, it, expect } from 'vitest'
import {
  normalizeBallot,
  normalizeVoteResult,
  extractSlug,
} from '@/lib/parliament/types'
import {
  normalizePostalCode,
  isValidCanadianPostalCode,
} from '@/lib/parliament/represent'

describe('Parliament types — normalizeBallot', () => {
  it('normalizes Yes to yes', () => {
    expect(normalizeBallot('Yes')).toBe('yes')
  })

  it('normalizes No to no', () => {
    expect(normalizeBallot('No')).toBe('no')
  })

  it('normalizes Paired to paired', () => {
    expect(normalizeBallot('Paired')).toBe('paired')
  })

  it("normalizes Didn't vote to didnt_vote", () => {
    expect(normalizeBallot("Didn't vote")).toBe('didnt_vote')
  })

  it('returns didnt_vote for unknown values', () => {
    expect(normalizeBallot('Unknown')).toBe('didnt_vote')
    expect(normalizeBallot('')).toBe('didnt_vote')
  })
})

describe('Parliament types — normalizeVoteResult', () => {
  it('normalizes Passed', () => {
    expect(normalizeVoteResult('Passed')).toBe('passed')
  })

  it('normalizes Failed', () => {
    expect(normalizeVoteResult('Failed')).toBe('defeated')
  })

  it('normalizes Agreed To', () => {
    expect(normalizeVoteResult('Agreed To')).toBe('passed')
  })

  it('normalizes Tie', () => {
    expect(normalizeVoteResult('Tie')).toBe('tie')
  })

  it('defaults to defeated for unknown results', () => {
    expect(normalizeVoteResult('Rejected')).toBe('defeated')
  })
})

describe('Parliament types — extractSlug', () => {
  it('extracts slug from politician URL', () => {
    expect(extractSlug('/politicians/justin-trudeau/')).toBe('justin-trudeau')
  })

  it('extracts slug without trailing slash', () => {
    expect(extractSlug('/politicians/jagmeet-singh')).toBe('jagmeet-singh')
  })

  it('handles deeply nested URLs', () => {
    expect(extractSlug('/politicians/memberships/4208/')).toBe('4208')
  })
})

describe('Represent — postal code validation', () => {
  it('normalizes postal codes', () => {
    expect(normalizePostalCode('v8b 0a1')).toBe('V8B0A1')
    expect(normalizePostalCode('V8B0A1')).toBe('V8B0A1')
    expect(normalizePostalCode('v8b  0a1')).toBe('V8B0A1')
  })

  it('validates correct postal codes', () => {
    expect(isValidCanadianPostalCode('V8B0A1')).toBe(true)
    expect(isValidCanadianPostalCode('K1A 0A6')).toBe(true)
    expect(isValidCanadianPostalCode('m5v 2t6')).toBe(true)
  })

  it('rejects invalid postal codes', () => {
    expect(isValidCanadianPostalCode('12345')).toBe(false)
    expect(isValidCanadianPostalCode('ABCDEF')).toBe(false)
    expect(isValidCanadianPostalCode('')).toBe(false)
    expect(isValidCanadianPostalCode('V8B')).toBe(false)
    expect(isValidCanadianPostalCode('V8B0A1X')).toBe(false)
  })
})
