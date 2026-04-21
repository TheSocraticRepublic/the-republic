import type { JurisdictionPortal } from '../types'

// VERIFY: URLs change. Verify all portal links before use.
// Last reviewed: training data (not independently verified).

export const onPortals: Record<string, JurisdictionPortal> = {
  'City of Toronto': {
    name: 'City of Toronto',
    url: 'https://www.toronto.ca/city-government/', // VERIFY
    description: 'Official portal for the City of Toronto, providing access to by-laws, council agendas, development applications, open data, and FIPPA requests.',
    documentTypes: [
      'By-laws (https://www.toronto.ca/city-government/council/city-by-laws/)', // VERIFY
      'Council Agendas and Minutes (https://www.toronto.ca/city-government/council/)', // VERIFY
      'Development Applications (https://www.toronto.ca/city-government/planning-development/)', // VERIFY
      'Open Data Portal (https://open.toronto.ca/)', // VERIFY
      'FIPPA Requests (https://www.toronto.ca/city-government/accountability-operations-customer-service/access-to-city-information/)', // VERIFY
    ],
  },
  'City of Ottawa': {
    name: 'City of Ottawa',
    url: 'https://ottawa.ca/en/city-hall/', // VERIFY
    description: 'Official portal for the City of Ottawa, providing access to by-laws, council minutes, development applications, open data, and FIPPA requests.',
    documentTypes: [
      'By-laws (https://ottawa.ca/en/city-hall/city-council/by-laws)', // VERIFY
      'Council Meetings (https://ottawa.ca/en/city-hall/city-council)', // VERIFY
      'Development Applications (https://ottawa.ca/en/planning-development-and-construction/planning-and-development)', // VERIFY
      'Open Data (https://open.ottawa.ca/)', // VERIFY
      'FIPPA Requests (https://ottawa.ca/en/city-hall/accountability-and-transparency/access-information)', // VERIFY
    ],
  },
  'City of Mississauga': {
    name: 'City of Mississauga',
    url: 'https://www.mississauga.ca/city-hall/', // VERIFY
    description: 'Official portal for the City of Mississauga, providing access to by-laws, council minutes, development applications, and FIPPA requests.',
    documentTypes: [
      'By-laws (https://www.mississauga.ca/city-hall/by-laws/)', // VERIFY
      'Council Meetings (https://www.mississauga.ca/city-hall/council-committees/)', // VERIFY
      'Development Applications (https://www.mississauga.ca/development-and-construction/)', // VERIFY
      'FIPPA Requests (https://www.mississauga.ca/city-hall/freedom-of-information/)', // VERIFY
    ],
  },
  'City of Hamilton': {
    name: 'City of Hamilton',
    url: 'https://www.hamilton.ca/city-hall/', // VERIFY
    description: 'Official portal for the City of Hamilton, providing access to by-laws, council agendas, development applications, and FIPPA requests.',
    documentTypes: [
      'By-laws (https://www.hamilton.ca/city-hall/by-laws-and-legislation/)', // VERIFY
      'Council Meetings (https://www.hamilton.ca/city-hall/council-committee-meetings/)', // VERIFY
      'FIPPA Requests (https://www.hamilton.ca/city-hall/accountability/freedom-information)', // VERIFY
    ],
  },
  'Government of Ontario': {
    name: 'Government of Ontario',
    url: 'https://www.ontario.ca/', // VERIFY
    description: 'Official portal for the Government of Ontario, providing access to legislation, provincial open data, Environmental Registry, and FIPPA request information.',
    documentTypes: [
      'Ontario Legislation (https://www.ontario.ca/laws)', // VERIFY
      'Open Data Catalogue (https://data.ontario.ca/)', // VERIFY
      'FIPPA Requests (https://www.ontario.ca/page/how-submit-freedom-information-request)', // VERIFY
      'Environmental Registry (https://ero.ontario.ca/)', // VERIFY
    ],
  },
  'Environmental Registry of Ontario': {
    name: 'Environmental Registry of Ontario',
    url: 'https://ero.ontario.ca/', // VERIFY
    description: 'The province-wide registry for environmental decisions, proposed policy changes, and Environmental Assessment postings. The public can comment on proposals during open comment periods.',
    documentTypes: [
      'Environmental Assessment Notices', // VERIFY
      'Policy and Regulation Proposals', // VERIFY
      'Permit and Approval Notices', // VERIFY
      'Greenbelt and Growth Plan Amendments', // VERIFY
    ],
  },
}

/**
 * Returns a formatted text block of known portal URLs for the given jurisdiction,
 * suitable for injection into the Scout/Briefing system prompt.
 * Returns empty string for unknown jurisdictions.
 */
export function getJurisdictionPortalContext(jurisdictionName: string): string {
  const portal = onPortals[jurisdictionName]
  if (!portal) {
    return ''
  }

  const lines: string[] = [
    `Known document portal URLs for ${portal.name}:`,
    `  Main portal: ${portal.url}`,
  ]

  for (const docType of portal.documentTypes) {
    lines.push(`  ${docType}`)
  }

  return lines.join('\n')
}
