import type { JurisdictionModule } from '../types'
import { abConcernCategories, getDocumentStructureContext } from './concern-categories'
import { abPublicBodies } from './public-bodies'
import { abPortals, getJurisdictionPortalContext } from './portals'
import { abFoiFramework } from './foi-framework'
import { abAssessmentFramework } from './assessment-framework'

const abModule: JurisdictionModule = {
  id: 'ab',
  name: 'Alberta',
  country: 'Canada',
  foiFramework: abFoiFramework,
  assessmentFramework: abAssessmentFramework,
  concernCategories: abConcernCategories,
  publicBodies: abPublicBodies,
  portals: abPortals,
  getDocumentStructureContext,
  getJurisdictionPortalContext,
}

export default abModule

// Re-export utilities for direct use
export { getDocumentStructureContext } from './concern-categories'
export { getJurisdictionPortalContext } from './portals'
