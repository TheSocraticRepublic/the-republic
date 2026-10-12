import { describe, it, expect } from 'vitest'
import {
  PUBLIC_BODY_DIRECTORY,
  PUBLIC_BODY_ALIASES,
  storedPublicBodyName,
  resolveActionJurisdiction,
  resolveRecipient,
  resolveGenerationTarget,
  resolveInvestigationProvince,
  provinceIdFromName,
  otherProvinceBodyError,
  listedIn,
  normaliseAddress,
  isCheckedEntry,
  CHOOSE_PROVINCE_ERROR,
  type DirectoryEntry,
  type PublicBodyDirectory,
} from '@/lib/lever/public-body'
import {
  LEGACY_LETTER,
  MARKER_V1_LETTER,
  OTHER_BODY_LETTER,
  UNRESOLVED_JURISDICTION_LETTER,
} from '../fixtures/letters'

const BC_INVESTIGATION = { concern: 'Mill Creek intake', jurisdictionName: 'Victoria, British Columbia' }
const AB_INVESTIGATION = { concern: 'River access', jurisdictionName: 'Calgary, Alberta' }
const UNDETECTABLE_INVESTIGATION = { concern: 'Somewhere', jurisdictionName: 'Nowhere in particular' }

/** A synthetic directory, so `checked` can be tested before A3 records real evidence. */
const CHECKED: DirectoryEntry = {
  name: 'Synthetic Checked Ministry',
  foiAddress: 'FOI Coordinator, Synthetic Ministry, PO Box 1234 Stn Prov Govt, Victoria, BC V8W 9A1',
  jurisdiction: 'bc-provincial',
  sourceUrl: 'https://www2.gov.bc.ca/synthetic-foi-page',
  checkedOn: '2026-10-12',
  sourceQuote: 'FOI coordinator - Synthetic Ministry, P.O. Box 1234 Stn. Prov. Govt., Victoria BC  V8W 9A1',
}
const UNCHECKED: DirectoryEntry = {
  name: 'Synthetic Unchecked Office',
  foiAddress: '1 Main Street, Victoria, BC V8W 1A1',
  jurisdiction: 'bc-provincial',
}
const MISMATCHED: DirectoryEntry = {
  name: 'Synthetic Mismatched Office',
  foiAddress: '1 Main Street, Victoria, BC V8W 1A1',
  jurisdiction: 'bc-provincial',
  sourceUrl: 'https://www2.gov.bc.ca/synthetic',
  checkedOn: '2026-10-12',
  sourceQuote: '2 Main Street, Victoria, BC V8W 1A1',
}
const AB_ENTRY: DirectoryEntry = {
  name: 'Synthetic Alberta Board',
  foiAddress: '10 Avenue, Edmonton, AB T5J 0A1',
  jurisdiction: 'ab-provincial',
}
const SYNTHETIC_DIRECTORY: PublicBodyDirectory = {
  bc: [CHECKED, UNCHECKED, MISMATCHED],
  ab: [AB_ENTRY],
  on: [],
}

describe('storedPublicBodyName: precedence publicBody > publicBodyName > addressee', () => {
  it('prefers publicBody', () => {
    expect(storedPublicBodyName({ publicBody: 'A', publicBodyName: 'B', addressee: 'C' })).toBe('A')
  })
  it('falls back to the legacy publicBodyName key', () => {
    expect(storedPublicBodyName({ publicBody: null, publicBodyName: 'B', addressee: 'C' })).toBe('B')
  })
  it('falls back to addressee', () => {
    expect(storedPublicBodyName({ publicBody: '', addressee: 'C' })).toBe('C')
  })
  it('returns null for missing, empty and non-string values', () => {
    expect(storedPublicBodyName(null)).toBeNull()
    expect(storedPublicBodyName({})).toBeNull()
    expect(storedPublicBodyName({ publicBody: '   ', publicBodyName: 42, addressee: null })).toBeNull()
  })
  it('trims what it returns', () => {
    expect(storedPublicBodyName({ publicBody: '  BC Ministry of Forests ' })).toBe('BC Ministry of Forests')
  })
})

