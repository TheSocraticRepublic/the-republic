import type { ConcernCategory } from '../types'

export const bcConcernCategories: ConcernCategory[] = [
  {
    category: 'Parking/Towing',
    keywords: ['parking', 'towing', 'tow', 'ticket', 'violation', 'impound', 'meter', 'fine'],
    documents: [
      {
        type: 'Traffic and Parking Bylaw',
        description: 'The municipal bylaw that sets parking rules, prohibited zones, time limits, and penalties. Defines what constitutes a violation, the maximum fee that can be charged, and the process for disputing tickets.',
        access: 'public',
        typicalLocation: 'Municipal website under Bylaws or Legal section. Search for "Traffic Bylaw" or "Parking Bylaw."',
      },
      {
        type: 'Towing Services Contract',
        description: 'The contract between the municipality and the towing company, specifying maximum fees, response requirements, and storage charges. Reveals whether the towing company is charging fees that exceed what the municipality authorized.',
        access: 'fippa_required',
        typicalLocation: 'Not typically published. Request under FIPPA from the municipal FOI Coordinator.',
      },
      {
        type: 'Council Minutes — Towing Contract Approval',
        description: 'The council meeting minutes where the towing services contract was awarded. Shows who approved the contract, what rates were authorized, and whether any councillors raised concerns about fee structures.',
        access: 'public',
        typicalLocation: 'Municipal website under Council Meetings or Agendas & Minutes. Search by year and "towing" or "parking enforcement."',
      },
      {
        type: 'Fee Schedule Bylaw or Schedule',
        description: 'A bylaw or schedule that lists all municipal fees, including parking fines and towing/storage fees. Provides the official authorized fee amounts — if what you were charged differs, you have grounds to dispute.',
        access: 'public',
        typicalLocation: 'Municipal website under Finance, Fees & Charges, or as a schedule attached to the Traffic Bylaw.',
      },
    ],
  },
  {
    category: 'Rezoning/Development',
    keywords: ['rezoning', 'development', 'zoning', 'variance', 'permit', 'development permit', 'subdivision', 'land use', 'density', 'building height'],
    documents: [
      {
        type: 'Zoning Bylaw',
        description: 'The comprehensive bylaw that divides the municipality into zones and specifies permitted uses, densities, setbacks, and building heights. Establishes what is currently permitted and what requires a rezoning or variance.',
        access: 'public',
        typicalLocation: 'Municipal website under Planning or Bylaws. Usually a large document with maps.',
      },
      {
        type: 'Official Community Plan (OCP)',
        description: 'The long-range land use planning document guiding development decisions over 10-20 years. A rezoning inconsistent with the OCP requires substantial justification and is harder for council to approve without amending the OCP first.',
        access: 'public',
        typicalLocation: 'Municipal website under Planning. Often called the OCP or Community Plan.',
      },
      {
        type: 'Development Application File',
        description: 'The file for a specific development application including the application form, site plans, and correspondence. Contains the specific proposal details — what the developer is asking for and any conditions attached.',
        access: 'public',
        typicalLocation: 'Municipal Planning department. Many municipalities publish active applications online. Some materials (financial statements, legal opinions) may require FIPPA.',
      },
      {
        type: 'Staff Report to Council',
        description: 'The planning department\'s written analysis and recommendation to council on a development application. Reveals staff\'s assessment of whether the proposal meets planning criteria.',
        access: 'public',
        typicalLocation: 'Attached to council meeting agendas. Available on municipal website under Council Meetings.',
      },
      {
        type: 'Public Hearing Minutes',
        description: 'Verbatim or summary record of public hearing proceedings including all public submissions. Documents what concerns citizens raised and how council responded.',
        access: 'public',
        typicalLocation: 'Municipal website under Council Meetings or Public Hearings.',
      },
      {
        type: 'Developer Studies (Traffic, Environmental)',
        description: 'Technical studies the developer commissioned: traffic impact assessments, environmental impact assessments, geotechnical reports. Reviewing the methodology and assumptions can reveal whether the analysis is sound.',
        access: 'fippa_required',
        typicalLocation: 'Sometimes included in staff reports. If not, request under FIPPA from the municipal Planning department.',
      },
    ],
  },
  {
    category: 'Property Taxes/Assessments',
    keywords: ['property tax', 'tax', 'assessment', 'mill rate', 'assessed value', 'BC Assessment', 'appeal', 'notice of assessment'],
    documents: [
      {
        type: 'Tax Rate Bylaw',
        description: 'The annual bylaw that sets the mill rates (tax rates) for each property class. Shows the exact rate applied to your property class and allows you to verify your tax calculation.',
        access: 'public',
        typicalLocation: 'Municipal website under Finance or Bylaws. Passed each spring.',
      },
      {
        type: 'BC Assessment Notice',
        description: 'The annual property assessment from BC Assessment Authority establishing the assessed value used for tax calculations. If the assessed value is incorrect, you can appeal to the Property Assessment Review Panel by January 31.',
        access: 'public',
        typicalLocation: 'bcassessment.ca — you can look up any property\'s assessed value. Your copy is mailed each January.',
      },
      {
        type: 'Financial Plan Bylaw (Five-Year Financial Plan)',
        description: 'The five-year financial plan that municipalities must adopt annually under the Community Charter, showing revenue sources and expenditures. Allows comparison of per-capita spending across service areas and years.',
        access: 'public',
        typicalLocation: 'Municipal website under Finance or Budget.',
      },
      {
        type: 'Assessment Review Panel Decision',
        description: 'Decisions from the Property Assessment Review Panel on appeals of assessed values. Shows how similar properties have been assessed and the grounds on which appeals succeed.',
        access: 'public',
        typicalLocation: 'Province of BC website under Assessment Review Panel.',
      },
    ],
  },
  {
    category: 'Noise/Nuisance',
    keywords: ['noise', 'nuisance', 'complaint', 'bylaw enforcement', 'neighbour', 'construction noise', 'loud music', 'disturbance'],
    documents: [
      {
        type: 'Noise Bylaw',
        description: 'The bylaw defining prohibited noise levels, times, and exemptions (construction hours, special event permits). Many noise complaints fail because an exemption applies.',
        access: 'public',
        typicalLocation: 'Municipal website under Bylaws.',
      },
      {
        type: 'Bylaw Enforcement Records',
        description: 'Records of complaints made to bylaw enforcement, inspections conducted, and notices issued for a specific address or property. Shows whether the municipality has already received complaints about this property and what action was taken.',
        access: 'fippa_required',
        typicalLocation: 'Not public. Request under FIPPA from the municipal FOI Coordinator, specifying the address and time period.',
      },
      {
        type: 'Complaint Log',
        description: 'Internal records of complaints received by the bylaw enforcement department. Reveals patterns of complaints at a location — useful for establishing that a nuisance is ongoing rather than isolated.',
        access: 'fippa_required',
        typicalLocation: 'Not public. Request under FIPPA. The municipality may provide aggregated data more readily than individual complaint records.',
      },
    ],
  },
  {
    category: 'Building Permits',
    keywords: ['building permit', 'construction permit', 'renovation', 'demolition', 'inspection', 'building code', 'occupancy permit'],
    documents: [
      {
        type: 'Building Bylaw',
        description: 'The municipal bylaw that adopts the BC Building Code and adds local requirements for permits, inspections, and enforcement. Defines when a permit is required, the application process, fees, and inspection stages.',
        access: 'public',
        typicalLocation: 'Municipal website under Bylaws or Building Department.',
      },
      {
        type: 'Permit Application File',
        description: 'The file for a specific building permit including the application, drawings, and approval conditions. Shows what was actually approved, what conditions were attached, and the scope of authorized work.',
        access: 'public',
        typicalLocation: 'Municipal Building Department. Personal information of the applicant may be severed.',
      },
      {
        type: 'Inspection Records',
        description: 'Records of building inspections, including pass/fail results and deficiency notices. Critical in cases involving safety concerns or unpermitted work — shows whether inspections were actually conducted and passed.',
        access: 'fippa_required',
        typicalLocation: 'Not fully public. Request under FIPPA from the municipal Building Department.',
      },
    ],
  },
  {
    category: 'Water/Sewer Infrastructure',
    keywords: ['water', 'sewer', 'utility', 'infrastructure', 'service connection', 'water main', 'stormwater', 'drainage', 'utility rate'],
    documents: [
      {
        type: 'Utilities Bylaw',
        description: 'The bylaw governing water, sewer, and utility service connections, rates, and responsibilities. Defines your rights and obligations as a utility customer and the municipality\'s maintenance responsibilities.',
        access: 'public',
        typicalLocation: 'Municipal website under Bylaws or Public Works.',
      },
      {
        type: 'Infrastructure Master Plan',
        description: 'Long-range capital planning document for water, sewer, and drainage infrastructure. Shows whether your area is in a planned upgrade zone and the timeline.',
        access: 'public',
        typicalLocation: 'Municipal website under Engineering, Public Works, or Capital Planning.',
      },
      {
        type: 'Capital Project Reports',
        description: 'Reports on specific infrastructure projects approved by council, including cost estimates and project scopes. Shows what was approved, at what cost, and whether projects are proceeding as planned.',
        access: 'public',
        typicalLocation: 'Council meeting agendas and minutes where projects were approved.',
      },
      {
        type: 'Engineering Studies and Condition Assessments',
        description: 'Technical assessments of infrastructure condition, capacity, and required upgrades. May show the municipality knew about infrastructure deficiencies before a failure or service disruption.',
        access: 'fippa_required',
        typicalLocation: 'Not always published. Request under FIPPA from the Engineering or Public Works department.',
      },
    ],
  },
  {
    category: 'Environmental/Tree Removal',
    keywords: ['tree', 'tree removal', 'environmental', 'riparian', 'stream', 'wetland', 'habitat', 'environmental permit', 'DPA', 'development permit area'],
    documents: [
      {
        type: 'Tree Protection Bylaw',
        description: 'Bylaw regulating the removal or alteration of significant trees, including permit requirements and replacement obligations. Defines what trees require a permit and penalties for unauthorized removal.',
        access: 'public',
        typicalLocation: 'Municipal website under Bylaws or Environment.',
      },
      {
        type: 'OCP Environmental Development Permit Area (DPA) Guidelines',
        description: 'Guidelines within the Official Community Plan governing development in sensitive ecosystems: riparian areas, steep slopes, floodplains. Establishes environmental assessment and permit requirements.',
        access: 'public',
        typicalLocation: 'Part of the Official Community Plan document on the municipal website.',
      },
      {
        type: 'Streamside Protection Regulations',
        description: 'Regulations under the BC Riparian Areas Protection Act establishing setbacks from streams. Establishes minimum no-development setbacks (typically 30m) that apply regardless of municipal zoning.',
        access: 'public',
        typicalLocation: 'Province of BC website. Also referenced in municipal OCP DPA guidelines.',
      },
      {
        type: 'Environmental Assessment Certificate',
        description: 'Certificates issued by the BC Environmental Assessment Office for major projects. Shows the conditions attached to provincial environmental approval.',
        access: 'public',
        typicalLocation: 'BC Environmental Assessment Office at eao.gov.bc.ca.',
      },
    ],
  },
  {
    category: 'Public Transit',
    keywords: ['transit', 'bus', 'route', 'TransLink', 'BC Transit', 'transit service', 'bus stop', 'transit funding'],
    documents: [
      {
        type: 'Transit Service Agreement',
        description: 'Agreements between the municipality and BC Transit or TransLink governing service levels, routes, and cost-sharing. Shows what service levels the municipality has committed to funding and the review or renegotiation schedule.',
        access: 'fippa_required',
        typicalLocation: 'Not typically published. Request under FIPPA from the municipal FOI Coordinator or BC Transit.',
      },
      {
        type: 'Regional Transit Future Plan (TransLink)',
        description: 'TransLink\'s long-range transit investment plans for the Metro Vancouver region. Shows planned service investments, timeline, and funding commitments for your area.',
        access: 'public',
        typicalLocation: 'TransLink.ca under Plans and Strategies.',
      },
      {
        type: 'Council Resolutions on Transit Funding',
        description: 'Council resolutions approving municipal contributions to transit service. Shows what service levels the municipality has committed to and any conditions attached.',
        access: 'public',
        typicalLocation: 'Council meeting minutes on the municipal website.',
      },
    ],
  },
  {
    category: 'Housing/Rental',
    keywords: ['housing', 'rental', 'rent', 'landlord', 'tenant', 'eviction', 'vacancy', 'affordable housing', 'housing agreement', 'secondary suite'],
    documents: [
      {
        type: 'Housing Needs Report',
        description: 'The legislatively required report (under BC Local Government Act) documenting current and projected housing needs. Useful for holding councils accountable to their own stated analysis.',
        access: 'public',
        typicalLocation: 'Municipal website under Planning or Housing.',
      },
      {
        type: 'Rental Housing Policies',
        description: 'Council-adopted policies on rental housing protection, tenant assistance, or inclusionary zoning. Shows what commitments the municipality has made to rental housing protection.',
        access: 'public',
        typicalLocation: 'Municipal website under Planning or Housing policies.',
      },
      {
        type: 'Housing Agreement Bylaw',
        description: 'A statutory housing agreement registered on title that requires a development to maintain affordable or rental units for a specified term. Legally binding on all future owners — critical for understanding obligations on rental buildings.',
        access: 'public',
        typicalLocation: 'Municipal website under Bylaws. Also registered at the Land Title Office.',
      },
      {
        type: 'BC Residential Tenancy Branch Decisions',
        description: 'Decisions from the BC Residential Tenancy Branch resolving disputes between landlords and tenants. Establishes precedent for how similar tenancy disputes are resolved under the Residential Tenancy Act.',
        access: 'public',
        typicalLocation: 'BC Residential Tenancy Branch website (gov.bc.ca/RTB). Decisions are published.',
      },
    ],
  },
  {
    category: 'Business Licensing',
    keywords: ['business licence', 'business license', 'business permit', 'trade licence', 'contractor licence', 'home based business', 'commercial zoning'],
    documents: [
      {
        type: 'Business Licence Bylaw',
        description: 'The bylaw requiring businesses to obtain a licence to operate, specifying categories, fees, and conditions. Defines the categories of licences, eligibility criteria, conditions that can be attached, and the review/revocation process.',
        access: 'public',
        typicalLocation: 'Municipal website under Bylaws or Business Licensing.',
      },
      {
        type: 'Business Licence Conditions',
        description: 'Conditions attached to a specific business licence. Shows what operating conditions apply to a specific business — useful if a business appears to be violating its licence conditions.',
        access: 'public',
        typicalLocation: 'The licence document itself. Some conditions are public record.',
      },
      {
        type: 'Inter-Municipal Business Licence Agreement',
        description: 'Agreements allowing contractors to operate across multiple municipalities on a single licence. Clarifies which municipalities are covered and under what conditions.',
        access: 'public',
        typicalLocation: 'Municipal website or the relevant regional district website.',
      },
    ],
  },
  {
    category: 'Mining/Extraction',
    keywords: ['mine', 'mining', 'extraction', 'drill', 'fracking', 'pipeline', 'tar sands', 'oil sands', 'lng', 'coal', 'gravel', 'quarry'],
    documents: [
      {
        type: 'Environmental Assessment Certificate',
        access: 'public',
        description: 'Provincial environmental approval for major projects, issued by the BC Environmental Assessment Office.',
        typicalLocation: 'BC EAO EPIC at projects.eao.gov.bc.ca',
      },
      {
        type: 'Mining Permit Application',
        access: 'public',
        description: 'Application to the Chief Inspector of Mines under the Mines Act.',
        typicalLocation: 'BC Ministry of Energy, Mines and Low Carbon Innovation',
      },
      {
        type: 'Remediation Plan',
        access: 'fippa_required',
        description: 'Plan for environmental remediation of mine sites.',
        typicalLocation: 'Request under FIPPA from BC Ministry of Environment',
      },
      {
        type: 'Water Licence',
        access: 'public',
        description: 'Licence for water use under the Water Sustainability Act.',
        typicalLocation: 'BC Water Resources Atlas or FrontCounter BC',
      },
    ],
  },
  {
    category: 'Land Protection/Conservation',
    keywords: ['park', 'protected area', 'conservation', 'old growth', 'wildlife', 'habitat', 'biodiversity', 'species at risk', 'wetland', 'salmon', 'watershed', 'ecological reserve'],
    documents: [
      {
        type: 'Protected Area Management Plan',
        access: 'public',
        description: 'Management plan for provincial parks and protected areas.',
        typicalLocation: 'BC Parks website at bcparks.ca',
      },
      {
        type: 'Conservation Data Centre Reports',
        access: 'public',
        description: 'Species and ecosystem occurrence data.',
        typicalLocation: 'BC Conservation Data Centre at gov.bc.ca/cdc',
      },
      {
        type: 'Land Use Plan',
        access: 'public',
        description: 'Regional strategic land use plans.',
        typicalLocation: 'Province of BC, archived plans at gov.bc.ca',
      },
      {
        type: 'Habitat Assessment Report',
        access: 'fippa_required',
        description: 'Assessment of habitat values for development review.',
        typicalLocation: 'Request under FIPPA from BC Ministry of Environment',
      },
    ],
  },
  {
    category: 'Environmental Assessment Process',
    keywords: ['environmental assessment', 'impact assessment', 'EIS', 'EIA', 'scoping', 'cumulative effects', 'environmental review', 'EAO', 'EPIC'],
    documents: [
      {
        type: 'Application Information Requirements',
        access: 'public',
        description: 'The scope of what the proponent must study.',
        typicalLocation: 'BC EAO EPIC at projects.eao.gov.bc.ca',
      },
      {
        type: 'Effects Assessment',
        access: 'public',
        description: 'The proponents assessment of environmental, social, economic, and health effects.',
        typicalLocation: 'BC EAO EPIC project page',
      },
      {
        type: 'Referral Package to Ministers',
        access: 'public',
        description: 'EAO staff recommendation to decision-makers.',
        typicalLocation: 'BC EAO EPIC project page',
      },
      {
        type: 'Conditions Schedule',
        access: 'public',
        description: 'Legally binding conditions attached to an Environmental Assessment Certificate.',
        typicalLocation: 'BC EAO EPIC project page, attached to certificate',
      },
    ],
  },
]

/**
 * Returns a formatted string of document structure knowledge for injection
 * into the Scout/Briefing system prompt at runtime.
 */
export function getDocumentStructureContext(): string {
  const lines: string[] = [
    'DOCUMENT STRUCTURE KNOWLEDGE — BC Municipal Governance',
    '======================================================',
    '',
  ]

  for (const category of bcConcernCategories) {
    lines.push(`## ${category.category}`)
    lines.push(`Keywords: ${category.keywords.join(', ')}`)
    lines.push('')

    for (const doc of category.documents) {
      const accessLabel =
        doc.access === 'public'
          ? 'PUBLIC'
          : doc.access === 'fippa_required'
          ? 'FIPPA REQUIRED'
          : 'RESTRICTED'

      lines.push(`  Document: ${doc.type}`)
      lines.push(`  Access: ${accessLabel}`)
      lines.push(`  What it is: ${doc.description}`)
      if (doc.typicalLocation) {
        lines.push(`  Typical location: ${doc.typicalLocation}`)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}
