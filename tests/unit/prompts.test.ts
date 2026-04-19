import { describe, it, expect } from 'vitest'
import { ORACLE_SYSTEM_PROMPT, ORACLE_PROMPT_VERSION } from '@/lib/ai/prompts/oracle-system'
import { GADFLY_SYSTEM_PROMPT, GADFLY_PROMPT_VERSION } from '@/lib/ai/prompts/gadfly-system'
import { LEVER_SYSTEM_PROMPT, LEVER_PROMPT_VERSION } from '@/lib/ai/prompts/lever-system'
import { MIRROR_SYSTEM_PROMPT, MIRROR_PROMPT_VERSION } from '@/lib/ai/prompts/mirror-system'
import {
  buildBriefingPrompt,
  BRIEFING_PROMPT_VERSION,
  BRIEFING_SYSTEM_PROMPT,
} from '@/lib/ai/prompts/briefing-system'
import type { JurisdictionModule } from '@/lib/jurisdictions/types'

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
      BRIEFING_PROMPT_VERSION,
    ]
    for (const v of versions) {
      expect(v).toMatch(/^\d+\.\d+\.\d+$/)
    }
  })
})

const mockJurisdictionModule: JurisdictionModule = {
  id: 'bc',
  name: 'British Columbia',
  country: 'Canada',
  foiFramework: {
    name: 'FIPPA',
    fullCitation: 'Freedom of Information and Protection of Privacy Act, RSBC 1996, c. 165',
    sections: {
      rightOfAccess: 's. 4',
      dutyToAssist: 's. 6',
      timeLimit: { section: 's. 7', days: 30 },
      feeWaiver: 's. 75(5)(a)',
      review: 's. 52',
    },
    letterTemplate: '',
    responseTimeline: '30 calendar days',
  },
  concernCategories: [],
  publicBodies: [],
  portals: {},
}

describe('Briefing prompt', () => {
  it('has a version string', () => {
    expect(BRIEFING_PROMPT_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('backward-compat export BRIEFING_SYSTEM_PROMPT contains core sections', () => {
    const requiredSections = [
      '## Your Concern',
      '## What Governs This',
      '## What the Public Record Shows',
      '## Key Players',
      '## What You Can Do',
      '## How Other Places Handle This',
      '## Questions Worth Asking',
    ]
    for (const section of requiredSections) {
      expect(BRIEFING_SYSTEM_PROMPT).toContain(section)
    }
  })

  it('buildBriefingPrompt with no config returns prompt containing core sections', () => {
    const prompt = buildBriefingPrompt({})
    const requiredSections = [
      '## Your Concern',
      '## What Governs This',
      '## What the Public Record Shows',
      '## Key Players',
      '## What You Can Do',
      '## How Other Places Handle This',
      '## Questions Worth Asking',
    ]
    for (const section of requiredSections) {
      expect(prompt).toContain(section)
    }
  })

  it('buildBriefingPrompt always includes the limitations section', () => {
    const prompt = buildBriefingPrompt({})
    expect(prompt).toContain('## What This Analysis Cannot See')
  })

  it('buildBriefingPrompt always includes the player identification section', () => {
    const prompt = buildBriefingPrompt({})
    expect(prompt).toContain('## Key Players')
  })

  it('buildBriefingPrompt with isConservationConcern includes conservation context', () => {
    const withConservation = buildBriefingPrompt({ isConservationConcern: true })
    const withoutConservation = buildBriefingPrompt({ isConservationConcern: false })
    expect(withConservation).toContain('CONSERVATION-SPECIFIC ANALYSIS')
    expect(withoutConservation).not.toContain('CONSERVATION-SPECIFIC ANALYSIS')
  })

  it('buildBriefingPrompt with a jurisdiction module includes the FOI section', () => {
    const prompt = buildBriefingPrompt({ jurisdictionModule: mockJurisdictionModule })
    expect(prompt).toContain('FOI FRAMEWORK: FIPPA')
    expect(prompt).toContain('Freedom of Information and Protection of Privacy Act, RSBC 1996, c. 165')
    expect(prompt).toContain('s. 4')
    expect(prompt).toContain('s. 7 (30 calendar days)')
    expect(prompt).toContain('s. 75(5)(a)')
    expect(prompt).toContain('s. 52')
  })

  it('buildBriefingPrompt without a jurisdiction module does not include FOI section', () => {
    const prompt = buildBriefingPrompt({})
    expect(prompt).not.toContain('FOI FRAMEWORK:')
  })

  it('buildBriefingPrompt injects document structures when provided', () => {
    const docStructures = '[TEST DOCUMENT STRUCTURE KNOWLEDGE]'
    const prompt = buildBriefingPrompt({ documentStructures: docStructures })
    expect(prompt).toContain(docStructures)
  })

  it('core prompt does not contain the old runtime placeholder', () => {
    const prompt = buildBriefingPrompt({})
    expect(prompt).not.toContain('[DOCUMENT STRUCTURE KNOWLEDGE will be injected here at runtime]')
  })
})