describe('resolveActionJurisdiction', () => {
  it('prefers the stored, confirmed province over detection', () => {
    expect(resolveActionJurisdiction({ jurisdiction: 'ab' }, BC_INVESTIGATION)).toBe('ab')
  })
  it('falls back to the investigation detection', () => {
    expect(resolveActionJurisdiction({}, BC_INVESTIGATION)).toBe('bc')
    expect(resolveActionJurisdiction({}, AB_INVESTIGATION)).toBe('ab')
  })
  it('ignores an unknown stored value', () => {
    expect(resolveActionJurisdiction({ jurisdiction: 'qc' }, AB_INVESTIGATION)).toBe('ab')
    expect(resolveActionJurisdiction({ jurisdiction: 'qc' }, null)).toBeNull()
  })
  it('is null with no stored province and nothing detectable: never a BC default', () => {
    expect(resolveActionJurisdiction({}, null)).toBeNull()
    expect(resolveActionJurisdiction({}, UNDETECTABLE_INVESTIGATION)).toBeNull()
  })
})

describe('normaliseAddress', () => {
  it('ignores case, whitespace and punctuation', () => {
    expect(normaliseAddress('FOI Coordinator,  City of X.')).toBe(normaliseAddress('foi coordinator city of x'))
  })
  it('treats Street/St, Avenue/Ave and PO Box/P.O. Box/Box as equal', () => {
    expect(normaliseAddress('7 Victoria Street W')).toBe(normaliseAddress('7 Victoria St W'))
    expect(normaliseAddress('453 W 12th Avenue')).toBe(normaliseAddress('453 W 12th Ave'))
    expect(normaliseAddress('PO Box 310')).toBe(normaliseAddress('P.O. Box 310'))
    expect(normaliseAddress('PO Box 310')).toBe(normaliseAddress('Box 310'))
  })
  it('keeps different numbers different', () => {
    expect(normaliseAddress('PO Box 310')).not.toBe(normaliseAddress('PO Box 311'))
    expect(normaliseAddress('PO Box 310')).toBe('box 310')
  })
})

describe('isCheckedEntry', () => {
  it('needs all three pieces of evidence and a matching quote', () => {
    expect(isCheckedEntry(CHECKED)).toBe(true)
    expect(isCheckedEntry(UNCHECKED)).toBe(false)
    expect(isCheckedEntry(MISMATCHED)).toBe(false)
    expect(isCheckedEntry({ ...CHECKED, sourceUrl: undefined })).toBe(false)
    expect(isCheckedEntry({ ...CHECKED, checkedOn: '' })).toBe(false)
    expect(isCheckedEntry({ ...CHECKED, sourceQuote: undefined })).toBe(false)
  })
  it('refuses a non-https source', () => {
    expect(isCheckedEntry({ ...CHECKED, sourceUrl: 'http://www2.gov.bc.ca/x' })).toBe(false)
  })
  it('no AB or ON directory entry is checked (A3 recorded BC evidence only)', () => {
    for (const province of ['ab', 'on'] as const) {
      for (const entry of PUBLIC_BODY_DIRECTORY[province]) expect(isCheckedEntry(entry)).toBe(false)
    }
  })
})

