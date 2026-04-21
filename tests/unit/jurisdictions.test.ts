import { describe, it, expect } from 'vitest'
import {
  loadJurisdictionModule,
  getRegisteredJurisdictions,
  detectJurisdiction,
} from '@/lib/jurisdictions'

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

describe('getRegisteredJurisdictions', () => {
  it('includes bc, ab, and on', () => {
    const ids = getRegisteredJurisdictions()
    expect(ids).toContain('bc')
    expect(ids).toContain('ab')
    expect(ids).toContain('on')
  })
})

// ---------------------------------------------------------------------------
// detectJurisdiction
// ---------------------------------------------------------------------------

describe('detectJurisdiction', () => {
  it('detects Alberta by province name', () => {
    expect(detectJurisdiction('', 'Alberta')).toBe('ab')
  })

  it('detects Alberta by city name — Edmonton', () => {
    expect(detectJurisdiction('', 'Edmonton')).toBe('ab')
  })

  it('detects Alberta by city name — Calgary', () => {
    expect(detectJurisdiction('', 'Calgary')).toBe('ab')
  })

  it('detects Ontario by province name', () => {
    expect(detectJurisdiction('', 'Ontario')).toBe('on')
  })

  it('detects Ontario by city name — Toronto', () => {
    expect(detectJurisdiction('', 'Toronto')).toBe('on')
  })

  it('detects Ontario by city name — Ottawa', () => {
    expect(detectJurisdiction('', 'Ottawa')).toBe('on')
  })

  it('detects BC by province name', () => {
    expect(detectJurisdiction('', 'British Columbia')).toBe('bc')
  })

  it('detects BC by city name — Vancouver', () => {
    expect(detectJurisdiction('', 'Vancouver')).toBe('bc')
  })

  it('defaults to bc when no jurisdiction provided', () => {
    expect(detectJurisdiction('some concern text')).toBe('bc')
  })
})

// ---------------------------------------------------------------------------
// Module loading helpers
// ---------------------------------------------------------------------------

async function loadModule(id: string) {
  const mod = await loadJurisdictionModule(id)
  expect(mod, `${id} module should load`).toBeDefined()
  return mod!
}

// ---------------------------------------------------------------------------
// BC module
// ---------------------------------------------------------------------------

describe('BC jurisdiction module', () => {
  it('loads successfully', async () => {
    await loadModule('bc')
  })

  it('has required top-level fields', async () => {
    const mod = await loadModule('bc')
    expect(mod.id).toBe('bc')
    expect(mod.name).toBeTruthy()
    expect(mod.country).toBe('Canada')
    expect(mod.foiFramework).toBeDefined()
    expect(mod.concernCategories.length).toBeGreaterThan(0)
    expect(mod.publicBodies.length).toBeGreaterThan(0)
    expect(mod.portals).toBeDefined()
    expect(Object.keys(mod.portals).length).toBeGreaterThan(0)
  })

  it('foiFramework has required fields', async () => {
    const { foiFramework } = await loadModule('bc')
    expect(foiFramework.name).toBeTruthy()
    expect(foiFramework.fullCitation).toBeTruthy()
    expect(foiFramework.verified).toBe(true)
    expect(foiFramework.sections.rightOfAccess).toBeTruthy()
    expect(foiFramework.sections.timeLimit.days).toBeGreaterThan(0)
    expect(foiFramework.letterTemplate).toBeTruthy()
    expect(foiFramework.letterTemplate).toContain('{records_description}')
  })

  it('foiFramework cites FIPPA', async () => {
    const { foiFramework } = await loadModule('bc')
    expect(foiFramework.fullCitation).toContain('RSBC 1996')
  })

  it('concern categories have non-empty keywords', async () => {
    const mod = await loadModule('bc')
    for (const cat of mod.concernCategories) {
      expect(cat.keywords.length, `${cat.category} has no keywords`).toBeGreaterThan(0)
      expect(cat.documents.length, `${cat.category} has no documents`).toBeGreaterThan(0)
    }
  })

  it('all keywords are lowercase', async () => {
    const mod = await loadModule('bc')
    for (const cat of mod.concernCategories) {
      for (const kw of cat.keywords) {
        expect(kw, `keyword "${kw}" in ${cat.category} is not lowercase`).toBe(kw.toLowerCase())
      }
    }
  })

  it('no duplicate keywords within a category', async () => {
    const mod = await loadModule('bc')
    for (const cat of mod.concernCategories) {
      const unique = new Set(cat.keywords)
      expect(unique.size, `${cat.category} has duplicate keywords`).toBe(cat.keywords.length)
    }
  })

  it('assessmentFramework has required fields', async () => {
    const { assessmentFramework } = await loadModule('bc')
    expect(assessmentFramework).toBeDefined()
    expect(assessmentFramework!.name).toBeTruthy()
    expect(assessmentFramework!.authority).toBeTruthy()
    expect(assessmentFramework!.documentTypes.length).toBeGreaterThan(0)
  })

  it('public bodies all have name, foiAddress, jurisdiction', async () => {
    const mod = await loadModule('bc')
    for (const body of mod.publicBodies) {
      expect(body.name, `BC body missing name`).toBeTruthy()
      expect(body.foiAddress, `${body.name} missing foiAddress`).toBeTruthy()
      expect(body.jurisdiction, `${body.name} missing jurisdiction`).toBeTruthy()
    }
  })
})

