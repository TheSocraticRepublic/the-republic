import { describe, it, expect } from 'vitest'
import {
  buildLeverGeneration,
  buildFippaPrompt,
  buildLeverPrompt,
  LEVER_PROMPT_VERSION,
  FIPPA_LETTER_FORMAT,
} from '@/lib/ai/prompts/lever-system'
import type { JurisdictionModule } from '@/lib/jurisdictions/types'
import bcModule from '@/lib/jurisdictions/bc'
import abModule from '@/lib/jurisdictions/ab'
import onModule from '@/lib/jurisdictions/on'
import { GUIDANCE_MARKER } from '@/lib/lever/letter-blocks'
import { RECIPIENT_ADDRESS_PLACEHOLDER, resolveGenerationTarget } from '@/lib/lever/public-body'

/*
 * The built legal prompt: the whole system prompt and user message a
 * generation sends. The route assembles it from resolveGenerationTarget() and
 * buildLeverGeneration(); this file tests exactly those two. The route-level
 * path (database, refusal status, the request the model receives) is in
 * lever-write-races.test.ts, against the harness.
 */

// ---------------------------------------------------------------------------
// The pre-A2 builder, frozen verbatim from lever-system.ts at a6a7007
// (prompt 0.5.1), and the pre-A2 user message from generate/route.ts.
// Non-FIPPA prompts must stay byte-identical to these.
// ---------------------------------------------------------------------------