describe('resolveRecipient', () => {
  it('checked: a listed name with matching evidence in the action province', () => {
    const r = resolveRecipient({ metadata: { publicBody: CHECKED.name, jurisdiction: 'bc' } }, SYNTHETIC_DIRECTORY)
    expect(r).toEqual({ status: 'checked', province: 'bc', name: CHECKED.name, entry: CHECKED })
  })

  it('unchecked: a listed name without evidence, or with a quote that does not match', () => {
    const a = resolveRecipient({ metadata: { publicBody: UNCHECKED.name, jurisdiction: 'bc' } }, SYNTHETIC_DIRECTORY)
    expect(a.status).toBe('unchecked')
    const b = resolveRecipient({ metadata: { publicBody: MISMATCHED.name, jurisdiction: 'bc' } }, SYNTHETIC_DIRECTORY)
    expect(b.status).toBe('unchecked')
    expect(b).toMatchObject({ name: MISMATCHED.name, province: 'bc' })
  })

  it('other: a name the directory does not list, or no name', () => {
    expect(
      resolveRecipient({ metadata: { publicBody: 'Some Water Board', jurisdiction: 'bc' } }, SYNTHETIC_DIRECTORY)
    ).toEqual({ status: 'other', province: 'bc', name: 'Some Water Board' })
    expect(resolveRecipient({ metadata: { jurisdiction: 'ab' } }, SYNTHETIC_DIRECTORY)).toEqual({
      status: 'other',
      province: 'ab',
      name: null,
    })
  })

  it('unresolved: no stored province and no investigation', () => {
    expect(resolveRecipient({ metadata: { publicBody: CHECKED.name } }, SYNTHETIC_DIRECTORY)).toEqual({
      status: 'unresolved',
      province: null,
      name: CHECKED.name,
      reason: 'no-jurisdiction',
    })
  })

  it('wrong-jurisdiction protection: a BC name under an AB investigation is unresolved, never the BC entry', () => {
    const r = resolveRecipient(
      { metadata: { publicBody: 'BC Ministry of Forests' }, investigation: AB_INVESTIGATION }
    )
    expect(r.status).toBe('unresolved')
    expect(r).toMatchObject({ province: 'ab', reason: 'other-jurisdiction' })
    expect('entry' in r).toBe(false)
    // and by alias, too
    const viaAlias = resolveRecipient({ metadata: { publicBody: 'Ministry of Forests', jurisdiction: 'ab' } })
    expect(viaAlias.status).toBe('unresolved')
  })

  it('maps a legacy alias to its directory entry', () => {
    expect(PUBLIC_BODY_ALIASES['Ministry of Forests']).toEqual({ province: 'bc', name: 'BC Ministry of Forests' })
    const r = resolveRecipient({ metadata: { publicBody: 'Ministry of Forests' }, investigation: BC_INVESTIGATION })
    expect(r).toMatchObject({ status: 'checked', province: 'bc', name: 'BC Ministry of Forests' })
  })

  it('every alias points at a real directory entry', () => {
    for (const [alias, target] of Object.entries(PUBLIC_BODY_ALIASES)) {
      expect(
        PUBLIC_BODY_DIRECTORY[target.province].some((b) => b.name === target.name),
        `${alias} -> ${target.name}`
      ).toBe(true)
    }
  })

  it('reads the precedence keys: a body under publicBodyName alone still resolves', () => {
    const r = resolveRecipient({ metadata: { publicBodyName: 'City of Victoria', jurisdiction: 'bc' } })
    expect(r).toMatchObject({ status: 'unchecked', name: 'City of Victoria' })
  })

  describe('the seeded fixtures', () => {
    const seedMetadata = (f: typeof LEGACY_LETTER) => ({
      publicBody: f.seed!.publicBody,
      addressee: f.seed!.publicBody,
      ...(f.seed!.jurisdiction ? { jurisdiction: f.seed!.jurisdiction } : {}),
    })
    it('legacy (alias, jurisdiction from the investigation)', () => {
      const r = resolveRecipient({ metadata: seedMetadata(LEGACY_LETTER), investigation: BC_INVESTIGATION })
      expect(r).toMatchObject({ status: 'checked', province: 'bc', name: 'BC Ministry of Forests' })
    })
    it('marker-v1 (stored province)', () => {
      expect(resolveRecipient({ metadata: seedMetadata(MARKER_V1_LETTER) })).toMatchObject({
        status: 'checked',
        province: 'bc',
      })
    })
    it('Other body', () => {
      expect(resolveRecipient({ metadata: seedMetadata(OTHER_BODY_LETTER) })).toEqual({
        status: 'other',
        province: 'bc',
        name: 'Synthetic Test Authority (QA)',
      })
    })
    it('unresolved jurisdiction', () => {
      expect(resolveRecipient({ metadata: seedMetadata(UNRESOLVED_JURISDICTION_LETTER) }).status).toBe('unresolved')
    })
  })
})

describe('resolveGenerationTarget', () => {
  it('FIPPA takes jurisdiction and body from the resolver', () => {
    expect(
      resolveGenerationTarget({
        actionType: 'fippa_request',
        metadata: { publicBody: 'Ministry of Forests' },
        investigation: BC_INVESTIGATION,
      })
    ).toEqual({ ok: true, jurisdictionId: 'bc', publicBodyName: 'BC Ministry of Forests' })
    expect(
      resolveGenerationTarget({
        actionType: 'fippa_request',
        metadata: { publicBody: 'City of Edmonton', jurisdiction: 'ab' },
        investigation: BC_INVESTIGATION,
      })
    ).toEqual({ ok: true, jurisdictionId: 'ab', publicBodyName: 'City of Edmonton' })
  })

  it('FIPPA with an unresolved jurisdiction is refused with 409: no BC fallback', () => {
    for (const investigation of [null, UNDETECTABLE_INVESTIGATION]) {
      expect(
        resolveGenerationTarget({ actionType: 'fippa_request', metadata: { publicBody: 'BC Ministry of Forests' }, investigation })
      ).toEqual({ ok: false, status: 409, error: CHOOSE_PROVINCE_ERROR })
    }
    expect(CHOOSE_PROVINCE_ERROR).toBe('Choose the province this request goes to')
  })

  it('FIPPA naming another province’s body is refused too', () => {
    expect(
      resolveGenerationTarget({
        actionType: 'fippa_request',
        metadata: { publicBody: 'BC Ministry of Forests' },
        investigation: AB_INVESTIGATION,
      })
    ).toMatchObject({ ok: false, status: 409 })
  })

  it('non-FIPPA keeps detection-or-BC and names no body', () => {
    expect(
      resolveGenerationTarget({ actionType: 'public_comment', metadata: { publicBody: 'X' }, investigation: null })
    ).toEqual({ ok: true, jurisdictionId: 'bc', publicBodyName: null })
    expect(
      resolveGenerationTarget({ actionType: 'policy_brief', metadata: {}, investigation: AB_INVESTIGATION })
    ).toEqual({ ok: true, jurisdictionId: 'ab', publicBodyName: null })
    // The stored province is a FIPPA field; other types ignore it, as before.
    expect(
      resolveGenerationTarget({ actionType: 'public_comment', metadata: { jurisdiction: 'on' }, investigation: null })
    ).toEqual({ ok: true, jurisdictionId: 'bc', publicBodyName: null })
  })
})