// ---------------------------------------------------------------------------
// Alberta module
// ---------------------------------------------------------------------------

describe('Alberta jurisdiction module', () => {
  it('loads successfully', async () => {
    await loadModule('ab')
  })

  it('has required top-level fields', async () => {
    const mod = await loadModule('ab')
    expect(mod.id).toBe('ab')
    expect(mod.name).toBe('Alberta')
    expect(mod.country).toBe('Canada')
    expect(mod.foiFramework).toBeDefined()
    expect(mod.concernCategories.length).toBeGreaterThanOrEqual(10)
    expect(mod.publicBodies.length).toBeGreaterThanOrEqual(8)
    expect(Object.keys(mod.portals).length).toBeGreaterThanOrEqual(6)
  })

  it('foiFramework has required fields', async () => {
    const { foiFramework } = await loadModule('ab')
    expect(foiFramework.name).toBeTruthy()
    expect(foiFramework.fullCitation).toBeTruthy()
    expect(foiFramework.verified).toBe(false)
    expect(foiFramework.sections.rightOfAccess).toBeTruthy()
    expect(foiFramework.sections.timeLimit.days).toBeGreaterThan(0)
    expect(foiFramework.letterTemplate).toBeTruthy()
    expect(foiFramework.letterTemplate).toContain('{records_description}')
  })

  it('foiFramework cites FOIP Act', async () => {
    const { foiFramework } = await loadModule('ab')
    expect(foiFramework.fullCitation).toContain('RSA 2000')
  })

  it('letterTemplate cites FOIP Act sections', async () => {
    const { foiFramework } = await loadModule('ab')
    expect(foiFramework.letterTemplate).toContain('RSA 2000')
  })

  it('concern categories include oil sands', async () => {
    const mod = await loadModule('ab')
    const categoryNames = mod.concernCategories.map((c) => c.category.toLowerCase())
    const hasOilSands = categoryNames.some(
      (n) => n.includes('oil') || n.includes('sands') || n.includes('extraction')
    )
    expect(hasOilSands).toBe(true)
  })

  it('concern categories include pipeline', async () => {
    const mod = await loadModule('ab')
    const allKeywords = mod.concernCategories.flatMap((c) => c.keywords)
    expect(allKeywords).toContain('pipeline')
  })

  it('concern categories include irrigation/water', async () => {
    const mod = await loadModule('ab')
    const allKeywords = mod.concernCategories.flatMap((c) => c.keywords)
    const hasWater = allKeywords.some((kw) => kw.includes('irrigation') || kw.includes('water'))
    expect(hasWater).toBe(true)
  })

  it('concern categories include cattle/agriculture', async () => {
    const mod = await loadModule('ab')
    const allKeywords = mod.concernCategories.flatMap((c) => c.keywords)
    const hasAg = allKeywords.some(
      (kw) => kw.includes('cattle') || kw.includes('agriculture') || kw.includes('farm')
    )
    expect(hasAg).toBe(true)
  })

  it('public bodies include Edmonton, Calgary, Government of Alberta, and AER', async () => {
    const mod = await loadModule('ab')
    const names = mod.publicBodies.map((b) => b.name)
    expect(names.some((n) => n.includes('Edmonton'))).toBe(true)
    expect(names.some((n) => n.includes('Calgary'))).toBe(true)
    expect(names.some((n) => n.includes('Government of Alberta'))).toBe(true)
    expect(names.some((n) => n.includes('Alberta Energy Regulator'))).toBe(true)
  })

  it('all keywords are lowercase', async () => {
    const mod = await loadModule('ab')
    for (const cat of mod.concernCategories) {
      for (const kw of cat.keywords) {
        expect(kw, `keyword "${kw}" in ${cat.category} is not lowercase`).toBe(kw.toLowerCase())
      }
    }
  })

  it('no duplicate keywords within a category', async () => {
    const mod = await loadModule('ab')
    for (const cat of mod.concernCategories) {
      const unique = new Set(cat.keywords)
      expect(unique.size, `${cat.category} has duplicate keywords`).toBe(cat.keywords.length)
    }
  })

  it('assessmentFramework references EPEA', async () => {
    const { assessmentFramework } = await loadModule('ab')
    expect(assessmentFramework).toBeDefined()
    const epea =
      assessmentFramework!.authority.includes('EPEA') ||
      assessmentFramework!.authority.includes('Environmental Protection and Enhancement')
    expect(epea).toBe(true)
  })

  it('assessmentFramework has required fields', async () => {
    const { assessmentFramework } = await loadModule('ab')
    expect(assessmentFramework!.name).toBeTruthy()
    expect(assessmentFramework!.authority).toBeTruthy()
    expect(assessmentFramework!.documentTypes.length).toBeGreaterThan(0)
  })

  it('public bodies all have name, foiAddress, jurisdiction', async () => {
    const mod = await loadModule('ab')
    for (const body of mod.publicBodies) {
      expect(body.name, `AB body missing name`).toBeTruthy()
      expect(body.foiAddress, `${body.name} missing foiAddress`).toBeTruthy()
      expect(body.jurisdiction, `${body.name} missing jurisdiction`).toBeTruthy()
    }
  })
})

