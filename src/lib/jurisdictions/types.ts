export interface JurisdictionModule {
  id: string // 'bc', 'canada-federal', 'us-federal'
  name: string // 'British Columbia'
  country: string // 'Canada'
  foiFramework: FOIFramework
  assessmentFramework?: AssessmentFramework
  concernCategories: ConcernCategory[]
  publicBodies: PublicBody[]
  portals: Record<string, JurisdictionPortal>
}

export interface FOIFramework {
  name: string // 'FIPPA', 'ATIA', 'FOIA'
  fullCitation: string // 'Freedom of Information and Protection of Privacy Act, RSBC 1996, c. 165'
  verified: boolean // true if legal citations have been verified by a legal professional
  sections: {
    rightOfAccess: string // 's. 4'
    dutyToAssist: string // 's. 6'
    timeLimit: { section: string; days: number }
    feeWaiver?: string // 's. 75(5)(a)'
    review?: string // 's. 52'
  }
  letterTemplate: string // Template with {placeholders}
  responseTimeline: string // '30 calendar days'
}

export interface AssessmentFramework {
  name: string // 'BC Environmental Assessment Office'
  authority: string // 'Environmental Assessment Act, SBC 2018, c. 51'
  registryUrl: string
  documentTypes: AssessmentDocumentType[]
  processStages: ProcessStage[]
  publicParticipation: PublicParticipation[]
  keyStatutes: string[]
}

export interface AssessmentDocumentType {
  type: string
  description: string
  access: 'public' | 'restricted'
  typicalLocation: string
}

export interface ProcessStage {
  stage: string
  description: string
  publicInput: boolean
  typicalDuration: string
}

export interface PublicParticipation {
  type: string // 'public_comment', 'public_hearing', 'open_house'
  stage: string
  howToParticipate: string
  typicalDeadline: string
}

export interface ConcernCategory {
  category: string
  keywords: string[]
  documents: ConcernDocument[]
}

export interface ConcernDocument {
  type: string
  access: 'public' | 'fippa_required' | 'restricted'
  description: string
  typicalLocation?: string
}

export interface PublicBody {
  name: string
  foiAddress: string
  jurisdiction: string
  email?: string
  phone?: string
}

export interface JurisdictionPortal {
  name: string
  url: string
  description: string
  documentTypes: string[]
}
