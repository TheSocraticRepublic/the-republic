import { describe, it, expect } from 'vitest'
import { ORACLE_SYSTEM_PROMPT, ORACLE_PROMPT_VERSION } from '@/lib/ai/prompts/oracle-system'
import { GADFLY_SYSTEM_PROMPT, GADFLY_PROMPT_VERSION } from '@/lib/ai/prompts/gadfly-system'
import { LEVER_SYSTEM_PROMPT, LEVER_PROMPT_VERSION } from '@/lib/ai/prompts/lever-system'
import { MIRROR_SYSTEM_PROMPT, MIRROR_PROMPT_VERSION } from '@/lib/ai/prompts/mirror-system'

describe('Oracle prompt', () => {
  it('includes all 6 required output sections', () => {
    const requiredSections = [
      '## Plain Language Summary',
      '## Key Findings',
      '## Power Map',
      '## What is Missing',
      '## Hidden Assumptions',
      '## Questions to Ask',
    ]
    for (const section of requiredSections) {
      expect(ORACLE_SYSTEM_PROMPT).toContain(section)
    }
  })

  it('has a version string', () => {
    expect(ORACLE_PROMPT_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})

describe('Gadfly prompt', () => {
  it('includes all 5 question types', () => {
    const questionTypes = [
      'Clarifying',
      'Probing',
      'Challenging',
      'Connecting',
      'Action',
    ]
    for (const qt of questionTypes) {
      expect(GADFLY_SYSTEM_PROMPT).toContain(qt)
    }
  })

  it('includes all absolute rules', () => {
    // The prompt lists 6 ABSOLUTE RULES
    const rules = [
      'Ask ONE question per turn',
      'NEVER answer your own questions',
      'NEVER explain what a document means',
      'NEVER tell the citizen what to think',
      'NEVER summarize',
      'The citizen discovers',
    ]
    for (const rule of rules) {
      expect(GADFLY_SYSTEM_PROMPT).toContain(rule)
    }
  })

  it('has a version string', () => {
    expect(GADFLY_PROMPT_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})

describe('Lever prompt', () => {
  it('includes all FIPPA citation templates', () => {
    // Template citations from lever-system.ts
    const citations = [
      's. 4',
      's. 6',
      's. 7',
      's. 75(5)(a)',
      's. 52',
    ]
    for (const citation of citations) {
      expect(LEVER_SYSTEM_PROMPT).toContain(citation)
    }
  })

  it('has a version string', () => {
    expect(LEVER_PROMPT_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})

describe('Mirror prompt', () => {
  it('includes hallucination guardrail', () => {
    // The mirror has explicit rules against fabrication
    expect(MIRROR_SYSTEM_PROMPT).toContain('NEVER fabricate')
  })

  it('has a version string', () => {
    expect(MIRROR_PROMPT_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})

describe('All prompts', () => {
  it('have version strings in semver format', () => {
    const versions = [
      ORACLE_PROMPT_VERSION,
      GADFLY_PROMPT_VERSION,
      LEVER_PROMPT_VERSION,
      MIRROR_PROMPT_VERSION,
    ]
    for (const v of versions) {
      expect(v).toMatch(/^\d+\.\d+\.\d+$/)
    }
  })
})
