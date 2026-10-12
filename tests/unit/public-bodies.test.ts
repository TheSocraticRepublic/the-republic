import { describe, it, expect } from 'vitest'
import { bcPublicBodies as BC_PUBLIC_BODIES } from '@/lib/jurisdictions/bc/public-bodies'
import type { PublicBody } from '@/lib/jurisdictions/types'
import {
  PUBLIC_BODY_DIRECTORY,
  isCheckedEntry,
  normaliseAddress,
  resolveRecipient,
  type PublicBodyDirectory,
} from '@/lib/lever/public-body'

describe('BC_PUBLIC_BODIES', () => {
  it('all entries have required fields (name, foiAddress, jurisdiction)', () => {
    for (const body of BC_PUBLIC_BODIES) {
      expect(body.name, `${body.jurisdiction} is missing name`).toBeTruthy()
      expect(body.foiAddress, `${body.name} is missing foiAddress`).toBeTruthy()
      expect(body.jurisdiction, `${body.name} is missing jurisdiction`).toBeTruthy()
    }
  })

  it('all entries have a non-empty kebab-case jurisdiction', () => {
    // Multiple bodies may share a jurisdiction (e.g. provincial ministries
    // under bc-provincial); identity uniqueness is enforced on name instead.
    for (const body of BC_PUBLIC_BODIES) {
      expect(body.jurisdiction).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  it('no duplicate names', () => {
    const names = BC_PUBLIC_BODIES.map((b) => b.name)
    const unique = new Set(names)
    expect(unique.size).toBe(names.length)
  })

  it('includes City of Vancouver', () => {
    const body = BC_PUBLIC_BODIES.find((b) => b.jurisdiction === 'vancouver')
    expect(body).toBeDefined()
    expect(body!.name).toBe('City of Vancouver')
    expect(body!.foiAddress).toContain('Vancouver')
  })

  it('includes City of Victoria', () => {
    const body = BC_PUBLIC_BODIES.find((b) => b.jurisdiction === 'victoria')
    expect(body).toBeDefined()
    expect(body!.name).toBe('City of Victoria')
  })

  it('includes City of Surrey', () => {
    const body = BC_PUBLIC_BODIES.find((b) => b.jurisdiction === 'surrey')
    expect(body).toBeDefined()
    expect(body!.name).toBe('City of Surrey')
  })

  it('includes District of Squamish', () => {
    const body = BC_PUBLIC_BODIES.find((b) => b.jurisdiction === 'squamish')
    expect(body).toBeDefined()
    expect(body!.name).toBe('District of Squamish')
  })

  it('includes BC Provincial government', () => {
    const body = BC_PUBLIC_BODIES.find((b) => b.jurisdiction === 'bc-provincial')
    expect(body).toBeDefined()
    expect(body!.name).toBe('Province of British Columbia')
  })

  it('all foiAddress values contain BC', () => {
    for (const body of BC_PUBLIC_BODIES) {
      expect(body.foiAddress).toContain('BC')
    }
  })

  it('has at least 5 entries', () => {
    expect(BC_PUBLIC_BODIES.length).toBeGreaterThanOrEqual(5)
  })
})

/** Government domains an evidence URL may point at, per province directory. */
function isBcGovernmentUrl(url: string): boolean {
  const parsed = new URL(url)
  return parsed.protocol === 'https:' && (parsed.hostname === 'gov.bc.ca' || parsed.hostname.endsWith('.gov.bc.ca'))
}

const FOI_PAGE =
  'https://www2.gov.bc.ca/gov/content/governments/about-the-bc-government/open-government/open-information/freedom-of-information'
const FOI_FAQ = `${FOI_PAGE}/foi-faq`
const FOI_OPERATIONS = 'FOI Operations, PO Box 9569, Stn Prov Govt, Victoria BC V8W 9K1'

const CHECKED_NAMES = [
  'Province of British Columbia',
  'BC Ministry of Environment and Climate Change Strategy',
  'BC Ministry of Energy, Mines and Low Carbon Innovation',
  'BC Ministry of Forests',
]

function entry(name: string): PublicBody {
  const found = BC_PUBLIC_BODIES.find((b) => b.name === name)
  if (!found) throw new Error(`no directory entry named ${name}`)
  return found
}

function resolveBc(name: string, directory?: PublicBodyDirectory) {
  return resolveRecipient({ metadata: { publicBody: name, jurisdiction: 'bc' } }, directory)
}

describe('BC_PUBLIC_BODIES evidence (A3)', () => {
  it('every entry with a checkedOn has an https gov.bc.ca sourceUrl, a non-empty sourceQuote, and a matching address', () => {
    const withDate = BC_PUBLIC_BODIES.filter((b) => b.checkedOn !== undefined)
    expect(withDate.length).toBeGreaterThan(0)
    for (const body of withDate) {
      expect(body.checkedOn, body.name).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(body.sourceUrl, `${body.name} sourceUrl`).toBeTruthy()
      expect(isBcGovernmentUrl(body.sourceUrl!), `${body.name} sourceUrl ${body.sourceUrl}`).toBe(true)
      expect(body.sourceQuote?.trim(), `${body.name} sourceQuote`).toBeTruthy()
      expect(normaliseAddress(body.foiAddress), body.name).toBe(normaliseAddress(body.sourceQuote!))
      expect(isCheckedEntry(body), body.name).toBe(true)
    }
  })

  it('no entry carries partial evidence', () => {
    for (const body of BC_PUBLIC_BODIES) {
      const present = [body.sourceUrl, body.checkedOn, body.sourceQuote].filter((v) => v !== undefined).length
      expect([0, 3], body.name).toContain(present)
    }
  })

  it('exactly the four FOI Operations entries are checked', () => {
    const checked = BC_PUBLIC_BODIES.filter(isCheckedEntry).map((b) => b.name)
    expect(checked.sort()).toEqual([...CHECKED_NAMES].sort())
  })

  it('records the source page, date and quote for each checked entry', () => {
    expect(entry('Province of British Columbia')).toMatchObject({
      foiAddress: FOI_OPERATIONS,
      sourceUrl: FOI_PAGE,
      checkedOn: '2026-10-12',
      sourceQuote: 'FOI Operations, PO Box 9569, Stn Prov Govt, Victoria BC, V8W 9K1',
    })
    for (const name of CHECKED_NAMES.slice(1)) {
      expect(entry(name), name).toMatchObject({
        foiAddress: FOI_OPERATIONS,
        sourceUrl: FOI_FAQ,
        checkedOn: '2026-10-12',
        sourceQuote: FOI_OPERATIONS,
      })
    }
  })

  it('the resolver: four provincial entries checked, the EAO unchecked', () => {
    for (const name of CHECKED_NAMES) {
      expect(resolveBc(name), name).toMatchObject({ status: 'checked', province: 'bc', name })
    }
    const eao = resolveBc('BC Environmental Assessment Office')
    expect(eao).toMatchObject({ status: 'unchecked', province: 'bc', name: 'BC Environmental Assessment Office' })
    expect(entry('BC Environmental Assessment Office').sourceUrl).toBeUndefined()
  })

  it('the resolver: a municipal entry is unchecked', () => {
    expect(resolveBc('City of Vancouver')).toMatchObject({ status: 'unchecked', name: 'City of Vancouver' })
    expect(resolveBc('City of Kamloops')).toMatchObject({ status: 'unchecked', name: 'City of Kamloops' })
  })

  describe('an entry whose evidence does not hold is unchecked, and never resolved as checked', () => {
    const forests = entry('BC Ministry of Forests')
    const variants: [string, PublicBody][] = [
      ['a quote with a different box', { ...forests, sourceQuote: 'FOI Operations, PO Box 9570, Stn Prov Govt, Victoria BC V8W 9K1' }],
      ['a quote with a different postcode', { ...forests, sourceQuote: 'FOI Operations, PO Box 9569, Stn Prov Govt, Victoria BC V8W 9K2' }],
      ['no checkedOn', { ...forests, checkedOn: undefined }],
      ['no sourceUrl', { ...forests, sourceUrl: undefined }],
      ['no sourceQuote', { ...forests, sourceQuote: undefined }],
      ['an http sourceUrl', { ...forests, sourceUrl: forests.sourceUrl!.replace('https://', 'http://') }],
    ]
    for (const [label, broken] of variants) {
      it(label, () => {
        expect(isCheckedEntry(broken)).toBe(false)
        const directory: PublicBodyDirectory = {
          ...PUBLIC_BODY_DIRECTORY,
          bc: PUBLIC_BODY_DIRECTORY.bc.map((b) => (b.name === forests.name ? broken : b)),
        }
        const r = resolveBc(forests.name, directory)
        expect(r.status).toBe('unchecked')
        expect(r.status).not.toBe('checked')
      })
    }
    it('the unbroken entry is checked through the same path', () => {
      expect(isCheckedEntry(forests)).toBe(true)
      expect(resolveBc(forests.name, { ...PUBLIC_BODY_DIRECTORY }).status).toBe('checked')
    })
  })
})