describe('resolveInvestigationProvince: the resolved jurisdiction first, detection second', () => {
  const BURNABY = { concern: 'Synthetic concern', jurisdictionName: 'City of Burnaby', province: 'British Columbia' }
  it('reads the resolved province where keyword detection finds nothing', () => {
    // "City of Burnaby" matches no detection keyword
    expect(resolveInvestigationProvince({ ...BURNABY, province: null })).toBeNull()
    expect(resolveInvestigationProvince(BURNABY)).toBe('bc')
    expect(resolveActionJurisdiction({}, BURNABY)).toBe('bc')
  })
  it('the resolved province wins over a conflicting keyword', () => {
    expect(resolveInvestigationProvince({ concern: '', jurisdictionName: 'Victoria, British Columbia', province: 'Alberta' })).toBe('ab')
  })
  it('an unsupported province falls back to detection, then null', () => {
    expect(resolveInvestigationProvince({ concern: '', jurisdictionName: 'Toronto', province: 'Quebec' })).toBe('on')
    expect(resolveInvestigationProvince({ concern: '', jurisdictionName: 'Montreal', province: 'Quebec' })).toBeNull()
    expect(resolveInvestigationProvince(null)).toBeNull()
  })
  it('the stored province still outranks the investigation', () => {
    expect(resolveActionJurisdiction({ jurisdiction: 'on' }, BURNABY)).toBe('on')
  })
  it('maps province names case-insensitively, and nothing else', () => {
    expect(provinceIdFromName(' ontario ')).toBe('on')
    expect(provinceIdFromName('BC')).toBeNull()
    expect(provinceIdFromName(undefined)).toBeNull()
  })
  it('a legacy FIPPA draft under a Burnaby investigation generates under BC', () => {
    expect(
      resolveGenerationTarget({ actionType: 'fippa_request', metadata: { publicBody: 'BC Ministry of Forests' }, investigation: BURNABY })
    ).toEqual({ ok: true, jurisdictionId: 'bc', publicBodyName: 'BC Ministry of Forests' })
  })
})

describe('a body in another province’s directory', () => {
  it('listedIn finds the province, by name or by alias', () => {
    expect(listedIn('BC Ministry of Forests')).toEqual({ province: 'bc', name: 'BC Ministry of Forests' })
    expect(listedIn('Ministry of Forests')).toEqual({ province: 'bc', name: 'BC Ministry of Forests' })
    expect(listedIn('City of Edmonton')).toEqual({ province: 'ab', name: 'City of Edmonton' })
    expect(listedIn('Synthetic Water Board')).toBeNull()
  })
  it('the create refusal names the province it belongs to', () => {
    expect(otherProvinceBodyError('bc')).toBe(
      'That body is in the British Columbia directory. Choose British Columbia, or pick a body from the list.'
    )
  })
  it('generation of such a legacy row is refused with the real problem, not "choose the province"', () => {
    expect(
      resolveGenerationTarget({
        actionType: 'fippa_request',
        metadata: { publicBody: 'Ministry of Forests', jurisdiction: 'ab' },
        investigation: null,
      })
    ).toEqual({
      ok: false,
      status: 409,
      error:
        'This request names BC Ministry of Forests, which is in the British Columbia directory, but it goes to Alberta. Start a new request with the right province.',
    })
  })
})
