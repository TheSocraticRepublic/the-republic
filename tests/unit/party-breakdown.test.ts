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

  it('parses real openparliament party_votes format', () => {
    const input = [
      {
        vote: 'Yes',
        disagreement: 0.02,
        party: { short_name: { en: 'Liberal' }, name: { en: 'Liberal Party of Canada' } },
      },
      {
        vote: 'No',
        disagreement: 0,
        party: { short_name: { en: 'Conservative' }, name: { en: 'Conservative Party of Canada' } },
      },
    ]
    const result = parsePartyVotes(input)
    expect(result).toHaveLength(2)

    expect(result[0]).toEqual({
      party: 'Liberal',
      position: 'Yes',
      disagreement: 0.02,
    })

    expect(result[1]).toEqual({
      party: 'Conservative',
      position: 'No',
      disagreement: 0,
    })
  })

  it('normalizes yea/nay vote values', () => {
    const input = [
      {
        vote: 'Yea',
        disagreement: 0,
        party: { short_name: { en: 'NDP' } },
      },
      {
        vote: 'Nay',
        disagreement: 0.1,
        party: { short_name: { en: 'Bloc' } },
      },
    ]
    const result = parsePartyVotes(input)
    expect(result[0].position).toBe('Yes')
    expect(result[1].position).toBe('No')
  })

  it('handles Paired votes', () => {
    const input = [
      {
        vote: 'Paired',
        disagreement: 0,
        party: { short_name: { en: 'Liberal' } },
      },
    ]
    const result = parsePartyVotes(input)
    expect(result[0].position).toBe('Paired')
  })

  it('maps unknown vote values to Unknown', () => {
    const input = [
      {
        vote: 'Abstain',
        disagreement: 0,
        party: { short_name: { en: 'Green' } },
      },
    ]
    const result = parsePartyVotes(input)
    expect(result[0].position).toBe('Unknown')
  })

  it('falls back to party name when short_name missing', () => {
    const input = [
      {
        vote: 'Yes',
        disagreement: 0,
        party: { name: { en: 'Green Party of Canada' } },
      },
    ]
    const result = parsePartyVotes(input)
    expect(result[0].party).toBe('Green Party of Canada')
  })

  it('falls back to Unknown for missing party name', () => {
    const input = [{ vote: 'Yes', disagreement: 0 }]
    const result = parsePartyVotes(input)
    expect(result[0].party).toBe('Unknown')
  })

  it('handles missing disagreement as null', () => {
    const input = [
      {
        vote: 'Yes',
        party: { short_name: { en: 'Liberal' } },
      },
    ]
    const result = parsePartyVotes(input)
    expect(result[0].disagreement).toBeNull()
  })

  it('shows disagreement when present and > 0', () => {
    const input = [
      {
        vote: 'No',
        disagreement: 0.15,
        party: { short_name: { en: 'Conservative' } },
      },
    ]
    const result = parsePartyVotes(input)
    expect(result[0].disagreement).toBe(0.15)
  })
})
