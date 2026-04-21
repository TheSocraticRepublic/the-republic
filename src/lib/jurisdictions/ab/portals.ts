import type { JurisdictionPortal } from '../types'

// VERIFY: URLs change. Verify all portal links before use.
// Last reviewed: training data (not independently verified).

export const abPortals: Record<string, JurisdictionPortal> = {
  'City of Edmonton': {
    name: 'City of Edmonton',
    url: 'https://www.edmonton.ca/city_government/', // VERIFY
    description: 'Official portal for the City of Edmonton, providing access to bylaws, council minutes, development applications, open data, and FOIP requests.',
    documentTypes: [
      'Bylaws (https://www.edmonton.ca/city_government/bylaws)', // VERIFY
      'Council Meetings (https://www.edmonton.ca/city_government/council/council-meetings)', // VERIFY
      'Development Applications (https://www.edmonton.ca/business_economy/urban_planning_and_design/development-applications)', // VERIFY
      'Open Data Portal (https://data.edmonton.ca/)', // VERIFY
      'FOIP Requests (https://www.edmonton.ca/city_government/city_administration/access-and-privacy)', // VERIFY
    ],
  },
  'City of Calgary': {
    name: 'City of Calgary',
    url: 'https://www.calgary.ca/home.html', // VERIFY
    description: 'Official portal for the City of Calgary, providing access to bylaws, council agendas, development permits, open data, and FOIP requests.',
    documentTypes: [
      'Bylaws (https://www.calgary.ca/city-clerks/bylaws.html)', // VERIFY
      'Council Agendas and Minutes (https://www.calgary.ca/city-clerks/council-agendas-minutes.html)', // VERIFY
      'Development Permits (https://www.calgary.ca/pda/pd/permit-applications.html)', // VERIFY
      'Open Data Portal (https://data.calgary.ca/)', // VERIFY
      'FOIP Requests (https://www.calgary.ca/city-clerks/foip.html)', // VERIFY
    ],
  },
  'City of Red Deer': {
    name: 'City of Red Deer',
    url: 'https://www.reddeer.ca/', // VERIFY
    description: 'Official portal for the City of Red Deer, providing access to bylaws, council minutes, and FOIP requests.',
    documentTypes: [
      'Bylaws (https://www.reddeer.ca/city-government/city-bylaws/)', // VERIFY
      'Council Meetings (https://www.reddeer.ca/city-government/council/council-meetings/)', // VERIFY
      'FOIP Requests (https://www.reddeer.ca/city-government/access-and-privacy/)', // VERIFY
    ],
  },
  'City of Lethbridge': {
    name: 'City of Lethbridge',
    url: 'https://www.lethbridge.ca/', // VERIFY
    description: 'Official portal for the City of Lethbridge, providing access to bylaws, council minutes, and FOIP requests.',
    documentTypes: [
      'Bylaws (https://www.lethbridge.ca/city-government/bylaws/)', // VERIFY
      'Council Meetings (https://www.lethbridge.ca/city-government/council/council-meetings/)', // VERIFY
      'FOIP Requests (https://www.lethbridge.ca/city-government/access-and-privacy/)', // VERIFY
    ],
  },
  'Government of Alberta': {
    name: 'Government of Alberta',
    url: 'https://www.alberta.ca/', // VERIFY
    description: 'Official portal for the Government of Alberta, providing access to legislation, provincial open data, and FOIP request information.',
    documentTypes: [
      'Alberta Legislation (https://www.qp.alberta.ca/)', // VERIFY
      'Open Government Portal (https://open.alberta.ca/opendata)', // VERIFY
      'FOIP Requests (https://www.alberta.ca/foip-making-a-request.aspx)', // VERIFY
      'Environmental Assessment Registry (https://environment.alberta.ca/apps/EIAR/)', // VERIFY
    ],
  },
  'Alberta Energy Regulator': {
    name: 'Alberta Energy Regulator',
    url: 'https://www.aer.ca/', // VERIFY
    description: 'Public registry for Alberta Energy Regulator decisions, licences, compliance data, and well records. Primary source for oil, gas, and pipeline regulatory information.',
    documentTypes: [
      'AER Public Registry (https://www.aer.ca/providing-information/finding-aer-information)', // VERIFY
      'Licence and Application Search (https://www.aer.ca/regulating-development/project-application)', // VERIFY
      'Compliance and Enforcement (https://www.aer.ca/protecting-what-matters/enforcing-our-rules)', // VERIFY
      'FOIP Requests (https://www.aer.ca/about-aer/foip)', // VERIFY
    ],
  },
}

/**
 * Returns a formatted text block of known portal URLs for the given jurisdiction,
 * suitable for injection into the Scout/Briefing system prompt.
 * Returns empty string for unknown jurisdictions.
 */
export function getJurisdictionPortalContext(jurisdictionName: string): string {
  const portal = abPortals[jurisdictionName]
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
