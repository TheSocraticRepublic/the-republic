import type { JurisdictionModule } from '../types'
import { onConcernCategories } from './concern-categories'
import { onPublicBodies } from './public-bodies'
import { onPortals } from './portals'
import { onFoiFramework } from './foi-framework'
import { onAssessmentFramework } from './assessment-framework'

const onModule: JurisdictionModule = {
  id: 'on',
  name: 'Ontario',
  country: 'Canada',
  foiFramework: onFoiFramework,
  assessmentFramework: onAssessmentFramework,
  concernCategories: onConcernCategories,
  publicBodies: onPublicBodies,
  portals: onPortals,
}

export default onModule

// Re-export utilities for direct use
export { getDocumentStructureContext } from './concern-categories'
export { getJurisdictionPortalContext } from './portals'
