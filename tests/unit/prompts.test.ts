import { describe, it, expect } from 'vitest'
import { ORACLE_SYSTEM_PROMPT, ORACLE_PROMPT_VERSION } from '@/lib/ai/prompts/oracle-system'
import { LENS_CONTEXT_SYSTEM_PROMPT, LENS_CONTEXT_PROMPT_VERSION } from '@/lib/ai/prompts/lens-context-system'
import { GADFLY_SYSTEM_PROMPT, GADFLY_PROMPT_VERSION } from '@/lib/ai/prompts/gadfly-system'
import { LEVER_SYSTEM_PROMPT, LEVER_PROMPT_VERSION } from '@/lib/ai/prompts/lever-system'
import { MIRROR_SYSTEM_PROMPT, MIRROR_PROMPT_VERSION } from '@/lib/ai/prompts/mirror-system'
import {
  buildBriefingPrompt,
  BRIEFING_PROMPT_VERSION,
  BRIEFING_SYSTEM_PROMPT,
} from '@/lib/ai/prompts/briefing-system'
import { buildLeverPrompt } from '@/lib/ai/prompts/lever-system'
import { buildScoutPrompt } from '@/lib/ai/prompts/scout-system'
import { SCOUT_PROMPT_VERSION } from '@/lib/ai/prompts/scout-system'
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
    verified: true,
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
  getDocumentStructureContext: () => '',
  getJurisdictionPortalContext: () => '',
}

describe('Briefing prompt', () => {
  it('has a version string', () => {
    expect(BRIEFING_PROMPT_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('backward-compat export BRIEFING_SYSTEM_PROMPT contains core sections (v0.3.0+: Context replaces Your Concern)', () => {
    const requiredSections = [
      '## Context',
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

  it('buildBriefingPrompt with no config returns prompt containing core sections (v0.3.0+: Context replaces Your Concern)', () => {
    const prompt = buildBriefingPrompt({})
    const requiredSections = [
      '## Context',
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

// ---------------------------------------------------------------------------
// Multi-jurisdiction prompt parameterization
// ---------------------------------------------------------------------------

const abModule: JurisdictionModule = {
  id: 'ab',
  name: 'Alberta',
  country: 'Canada',
  foiFramework: {
    name: 'FOIP',
    fullCitation: 'Freedom of Information and Protection of Privacy Act, RSA 2000, c F-25',
    verified: false,
    sections: {
      rightOfAccess: 's. 6(1)',
      dutyToAssist: 's. 10(1)',
      timeLimit: { section: 's. 11', days: 30 },
      feeWaiver: 's. 93(4)',
      review: 's. 65',
    },
    letterTemplate: '',
    responseTimeline: '30 days',
  },
  concernCategories: [],
  publicBodies: [],
  portals: {},
  getDocumentStructureContext: () => '',
  getJurisdictionPortalContext: () => '',
}

const onModule: JurisdictionModule = {
  id: 'on',
  name: 'Ontario',
  country: 'Canada',
  foiFramework: {
    name: 'FIPPA',
    fullCitation: 'Freedom of Information and Protection of Privacy Act, RSO 1990, c F.31',
    verified: false,
    sections: {
      rightOfAccess: 's. 10(1)',
      dutyToAssist: 's. 24',
      timeLimit: { section: 's. 26', days: 30 },
      feeWaiver: 's. 57(4)',
      review: 's. 50',
    },
    letterTemplate: '',
    responseTimeline: '30 calendar days',
  },
  concernCategories: [],
  publicBodies: [],
  portals: {},
  getDocumentStructureContext: () => '',
  getJurisdictionPortalContext: () => '',
}

describe('Briefing prompt — AB module', () => {
  it('contains RSA 2000 and no RSBC 1996', () => {
    const prompt = buildBriefingPrompt({ jurisdictionModule: abModule })
    expect(prompt).toContain('RSA 2000')
    expect(prompt).not.toContain('RSBC 1996')
  })

  it('contains FOIP abbreviation', () => {
    const prompt = buildBriefingPrompt({ jurisdictionModule: abModule })
    expect(prompt).toContain('FOIP')
  })
})

describe('Briefing prompt — ON module', () => {
  it('contains RSO 1990 and no RSBC 1996', () => {
    const prompt = buildBriefingPrompt({ jurisdictionModule: onModule })
    expect(prompt).toContain('RSO 1990')
    expect(prompt).not.toContain('RSBC 1996')
  })
})

describe('Briefing prompt — unverified module includes practitioner caution', () => {
  it('includes caution when verified is false', () => {
    const prompt = buildBriefingPrompt({ jurisdictionModule: abModule })
    expect(prompt).toContain('not yet been verified by a practitioner')
  })

  it('does not include caution when verified is true', () => {
    const prompt = buildBriefingPrompt({ jurisdictionModule: mockJurisdictionModule })
    expect(prompt).not.toContain('not yet been verified by a practitioner')
  })
})

describe('Lever prompt — AB module', () => {
  it('contains RSA 2000 and FOIP', () => {
    const prompt = buildLeverPrompt(abModule)
    expect(prompt).toContain('RSA 2000')
    expect(prompt).toContain('FOIP')
    expect(prompt).not.toContain('RSBC 1996')
  })

  it('includes practitioner caution for unverified module', () => {
    const prompt = buildLeverPrompt(abModule)
    expect(prompt).toContain('not yet been verified by a practitioner')
  })
})

describe('Scout prompt — AB module', () => {
  it('contains RSA 2000 and Alberta governance', () => {
    const prompt = buildScoutPrompt(abModule, '')
    expect(prompt).toContain('RSA 2000')
    expect(prompt).toContain('Alberta')
    expect(prompt).not.toContain('RSBC 1996')
  })

  it('has version 0.3.0', () => {
    expect(SCOUT_PROMPT_VERSION).toBe('0.3.0')
  })
})

describe('Lens context prompt', () => {
  it('has version 0.2.0', () => {
    expect(LENS_CONTEXT_PROMPT_VERSION).toBe('0.2.0')
  })

  it('has a semver version string', () => {
    expect(LENS_CONTEXT_PROMPT_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('contains all three confidence markers', () => {
    expect(LENS_CONTEXT_SYSTEM_PROMPT).toContain('[DOCUMENTED]')
    expect(LENS_CONTEXT_SYSTEM_PROMPT).toContain('[REPORTED]')
    expect(LENS_CONTEXT_SYSTEM_PROMPT).toContain('[INFERRED]')
  })

  it('includes all four required output sections', () => {
    const sections = [
      '## How We Got Here',
      '## Connected Issues',
      '## What the Players Have Done Before',
      '## The Deeper Question',
    ]
    for (const section of sections) {
      expect(LENS_CONTEXT_SYSTEM_PROMPT).toContain(section)
    }
  })
})
