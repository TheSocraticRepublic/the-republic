import { describe, it, expect } from 'vitest'
import {
  campaignMaterialSchema,
  infographicSpecSchema,
  talkingPointsSpecSchema,
  factSheetSpecSchema,
  socialPostSpecSchema,
  timelineSpecSchema,
  comparisonSpecSchema,
} from '@/lib/campaign/schemas'

// Shared base fields used across test fixtures
// UUIDs must be valid RFC 4122 (version digit 1-8, variant digit 8-b)
const INVESTIGATION_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const DOCUMENT_UUID = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

const BASE = {
  investigationId: INVESTIGATION_UUID,
  title: 'Test Campaign Material',
  generatedAt: '2026-04-16T12:00:00.000Z',
  reasoning: 'This framing was chosen because it presents the data accessibly for the general public. Alternatives considered: decision_maker framing (too technical), media framing (requires newsworthy hook not present in the data). A citizen could adapt this by swapping the lead data point for one more relevant to their local context.',
  sources: [{ text: 'City budget document 2024, p. 12', url: 'https://example.com/budget' }],
  audience: 'general_public' as const,
  jurisdiction: { name: 'City of Vancouver' },
}

const VALID_INFOGRAPHIC = {
  ...BASE,
  materialType: 'infographic' as const,
  dataPoints: [
    { label: 'Annual cost', value: 1200000, source: 'Budget 2024', emphasis: true },
    { label: 'Comparable city cost', value: 450000, source: 'Surrey Budget 2024', emphasis: false },
  ],
  callToAction: 'Contact your councillor before the March 15 vote.',
  suggestedTemplate: 'stat-cards',
}

const VALID_TALKING_POINTS = {
  ...BASE,
  materialType: 'talking_points' as const,
  context: 'City council meeting, March 15 2026',
  points: [
    {
      claim: 'The proposed contract is 2.6x the cost of comparable services in Surrey.',
      evidence: 'City budget 2024 shows $1.2M; Surrey 2024 budget shows $450k for equivalent scope.',
      anticipatedPushback: 'Surrey has different requirements and cannot be directly compared.',
      response: 'The scope is documented in RFP-2024-117. The specifications are materially identical.',
      source: 'RFP-2024-117 and Surrey RFP-2023-88',
    },
  ],
}

describe('infographicSpecSchema', () => {
  it('accepts a valid infographic spec', () => {
    const result = infographicSpecSchema.safeParse(VALID_INFOGRAPHIC)
    expect(result.success).toBe(true)
  })

  it('rejects a spec with no data points', () => {
    const result = infographicSpecSchema.safeParse({ ...VALID_INFOGRAPHIC, dataPoints: [] })
    expect(result.success).toBe(false)
  })

  it('accepts optional comparison and timeline fields', () => {
    const withOptionals = {
      ...VALID_INFOGRAPHIC,
      comparison: { before: '2019 policy', after: '2024 policy', source: 'Staff report' },
      timeline: [{ date: '2020-01-15', event: 'Initial contract signed' }],
    }
    const result = infographicSpecSchema.safeParse(withOptionals)
    expect(result.success).toBe(true)
  })
})

describe('talkingPointsSpecSchema', () => {
  it('accepts a valid talking points spec', () => {
    const result = talkingPointsSpecSchema.safeParse(VALID_TALKING_POINTS)
    expect(result.success).toBe(true)
  })

  it('rejects more than 5 points', () => {
    const sixPoints = Array.from({ length: 6 }, (_, i) => ({
      claim: `Claim ${i + 1}`,
      evidence: 'Evidence',
      anticipatedPushback: 'Pushback',
      response: 'Response',
      source: 'Source',
    }))
    const result = talkingPointsSpecSchema.safeParse({ ...VALID_TALKING_POINTS, points: sixPoints })
    expect(result.success).toBe(false)
  })

  it('rejects zero points', () => {
    const result = talkingPointsSpecSchema.safeParse({ ...VALID_TALKING_POINTS, points: [] })
    expect(result.success).toBe(false)
  })
})

