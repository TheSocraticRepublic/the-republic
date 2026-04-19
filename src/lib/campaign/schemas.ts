import { z } from 'zod'

// Base schema shared by all campaign materials
const campaignMaterialBase = z.object({
  investigationId: z.string().uuid(),
  materialType: z.string(),
  title: z.string().min(1).max(200),
  generatedAt: z.string().datetime(),
  reasoning: z.string().min(1),
  sources: z.array(z.object({
    text: z.string(),
    url: z.string().optional(),
    documentId: z.string().uuid().optional(),
  })).min(1),
  audience: z.enum(['general_public', 'decision_maker', 'media', 'legal']),
  jurisdiction: z.object({
    name: z.string(),
    id: z.string().uuid().optional(),
  }),
})

// Discriminated subtypes

export const infographicSpecSchema = campaignMaterialBase.extend({
  materialType: z.literal('infographic'),
  dataPoints: z.array(z.object({
    label: z.string(),
    value: z.union([z.string(), z.number()]),
    source: z.string(),
    emphasis: z.boolean(),
  })).min(1),
  comparison: z.object({
    before: z.string(),
    after: z.string(),
    source: z.string(),
  }).optional(),
  timeline: z.array(z.object({
    date: z.string(),
    event: z.string(),
  })).optional(),
  callToAction: z.string(),
  suggestedTemplate: z.string().optional(),
})

export const factSheetSpecSchema = campaignMaterialBase.extend({
  materialType: z.literal('fact_sheet'),
  headline: z.string(),
  keyFindings: z.array(z.object({
    finding: z.string(),
    evidence: z.string(),
    source: z.string(),
  })).min(1),
  playerProfiles: z.array(z.object({
    name: z.string(),
    role: z.string(),
    trackRecord: z.string(),
  })),
  actionItems: z.array(z.string()),
})

export const socialPostSpecSchema = campaignMaterialBase.extend({
  materialType: z.literal('social_post'),
  variations: z.array(z.object({
    tone: z.enum(['factual', 'question', 'comparison']),
    text: z.string(),
    characterCount: z.number(),
    hashtags: z.array(z.string()),
    source: z.string(),
  }).refine(
    (v) => Math.abs(v.characterCount - v.text.length) <= 5,
    { message: 'characterCount must be within 5 characters of actual text length' }
  )).min(1),
})

export const talkingPointsSpecSchema = campaignMaterialBase.extend({
  materialType: z.literal('talking_points'),
  context: z.string(), // Where used: council meeting, media interview, etc.
  points: z.array(z.object({
    claim: z.string(),
    evidence: z.string(),
    anticipatedPushback: z.string(),
    response: z.string(),
    source: z.string(),
  })).min(1).max(5),
})

export const timelineSpecSchema = campaignMaterialBase.extend({
  materialType: z.literal('timeline'),
  events: z.array(z.object({
    date: z.string(),
    event: z.string(),
    significance: z.string(),
    actor: z.string().optional(),
  })),
  deadlines: z.array(z.object({
    date: z.string(),
    action: z.string(),
    critical: z.boolean(),
  })),
}).refine(
  (data) => data.events.length > 0 || data.deadlines.length > 0,
  { message: 'At least one event or deadline is required' }
)

export const comparisonSpecSchema = campaignMaterialBase.extend({
  materialType: z.literal('comparison'),
  subject: z.object({
    jurisdiction: z.string(),
    policy: z.string(),
    outcome: z.string().optional(),
  }),
  alternatives: z.array(z.object({
    jurisdiction: z.string(),
    policy: z.string(),
    outcome: z.string(),
    source: z.string(),
  })).min(1),
  argumentFromExistence: z.string(),
})

// Discriminated union
export const campaignMaterialSchema = z.discriminatedUnion('materialType', [
  infographicSpecSchema,
  factSheetSpecSchema,
  socialPostSpecSchema,
  talkingPointsSpecSchema,
  timelineSpecSchema,
  comparisonSpecSchema,
])

export type CampaignMaterial = z.infer<typeof campaignMaterialSchema>
export type InfographicSpec = z.infer<typeof infographicSpecSchema>
export type FactSheetSpec = z.infer<typeof factSheetSpecSchema>
export type SocialPostSpec = z.infer<typeof socialPostSpecSchema>
export type TalkingPointsSpec = z.infer<typeof talkingPointsSpecSchema>
export type TimelineSpec = z.infer<typeof timelineSpecSchema>
export type ComparisonSpec = z.infer<typeof comparisonSpecSchema>

// Material type labels for UI
export const MATERIAL_TYPE_LABELS: Record<CampaignMaterial['materialType'], string> = {
  infographic: 'Infographic',
  fact_sheet: 'Fact Sheet',
  social_post: 'Social Posts',
  talking_points: 'Talking Points',
  timeline: 'Timeline',
  comparison: 'Policy Comparison',
}

// Material type descriptions for the campaign panel
export const MATERIAL_TYPE_DESCRIPTIONS: Record<CampaignMaterial['materialType'], string> = {
  infographic: 'Data visualization highlighting key findings. Export to AntV, Canva, or Claude Artifacts.',
  fact_sheet: 'One-page summary of findings with evidence and sources. Export to PDF.',
  social_post: 'Three variations (factual, question, comparison) ready for social platforms.',
  talking_points: 'Five points with claim, evidence, anticipated pushback, and response. For meetings and interviews.',
  timeline: 'Visual timeline of key events and upcoming deadlines.',
  comparison: 'How other jurisdictions handle this issue. The argument from existence.',
}
