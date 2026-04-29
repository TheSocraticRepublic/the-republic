import { describe, it, expect } from 'vitest'
import {
  VOTE_LETTER_SYSTEM_PROMPT,
  VOTE_LETTER_PROMPT_VERSION,
} from '@/lib/ai/prompts/vote-letter-system'
import { leverActionTypeEnum } from '@/lib/db/schema'

describe('Vote letter prompt', () => {
  it('has a semver version string', () => {
    expect(VOTE_LETTER_PROMPT_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('contains no-fabrication guardrail', () => {
    expect(VOTE_LETTER_SYSTEM_PROMPT).toContain('Do NOT fabricate vote records')
  })

  it('requires specific actionable request', () => {
    expect(VOTE_LETTER_SYSTEM_PROMPT).toContain('specific, actionable request')
  })

  it('handles contradiction data factually', () => {
    expect(VOTE_LETTER_SYSTEM_PROMPT).toContain('present this factually without accusation')
  })

  it('includes citizen signature placeholders', () => {
    expect(VOTE_LETTER_SYSTEM_PROMPT).toContain('[Your name]')
  })
})

describe('Lever action type enum includes mp_letter', () => {
  it('mp_letter is a valid lever action type', () => {
    expect(leverActionTypeEnum.enumValues).toContain('mp_letter')
  })
})
