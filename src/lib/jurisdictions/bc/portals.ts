import type { JurisdictionPortal } from '../types'

export const bcPortals: Record<string, JurisdictionPortal> = {
  'District of Squamish': {
    name: 'District of Squamish',
    url: 'https://squamish.ca/yourgovernment/',
    description: 'Official web portal for the District of Squamish, providing access to bylaws, council minutes, budget documents, development applications, and FOI requests.',
    documentTypes: [
      'Bylaws (https://squamish.ca/yourgovernment/bylaws/)',
      'Council Minutes (https://squamish.ca/yourgovernment/council-and-committees/council-meetings/)',
      'Budget & Finance (https://squamish.ca/yourgovernment/budget-and-finance/)',
      'Development Applications (https://squamish.ca/business-and-development/)',
      'FOI/FIPPA Requests (https://squamish.ca/yourgovernment/freedom-of-information/)',
    ],
  },
  'City of Vancouver': {
    name: 'City of Vancouver',
    url: 'https://vancouver.ca/your-government/',
    description: 'Official web portal for the City of Vancouver, providing access to bylaws, council minutes, budget documents, development applications, open data, and FOI requests.',
    documentTypes: [
      'Bylaws (https://vancouver.ca/your-government/city-bylaws.aspx)',
      'Council Minutes (https://council.vancouver.ca/meetingSearchResults.aspx)',
      'Budget & Finance (https://vancouver.ca/your-government/budgets.aspx)',
      'Development Applications (https://vancouver.ca/home-property-development/development-applications.aspx)',
      'Open Data Portal (https://opendata.vancouver.ca/)',
      'FOI/FIPPA Requests (https://vancouver.ca/your-government/freedom-of-information.aspx)',
    ],
  },
  'City of Victoria': {
    name: 'City of Victoria',
    url: 'https://www.victoria.ca/city-government/',
    description: 'Official web portal for the City of Victoria, providing access to bylaws, council minutes, and FOI requests.',
    documentTypes: [
      'Bylaws (https://www.victoria.ca/city-government/city-bylaws)',
      'Council Minutes (https://www.victoria.ca/city-government/council-meetings)',
      'FOI/FIPPA Requests (https://www.victoria.ca/city-government/freedom-information)',
    ],
  },
  'City of Surrey': {
    name: 'City of Surrey',
    url: 'https://www.surrey.ca/city-government/',
    description: 'Official web portal for the City of Surrey, providing access to bylaws, council minutes, and FOI requests.',
    documentTypes: [
      'Bylaws (https://www.surrey.ca/city-government/bylaws)',
      'Council Minutes (https://www.surrey.ca/city-government/council-meetings-minutes)',
      'FOI/FIPPA Requests (https://www.surrey.ca/city-government/freedom-information)',
    ],
  },
  'City of Kelowna': {
    name: 'City of Kelowna',
    url: 'https://www.kelowna.ca/city-hall/',
    description: 'Official web portal for the City of Kelowna, providing access to bylaws and council minutes.',
    documentTypes: [
      'Bylaws (https://www.kelowna.ca/city-hall/city-bylaws)',
      'Council Minutes (https://www.kelowna.ca/city-hall/council/council-meetings)',
    ],
  },
  'District of North Vancouver': {
    name: 'District of North Vancouver',
    url: 'https://www.dnv.org/',
    description: 'Official web portal for the District of North Vancouver, providing access to bylaws and council minutes.',
    documentTypes: [
      'Bylaws (https://www.dnv.org/bylaws)',
      'Council Minutes (https://www.dnv.org/council-agendas-minutes)',
    ],
  },
  'City of Burnaby': {
    name: 'City of Burnaby',
    url: 'https://www.burnaby.ca/',
    description: 'Official web portal for the City of Burnaby, providing access to bylaws and council minutes.',
    documentTypes: [
      'Bylaws (https://www.burnaby.ca/our-city/bylaws)',
      'Council Minutes (https://www.burnaby.ca/our-city/council/council-meetings)',
    ],
  },
  'Resort Municipality of Whistler': {
    name: 'Resort Municipality of Whistler',
    url: 'https://www.whistler.ca/municipal-government/',
    description: 'Official web portal for the Resort Municipality of Whistler, providing access to bylaws and council minutes.',
    documentTypes: [
      'Bylaws (https://www.whistler.ca/municipal-government/bylaws/)',
      'Council Minutes (https://www.whistler.ca/municipal-government/council/council-meetings/)',
    ],
  },
  'City of Kamloops': {
    name: 'City of Kamloops',
    url: 'https://www.kamloops.ca/city-hall/',
    description: 'Official web portal for the City of Kamloops, providing access to bylaws and council minutes.',
    documentTypes: [
      'Bylaws (https://www.kamloops.ca/city-services/bylaws)',
      'Council Minutes (https://www.kamloops.ca/city-hall/council-meetings)',
    ],
  },
  'City of Nanaimo': {
    name: 'City of Nanaimo',
    url: 'https://www.nanaimo.ca/your-government/',
    description: 'Official web portal for the City of Nanaimo, providing access to bylaws and council minutes.',
    documentTypes: [
      'Bylaws (https://www.nanaimo.ca/your-government/bylaws)',
      'Council Minutes (https://www.nanaimo.ca/your-government/council-meetings)',
    ],
  },
}

/**
 * Returns a formatted text block of known portal URLs for the given jurisdiction,
 * suitable for injection into the Scout/Briefing system prompt.
 * Returns empty string for unknown jurisdictions.
 */
export function getJurisdictionPortalContext(jurisdictionName: string): string {
  const portal = bcPortals[jurisdictionName]
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
