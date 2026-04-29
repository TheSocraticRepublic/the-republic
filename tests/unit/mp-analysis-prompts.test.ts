import { describe, it, expect } from 'vitest'
import {
  MP_PATTERN_SYSTEM_PROMPT,
  MP_PATTERN_PROMPT_VERSION,
  CONTRADICTION_SYSTEM_PROMPT,
  CONTRADICTION_PROMPT_VERSION,
} from '@/lib/ai/prompts/mp-analysis-system'
import { mpVotingPatterns } from '@/lib/db/schema'

describe('MP pattern analysis prompt', () => {
  it('has a semver version string', () => {
    expect(MP_PATTERN_PROMPT_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('does NOT contain numerical scores or percentages', () => {
    expect(MP_PATTERN_SYSTEM_PROMPT).toContain(
      'Do NOT use numerical scores, percentages, letter grades, or ratings'
    )
  })

  it('uses generally-voted-for language', () => {
    expect(MP_PATTERN_SYSTEM_PROMPT).toContain('generally voted for')
    expect(MP_PATTERN_SYSTEM_PROMPT).toContain('consistently voted against')
  })

  it('includes all required output sections', () => {
    expect(MP_PATTERN_SYSTEM_PROMPT).toContain('## Voting Patterns by Area')
    expect(MP_PATTERN_SYSTEM_PROMPT).toContain('## Notable Votes')
    expect(MP_PATTERN_SYSTEM_PROMPT).toContain('## Party Line Departures')
  })

  it('prohibits speculation about motivations', () => {
    expect(MP_PATTERN_SYSTEM_PROMPT).toContain('Do not speculate about motivations')
  })
})

describe('Contradiction detection prompt', () => {
  it('has a semver version string', () => {
    expect(CONTRADICTION_PROMPT_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('requires both sides documented', () => {
    expect(CONTRADICTION_SYSTEM_PROMPT).toContain('BOTH sides are clearly documented')
  })

  it('allows empty array as valid outcome', () => {
    expect(CONTRADICTION_SYSTEM_PROMPT).toContain('return an empty array')
  })

  it('warns against false positives', () => {
    expect(CONTRADICTION_SYSTEM_PROMPT).toContain('false positive')
  })

  it('requires JSON array output', () => {
    expect(CONTRADICTION_SYSTEM_PROMPT).toContain('JSON array')
  })
})

describe('MP voting patterns schema', () => {
  it('table is defined', () => {
    expect(mpVotingPatterns).toBeDefined()
  })

  it('has all required columns', () => {
    const cols = [
      'id',
      'mpId',
      'session',
      'patternAnalysis',
      'contradictions',
      'promptVersion',
      'generatedAt',
      'createdAt',
    ]
    for (const col of cols) {
      expect(mpVotingPatterns).toHaveProperty(col)
    }
  })
})
