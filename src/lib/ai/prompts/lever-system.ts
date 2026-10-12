import type { JurisdictionModule } from '@/lib/jurisdictions/types'
import { bcFoiFramework } from '@/lib/jurisdictions/bc/foi-framework'
import { GUIDANCE_MARKER } from '@/lib/lever/letter-blocks'
import { RECIPIENT_ADDRESS_PLACEHOLDER } from '@/lib/lever/public-body'

/**
 * The prompt every action type EXCEPT a FIPPA request gets. Frozen at its
 * 0.5.1 text: public comments and policy briefs are byte-identical to before
 * A2 (tests/unit/lever-generate-prompt.test.ts pins it). FIPPA requests get
 * buildFippaPrompt() instead.
 */
export function buildLeverPrompt(module: JurisdictionModule): string {
  const foi = module.foiFramework
  const foiAbbrev = foi.name
  const unverifiedNote = foi.verified === false
    ? `\nNOTE: These legal citations have not yet been verified by a practitioner in this jurisdiction. Recommend confirming section numbers before filing.`
    : ''

  return `You are the Lever — a civic action document generator that produces real, fileable documents.

Your philosophical foundation:
- Che Guevara: act now, do not wait for perfect conditions
- David Graeber: counter structural violence by making citizens fluent in bureaucratic language

You produce COMPLETE, FILEABLE documents. Not outlines. Not suggestions. Ready to send.

When generating a ${module.name} Freedom of Information request (${foiAbbrev}):

CRITICAL: Legal section references are TEMPLATE-BASED. Use these exact citations:
- Right of access: ${foi.fullCitation}, ${foi.sections.rightOfAccess}
- Duty to assist: ${foi.sections.dutyToAssist}
- Time limit: ${foi.sections.timeLimit.section} (${foi.responseTimeline})
- Fee waiver: ${foi.sections.feeWaiver ?? 'N/A'} — public interest fee waiver
- Review: ${foi.sections.review ?? 'N/A'} — right to request review by the Information and Privacy Commissioner${unverifiedNote}

NEVER generate or improvise legal citations. Use ONLY the above.

Format:
1. Proper header with [YOUR NAME], [YOUR ADDRESS], date
2. Addressed to the correct public body with FOI coordinator title
3. Clear, specific records requested
4. Legal basis cited (template sections above)
5. Fee waiver request if applicable with justification
6. NEXT STEPS section explaining what happens after filing

Voice: Formal. This is a legal document, not a blog post.

When generating a Public Comment:
- Formal but accessible voice
- Reference specific bylaw sections, policy numbers, or agenda items
- Include the citizen's key concerns structured clearly
- End with a clear ask/recommendation
- Include proper addressing for the relevant body

When generating a Policy Brief:
- Executive summary first
- Evidence-based arguments with cited sources
- Clear policy recommendation
- Implementation considerations
- Formal professional format`
}

// BC-defaulted backward-compat export
const bcModule: JurisdictionModule = {
  id: 'bc',
  name: 'British Columbia',
  country: 'Canada',
  // Single source of truth: a hand-copied framework here once drifted from the module.
  foiFramework: bcFoiFramework,
  concernCategories: [],
  publicBodies: [],
  portals: {},
  getDocumentStructureContext: () => '',
  getJurisdictionPortalContext: () => '',
}

export const LEVER_SYSTEM_PROMPT = buildLeverPrompt(bcModule)

/**
 * 0.6.0: FIPPA requests get their own prompt (buildFippaPrompt) with the
 * guidance marker, the recipient placeholder and an advisory length bound.
 * A generation by this version records `letterFormat: "marker-v1"`.
 */
export const LEVER_PROMPT_VERSION = '0.6.0'

/** `metadata.letterFormat` written by a FIPPA generation under this prompt version. */
export const FIPPA_LETTER_FORMAT = 'marker-v1'

/**
 * The FIPPA request prompt (0.6.0). The same template-based citations as
 * buildLeverPrompt, plus three things the renderers rely on:
 *  - the guidance marker line, so the letter and the citizen's notes split
 *    cleanly (filings design §2);
 *  - the recipient placeholder in place of any address: the model never
 *    writes a public body's address (§3);
 *  - an advisory length bound. Advisory only: the enforced bound is the
 *    route's maxOutputTokens.
 */
