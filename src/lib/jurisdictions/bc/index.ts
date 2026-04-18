import type { JurisdictionModule } from '../types'
import { bcConcernCategories } from './concern-categories'
import { bcPublicBodies } from './public-bodies'
import { bcPortals } from './portals'
import { bcFoiFramework } from './foi-framework'
import { bcAssessmentFramework } from './assessment-framework'

const bcModule: JurisdictionModule = {
  id: 'bc',
  name: 'British Columbia',
  country: 'Canada',
  foiFramework: bcFoiFramework,
  assessmentFramework: bcAssessmentFramework,
  concernCategories: bcConcernCategories,
  publicBodies: bcPublicBodies,
  portals: bcPortals,
}

export default bcModule

// Re-export utilities for direct use
export { getDocumentStructureContext } from './concern-categories'
export { getJurisdictionPortalContext } from './portals'
