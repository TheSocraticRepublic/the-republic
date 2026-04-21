import type { ConcernCategory } from '../types'

export const onConcernCategories: ConcernCategory[] = [
  {
    category: 'Parking/Towing',
    keywords: ['parking', 'towing', 'tow', 'ticket', 'parking ticket', 'violation', 'impound', 'meter', 'fine', 'parking bylaw'],
    documents: [
      {
        type: 'Traffic and Parking By-law',
        description: 'The municipal by-law governing parking rules, prohibited zones, time limits, and penalties. Ontario municipalities pass by-laws under the Municipal Act, 2001 or the City of Toronto Act, 2006.',
        access: 'public',
        typicalLocation: 'Municipal website under By-laws or City Clerk.',
      },
      {
        type: 'Towing Services By-law',
        description: 'Ontario municipalities may license and regulate towing operators separately. Shows the authorized rate schedule and conditions. The City of Toronto has specific towing regulations under the City of Toronto Act.',
        access: 'public',
        typicalLocation: 'Municipal website under By-laws or Municipal Licensing.',
      },
      {
        type: 'Towing Contract',
        description: 'The contract between the municipality and a towing operator, specifying approved fee rates, response requirements, and storage charges.',
        access: 'fippa_required',
        typicalLocation: 'Not typically published. Request under FIPPA from the municipal Freedom of Information Coordinator.',
      },
      {
        type: 'Fee Schedule',
        description: 'Schedule of fees for parking violations and towing charges. If fees charged differ from the schedule, grounds exist for dispute.',
        access: 'public',
        typicalLocation: 'Municipal website under Finance or Treasury.',
      },
    ],
  },
  {
    category: 'Rezoning/Development',
    keywords: ['rezoning', 'development', 'zoning', 'variance', 'minor variance', 'development permit', 'site plan', 'subdivision', 'consent', 'land use', 'density', 'official plan amendment', 'opa'],
    documents: [
      {
        type: 'Zoning By-law',
        description: 'The comprehensive by-law dividing the municipality into zones and specifying permitted uses, densities, setbacks, and heights. Under the Planning Act, Ontario municipalities must pass a zoning by-law that conforms to the Official Plan.',
        access: 'public',
        typicalLocation: 'Municipal website under Planning or By-laws. Toronto\'s zoning by-law is at toronto.ca/zoning.',
      },
      {
        type: 'Official Plan',
        description: 'The long-range land use planning document that all zoning by-laws and development decisions must conform to. Official Plans in Ontario are approved by the Province and must conform to applicable Provincial Plans (Greenbelt Plan, Growth Plan).',
        access: 'public',
        typicalLocation: 'Municipal website under Planning. Also available through the Municipal Clerk.',
      },
      {
        type: 'Development Application Records',
        description: 'The file for a specific planning application including the application, site plans, and supporting studies. Ontario\'s Planning Act requires the municipality to make these available.',
        access: 'public',
        typicalLocation: 'Municipal Planning department. Many Ontario municipalities post active applications online.',
      },
      {
        type: 'Planning Committee or Council Report',
        description: 'Staff report recommending approval or refusal of a planning application. Shows the planning analysis and conditions of any approval.',
        access: 'public',
        typicalLocation: 'Municipal website under Committee or Council meeting agendas.',
      },
      {
        type: 'Ontario Land Tribunal Decision',
        description: 'Decisions of the Ontario Land Tribunal (formerly LPAT/OMB) on appealed planning decisions. Binding on the municipality and sets precedent.',
        access: 'public',
        typicalLocation: 'Ontario Land Tribunal at olt.gov.on.ca.',
      },
      {
        type: 'Developer Studies (Traffic, Environmental, Shadow)',
        description: 'Technical studies submitted with development applications: traffic impact studies, environmental site assessments, shadow studies, wind studies. Required by Ontario\'s Planning Act.',
        access: 'fippa_required',
        typicalLocation: 'Sometimes on the municipal website as part of application materials. If not, request under FIPPA from the Planning department.',
      },
    ],
  },
  {
    category: 'Property Taxes/Assessments',
    keywords: ['property tax', 'tax', 'mill rate', 'assessed value', 'mpac', 'assessment', 'appeal', 'request for reconsideration', 'arb', 'tax rate by-law'],
    documents: [
      {
        type: 'Tax Rate By-law',
        description: 'The annual by-law setting tax rates for each property class. Establishes the rate applied to your property\'s MPAC assessment.',
        access: 'public',
        typicalLocation: 'Municipal website under Finance or By-laws. Passed each spring.',
      },
      {
        type: 'MPAC Assessment Notice',
        description: 'The property assessment from the Municipal Property Assessment Corporation (MPAC) establishing the assessed value for property tax purposes. Can be challenged through MPAC\'s Request for Reconsideration or the Assessment Review Board.',
        access: 'public',
        typicalLocation: 'aboutmyproperty.ca — you can look up assessed values for any Ontario property.',
      },
      {
        type: 'Financial Information Return',
        description: 'The annual financial report municipalities must file with the Province showing all revenues, expenditures, and reserves. Enables comparison across Ontario municipalities.',
        access: 'public',
        typicalLocation: 'Ontario Ministry of Municipal Affairs and Housing open data portal.',
      },
      {
        type: 'Assessment Review Board Decision',
        description: 'Decisions from the Assessment Review Board on assessment appeals. Shows how comparable properties have been assessed and the grounds on which appeals succeed.',
        access: 'public',
        typicalLocation: 'Assessment Review Board at tribunalsontario.ca/arb.',
      },
    ],
  },
  {
    category: 'Noise/Nuisance',
    keywords: ['noise', 'nuisance', 'complaint', 'bylaw enforcement', 'neighbour', 'construction noise', 'loud music', 'disturbance', 'municipal law enforcement'],
    documents: [
      {
        type: 'Noise By-law',
        description: 'The by-law defining prohibited noise levels, times, and exemptions including construction hours and special event permits. Ontario municipalities enact noise by-laws under the Municipal Act, 2001.',
        access: 'public',
        typicalLocation: 'Municipal website under By-laws.',
      },
      {
        type: 'Municipal Law Enforcement Records',
        description: 'Records of complaints made to by-law enforcement, inspections conducted, and orders issued for a specific property or address.',
        access: 'fippa_required',
        typicalLocation: 'Not public. Request under FIPPA from the municipal Freedom of Information Coordinator.',
      },
      {
        type: 'Property Standards Order',
        description: 'An order under a municipal Property Standards By-law requiring remediation of a nuisance condition. These orders may be registered on title.',
        access: 'public',
        typicalLocation: 'Municipal Clerk. If registered on title, search at the Ontario land registry through ServiceOntario.',
      },
    ],
  },
  {
    category: 'Building Permits',
    keywords: ['building permit', 'construction permit', 'renovation', 'demolition', 'inspection', 'building code', 'occupancy permit', 'conditional permit'],
    documents: [
      {
        type: 'Building Permit Application File',
        description: 'The permit file including the application, drawings, and approval conditions. Ontario\'s Building Code Act requires municipalities to issue permits for most construction. Shows what was authorized and any conditions.',
        access: 'public',
        typicalLocation: 'Municipal Building department. Personal applicant information may be severed.',
      },
      {
        type: 'Inspection Records',
        description: 'Records of building inspections under the Ontario Building Code, including pass/fail and deficiency notices. Relevant for safety concerns or unpermitted work.',
        access: 'fippa_required',
        typicalLocation: 'Not fully public. Request under FIPPA from the municipal Chief Building Official.',
      },
      {
        type: 'Building Code Compliance Order',
        description: 'Order issued under the Building Code Act requiring remediation of code deficiencies. These orders may be registered on title.',
        access: 'public',
        typicalLocation: 'Municipal Chief Building Official. If registered on title, available through ServiceOntario.',
      },
    ],
  },
  {
    category: 'Transit/Metrolinx',
    keywords: ['transit', 'bus', 'subway', 'lrt', 'go train', 'metrolinx', 'ttc', 'transit service', 'bus stop', 'transit funding', 'rapid transit', 'mto'],
    documents: [
      {
        type: 'Metrolinx Capital Program Agreement',
        description: 'Agreements between Metrolinx and municipalities governing rapid transit projects, cost-sharing, and timelines. Metrolinx is accountable to the Province, not municipalities.',
        access: 'fippa_required',
        typicalLocation: 'Request under FIPPA from Metrolinx (provincial FOI coordinator). Some agreements are posted publicly at metrolinx.com.',
      },
      {
        type: 'Regional Transportation Plan',
        description: 'Metrolinx\'s Regional Transportation Plan (The Big Move, and successor plans) setting regional transit priorities and investment timelines for the Greater Toronto and Hamilton Area.',
        access: 'public',
        typicalLocation: 'metrolinx.com/en/regionalplanning/rtp/',
      },
      {
        type: 'Environmental Project Report',
        description: 'The environmental review document for Metrolinx transit projects under the Ontario Transit Project Assessment Process (TPAP). Covers route selection and environmental effects.',
        access: 'public',
        typicalLocation: 'Environmental Registry of Ontario (ERO) at ero.ontario.ca.',
      },
      {
        type: 'TTC Operating Agreement',
        description: 'The service agreement between the TTC and the City of Toronto governing service levels, routes, and financial contributions.',
        access: 'fippa_required',
        typicalLocation: 'Request under FIPPA from the City of Toronto or TTC.',
      },
      {
        type: 'Service Change Notice',
        description: 'Official notices of proposed transit route changes, service reductions, or stop closures. Ontario requires a public process for major service changes.',
        access: 'public',
        typicalLocation: 'TTC, OC Transpo, Metrolinx, or local transit authority websites.',
      },
    ],
  },
  {
    category: 'Housing/Rent Control',
    keywords: ['housing', 'rental', 'rent', 'landlord', 'tenant', 'eviction', 'rent increase', 'rent control', 'ltb', 'landlord and tenant board', 'affordable housing', 'inclusionary zoning', 'secondary suite'],
    documents: [
      {
        type: 'Landlord and Tenant Board Order',
        description: 'Orders from the Ontario Landlord and Tenant Board resolving disputes under the Residential Tenancies Act, 2006. Binding on landlords and tenants. Precedent for similar situations.',
        access: 'public',
        typicalLocation: 'Tribunals Ontario at tribunalsontario.ca/ltb. Published decisions are searchable.',
      },
      {
        type: 'Rent Increase Guideline',
        description: 'The annual rent increase guideline set by the Province under the Residential Tenancies Act. Establishes the maximum above-guideline increase landlords can charge without LTB approval.',
        access: 'public',
        typicalLocation: 'Ontario Ministry of Municipal Affairs and Housing at ontario.ca/housing.',
      },
      {
        type: 'Municipal Housing Strategy',
        description: 'The municipality\'s housing strategy, including targets for affordable and rental housing, inclusionary zoning policies, and community improvement plans.',
        access: 'public',
        typicalLocation: 'Municipal website under Planning or Housing.',
      },
      {
        type: 'Inclusionary Zoning By-law',
        description: 'A by-law under Ontario\'s Planning Act requiring a percentage of affordable housing units in new developments. Legally binding on developers.',
        access: 'public',
        typicalLocation: 'Municipal website under By-laws or Planning.',
      },
    ],
  },
  {
    category: 'Greenbelt Protection',
    keywords: ['greenbelt', 'greenbelt plan', 'oak ridges moraine', 'niagara escarpment', 'protected countryside', 'natural heritage', 'parkway belt'],
    documents: [
      {
        type: 'Greenbelt Plan',
        description: 'The provincial land use plan establishing permanent protection for approximately 810,000 hectares of land in the Greater Golden Horseshoe. All development in the Greenbelt must conform to the Plan.',
        access: 'public',
        typicalLocation: 'Ontario Ministry of Municipal Affairs and Housing at ontario.ca/greenbelt.',
      },
      {
        type: 'Greenbelt Boundary Map',
        description: 'Official mapping showing Greenbelt boundaries, Protected Countryside designations, urban river valleys, and key natural heritage features.',
        access: 'public',
        typicalLocation: 'Greenbelt Plan schedule maps at Ontario Ministry of Municipal Affairs and Housing.',
      },
      {
        type: 'Environmental Registry Posting — Greenbelt Amendment',
        description: 'Notices on the Environmental Registry of Ontario (ERO) when the Province proposes to amend the Greenbelt Plan. Public has the right to comment during the ERO posting period.',
        access: 'public',
        typicalLocation: 'Environmental Registry of Ontario at ero.ontario.ca. Search "Greenbelt."',
      },
      {
        type: 'Official Plan Conformity Assessment',
        description: 'Provincial review of whether a municipality\'s Official Plan conforms to the Greenbelt Plan and Growth Plan. Non-conformity can be appealed to the Ontario Land Tribunal.',
        access: 'public',
        typicalLocation: 'Ontario Ministry of Municipal Affairs and Housing.',
      },
    ],
  },
  {
    category: 'Environmental Assessment Process',
    keywords: ['environmental assessment', 'ea', 'environmental impact', 'eis', 'ero', 'class ea', 'individual ea', 'terms of reference', 'cumulative effects'],
    documents: [
      {
        type: 'Terms of Reference',
        description: 'The approved terms of reference describing how the proponent will study and report on environmental effects in an individual Environmental Assessment under the Ontario Environmental Assessment Act.',
        access: 'public',
        typicalLocation: 'Environmental Registry of Ontario at ero.ontario.ca.',
      },
      {
        type: 'Environmental Assessment Document',
        description: 'The proponent\'s EA document covering the description of the undertaking, alternative methods, assessment of environmental effects, and consultation record.',
        access: 'public',
        typicalLocation: 'Environmental Registry of Ontario and the proponent\'s project website.',
      },
      {
        type: 'Class EA Study Report',
        description: 'Report for projects subject to a Class Environmental Assessment (roads, transit, electricity). Less comprehensive than an individual EA but still publicly available.',
        access: 'public',
        typicalLocation: 'Municipal website, provincial ministry, or proponent\'s project website.',
      },
      {
        type: 'Environmental Assessment Approval',
        description: 'The provincial approval issued by the Minister of the Environment, Conservation and Parks. May include conditions and monitoring requirements.',
        access: 'public',
        typicalLocation: 'Environmental Registry of Ontario.',
      },
    ],
  },
  {
    category: 'Land Protection/Conservation',
    keywords: ['provincial park', 'conservation authority', 'wetland', 'flood plain', 'significant wildlife habitat', 'natural heritage', 'species at risk', 'oak ridges moraine', 'escarpment'],
    documents: [
      {
        type: 'Conservation Authority Permit',
        description: 'Permit issued by a Conservation Authority under the Conservation Authorities Act for development in regulated areas (floodplains, wetlands). Required in addition to municipal building permits.',
        access: 'public',
        typicalLocation: 'The applicable Conservation Authority. Ontario has 36 Conservation Authorities.',
      },
      {
        type: 'Conservation Authority Fill Regulation',
        description: 'Each Conservation Authority\'s Ontario Regulation governing development, interference, and fill in regulated areas within their watershed.',
        access: 'public',
        typicalLocation: 'The applicable Conservation Authority website and e-Laws Ontario at ontario.ca/laws.',
      },
      {
        type: 'Natural Heritage Assessment',
        description: 'Assessment of significant natural heritage features (wetlands, ESAs, species at risk habitat) required by municipal Official Plans and the Provincial Policy Statement.',
        access: 'fippa_required',
        typicalLocation: 'Sometimes part of development application materials. If not, request under FIPPA from the municipal Planning department.',
      },
    ],
  },
  {
    category: 'Mining/Extraction',
    keywords: ['mine', 'mining', 'extraction', 'aggregate', 'gravel pit', 'quarry', 'licence of occupation', 'mnr', 'mnrf', 'pit', 'pits and quarries'],
    documents: [
      {
        type: 'Aggregate Resource Licence',
        description: 'Licence issued by the Ministry of Natural Resources and Forestry under the Aggregate Resources Act for operation of a pit or quarry. Specifies permitted extraction volumes and rehabilitation requirements.',
        access: 'public',
        typicalLocation: 'MNRF Aggregate Resources Information System at ontario.ca/aggregate.',
      },
      {
        type: 'Progressive Rehabilitation Plan',
        description: 'Plan for rehabilitating aggregate extraction sites progressively during and after extraction, required under the Aggregate Resources Act.',
        access: 'public',
        typicalLocation: 'MNRF Aggregate Resources Information System.',
      },
      {
        type: 'Site Plan',
        description: 'The approved site plan for an aggregate pit or quarry showing extraction limits, setbacks, buffers, and haul routes.',
        access: 'public',
        typicalLocation: 'MNRF Aggregate Resources Information System.',
      },
      {
        type: 'Mining Claim and Lease',
        description: 'Records of mining claims, leases, and exploration permits under the Mining Act. Northern Ontario mining activity is recorded in the Mining Lands Administration System.',
        access: 'public',
        typicalLocation: 'MNRF Mining Lands Administration System at ontario.ca/mining.',
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
    'DOCUMENT STRUCTURE KNOWLEDGE — Ontario Municipal and Provincial Governance',
    '=========================================================================',
    '',
  ]

  for (const category of onConcernCategories) {
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
