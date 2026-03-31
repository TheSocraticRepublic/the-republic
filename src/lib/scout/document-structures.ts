export interface DocumentEntry {
  type: string
  description: string
  access: 'public' | 'fippa_required' | 'council_record'
  typical_location: string
  why_it_matters: string
}

export interface ConcernCategory {
  category: string
  concern_keywords: string[]
  documents: DocumentEntry[]
}

export const CONCERN_CATEGORIES: ConcernCategory[] = [
  {
    category: 'Parking/Towing',
    concern_keywords: ['parking', 'towing', 'tow', 'ticket', 'violation', 'impound', 'meter', 'fine'],
    documents: [
      {
        type: 'Traffic and Parking Bylaw',
        description: 'The municipal bylaw that sets parking rules, prohibited zones, time limits, and penalties.',
        access: 'public',
        typical_location: 'Municipal website under Bylaws or Legal section. Search for "Traffic Bylaw" or "Parking Bylaw."',
        why_it_matters: 'Defines what constitutes a violation, the maximum fee that can be charged, and the process for disputing tickets. If the fine you paid exceeds what the bylaw authorizes, that is a legal problem.',
      },
      {
        type: 'Towing Services Contract',
        description: 'The contract between the municipality and the towing company, specifying maximum fees, response requirements, and storage charges.',
        access: 'fippa_required',
        typical_location: 'Not typically published. Request under FIPPA from the municipal FOI Coordinator.',
        why_it_matters: 'Reveals whether the towing company is charging fees that exceed what the municipality authorized. Many towing abuses stem from companies charging above contracted rates.',
      },
      {
        type: 'Council Minutes — Towing Contract Approval',
        description: 'The council meeting minutes where the towing services contract was awarded.',
        access: 'council_record',
        typical_location: 'Municipal website under Council Meetings or Agendas & Minutes. Search by year and "towing" or "parking enforcement."',
        why_it_matters: 'Shows who approved the contract, what rates were authorized, and whether any councillors raised concerns about fee structures.',
      },
      {
        type: 'Fee Schedule Bylaw or Schedule',
        description: 'A bylaw or schedule that lists all municipal fees, including parking fines and towing/storage fees.',
        access: 'public',
        typical_location: 'Municipal website under Finance, Fees & Charges, or as a schedule attached to the Traffic Bylaw.',
        why_it_matters: 'Provides the official authorized fee amounts. If what you were charged differs from the published schedule, you have grounds to dispute.',
      },
    ],
  },
  {
    category: 'Rezoning/Development',
    concern_keywords: ['rezoning', 'development', 'zoning', 'variance', 'permit', 'development permit', 'subdivision', 'land use', 'density', 'building height'],
    documents: [
      {
        type: 'Zoning Bylaw',
        description: 'The comprehensive bylaw that divides the municipality into zones and specifies permitted uses, densities, setbacks, and building heights for each.',
        access: 'public',
        typical_location: 'Municipal website under Planning or Bylaws. Usually a large document with maps.',
        why_it_matters: 'Establishes what is currently permitted on a property and what would require a rezoning or variance. Tells you whether a proposed development is as-of-right or requires council approval.',
      },
      {
        type: 'Official Community Plan (OCP)',
        description: 'The long-range land use planning document that guides development decisions over 10-20 years.',
        access: 'public',
        typical_location: 'Municipal website under Planning. Often called the OCP or Community Plan.',
        why_it_matters: 'Shows the intended long-term direction for a neighbourhood. A rezoning inconsistent with the OCP requires a more substantial justification and is harder for council to approve without amending the OCP first.',
      },
      {
        type: 'Development Application File',
        description: 'The file for a specific development application including the application form, site plans, and correspondence.',
        access: 'public',
        typical_location: 'Municipal Planning department. Many municipalities publish active applications online. Some materials (financial statements, legal opinions) may require FIPPA.',
        why_it_matters: 'Contains the specific proposal details — what the developer is asking for, any conditions attached, and the application history.',
      },
      {
        type: 'Staff Report to Council',
        description: 'The planning department\'s written analysis and recommendation to council on a development application.',
        access: 'public',
        typical_location: 'Attached to council meeting agendas. Available on municipal website under Council Meetings.',
        why_it_matters: 'Reveals staff\'s assessment of whether the proposal meets planning criteria. A staff recommendation against approval that council overrides is significant.',
      },
      {
        type: 'Public Hearing Minutes',
        description: 'Verbatim or summary record of public hearing proceedings including all public submissions.',
        access: 'council_record',
        typical_location: 'Municipal website under Council Meetings or Public Hearings.',
        why_it_matters: 'Documents what concerns citizens raised and how council responded. Shows whether council properly considered public input before deciding.',
      },
      {
        type: 'Developer Studies (Traffic, Environmental)',
        description: 'Technical studies the developer commissioned: traffic impact assessments, environmental impact assessments, geotechnical reports.',
        access: 'fippa_required',
        typical_location: 'Sometimes included in staff reports. If not, request under FIPPA from the municipal Planning department.',
        why_it_matters: 'These studies contain the technical justification for the development. Reviewing the methodology and assumptions can reveal whether the analysis is sound.',
      },
    ],
  },
  {
    category: 'Property Taxes/Assessments',
    concern_keywords: ['property tax', 'tax', 'assessment', 'mill rate', 'assessed value', 'BC Assessment', 'appeal', 'notice of assessment'],
    documents: [
      {
        type: 'Tax Rate Bylaw',
        description: 'The annual bylaw that sets the mill rates (tax rates) for each property class.',
        access: 'public',
        typical_location: 'Municipal website under Finance or Bylaws. Passed each spring.',
        why_it_matters: 'Shows the exact rate applied to your property class. Allows you to verify your tax calculation.',
      },
      {
        type: 'BC Assessment Notice',
        description: 'The annual property assessment from BC Assessment Authority establishing the assessed value used for tax calculations.',
        access: 'public',
        typical_location: 'bcassessment.ca — you can look up any property\'s assessed value. Your copy is mailed each January.',
        why_it_matters: 'The assessment determines your tax base. If the assessed value is incorrect, you can appeal to the Property Assessment Review Panel by January 31.',
      },
      {
        type: 'Financial Plan Bylaw (Five-Year Financial Plan)',
        description: 'The five-year financial plan that municipalities must adopt each year under the Community Charter, showing revenue sources and expenditures.',
        access: 'public',
        typical_location: 'Municipal website under Finance or Budget.',
        why_it_matters: 'Shows how tax revenues are allocated. Allows comparison of per-capita spending across service areas and years.',
      },
      {
        type: 'Assessment Review Panel Decision',
        description: 'Decisions from the Property Assessment Review Panel on appeals of assessed values.',
        access: 'public',
        typical_location: 'Province of BC website under Assessment Review Panel.',
        why_it_matters: 'Shows how similar properties have been assessed and the grounds on which appeals succeed.',
      },
    ],
  },
  {
    category: 'Noise/Nuisance',
    concern_keywords: ['noise', 'nuisance', 'complaint', 'bylaw enforcement', 'neighbour', 'construction noise', 'loud music', 'disturbance'],
    documents: [
      {
        type: 'Noise Bylaw',
        description: 'The bylaw defining prohibited noise levels, times, and exemptions (construction hours, special event permits).',
        access: 'public',
        typical_location: 'Municipal website under Bylaws.',
        why_it_matters: 'Defines what is actually prohibited, the permitted construction hours, and the exemptions that may apply. Many noise complaints fail because an exemption applies.',
      },
      {
        type: 'Bylaw Enforcement Records',
        description: 'Records of complaints made to bylaw enforcement, inspections conducted, and notices issued for a specific address or property.',
        access: 'fippa_required',
        typical_location: 'Not public. Request under FIPPA from the municipal FOI Coordinator, specifying the address and time period.',
        why_it_matters: 'Shows whether the municipality has already received complaints about this property, what action was taken, and whether enforcement is consistent.',
      },
      {
        type: 'Complaint Log',
        description: 'Internal records of complaints received by the bylaw enforcement department.',
        access: 'fippa_required',
        typical_location: 'Not public. Request under FIPPA. The municipality may provide aggregated data more readily than individual complaint records.',
        why_it_matters: 'Reveals patterns of complaints at a location. Useful for establishing that a nuisance is ongoing rather than isolated.',
      },
    ],
  },
  {
    category: 'Building Permits',
    concern_keywords: ['building permit', 'construction permit', 'renovation', 'demolition', 'inspection', 'building code', 'occupancy permit'],
    documents: [
      {
        type: 'Building Bylaw',
        description: 'The municipal bylaw that adopts the BC Building Code and adds local requirements for permits, inspections, and enforcement.',
        access: 'public',
        typical_location: 'Municipal website under Bylaws or Building Department.',
        why_it_matters: 'Defines when a permit is required, the application process, fees, and the inspection stages. Establishes municipal authority to order work stopped or demolished.',
      },
      {
        type: 'Permit Application File',
        description: 'The file for a specific building permit including the application, drawings, and approval conditions.',
        access: 'public',
        typical_location: 'Municipal Building Department. Personal information of the applicant may be severed.',
        why_it_matters: 'Shows what was actually approved, what conditions were attached, and the scope of authorized work. If work exceeds the permit, that is an enforcement matter.',
      },
      {
        type: 'Inspection Records',
        description: 'Records of building inspections, including pass/fail results and deficiency notices.',
        access: 'fippa_required',
        typical_location: 'Not fully public. Request under FIPPA from the municipal Building Department.',
        why_it_matters: 'Shows whether inspections were actually conducted and passed. Critical in cases involving safety concerns or unpermitted work.',
      },
    ],
  },
  {
    category: 'Water/Sewer Infrastructure',
    concern_keywords: ['water', 'sewer', 'utility', 'infrastructure', 'service connection', 'water main', 'stormwater', 'drainage', 'utility rate'],
    documents: [
      {
        type: 'Utilities Bylaw',
        description: 'The bylaw governing water, sewer, and utility service connections, rates, and responsibilities.',
        access: 'public',
        typical_location: 'Municipal website under Bylaws or Public Works.',
        why_it_matters: 'Defines your rights and obligations as a utility customer, permitted connection specifications, and the municipality\'s maintenance responsibilities.',
      },
      {
        type: 'Infrastructure Master Plan',
        description: 'Long-range capital planning document for water, sewer, and drainage infrastructure.',
        access: 'public',
        typical_location: 'Municipal website under Engineering, Public Works, or Capital Planning.',
        why_it_matters: 'Shows whether your area is in a planned upgrade zone and the timeline. Relevant for disputes about adequacy of current service.',
      },
      {
        type: 'Capital Project Reports',
        description: 'Reports on specific infrastructure projects approved by council, including cost estimates and project scopes.',
        access: 'public',
        typical_location: 'Council meeting agendas and minutes where projects were approved.',
        why_it_matters: 'Shows what was approved, at what cost, and whether projects are proceeding as planned.',
      },
      {
        type: 'Engineering Studies and Condition Assessments',
        description: 'Technical assessments of infrastructure condition, capacity, and required upgrades.',
        access: 'fippa_required',
        typical_location: 'Not always published. Request under FIPPA from the Engineering or Public Works department.',
        why_it_matters: 'May show the municipality knew about infrastructure deficiencies before a failure or service disruption.',
      },
    ],
  },
  {
    category: 'Environmental/Tree Removal',
    concern_keywords: ['tree', 'tree removal', 'environmental', 'riparian', 'stream', 'wetland', 'habitat', 'environmental permit', 'DPA', 'development permit area'],
    documents: [
      {
        type: 'Tree Protection Bylaw',
        description: 'Bylaw regulating the removal or alteration of significant trees, including permit requirements and replacement obligations.',
        access: 'public',
        typical_location: 'Municipal website under Bylaws or Environment.',
        why_it_matters: 'Defines what trees require a permit, the permit application process, and penalties for unauthorized removal. Many municipalities exempt certain species or sizes.',
      },
      {
        type: 'OCP Environmental Development Permit Area (DPA) Guidelines',
        description: 'Guidelines within the Official Community Plan that govern development in sensitive ecosystems: riparian areas, steep slopes, floodplains.',
        access: 'public',
        typical_location: 'Part of the Official Community Plan document on the municipal website.',
        why_it_matters: 'Establishes the environmental assessment and permit requirements before development can proceed in designated areas.',
      },
      {
        type: 'Streamside Protection Regulations',
        description: 'Regulations under the BC Riparian Areas Protection Act establishing setbacks from streams.',
        access: 'public',
        typical_location: 'Province of BC website. Also referenced in municipal OCP DPA guidelines.',
        why_it_matters: 'Establishes minimum no-development setbacks from streams (typically 30m) that apply regardless of municipal zoning.',
      },
      {
        type: 'Environmental Assessment Certificate',
        description: 'Certificates issued by the BC Environmental Assessment Office for major projects.',
        access: 'public',
        typical_location: 'BC Environmental Assessment Office at eao.gov.bc.ca.',
        why_it_matters: 'For major projects, shows the conditions attached to provincial environmental approval.',
      },
    ],
  },
  {
    category: 'Public Transit',
    concern_keywords: ['transit', 'bus', 'route', 'TransLink', 'BC Transit', 'transit service', 'bus stop', 'transit funding'],
    documents: [
      {
        type: 'Transit Service Agreement',
        description: 'Agreements between the municipality and BC Transit or TransLink governing service levels, routes, and cost-sharing.',
        access: 'fippa_required',
        typical_location: 'Not typically published. Request under FIPPA from the municipal FOI Coordinator or BC Transit.',
        why_it_matters: 'Shows what service levels the municipality has committed to funding and the review or renegotiation schedule.',
      },
      {
        type: 'Regional Transit Future Plan (TransLink)',
        description: 'TransLink\'s long-range transit investment plans for the Metro Vancouver region.',
        access: 'public',
        typical_location: 'TransLink.ca under Plans and Strategies.',
        why_it_matters: 'Shows planned service investments, timeline, and funding commitments for your area.',
      },
      {
        type: 'Council Resolutions on Transit Funding',
        description: 'Council resolutions approving municipal contributions to transit service.',
        access: 'council_record',
        typical_location: 'Council meeting minutes on the municipal website.',
        why_it_matters: 'Shows what service levels the municipality has committed to and any conditions attached.',
      },
    ],
  },
  {
    category: 'Housing/Rental',
    concern_keywords: ['housing', 'rental', 'rent', 'landlord', 'tenant', 'eviction', 'vacancy', 'affordable housing', 'housing agreement', 'secondary suite'],
    documents: [
      {
        type: 'Housing Needs Report',
        description: 'The legislatively required report (under BC Local Government Act) documenting current and projected housing needs.',
        access: 'public',
        typical_location: 'Municipal website under Planning or Housing.',
        why_it_matters: 'Shows whether the municipality has documented the housing need. Useful for holding councils accountable to their own stated analysis.',
      },
      {
        type: 'Rental Housing Policies',
        description: 'Council-adopted policies on rental housing protection, tenant assistance, or inclusionary zoning.',
        access: 'public',
        typical_location: 'Municipal website under Planning or Housing policies.',
        why_it_matters: 'Shows what commitments the municipality has made to rental housing protection.',
      },
      {
        type: 'Housing Agreement Bylaw',
        description: 'A statutory housing agreement registered on title that requires a development to maintain affordable or rental units for a specified term.',
        access: 'public',
        typical_location: 'Municipal website under Bylaws. Also registered at the Land Title Office.',
        why_it_matters: 'If a housing agreement exists on a property, it is legally binding on all future owners. Critical for understanding obligations on rental buildings.',
      },
      {
        type: 'BC Residential Tenancy Branch Decisions',
        description: 'Decisions from the BC Residential Tenancy Branch resolving disputes between landlords and tenants.',
        access: 'public',
        typical_location: 'BC Residential Tenancy Branch website (gov.bc.ca/RTB). Decisions are published.',
        why_it_matters: 'Establishes precedent for how similar tenancy disputes are resolved under the Residential Tenancy Act.',
      },
    ],
  },
  {
    category: 'Business Licensing',
    concern_keywords: ['business licence', 'business license', 'business permit', 'trade licence', 'contractor licence', 'home based business', 'commercial zoning'],
    documents: [
      {
        type: 'Business Licence Bylaw',
        description: 'The bylaw requiring businesses to obtain a licence to operate, specifying categories, fees, and conditions.',
        access: 'public',
        typical_location: 'Municipal website under Bylaws or Business Licensing.',
        why_it_matters: 'Defines the categories of licences, eligibility criteria, conditions that can be attached, and the review/revocation process.',
      },
      {
        type: 'Business Licence Conditions',
        description: 'Conditions attached to a specific business licence.',
        access: 'public',
        typical_location: 'The licence document itself. Some conditions are public record.',
        why_it_matters: 'Shows what operating conditions apply to a specific business. Useful if a business is operating in a way that appears to violate its licence conditions.',
      },
      {
        type: 'Inter-Municipal Business Licence Agreement',
        description: 'Agreements allowing contractors to operate across multiple municipalities on a single licence.',
        access: 'public',
        typical_location: 'Municipal website or the relevant regional district website.',
        why_it_matters: 'Clarifies which municipalities are covered and under what conditions a contractor can operate without obtaining individual municipal licences.',
      },
    ],
  },
]

/**
 * Returns a formatted string of document structure knowledge for injection
 * into the Scout system prompt at runtime.
 */
export function getDocumentStructureContext(): string {
  const lines: string[] = [
    'DOCUMENT STRUCTURE KNOWLEDGE — BC Municipal Governance',
    '======================================================',
    '',
  ]

  for (const category of CONCERN_CATEGORIES) {
    lines.push(`## ${category.category}`)
    lines.push(`Keywords: ${category.concern_keywords.join(', ')}`)
    lines.push('')

    for (const doc of category.documents) {
      const accessLabel =
        doc.access === 'public'
          ? 'PUBLIC'
          : doc.access === 'fippa_required'
          ? 'FIPPA REQUIRED'
          : 'COUNCIL RECORD'

      lines.push(`  Document: ${doc.type}`)
      lines.push(`  Access: ${accessLabel}`)
      lines.push(`  What it is: ${doc.description}`)
      lines.push(`  Why it matters: ${doc.why_it_matters}`)
      lines.push(`  Typical location: ${doc.typical_location}`)
      lines.push('')
    }
  }

  return lines.join('\n')
}