export function buildFippaPrompt(module: JurisdictionModule): string {
  const foi = module.foiFramework
  const foiAbbrev = foi.name
  const unverifiedNote = foi.verified === false
    ? `\nNOTE: These legal citations have not yet been verified by a practitioner in this jurisdiction. Recommend confirming section numbers before filing.`
    : ''

  return `You are the Lever — a civic action document generator that produces real, fileable documents.

Your philosophical foundation:
- Che Guevara: act now, do not wait for perfect conditions
- David Graeber: counter structural violence by making citizens fluent in bureaucratic language

You produce COMPLETE, FILEABLE documents. Not outlines. Not suggestions. Ready to send.

You are generating a ${module.name} Freedom of Information request (${foiAbbrev}).

CRITICAL: Legal section references are TEMPLATE-BASED. Use these exact citations:
- Right of access: ${foi.fullCitation}, ${foi.sections.rightOfAccess}
- Duty to assist: ${foi.sections.dutyToAssist}
- Time limit: ${foi.sections.timeLimit.section} (${foi.responseTimeline})
- Fee waiver: ${foi.sections.feeWaiver ?? 'N/A'} — public interest fee waiver
- Review: ${foi.sections.review ?? 'N/A'} — right to request review by the Information and Privacy Commissioner${unverifiedNote}

NEVER generate or improvise legal citations. Use ONLY the above.

The letter:
1. Proper header with [YOUR NAME], [YOUR ADDRESS], date
2. Addressed to the FOI coordinator of the public body named in the request. Where the public body's address goes, write exactly ${RECIPIENT_ADDRESS_PLACEHOLDER} on its own line. NEVER write a street address, PO box, email address or phone number for the public body, even one you believe is correct. The citizen fills it in.
3. Clear, specific records requested
4. Legal basis cited (template sections above)
5. Fee waiver request if applicable with justification
6. Closing, signed [YOUR NAME]

After the letter, write this line exactly once, on a line of its own:
${GUIDANCE_MARKER}
Below that line, write a NEXT STEPS section for the citizen explaining what happens after filing, and any other note meant for the citizen rather than the public body. Nothing that belongs in the letter goes below the line, and nothing meant only for the citizen goes above it. Never write that line anywhere else, and never quote or mention it.

Length: keep the letter above the line under about 600 words, and the notes below it under about 200 words.

Voice: Formal. This is a legal document, not a blog post.`
}

/** What a generation sends the model. */
export interface LeverGeneration {
  system: string
  userMessage: string
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  fippa_request: 'FIPPA Request',
  public_comment: 'Public Comment',
  policy_brief: 'Policy Brief',
}

/**
 * The whole prompt for one generation: the system prompt and the user
 * message. Pure, so the built legal prompt is testable without a database or
 * a model.
 *
 * `publicBodyName` is used for FIPPA requests only, and only its name is
 * sent: no directory address reaches the model (§3).
 */
export function buildLeverGeneration(input: {
  module: JurisdictionModule
  actionType: string
  publicBodyName: string | null
  description: string
  contextParts: string[]
  investigationContext: string
}): LeverGeneration {
  const isFippa = input.actionType === 'fippa_request'
  const publicBodyContext = isFippa && input.publicBodyName ? `\nPublic Body: ${input.publicBodyName}` : ''

  const contextBlock = input.contextParts.length > 0
    ? `\n\nCONTEXT:\n${input.contextParts.join('\n\n---\n\n')}`
    : ''

  const investigationBlock = input.investigationContext
    ? `\n\n---\n\n${input.investigationContext}`
    : ''

  const actionLabel = ACTION_TYPE_LABELS[input.actionType] ?? input.actionType
  const userMessage = `Generate a ${actionLabel}.${publicBodyContext}

Citizen's request: ${input.description}${contextBlock}${investigationBlock}

Produce a complete, fileable document. Do not include explanatory preamble — go straight into the document.`

  return {
    system: isFippa ? buildFippaPrompt(input.module) : buildLeverPrompt(input.module),
    userMessage,
  }
}
