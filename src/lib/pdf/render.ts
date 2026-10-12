import React from 'react'
import { renderToStream } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import type { RecipientResolution } from '@/lib/lever/public-body'
import type {
  CampaignMaterial,
  FactSheetSpec,
  TalkingPointsSpec,
  TimelineSpec,
  ComparisonSpec,
} from '@/lib/campaign/schemas'

// Ensure fonts are registered before any render call
import './fonts'

// Template imports (lazy to avoid loading unused templates)
import { FactSheetTemplate } from './templates/fact-sheet'
import { TalkingPointsTemplate } from './templates/talking-points'
import { TimelineTemplate } from './templates/timeline'
import { ComparisonTemplate } from './templates/comparison'
import {
  FippaRequestTemplate,
  loadLetterMetrics,
  estimateRenderCost,
  RENDER_COST_LIMIT,
} from './templates/fippa-request'
import { PublicCommentTemplate } from './templates/public-comment'
import { PolicyBriefTemplate } from './templates/policy-brief'

// -------------------------------------------------------------------
// Campaign material PDF rendering
// -------------------------------------------------------------------

/**
 * Render a campaign material spec to a PDF stream.
 * Selects the appropriate template based on materialType.
 *
 * Returns a Node.js ReadableStream suitable for piping to a Response.
 */
export async function renderCampaignPdf(
  material: CampaignMaterial
): Promise<NodeJS.ReadableStream> {
  const element = buildCampaignElement(material)
  return renderToStream(element as React.ReactElement<DocumentProps>)
}

function buildCampaignElement(material: CampaignMaterial): React.ReactElement {
  switch (material.materialType) {
    case 'fact_sheet':
      return React.createElement(FactSheetTemplate, {
        spec: material as FactSheetSpec,
      })
    case 'talking_points':
      return React.createElement(TalkingPointsTemplate, {
        spec: material as TalkingPointsSpec,
      })
    case 'timeline':
      return React.createElement(TimelineTemplate, {
        spec: material as TimelineSpec,
      })
    case 'comparison':
      return React.createElement(ComparisonTemplate, {
        spec: material as ComparisonSpec,
      })
    default:
      throw new Error(
        `No PDF template available for material type: ${material.materialType}`
      )
  }
}

// -------------------------------------------------------------------
// Lever action PDF rendering
// -------------------------------------------------------------------

/**
 * Data shape for lever actions — plain text with metadata.
 */
export interface LeverActionData {
  title: string
  content: string
  actionType: string
  metadata?: Record<string, unknown>
  /** FIPPA only: the action's status (it words the §2 notice). */
  status?: 'draft' | 'final' | 'filed'
  /** FIPPA only: the recipient resolver's answer, with the action's investigation (§3). */
  recipient?: RecipientResolution
}

/** A letter whose estimated render cost is over the limit; nothing was rendered. */
export class PdfTooCostly extends Error {
  constructor(readonly cost: number) {
    super(`PDF render cost ${cost} is over the limit ${RENDER_COST_LIMIT}`)
  }
}

/**
 * Render a lever action to a PDF stream.
 * Selects template based on actionType.
 */
export async function renderLeverPdf(
  action: LeverActionData
): Promise<NodeJS.ReadableStream> {
  // A FIPPA letter is measured with its embedded font before layout, so
  // over-wide words can be broken without anything inserted (fippa-request).
  const metrics = action.actionType === 'fippa_request' ? await loadLetterMetrics() : null
  if (metrics) {
    // Refused before any layout: react-pdf can't be interrupted once it starts.
    const cost = estimateRenderCost(action.content, action.metadata?.letterFormat, metrics)
    if (cost > RENDER_COST_LIMIT) throw new PdfTooCostly(cost)
  }
  const element = buildLeverElement(action, metrics)
  return renderToStream(element as React.ReactElement<DocumentProps>)
}

function buildLeverElement(
  action: LeverActionData,
  metrics: Awaited<ReturnType<typeof loadLetterMetrics>> | null
): React.ReactElement {
  switch (action.actionType) {
    case 'fippa_request':
      return React.createElement(FippaRequestTemplate, {
        data: {
          title: action.title,
          content: action.content,
          metadata: action.metadata,
          status: action.status,
          recipient: action.recipient,
          metrics: metrics!,
        },
      })
    case 'public_comment':
      return React.createElement(PublicCommentTemplate, {
        data: {
          title: action.title,
          content: action.content,
          metadata: action.metadata,
        },
      })
    case 'policy_brief':
      return React.createElement(PolicyBriefTemplate, {
        data: {
          title: action.title,
          content: action.content,
          metadata: action.metadata,
        },
      })
    default:
      throw new Error(
        `No PDF template available for action type: ${action.actionType}`
      )
  }
}

// Re-export type helpers (safe for client-side import via types.ts)
export {
  hasCampaignPdfTemplate,
  hasLeverPdfTemplate,
  PDF_CAMPAIGN_TYPES,
  PDF_LEVER_TYPES,
} from './types'
