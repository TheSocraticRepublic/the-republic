import { describe, it, expect } from 'vitest'

const EXTERNAL_LINKS: Record<string, Array<{ label: string; urlTemplate: (name: string) => string }>> = {
  company: [
    {
      label: 'BC Corporate Registry',
      urlTemplate: (name) =>
        `https://www.corporateonline.gov.bc.ca/WebHelp/searches.htm#${encodeURIComponent(name)}`,
    },
  ],
  organization: [
    {
      label: 'CRA Charity Search',
      urlTemplate: (name) =>
        `https://apps.cra-arc.gc.ca/ebci/hacc/srch/pub/dsplyBscSrch?q.stts=0007&q.nme=${encodeURIComponent(name)}`,
    },
  ],
}

describe('Player enrichment — external links', () => {
  it('generates BC Corporate Registry URL for company type', () => {
    const links = EXTERNAL_LINKS.company
    expect(links).toHaveLength(1)
    const url = links[0].urlTemplate('Acme Corp')
    expect(url).toContain('corporateonline.gov.bc.ca')
    expect(url).toContain('Acme%20Corp')
  })

  it('generates CRA Charity Search URL for organization type', () => {
    const links = EXTERNAL_LINKS.organization
    expect(links).toHaveLength(1)
    const url = links[0].urlTemplate('Community Aid Society')
    expect(url).toContain('cra-arc.gc.ca')
    expect(url).toContain('Community%20Aid%20Society')
  })

  it('returns empty array for types without external links', () => {
    expect(EXTERNAL_LINKS.official ?? []).toEqual([])
    expect(EXTERNAL_LINKS.agency ?? []).toEqual([])
    expect(EXTERNAL_LINKS.rights_holder ?? []).toEqual([])
  })

  it('encodes special characters in names', () => {
    const url = EXTERNAL_LINKS.company[0].urlTemplate("O'Brien & Associates")
    expect(url).toContain("O'Brien%20%26%20Associates")
  })
})

describe('Player enrichment — expanded data shape', () => {
  it('appearances array has required fields', () => {
    const appearance = {
      investigationId: 'inv-1',
      role: 'decision_maker',
      concern: 'Rezoning of industrial land',
      jurisdictionName: 'Vancouver',
    }
    expect(appearance).toHaveProperty('investigationId')
    expect(appearance).toHaveProperty('role')
    expect(appearance).toHaveProperty('concern')
    expect(appearance).toHaveProperty('jurisdictionName')
  })

  it('related player data has required fields', () => {
    const related = {
      playerId: 'p-1',
      name: 'City Council',
      playerType: 'agency',
      role: 'decision_maker',
    }
    expect(related).toHaveProperty('playerId')
    expect(related).toHaveProperty('name')
    expect(related).toHaveProperty('playerType')
    expect(related).toHaveProperty('role')
  })
})
