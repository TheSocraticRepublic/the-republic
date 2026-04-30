import type { JurisdictionPortal } from '../types'

export const abPortals: Record<string, JurisdictionPortal> = {
  'City of Edmonton': {
    name: 'City of Edmonton',
    url: 'https://www.edmonton.ca/city_government/',
    description: 'Official portal for the City of Edmonton, providing access to bylaws, council minutes, development applications, open data, and FOIP requests.',
    documentTypes: [
      'Bylaws (https://www.edmonton.ca/city_government/bylaws)',
      'Council Meetings (https://www.edmonton.ca/city_government/council/council-meetings)',
      'Development Applications (https://www.edmonton.ca/business_economy/urban_planning_and_design/development-applications)',
      'Open Data Portal (https://data.edmonton.ca/)',
      'FOIP Requests (https://www.edmonton.ca/city_government/city_administration/access-and-privacy)',
    ],
  },
  'City of Calgary': {
    name: 'City of Calgary',
    url: 'https://www.calgary.ca/home.html',
    description: 'Official portal for the City of Calgary, providing access to bylaws, council agendas, development permits, open data, and FOIP requests.',
    documentTypes: [
      'Bylaws (https://www.calgary.ca/city-clerks/bylaws.html)',
      'Council Agendas and Minutes (https://www.calgary.ca/city-clerks/council-agendas-minutes.html)',
      'Development Permits (https://www.calgary.ca/pda/pd/permit-applications.html)',
      'Open Data Portal (https://data.calgary.ca/)',
      'FOIP Requests (https://www.calgary.ca/city-clerks/foip.html)',
    ],
  },
  'City of Red Deer': {
    name: 'City of Red Deer',
    url: 'https://www.reddeer.ca/',
    description: 'Official portal for the City of Red Deer, providing access to bylaws, council minutes, and FOIP requests.',
    documentTypes: [
      'Bylaws (https://www.reddeer.ca/city-government/city-bylaws/)',
      'Council Meetings (https://www.reddeer.ca/city-government/council/council-meetings/)',
      'FOIP Requests (https://www.reddeer.ca/city-government/access-and-privacy/)',
    ],
  },
  'City of Lethbridge': {
    name: 'City of Lethbridge',
    url: 'https://www.lethbridge.ca/',
    description: 'Official portal for the City of Lethbridge, providing access to bylaws, council minutes, and FOIP requests.',
    documentTypes: [
      'Bylaws (https://www.lethbridge.ca/city-government/bylaws/)',
      'Council Meetings (https://www.lethbridge.ca/city-government/council/council-meetings/)',
      'FOIP Requests (https://www.lethbridge.ca/city-government/access-and-privacy/)',
    ],
  },
  'Government of Alberta': {
    name: 'Government of Alberta',
    url: 'https://www.alberta.ca/',
    description: 'Official portal for the Government of Alberta, providing access to legislation, provincial open data, and FOIP request information.',
    documentTypes: [
      'Alberta Legislation (https://www.qp.alberta.ca/)',
      'Open Government Portal (https://open.alberta.ca/opendata)',
      'FOIP Requests (https://www.alberta.ca/foip-making-a-request.aspx)',
      'Environmental Impact Assessments (https://www.alberta.ca/environmental-impact-assessments)',
    ],
  },
  'Alberta Energy Regulator': {
    name: 'Alberta Energy Regulator',
    url: 'https://www.aer.ca/',
    description: 'Public registry for Alberta Energy Regulator decisions, licences, compliance data, and well records. Primary source for oil, gas, and pipeline regulatory information.',
    documentTypes: [
      'AER Public Registry (https://www.aer.ca/providing-information/finding-aer-information)',
      'Licence and Application Search (https://www.aer.ca/regulating-development/project-application)',
      'Compliance and Enforcement (https://www.aer.ca/protecting-what-matters/enforcing-our-rules)',
      'FOIP Requests (https://www.aer.ca/about-aer/foip)',
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
