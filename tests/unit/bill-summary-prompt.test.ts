import { describe, it, expect } from 'vitest'
import {
  BILL_SUMMARY_SYSTEM_PROMPT,
  BILL_SUMMARY_PROMPT_VERSION,
} from '@/lib/ai/prompts/vote-tracker-system'

describe('Bill summary prompt', () => {
  it('has a semver version string', () => {
    expect(BILL_SUMMARY_PROMPT_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('states the model only has metadata', () => {
    expect(BILL_SUMMARY_SYSTEM_PROMPT).toContain('YOU ONLY HAVE METADATA')
  })

  it('prohibits fabricating provisions', () => {
    expect(BILL_SUMMARY_SYSTEM_PROMPT).toContain('Never fabricate specific provisions')
  })

  it('does not ask for Key Provisions section', () => {
    expect(BILL_SUMMARY_SYSTEM_PROMPT).not.toContain('Key Provisions')
  })

  it('does not demand provision-level specifics', () => {
    expect(BILL_SUMMARY_SYSTEM_PROMPT).not.toContain(
      'increases the penalty from X to Y'
    )
  })

  it('directs to LEGISinfo for the full record', () => {
    expect(BILL_SUMMARY_SYSTEM_PROMPT).toContain('LEGISinfo')
  })

  it('includes a section about what requires reading the bill text', () => {
    expect(BILL_SUMMARY_SYSTEM_PROMPT).toContain(
      'What You Need to Read the Bill to Know'
    )
  })
})