function legacyLeverPrompt(module: JurisdictionModule): string {
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


function legacyUserMessage(opts: {
  actionType: string
  description: string
  contextParts: string[]
  investigationContext: string
}): string {
  const ACTION_TYPE_LABELS: Record<string, string> = {
    fippa_request: 'FIPPA Request',
    public_comment: 'Public Comment',
    policy_brief: 'Policy Brief',
  }
  // Non-FIPPA: publicBodyContext was always '' before A2.
  const publicBodyContext = ''
  const contextBlock = opts.contextParts.length > 0
    ? `\n\nCONTEXT:\n${opts.contextParts.join('\n\n---\n\n')}`
    : ''
  const investigationBlock = opts.investigationContext
    ? `\n\n---\n\n${opts.investigationContext}`
    : ''
  const actionLabel = ACTION_TYPE_LABELS[opts.actionType] ?? opts.actionType
  return `Generate a ${actionLabel}.${publicBodyContext}

Citizen's request: ${opts.description}${contextBlock}${investigationBlock}

Produce a complete, fileable document. Do not include explanatory preamble — go straight into the document.`
}

const CONTEXT_PARTS = ['DOCUMENT CONTEXT:\nTitle: Synthetic plan', 'ORACLE ANALYSIS:\nSummary: synthetic']
const INVESTIGATION_CONTEXT = 'INVESTIGATION CONTEXT:\nCitizen concern: synthetic concern\nJurisdiction: Victoria, British Columbia'

/** Every citation string a module's FOI framework puts into a prompt. */
function citations(m: JurisdictionModule): string[] {
  const s = m.foiFramework.sections
  return [m.foiFramework.fullCitation, `${m.foiFramework.fullCitation}, ${s.rightOfAccess}`]
}

describe('non-FIPPA prompts are byte-identical to before A2', () => {
  for (const actionType of ['public_comment', 'policy_brief']) {
    for (const mod of [bcModule, abModule, onModule]) {
      it(`${actionType} under ${mod.id}`, () => {
        const built = buildLeverGeneration({
          module: mod,
          actionType,
          // a body is ignored for non-FIPPA, as before
          publicBodyName: 'BC Ministry of Forests',
          description: 'Require a monitoring plan.',
          contextParts: CONTEXT_PARTS,
          investigationContext: INVESTIGATION_CONTEXT,
        })
        expect(built.system).toBe(legacyLeverPrompt(mod))
        expect(built.userMessage).toBe(
          legacyUserMessage({
            actionType,
            description: 'Require a monitoring plan.',
            contextParts: CONTEXT_PARTS,
            investigationContext: INVESTIGATION_CONTEXT,
          })
        )
      })
    }
  }

  it('with no context at all', () => {
    const built = buildLeverGeneration({
      module: bcModule,
      actionType: 'public_comment',
      publicBodyName: null,
      description: 'x',
      contextParts: [],
      investigationContext: '',
    })
    expect(built.system).toBe(legacyLeverPrompt(bcModule))
    expect(built.userMessage).toBe(
      legacyUserMessage({ actionType: 'public_comment', description: 'x', contextParts: [], investigationContext: '' })
    )
  })

  it('buildLeverPrompt itself is unchanged', () => {
    expect(buildLeverPrompt(bcModule)).toBe(legacyLeverPrompt(bcModule))
  })
})

describe('the FIPPA prompt (0.6.0)', () => {
  it('records its version and letter format', () => {
    expect(LEVER_PROMPT_VERSION).toBe('0.6.0')
    expect(FIPPA_LETTER_FORMAT).toBe('marker-v1')
  })

  it('asks for the guidance marker line, exactly as the parser splits on it', () => {
    const p = buildFippaPrompt(bcModule)
    expect(GUIDANCE_MARKER).toBe('=== NOT PART OF YOUR REQUEST ===')
    expect(p.split('\n')).toContain(GUIDANCE_MARKER)
    expect(p).toContain('NEXT STEPS')
    // NEXT STEPS is described below the marker, not as part of the letter
    expect(p.indexOf('NEXT STEPS')).toBeGreaterThan(p.indexOf(GUIDANCE_MARKER))
  })

  it('asks for the recipient placeholder and forbids an address', () => {
    const p = buildFippaPrompt(bcModule)
    expect(RECIPIENT_ADDRESS_PLACEHOLDER).toBe('[Public body FOI address]')
    expect(p).toContain(`write exactly ${RECIPIENT_ADDRESS_PLACEHOLDER} on its own line`)
    expect(p).toContain('NEVER write a street address')
  })

  it('carries an advisory length bound', () => {
    expect(buildFippaPrompt(bcModule)).toMatch(/under about 600 words/)
  })

  it('is FIPPA only: no public comment or policy brief instructions', () => {
    const p = buildFippaPrompt(bcModule)
    expect(p).not.toContain('When generating a Public Comment')
    expect(p).not.toContain('When generating a Policy Brief')
    expect(p).toContain('Freedom of Information request')
  })
})

/** The whole built prompt for a FIPPA action, the way the route assembles it. */
function builtFippa(metadata: Record<string, unknown>, investigation: { concern: string; jurisdictionName: string | null } | null) {
  const target = resolveGenerationTarget({ actionType: 'fippa_request', metadata, investigation })
  if (!target.ok) return target
  const mod = { bc: bcModule, ab: abModule, on: onModule }[target.jurisdictionId as 'bc' | 'ab' | 'on']
  return {
    ...target,
    built: buildLeverGeneration({
      module: mod,
      actionType: 'fippa_request',
      publicBodyName: target.publicBodyName,
      description: 'Inspection reports for the intake.',
      contextParts: [],
      investigationContext: '',
    }),
  }
}

describe('the built legal prompt, by jurisdiction', () => {
  it('BC: BC citations and the selected body, no address', () => {
    const r = builtFippa({ publicBody: 'BC Ministry of Forests', jurisdiction: 'bc' }, null)
    if (!('built' in r)) throw new Error('expected a BC prompt')
    const whole = `${r.built.system}\n${r.built.userMessage}`
    for (const c of citations(bcModule)) expect(whole).toContain(c)
    expect(r.built.system).toBe(buildFippaPrompt(bcModule))
    expect(r.built.userMessage.startsWith('Generate a FIPPA Request.\nPublic Body: BC Ministry of Forests\n')).toBe(true)
    // the directory address never reaches the model
    expect(whole).not.toContain('PO Box 9049')
    expect(whole).not.toContain('FOI Address')
  })

  it('AB: AB citations and never a BC citation', () => {
    const r = builtFippa({ publicBody: 'City of Edmonton', jurisdiction: 'ab' }, { concern: 'x', jurisdictionName: 'Victoria, British Columbia' })
    if (!('built' in r)) throw new Error('expected an AB prompt')
    const whole = `${r.built.system}\n${r.built.userMessage}`
    for (const c of citations(abModule)) expect(whole).toContain(c)
    expect(whole).not.toContain(bcModule.foiFramework.fullCitation)
    expect(whole).not.toContain('RSBC')
    expect(whole).toContain('Public Body: City of Edmonton')
    // AB stays labelled unverified (JURIS-2)
    expect(whole).toContain('have not yet been verified by a practitioner')
  })

  it('unresolved FIPPA is refused, so no prompt (and no BC citation) is built', () => {
    const r = builtFippa({ publicBody: 'BC Ministry of Forests' }, null)
    expect(r).toEqual({ ok: false, status: 409, error: 'Choose the province this request goes to' })
    expect('built' in r).toBe(false)
  })

  it('the legacy publicBodyName key reaches the prompt (the key bug)', () => {
    const r = builtFippa({ publicBody: null, publicBodyName: 'City of Victoria', jurisdiction: 'bc' }, null)
    if (!('built' in r)) throw new Error('expected a prompt')
    expect(r.built.userMessage).toContain('Public Body: City of Victoria')
  })

  it('the canonical publicBody key reaches the prompt, aliased to its directory name', () => {
    const r = builtFippa({ publicBody: 'Ministry of Forests' }, { concern: 'x', jurisdictionName: 'Victoria, British Columbia' })
    if (!('built' in r)) throw new Error('expected a prompt')
    expect(r.built.userMessage).toContain('Public Body: BC Ministry of Forests')
  })

  it('an Other body is named as typed', () => {
    const r = builtFippa({ publicBody: 'Synthetic Water Board', jurisdiction: 'on' }, null)
    if (!('built' in r)) throw new Error('expected a prompt')
    expect(r.built.userMessage).toContain('Public Body: Synthetic Water Board')
    for (const c of citations(onModule)) expect(r.built.system).toContain(c)
  })
})
