import { describe, it, expect } from 'vitest'
import { parsePartyVotes } from '@/components/votes/party-breakdown'

describe('parsePartyVotes', () => {
  it('returns empty array for null input', () => {
    expect(parsePartyVotes(null)).toEqual([])
  })

  it('returns empty array for non-array input', () => {
    expect(parsePartyVotes('not an array')).toEqual([])
    expect(parsePartyVotes(42)).toEqual([])
    expect(parsePartyVotes({})).toEqual([])
  })

  it('parses standard openparliament party_votes format', () => {
    const input = [
      {
        vote: 'Yes',
        party: { short_name: { en: 'Liberal' }, name: { en: 'Liberal Party of Canada' } },
        party_size: 150,
      },
      {
        vote: 'No',
        party: { short_name: { en: 'Conservative' }, name: { en: 'Conservative Party of Canada' } },
        party_size: 120,
      },
    ]
    const result = parsePartyVotes(input)
    expect(result).toHaveLength(2)

    const liberal = result.find((r) => r.party === 'Liberal')
    expect(liberal).toBeDefined()
    expect(liberal!.yea).toBe(150)
    expect(liberal!.nay).toBe(0)

    const conservative = result.find((r) => r.party === 'Conservative')
    expect(conservative).toBeDefined()
    expect(conservative!.nay).toBe(120)
    expect(conservative!.yea).toBe(0)
  })

  it('handles missing party_size by defaulting to 1', () => {
    const input = [
      {
        vote: 'Yes',
        party: { short_name: { en: 'Green' } },
      },
    ]
    const result = parsePartyVotes(input)
    expect(result[0].yea).toBe(1)
  })

  it('handles Paired votes', () => {
    const input = [
      {
        vote: 'Paired',
        party: { short_name: { en: 'Liberal' } },
        party_size: 2,
      },
    ]
    const result = parsePartyVotes(input)
    expect(result[0].paired).toBe(2)
  })

  it('falls back to Unknown for missing party name', () => {
    const input = [{ vote: 'Yes' }]
    const result = parsePartyVotes(input)
    expect(result[0].party).toBe('Unknown')
  })
})
