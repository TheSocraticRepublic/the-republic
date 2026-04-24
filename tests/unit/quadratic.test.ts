import { describe, it, expect } from 'vitest'
import { computeVoteWeight } from '@/lib/governance/quadratic'

describe('computeVoteWeight — quadratic voting', () => {
  it('returns 0 for input of 0', () => {
    expect(computeVoteWeight(0)).toBe(0)
  })

  it('returns 0 for negative inputs', () => {
    expect(computeVoteWeight(-1)).toBe(0)
    expect(computeVoteWeight(-100)).toBe(0)
  })

  it('returns 1 for input of 1', () => {
    expect(computeVoteWeight(1)).toBe(1)
  })

  it('returns 2 for input of 4', () => {
    expect(computeVoteWeight(4)).toBe(2)
  })

  it('returns 3 for input of 9', () => {
    expect(computeVoteWeight(9)).toBe(3)
  })

  it('returns 10 for input of 100', () => {
    expect(computeVoteWeight(100)).toBe(10)
  })

  it('returns 0.5 for input of 0.25', () => {
    expect(computeVoteWeight(0.25)).toBe(0.5)
  })

  it('handles non-integer inputs correctly', () => {
    expect(computeVoteWeight(2)).toBeCloseTo(Math.sqrt(2))
    expect(computeVoteWeight(3)).toBeCloseTo(Math.sqrt(3))
    expect(computeVoteWeight(1.5)).toBeCloseTo(Math.sqrt(1.5))
  })
})
