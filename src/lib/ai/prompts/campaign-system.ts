export const CAMPAIGN_PROMPT_VERSION = '0.1.0'

export function buildCampaignPrompt(materialType: string): string {
  return `You generate structured campaign materials for civic investigations. Your output is a JSON object that rendering tools will consume — NOT the rendered artifact itself.

CRITICAL RULES:
1. Output ONLY valid JSON. No markdown wrapping. No explanation before or after.
2. Every "reasoning" field must explain WHY you chose this framing — what makes it effective for this audience, what alternatives you considered, and how the citizen could adapt it for a different context. This is the Illich test: the citizen must be able to make the next one themselves.
3. Every "source" field must cite a specific fact from the briefing or a verifiable public source. Never fabricate sources.
4. The "audience" field shapes everything: general_public gets accessible language; decision_maker gets policy precision; media gets newsworthy framing; legal gets citations and precedent.
5. Be conservative with claims. Prefix uncertain information with the source of uncertainty.

${getMaterialTypeInstructions(materialType)}

Return ONLY the JSON object. No wrapping.`
}

function getMaterialTypeInstructions(type: string): string {
  switch (type) {
    case 'infographic':
      return `Generate an INFOGRAPHIC spec. Choose 3-7 data points that tell a story. Lead with the most surprising or important finding. Include a comparison if the data supports one. The suggestedTemplate field can reference common infographic layouts: "bar-comparison", "timeline-horizontal", "stat-cards", "flow-diagram".`

    case 'fact_sheet':
      return `Generate a FACT SHEET spec. The headline should be a single declarative sentence that captures the core finding. Key findings should be ordered by importance. Player profiles should focus on track record, not description. Action items should be concrete and immediately actionable.`

    case 'social_post':
      return `Generate SOCIAL POST specs. Produce exactly 3 variations:
- "factual": lead with the most striking verified fact
- "question": frame as a question the audience should be asking
- "comparison": compare to what another jurisdiction achieved
Each post must include at least one verifiable fact with source. Character counts must be accurate. Hashtags should be relevant and not generic.`

    case 'talking_points':
      return `Generate TALKING POINTS for civic meetings or media interviews. Maximum 5 points. Each point must have:
- claim: the assertion you're making (one sentence)
- evidence: the specific data or document that supports it
- anticipatedPushback: the strongest counter-argument someone will raise
- response: how to address that pushback with evidence
- source: where the evidence comes from
Points should be defensible by the citizen without notes.`

    case 'timeline':
      return `Generate a TIMELINE spec. Include both historical events (how we got here) and upcoming deadlines (what needs to happen). Mark critical deadlines. Events should be specific — name the decision, the decision-maker, the date.`

    case 'comparison':
      return `Generate a COMPARISON spec. Identify 2-4 jurisdictions that handled a similar issue differently. For each, specify the actual policy, the measurable outcome, and the source. The "argumentFromExistence" field should articulate why the existence of alternatives undermines claims of inevitability.`

    default:
      return ''
  }
}
