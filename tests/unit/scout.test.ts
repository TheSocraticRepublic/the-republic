import { describe, it, expect } from 'vitest'
import { SCOUT_SYSTEM_PROMPT, SCOUT_PROMPT_VERSION } from '@/lib/ai/prompts/scout-system'
import {
  CONCERN_CATEGORIES,
  JURISDICTION_PORTALS,
  getDocumentStructureContext,
  getJurisdictionPortalContext,
} from '@/lib/scout/document-structures'

describe('Scout prompt', () => {
  it('includes all 5 required output sections', () => {
    const requiredSections = [
      '## Your Concern',
      '## Relevant Documents',
      '## Documents You Cannot Easily Get',
      '## The Paper Trail',
      '## Next Steps',
    ]
    for (const section of requiredSections) {
      expect(SCOUT_SYSTEM_PROMPT).toContain(section)
    }
  })

  it('includes all 6 critical rules', () => {
    // Each rule is numbered 1-6 in the prompt
    for (let i = 1; i <= 6; i++) {
      expect(SCOUT_SYSTEM_PROMPT).toContain(`${i}.`)
    }
    // Spot-check key rule content
    expect(SCOUT_SYSTEM_PROMPT).toContain('SPECIFIC')
    expect(SCOUT_SYSTEM_PROMPT).toContain('FIPPA REQUEST')
    expect(SCOUT_SYSTEM_PROMPT).toContain('CHAIN')
    expect(SCOUT_SYSTEM_PROMPT).toContain('s. 4')
    expect(SCOUT_SYSTEM_PROMPT).toContain('Freedom of Information and Protection of Privacy Act')
  })

  it('has a version string in semver format', () => {
    expect(SCOUT_PROMPT_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})

describe('Document structures', () => {
  const expectedCategories = [
    'Parking/Towing',
    'Rezoning/Development',
    'Property Taxes/Assessments',
    'Noise/Nuisance',
    'Building Permits',
    'Water/Sewer Infrastructure',
    'Environmental/Tree Removal',
    'Public Transit',
    'Housing/Rental',
    'Business Licensing',
  ]

  it('covers all 10 concern categories', () => {
    const categoryNames = CONCERN_CATEGORIES.map((c) => c.category)
    for (const expected of expectedCategories) {
      expect(categoryNames).toContain(expected)
    }
    expect(CONCERN_CATEGORIES.length).toBe(10)
  })

  it('each category has required fields', () => {
    for (const category of CONCERN_CATEGORIES) {
      expect(category.category).toBeTruthy()
      expect(Array.isArray(category.concern_keywords)).toBe(true)
      expect(category.concern_keywords.length).toBeGreaterThan(0)
      expect(Array.isArray(category.documents)).toBe(true)
      expect(category.documents.length).toBeGreaterThan(0)
    }
  })

  it('each document entry has required fields', () => {
    for (const category of CONCERN_CATEGORIES) {
      for (const doc of category.documents) {
        expect(doc.type).toBeTruthy()
        expect(doc.description).toBeTruthy()
        expect(['public', 'fippa_required', 'council_record']).toContain(doc.access)
        expect(doc.why_it_matters).toBeTruthy()
        expect(doc.typical_location).toBeTruthy()
      }
    }
  })

  it('getDocumentStructureContext returns a non-empty string covering all categories', () => {
    const context = getDocumentStructureContext()
    expect(typeof context).toBe('string')
    expect(context.length).toBeGreaterThan(0)

    for (const category of CONCERN_CATEGORIES) {
      expect(context).toContain(category.category)
    }
  })

  it('document access types are valid across all categories', () => {
    const validAccessTypes = new Set(['public', 'fippa_required', 'council_record'])
    for (const category of CONCERN_CATEGORIES) {
      for (const doc of category.documents) {
        expect(validAccessTypes.has(doc.access)).toBe(true)
      }
    }
  })
})

describe('All prompts', () => {
  it('Scout prompt version is in semver format', () => {
    expect(SCOUT_PROMPT_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})

describe('Jurisdiction portals', () => {
  const keyJurisdictions = [
    'District of Squamish',
    'City of Vancouver',
    'City of Victoria',
  ]

  it('includes entries for key BC jurisdictions', () => {
    for (const name of keyJurisdictions) {
      expect(JURISDICTION_PORTALS).toHaveProperty(name)
    }
  })

  it('each portal entry has at least a bylawsUrl', () => {
    for (const [name, portal] of Object.entries(JURISDICTION_PORTALS)) {
      expect(
        portal.bylawsUrl,
        `${name} is missing bylawsUrl`
      ).toBeTruthy()
    }
  })

  it('getJurisdictionPortalContext returns formatted string for known jurisdiction', () => {
    const context = getJurisdictionPortalContext('District of Squamish')
    expect(typeof context).toBe('string')
    expect(context.length).toBeGreaterThan(0)
    expect(context).toContain('District of Squamish')
    expect(context).toContain('squamish.ca')
    expect(context).toContain('Bylaws')
  })

  it('getJurisdictionPortalContext returns empty string for unknown jurisdiction', () => {
    const context = getJurisdictionPortalContext('City of Nowhere BC')
    expect(context).toBe('')
  })
})
