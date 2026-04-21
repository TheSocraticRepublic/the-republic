import type { ConcernCategory } from '../types'

export const abConcernCategories: ConcernCategory[] = [
  {
    category: 'Parking/Towing',
    keywords: ['parking', 'towing', 'tow', 'ticket', 'violation', 'impound', 'meter', 'fine'],
    documents: [
      {
        type: 'Traffic Bylaw',
        description: 'The municipal bylaw governing parking rules, prohibited zones, time limits, and penalties. Defines what constitutes a violation, the maximum fee that can be charged, and the process for disputing tickets.',
        access: 'public',
        typicalLocation: 'Municipal website under Bylaws or City Administration.',
      },
      {
        type: 'Towing Services Contract',
        description: 'The contract between the municipality and the towing operator, specifying authorized fee rates, response requirements, and storage charges. Reveals whether fees charged exceed what the municipality authorized.',
        access: 'fippa_required',
        typicalLocation: 'Not typically published. Request under FOIP from the municipal FOIP Coordinator.',
      },
      {
        type: 'Fee Schedule',
        description: 'The official schedule of municipal fees including parking fines and towing charges. If what you were charged differs from the schedule, you have grounds to dispute.',
        access: 'public',
        typicalLocation: 'Municipal website under Finance or Fees and Charges.',
      },
      {
        type: 'Council Minutes — Towing Contract Approval',
        description: 'The council meeting minutes where the towing contract was awarded. Shows who approved the contract, what rates were authorized, and whether any councillors raised concerns.',
        access: 'public',
        typicalLocation: 'Municipal website under Council Meetings or Agendas and Minutes.',
      },
    ],
  },
  {
    category: 'Rezoning/Development',
    keywords: ['rezoning', 'development', 'zoning', 'variance', 'development permit', 'subdivision', 'land use', 'density', 'building height', 'area structure plan'],
    documents: [
      {
        type: 'Land Use Bylaw',
        description: 'The comprehensive bylaw dividing the municipality into districts and specifying permitted uses, densities, setbacks, and building heights. Alberta municipalities use a Land Use Bylaw rather than a Zoning Bylaw.',
        access: 'public',
        typicalLocation: 'Municipal website under Bylaws or Planning.',
      },
      {
        type: 'Municipal Development Plan',
        description: 'The statutory long-range land use plan required under the Municipal Government Act. Guides development decisions over 20+ years and must be consistent with the applicable Intermunicipal Development Plan.',
        access: 'public',
        typicalLocation: 'Municipal website under Planning or Bylaws. Also called a General Municipal Plan in some municipalities.',
      },
      {
        type: 'Area Structure Plan',
        description: 'A statutory plan for a defined area of the municipality providing more detailed land use and servicing guidance before subdivision and development. Rezoning inconsistent with the Area Structure Plan requires an amendment.',
        access: 'public',
        typicalLocation: 'Municipal website under Planning. Each plan covers a specific neighbourhood or district.',
      },
      {
        type: 'Development Application File',
        description: 'The file for a specific development application including the application form, site plans, and staff correspondence. Shows what the developer is asking for and any conditions attached.',
        access: 'public',
        typicalLocation: 'Municipal Planning department. Many municipalities publish active applications online.',
      },
      {
        type: 'Council Report and Decision',
        description: 'The planning department analysis and recommendation to council on a development application or rezoning. Reveals staff assessment and council decision rationale.',
        access: 'public',
        typicalLocation: 'Attached to council meeting agendas on the municipal website.',
      },
      {
        type: 'Developer Studies (Traffic, Environmental)',
        description: 'Technical studies the developer commissioned: traffic impact assessments, environmental site assessments, geotechnical reports. Reviewing methodology can reveal whether the analysis supports the proposed development.',
        access: 'fippa_required',
        typicalLocation: 'Sometimes included in council reports. If not, request under FOIP from the municipal Planning department.',
      },
    ],
  },
  {
    category: 'Property Taxes/Assessments',
    keywords: ['property tax', 'tax', 'mill rate', 'assessed value', 'assessment', 'appeal', 'notice of assessment', 'equalized assessment'],
    documents: [
      {
        type: 'Tax Rate Bylaw',
        description: 'The annual bylaw setting mill rates for each property class. Shows the exact rate applied to your property class and allows you to verify your tax calculation.',
        access: 'public',
        typicalLocation: 'Municipal website under Finance or Bylaws. Passed each spring.',
      },
      {
        type: 'Assessment Notice',
        description: 'The annual property assessment establishing the value used for municipal and provincial tax calculations. If the assessed value is incorrect, you can appeal to the Assessment Review Board.',
        access: 'public',
        typicalLocation: 'Mailed annually. Look up comparable assessments through the municipality or Assessment Review Board.',
      },
      {
        type: 'Operating Budget',
        description: 'The annual operating budget showing revenue sources and expenditures. Alberta municipalities must pass a budget each year under the Municipal Government Act.',
        access: 'public',
        typicalLocation: 'Municipal website under Finance or Budget.',
      },
      {
        type: 'Assessment Review Board Decision',
        description: 'Decisions from the local Assessment Review Board on property assessment appeals. Shows how similar properties have been assessed and the grounds on which appeals succeed.',
        access: 'public',
        typicalLocation: 'Municipal Assessment Review Board, or Municipal Government Board for composite assessment complaints.',
      },
    ],
  },
  {
    category: 'Noise/Nuisance',
    keywords: ['noise', 'nuisance', 'complaint', 'bylaw enforcement', 'neighbour', 'construction noise', 'loud music', 'disturbance', 'industrial noise'],
    documents: [
      {
        type: 'Community Standards Bylaw',
        description: 'The bylaw defining prohibited noise levels, times, and exemptions (construction hours, special event permits). Alberta municipalities typically use a Community Standards Bylaw rather than a standalone Noise Bylaw.',
        access: 'public',
        typicalLocation: 'Municipal website under Bylaws.',
      },
      {
        type: 'Bylaw Enforcement Records',
        description: 'Records of complaints made to bylaw enforcement, inspections conducted, and notices issued for a specific address. Shows whether the municipality has received prior complaints and what action was taken.',
        access: 'fippa_required',
        typicalLocation: 'Not public. Request under FOIP from the municipal FOIP Coordinator, specifying the address and time period.',
      },
      {
        type: 'Complaint Log',
        description: 'Internal records of complaints received by the bylaw enforcement department. Reveals patterns of complaints at a location useful for establishing an ongoing nuisance.',
        access: 'fippa_required',
        typicalLocation: 'Not public. Request under FOIP. Aggregated data may be provided more readily than individual complaint records.',
      },
    ],
  },
  {
    category: 'Building Permits',
    keywords: ['building permit', 'construction permit', 'renovation', 'demolition', 'inspection', 'building code', 'occupancy permit', 'safety codes'],
    documents: [
      {
        type: 'Safety Codes Permit Application File',
        description: 'Alberta uses a Safety Codes system rather than a pure Building Code system. The permit file includes the application, drawings, and approval conditions. Shows what was authorized and any conditions attached.',
        access: 'public',
        typicalLocation: 'Municipal Building or Safety Codes department.',
      },
      {
        type: 'Inspection Records',
        description: 'Records of Safety Codes inspections, including pass/fail results and deficiency notices. Critical for safety concerns or unpermitted work.',
        access: 'fippa_required',
        typicalLocation: 'Not fully public. Request under FOIP from the municipal Safety Codes Officer or the accredited agency.',
      },
      {
        type: 'Safety Codes Act Accreditation',
        description: 'Alberta municipalities must use accredited Safety Codes Officers. Knowing which accredited agency handles permits for your municipality clarifies who to contact and what standards apply.',
        access: 'public',
        typicalLocation: 'Safety Codes Council of Alberta website (safetycodes.ab.ca).',
      },
    ],
  },
  {
    category: 'Oil Sands/Extraction',
    keywords: ['oil sands', 'tar sands', 'oilsands', 'bitumen', 'extraction', 'in-situ', 'sagd', 'tailings', 'reclamation', 'mineable'],
    documents: [
      {
        type: 'AER Approval',
        description: 'Alberta Energy Regulator approval for oil sands projects, including in-situ and mineable operations. Specifies approved conditions, reclamation requirements, and monitoring obligations.',
        access: 'public',
        typicalLocation: 'Alberta Energy Regulator public registry at aer.ca/providing-information/finding-aer-information.',
      },
      {
        type: 'Environmental Impact Assessment',
        description: 'The EIA prepared under the Alberta Environmental Protection and Enhancement Act for major oil sands projects. Covers air, water, land, and cumulative effects.',
        access: 'public',
        typicalLocation: 'Alberta Environmental Assessment Registry at environment.alberta.ca/apps/EIAR/',
      },
      {
        type: 'Tailings Management Plan',
        description: 'Plan for managing oil sands tailings ponds, including fluid tailings volumes, treatment methods, and reclamation timeline. Required by AER Directive 085.',
        access: 'public',
        typicalLocation: 'AER public registry. Some operational details may be restricted under FOIP.',
      },
      {
        type: 'Reclamation Certificate',
        description: 'Certificate issued by Alberta Environment and Protected Areas confirming successful reclamation of disturbed land to equivalent land capability.',
        access: 'public',
        typicalLocation: 'Alberta Environment and Protected Areas (AESRD), Land Reclamation Program.',
      },
    ],
  },
  {
    category: 'Pipeline',
    keywords: ['pipeline', 'pipe', 'transmission line', 'gathering system', 'abandonment', 'right of way', 'rupture', 'spill', 'leak'],
    documents: [
      {
        type: 'Pipeline Licence',
        description: 'AER licence for construction and operation of a pipeline, specifying the route, product, operating conditions, and any special requirements.',
        access: 'public',
        typicalLocation: 'AER public registry at aer.ca.',
      },
      {
        type: 'Right-of-Way Agreement',
        description: 'Agreement between the pipeline company and landowner granting access across private land. Shows the compensation paid and conditions imposed on the landowner.',
        access: 'fippa_required',
        typicalLocation: 'Registered on land title at Service Alberta (Land Titles). Personal financial details may be severed.',
      },
      {
        type: 'Incident Report',
        description: 'AER-required report filed after a pipeline release, rupture, or incident. Discloses the volume released, the cause, and remediation actions taken.',
        access: 'public',
        typicalLocation: 'AER public registry. Major incidents are published as Field Surveillance Reports.',
      },
      {
        type: 'Surface Rights Board Decision',
        description: 'Decision from the Surface Rights Board resolving disputes between landowners and pipeline operators about compensation or right-of-entry.',
        access: 'public',
        typicalLocation: 'Surface Rights Board of Alberta at surfacerights.ab.ca.',
      },
    ],
  },
  {
    category: 'Water/Irrigation Rights',
    keywords: ['water', 'water licence', 'irrigation', 'canal', 'diversion', 'dugout', 'riparian', 'wetland', 'water allocation', 'prior allocation', 'watershed'],
    documents: [
      {
        type: 'Water Act Licence',
        description: 'Licence issued under the Alberta Water Act authorizing a specific volume of water diversion from a named source. Alberta uses a prior allocation system (first in time, first in right).',
        access: 'public',
        typicalLocation: 'Alberta Environment and Protected Areas. Water licence information is in the Water Rights Viewer at waterrights.alberta.ca.',
      },
      {
        type: 'Irrigation District Bylaw',
        description: 'Bylaws passed by local irrigation districts governing water allocation, delivery schedules, and assessment charges. Irrigation districts in Alberta are quasi-governmental bodies.',
        access: 'public',
        typicalLocation: 'The specific irrigation district. Alberta has 13 irrigation districts primarily in southern Alberta.',
      },
      {
        type: 'Watershed Management Plan',
        description: 'Government plan for managing water allocation within a specific watershed. Shows whether the watershed is closed to new allocations and the allocation priorities.',
        access: 'public',
        typicalLocation: 'Alberta Environment and Protected Areas, Watershed Management Plans.',
      },
      {
        type: 'Water Act Enforcement Order',
        description: 'Order issued under the Water Act requiring a party to stop an unauthorized diversion or remediate damage to a water body.',
        access: 'public',
        typicalLocation: 'Alberta Environment and Protected Areas.',
      },
    ],
  },
  {
    category: 'Cattle/Agriculture',
    keywords: ['cattle', 'agriculture', 'farm', 'feedlot', 'livestock', 'concentrated animal feeding', 'cafo', 'manure', 'crop', 'spray', 'pesticide'],
    documents: [
      {
        type: 'Agricultural Operation Approval',
        description: 'Approval under the Agricultural Operation Practices Act for confined feeding operations and manure management. Shows the approved capacity, setback distances, and manure management plan.',
        access: 'public',
        typicalLocation: 'Natural Resources Conservation Board (NRCB) at nrcb.ca/agricultural-operation-approval.',
      },
      {
        type: 'Nutrient Management Plan',
        description: 'Plan for application of manure and other nutrients to agricultural land, required for approved confined feeding operations.',
        access: 'public',
        typicalLocation: 'NRCB or the municipality where the operation is located.',
      },
      {
        type: 'Agricultural Support Payments',
        description: 'Records of government payments to agricultural producers under AgriStability, AgriInvest, and other programs. Aggregate data is often publicly reported.',
        access: 'fippa_required',
        typicalLocation: 'Agriculture and Agri-Food Canada / Alberta Agriculture and Irrigation. Individual payment records require FOIP.',
      },
      {
        type: 'Pesticide Use Report',
        description: 'Records of pesticide applications on agricultural land, including product, rate, and application date. Applicators in Alberta must keep records under the Pesticide Sales, Handling, Use and Application Regulation.',
        access: 'fippa_required',
        typicalLocation: 'Alberta Agriculture and Irrigation. Not routinely published; request under FOIP.',
      },
    ],
  },
  {
    category: 'Land Protection/Conservation',
    keywords: ['park', 'protected area', 'conservation', 'wildlife corridor', 'caribou', 'species at risk', 'wetland', 'natural area', 'ecological reserve', 'provincial park'],
    documents: [
      {
        type: 'Park Management Plan',
        description: 'Management plan for Alberta provincial parks and protected areas under Parks Canada Act or the Provincial Parks Act. Guides permitted activities and conservation priorities.',
        access: 'public',
        typicalLocation: 'Alberta Environment and Protected Areas, parks section at albertaparks.ca.',
      },
      {
        type: 'Biodiversity Management Framework',
        description: 'Provincial policy documents guiding species and habitat protection, including the Alberta Biodiversity Monitoring Institute data and subregional plans.',
        access: 'public',
        typicalLocation: 'Alberta Environment and Protected Areas, Lands and Forests section.',
      },
      {
        type: 'Conservation Easement',
        description: 'A voluntary legal agreement between a landowner and a conservation organization or government body permanently restricting certain land uses to protect conservation values.',
        access: 'public',
        typicalLocation: 'Registered on land title at Service Alberta. Alberta Conservation Association maintains a database of easements it holds.',
      },
    ],
  },
  {
    category: 'Environmental Assessment Process',
    keywords: ['environmental assessment', 'impact assessment', 'epea', 'environmental review', 'aer review', 'cumulative effects', 'project approval'],
    documents: [
      {
        type: 'Environmental Impact Assessment Report',
        description: 'The proponent-prepared EIA submitted to Alberta Environment and Protected Areas under the Environmental Protection and Enhancement Act. Covers all significant effects of a proposed project.',
        access: 'public',
        typicalLocation: 'Alberta Environmental Assessment Registry (AEAR) at environment.alberta.ca/apps/EIAR/',
      },
      {
        type: 'Environmental Assessment Decision',
        description: 'The decision by the Director of Environmental Assessment approving, approving with conditions, or rejecting a project under EPEA.',
        access: 'public',
        typicalLocation: 'Alberta Environmental Assessment Registry.',
      },
      {
        type: 'Public Participation Program',
        description: 'The proponent-designed program for engaging the public in the EA process. Describes when and how to submit comments.',
        access: 'public',
        typicalLocation: 'Alberta Environmental Assessment Registry and the proponent\'s project website.',
      },
      {
        type: 'Cumulative Effects Assessment',
        description: 'Assessment of combined effects of the proposed project with other existing and reasonably foreseeable projects in the region.',
        access: 'public',
        typicalLocation: 'Part of the EIA Report in the Alberta Environmental Assessment Registry.',
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
    'DOCUMENT STRUCTURE KNOWLEDGE — Alberta Municipal and Provincial Governance',
    '=========================================================================',
    '',
  ]

  for (const category of abConcernCategories) {
    lines.push(`## ${category.category}`)
    lines.push(`Keywords: ${category.keywords.join(', ')}`)
    lines.push('')

    for (const doc of category.documents) {
      const accessLabel =
        doc.access === 'public'
          ? 'PUBLIC'
          : doc.access === 'fippa_required'
          ? 'FOIP REQUIRED'
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