describe('campaignMaterialSchema (discriminated union)', () => {
  it('routes infographic correctly', () => {
    const result = campaignMaterialSchema.safeParse(VALID_INFOGRAPHIC)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.materialType).toBe('infographic')
    }
  })

  it('routes talking_points correctly', () => {
    const result = campaignMaterialSchema.safeParse(VALID_TALKING_POINTS)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.materialType).toBe('talking_points')
    }
  })

  it('rejects an invalid materialType', () => {
    const result = campaignMaterialSchema.safeParse({ ...VALID_INFOGRAPHIC, materialType: 'poster' })
    expect(result.success).toBe(false)
  })

  it('rejects coalition_template (not in Zod union, even though it exists in DB enum)', () => {
    const result = campaignMaterialSchema.safeParse({ ...VALID_INFOGRAPHIC, materialType: 'coalition_template' })
    expect(result.success).toBe(false)
  })
})

describe('reasoning field (Illich test)', () => {
  it('rejects an empty reasoning field', () => {
    const result = infographicSpecSchema.safeParse({ ...VALID_INFOGRAPHIC, reasoning: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a missing reasoning field', () => {
    const { reasoning: _omit, ...withoutReasoning } = VALID_INFOGRAPHIC
    const result = infographicSpecSchema.safeParse(withoutReasoning)
    expect(result.success).toBe(false)
  })
})

describe('sources array', () => {
  it('accepts sources with only the text field', () => {
    const result = infographicSpecSchema.safeParse({
      ...VALID_INFOGRAPHIC,
      sources: [{ text: 'City budget 2024, p. 12' }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts sources with url and documentId', () => {
    const result = infographicSpecSchema.safeParse({
      ...VALID_INFOGRAPHIC,
      sources: [{
        text: 'Budget document',
        url: 'https://example.com',
        documentId: DOCUMENT_UUID,
      }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a source missing the text field', () => {
    const result = infographicSpecSchema.safeParse({
      ...VALID_INFOGRAPHIC,
      sources: [{ url: 'https://example.com' }],
    })
    expect(result.success).toBe(false)
  })

  // W-4: sources must have at least one entry
  it('rejects an empty sources array', () => {
    const result = infographicSpecSchema.safeParse({
      ...VALID_INFOGRAPHIC,
      sources: [],
    })
    expect(result.success).toBe(false)
  })
})

describe('missing required base fields', () => {
  it('rejects a spec missing investigationId', () => {
    const { investigationId: _omit, ...without } = VALID_INFOGRAPHIC
    const result = infographicSpecSchema.safeParse(without)
    expect(result.success).toBe(false)
  })

  it('rejects a spec with invalid investigationId (not a valid RFC 4122 uuid)', () => {
    const result = infographicSpecSchema.safeParse({ ...VALID_INFOGRAPHIC, investigationId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects a spec missing title', () => {
    const result = infographicSpecSchema.safeParse({ ...VALID_INFOGRAPHIC, title: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a spec with invalid audience', () => {
    const result = infographicSpecSchema.safeParse({ ...VALID_INFOGRAPHIC, audience: 'everyone' })
    expect(result.success).toBe(false)
  })
})

describe('fact_sheet schema', () => {
  const VALID_FACT_SHEET = {
    ...BASE,
    materialType: 'fact_sheet' as const,
    headline: 'City paid 2.6x market rate for maintenance contract, records show.',
    keyFindings: [{
      finding: 'Contract value is $1.2M, compared to $450k in Surrey for identical scope.',
      evidence: 'RFP-2024-117 and Surrey RFP-2023-88',
      source: 'Freedom of information response, January 2026',
    }],
    playerProfiles: [],
    actionItems: ['Submit a FIPPA request for the vendor selection decision record.'],
  }

  it('accepts a valid fact sheet spec', () => {
    const result = factSheetSpecSchema.safeParse(VALID_FACT_SHEET)
    expect(result.success).toBe(true)
  })

  it('rejects a fact sheet with no key findings', () => {
    const result = factSheetSpecSchema.safeParse({ ...VALID_FACT_SHEET, keyFindings: [] })
    expect(result.success).toBe(false)
  })
})

describe('social_post schema', () => {
  const VALID_SOCIAL = {
    ...BASE,
    materialType: 'social_post' as const,
    variations: [{
      tone: 'factual' as const,
      text: 'Vancouver paid $1.2M for maintenance services Surrey gets for $450k. Same specs. Different vendor.',
      characterCount: 95,
      hashtags: ['VanCity', 'OpenData'],
      source: 'City budget 2024 + Surrey budget 2024',
    }],
  }

  it('accepts a valid social post spec', () => {
    const result = socialPostSpecSchema.safeParse(VALID_SOCIAL)
    expect(result.success).toBe(true)
  })

  it('rejects a social post with no variations', () => {
    const result = socialPostSpecSchema.safeParse({ ...VALID_SOCIAL, variations: [] })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid tone', () => {
    const result = socialPostSpecSchema.safeParse({
      ...VALID_SOCIAL,
      variations: [{ ...VALID_SOCIAL.variations[0], tone: 'angry' }],
    })
    expect(result.success).toBe(false)
  })

  // W-6: characterCount must be within 5 of actual text length
  it('rejects a variation where characterCount is far from actual text length', () => {
    const result = socialPostSpecSchema.safeParse({
      ...VALID_SOCIAL,
      variations: [{ ...VALID_SOCIAL.variations[0], characterCount: 200 }],
    })
    expect(result.success).toBe(false)
  })

  it('accepts a variation where characterCount is within 5 of actual text length', () => {
    const text = VALID_SOCIAL.variations[0].text
    const result = socialPostSpecSchema.safeParse({
      ...VALID_SOCIAL,
      variations: [{ ...VALID_SOCIAL.variations[0], characterCount: text.length + 3 }],
    })
    expect(result.success).toBe(true)
  })
})

describe('timeline schema', () => {
  const VALID_TIMELINE = {
    ...BASE,
    materialType: 'timeline' as const,
    events: [{ date: '2020-01-15', event: 'Initial contract signed', significance: 'First time sole-source procurement used for this service category', actor: 'City Manager' }],
    deadlines: [{ date: '2026-03-15', action: 'Council vote on renewal', critical: true }],
  }

  it('accepts a valid timeline spec', () => {
    const result = timelineSpecSchema.safeParse(VALID_TIMELINE)
    expect(result.success).toBe(true)
  })

  // W-5: at least one of events or deadlines must be non-empty
  it('rejects a timeline with both events and deadlines empty', () => {
    const result = timelineSpecSchema.safeParse({ ...VALID_TIMELINE, events: [], deadlines: [] })
    expect(result.success).toBe(false)
  })

  it('accepts a timeline with only events populated', () => {
    const result = timelineSpecSchema.safeParse({ ...VALID_TIMELINE, deadlines: [] })
    expect(result.success).toBe(true)
  })

  it('accepts a timeline with only deadlines populated', () => {
    const result = timelineSpecSchema.safeParse({ ...VALID_TIMELINE, events: [] })
    expect(result.success).toBe(true)
  })
})

describe('comparison schema', () => {
  const VALID_COMPARISON = {
    ...BASE,
    materialType: 'comparison' as const,
    subject: {
      jurisdiction: 'City of Vancouver',
      policy: 'Sole-source infrastructure maintenance contracts',
    },
    alternatives: [{
      jurisdiction: 'City of Surrey',
      policy: 'Competitive tender for all contracts over $50k',
      outcome: '35% lower average contract cost over 3 years',
      source: 'Surrey procurement report 2024',
    }],
    argumentFromExistence: 'Surrey demonstrates that competitive tendering for this service category is operationally feasible and produces measurable savings, undermining the claim that sole-source procurement is a practical necessity.',
  }

  it('accepts a valid comparison spec', () => {
    const result = comparisonSpecSchema.safeParse(VALID_COMPARISON)
    expect(result.success).toBe(true)
  })

  it('rejects a comparison with no alternatives', () => {
    const result = comparisonSpecSchema.safeParse({ ...VALID_COMPARISON, alternatives: [] })
    expect(result.success).toBe(false)
  })
})
