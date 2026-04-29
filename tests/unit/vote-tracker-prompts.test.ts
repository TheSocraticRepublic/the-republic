import { describe, it, expect } from 'vitest'
import {
  BILL_SUMMARY_SYSTEM_PROMPT,
  BILL_SUMMARY_PROMPT_VERSION,
  VOTE_EXPLANATION_SYSTEM_PROMPT,
  VOTE_EXPLANATION_PROMPT_VERSION,
} from '@/lib/ai/prompts/vote-tracker-system'

describe('Bill summary prompt', () => {
  it('has a semver version string', () => {
    expect(BILL_SUMMARY_PROMPT_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('includes all required output sections', () => {
    const sections = [
      '## What This Bill Does',
      '## Who It Affects',
      '## Key Provisions',
      '## What This Summary Cannot Tell You',
    ]
    for (const section of sections) {
      expect(BILL_SUMMARY_SYSTEM_PROMPT).toContain(section)
    }
  })

  it('contains no-advocacy guardrail', () => {
    expect(BILL_SUMMARY_SYSTEM_PROMPT).toContain(
      'Do not say whether the bill is good or bad'
    )
  })

  it('contains plain-language instruction', () => {
    expect(BILL_SUMMARY_SYSTEM_PROMPT).toContain('plain language')
  })

  it('directs readers to LEGISinfo', () => {
    expect(BILL_SUMMARY_SYSTEM_PROMPT).toContain('LEGISinfo')
  })
})

describe('Vote explanation prompt', () => {
  it('has a semver version string', () => {
    expect(VOTE_EXPLANATION_PROMPT_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('contains no-advocacy guardrail', () => {
    expect(VOTE_EXPLANATION_SYSTEM_PROMPT).toContain(
      'Do not say whether the outcome is good or bad'
    )
  })

  it('instructs about whipped vs free vote detection', () => {
    expect(VOTE_EXPLANATION_SYSTEM_PROMPT).toContain('whipped vote')
    expect(VOTE_EXPLANATION_SYSTEM_PROMPT).toContain('free vote')
  })

  it('instructs about cross-party voting', () => {
    expect(VOTE_EXPLANATION_SYSTEM_PROMPT).toContain('cross-party')
  })

  it('instructs about procedural context', () => {
    expect(VOTE_EXPLANATION_SYSTEM_PROMPT).toContain('procedural')
  })
})
