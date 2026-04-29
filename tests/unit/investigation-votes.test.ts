import { describe, it, expect } from 'vitest'
import { investigations, investigationVotes } from '@/lib/db/schema'
import {
  VOTE_RELEVANCE_SYSTEM_PROMPT,
  VOTE_RELEVANCE_PROMPT_VERSION,
} from '@/lib/ai/prompts/vote-relevance-system'

describe('Investigation votes schema', () => {
  it('investigations has postalCode column', () => {
    expect(investigations.postalCode).toBeDefined()
    expect(investigations.postalCode.name).toBe('postal_code')
  })

  it('investigations has federalMpId column', () => {
    expect(investigations.federalMpId).toBeDefined()
    expect(investigations.federalMpId.name).toBe('federal_mp_id')
  })

  it('investigationVotes table is defined', () => {
    expect(investigationVotes).toBeDefined()
  })

  it('investigationVotes has all required columns', () => {
    const cols = ['id', 'investigationId', 'voteId', 'relevanceExplanation', 'createdAt']
    for (const col of cols) {
      expect(investigationVotes).toHaveProperty(col)
    }
  })
})

describe('Vote relevance prompt', () => {
  it('has a semver version string', () => {
    expect(VOTE_RELEVANCE_PROMPT_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('returns JSON array', () => {
    expect(VOTE_RELEVANCE_SYSTEM_PROMPT).toContain('JSON array')
  })

  it('allows empty array as valid outcome', () => {
    expect(VOTE_RELEVANCE_SYSTEM_PROMPT).toContain('empty array')
  })

  it('limits to 5 relevant votes', () => {
    expect(VOTE_RELEVANCE_SYSTEM_PROMPT).toContain('Maximum 5')
  })
})
