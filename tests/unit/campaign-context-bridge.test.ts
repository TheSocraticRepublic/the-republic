import { describe, it, expect } from 'vitest'
import { buildCampaignPrompt, CAMPAIGN_PROMPT_VERSION } from '@/lib/ai/prompts/campaign-system'

describe('Campaign-Lens context bridge', () => {
  it('campaign prompt version is 0.2.0', () => {
    expect(CAMPAIGN_PROMPT_VERSION).toBe('0.2.0')
  })

  it('prompt includes rule about Lens historical context', () => {
    const prompt = buildCampaignPrompt('infographic')
    expect(prompt).toContain('historical context from The Lens')
  })

  it('prompt includes rule about Gadfly inquiry context', () => {
    const prompt = buildCampaignPrompt('talking_points')
    expect(prompt).toContain('Gadfly inquiry context')
  })

  it('Lens/Gadfly rule is present for all material types', () => {
    const types = ['infographic', 'fact_sheet', 'social_post', 'talking_points', 'timeline', 'comparison']
    for (const type of types) {
      const prompt = buildCampaignPrompt(type)
      expect(prompt).toContain('genuine engagement with the issue')
    }
  })
})
