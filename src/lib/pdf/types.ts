/**
 * PDF template availability checks.
 *
 * This file is safe to import from client components -- it does NOT import
 * @react-pdf/renderer or any server-only dependencies.
 */

/** Campaign material types that have PDF templates */
export const PDF_CAMPAIGN_TYPES = [
  'fact_sheet',
  'talking_points',
  'timeline',
  'comparison',
] as const

/** Lever action types that have PDF templates */
export const PDF_LEVER_TYPES = [
  'fippa_request',
  'public_comment',
  'policy_brief',
] as const

/** Check if a campaign material type supports PDF export */
export function hasCampaignPdfTemplate(
  materialType: string
): materialType is (typeof PDF_CAMPAIGN_TYPES)[number] {
  return (PDF_CAMPAIGN_TYPES as readonly string[]).includes(materialType)
}

/** Check if a lever action type supports PDF export */
export function hasLeverPdfTemplate(
  actionType: string
): actionType is (typeof PDF_LEVER_TYPES)[number] {
  return (PDF_LEVER_TYPES as readonly string[]).includes(actionType)
}