// ---------------------------------------------------------------------------
// Ontario module
// ---------------------------------------------------------------------------

describe('Ontario jurisdiction module', () => {
  it('loads successfully', async () => {
    await loadModule('on')
  })

  it('has required top-level fields', async () => {
    const mod = await loadModule('on')
    expect(mod.id).toBe('on')
    expect(mod.name).toBe('Ontario')
    expect(mod.country).toBe('Canada')
    expect(mod.foiFramework).toBeDefined()
    expect(mod.concernCategories.length).toBeGreaterThanOrEqual(10)
    expect(mod.publicBodies.length).toBeGreaterThanOrEqual(8)
    expect(Object.keys(mod.portals).length).toBeGreaterThanOrEqual(6)
  })

  it('foiFramework has required fields', async () => {
    const { foiFramework } = await loadModule('on')
    expect(foiFramework.name).toBeTruthy()
    expect(foiFramework.fullCitation).toBeTruthy()
    expect(foiFramework.verified).toBe(false)
    expect(foiFramework.sections.rightOfAccess).toBeTruthy()
    expect(foiFramework.sections.timeLimit.days).toBeGreaterThan(0)
    expect(foiFramework.letterTemplate).toBeTruthy()
    expect(foiFramework.letterTemplate).toContain('{records_description}')
  })

  it('foiFramework cites FIPPA Ontario', async () => {
    const { foiFramework } = await loadModule('on')
    expect(foiFramework.fullCitation).toContain('RSO 1990')
    expect(foiFramework.fullCitation).toContain('F.31')
  })

  it('letterTemplate cites FIPPA sections', async () => {
    const { foiFramework } = await loadModule('on')
    expect(foiFramework.letterTemplate).toContain('RSO 1990')
  })

  it('concern categories include transit/Metrolinx', async () => {
    const mod = await loadModule('on')
    const allKeywords = mod.concernCategories.flatMap((c) => c.keywords)
    const hasMetrolinx = allKeywords.some(
      (kw) => kw.includes('metrolinx') || kw.includes('transit') || kw.includes('lrt')
    )
    expect(hasMetrolinx).toBe(true)
  })

  it('concern categories include housing/rent control', async () => {
    const mod = await loadModule('on')
    const allKeywords = mod.concernCategories.flatMap((c) => c.keywords)
    const hasRent = allKeywords.some(
      (kw) => kw.includes('rent control') || kw.includes('ltb') || kw.includes('tenant')
    )
    expect(hasRent).toBe(true)
  })

  it('concern categories include Greenbelt', async () => {
    const mod = await loadModule('on')
    const allKeywords = mod.concernCategories.flatMap((c) => c.keywords)
    expect(allKeywords).toContain('greenbelt')
  })

  it('public bodies include Toronto, Ottawa, Mississauga, Hamilton, Metrolinx, Ontario Energy Board', async () => {
    const mod = await loadModule('on')
    const names = mod.publicBodies.map((b) => b.name)
    expect(names.some((n) => n.includes('Toronto'))).toBe(true)
    expect(names.some((n) => n.includes('Ottawa'))).toBe(true)
    expect(names.some((n) => n.includes('Mississauga'))).toBe(true)
    expect(names.some((n) => n.includes('Hamilton'))).toBe(true)
    expect(names.some((n) => n.includes('Metrolinx'))).toBe(true)
    expect(names.some((n) => n.includes('Energy Board'))).toBe(true)
  })

  it('all keywords are lowercase', async () => {
    const mod = await loadModule('on')
    for (const cat of mod.concernCategories) {
      for (const kw of cat.keywords) {
        expect(kw, `keyword "${kw}" in ${cat.category} is not lowercase`).toBe(kw.toLowerCase())
      }
    }
  })

  it('no duplicate keywords within a category', async () => {
    const mod = await loadModule('on')
    for (const cat of mod.concernCategories) {
      const unique = new Set(cat.keywords)
      expect(unique.size, `${cat.category} has duplicate keywords`).toBe(cat.keywords.length)
    }
  })

  it('assessmentFramework references Environmental Assessment Act', async () => {
    const { assessmentFramework } = await loadModule('on')
    expect(assessmentFramework).toBeDefined()
    expect(assessmentFramework!.authority).toContain('Environmental Assessment Act')
  })

  it('assessmentFramework has required fields', async () => {
    const { assessmentFramework } = await loadModule('on')
    expect(assessmentFramework!.name).toBeTruthy()
    expect(assessmentFramework!.authority).toBeTruthy()
    expect(assessmentFramework!.documentTypes.length).toBeGreaterThan(0)
  })

  it('public bodies all have name, foiAddress, jurisdiction', async () => {
    const mod = await loadModule('on')
    for (const body of mod.publicBodies) {
      expect(body.name, `ON body missing name`).toBeTruthy()
      expect(body.foiAddress, `${body.name} missing foiAddress`).toBeTruthy()
      expect(body.jurisdiction, `${body.name} missing jurisdiction`).toBeTruthy()
    }
  })
})

// ---------------------------------------------------------------------------
// Cross-module: verified flag semantics
// ---------------------------------------------------------------------------

describe('verified flag across modules', () => {
  it('BC is verified: true', async () => {
    const mod = await loadModule('bc')
    expect(mod.foiFramework.verified).toBe(true)
  })

  it('Alberta is verified: false', async () => {
    const mod = await loadModule('ab')
    expect(mod.foiFramework.verified).toBe(false)
  })

  it('Ontario is verified: false', async () => {
    const mod = await loadModule('on')
    expect(mod.foiFramework.verified).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Unknown jurisdiction
// ---------------------------------------------------------------------------

describe('loadJurisdictionModule — unknown jurisdiction', () => {
  it('returns undefined for unregistered ID', async () => {
    const mod = await loadJurisdictionModule('xx')
    expect(mod).toBeUndefined()
  })
})
