import { describe, it, expect } from 'vitest'
import { Font } from '@react-pdf/renderer'
import { renderCampaignPdf, renderLeverPdf } from '@/lib/pdf/render'
import { PDF_CAMPAIGN_TYPES, PDF_LEVER_TYPES } from '@/lib/pdf/types'
import type { CampaignMaterial } from '@/lib/campaign/schemas'

// These tests exist because there were none. The PDF export path shipped with
// fonts fetched from `github.com/google/fonts/.../static/*.ttf`; Google removed
// the `static/` directory, all nine URLs 404'd, and every campaign and lever
// PDF export returned 500 in production. Nothing caught it, because nothing
// had ever rendered a PDF in the test suite.
//
// Note this file is `.ts`, not `.tsx`: `vitest.config.ts` includes
// `tests/**/*.test.ts` only. A `.tsx` file here would be silently unmatched and
// never run — which is its own version of the same failure. Elements are built
// with `React.createElement` inside the render helpers, so no JSX is needed.

const UUID = '00000000-0000-4000-8000-000000000001'

const base = {
  investigationId: UUID,
  title: 'Test Material',
  generatedAt: '2026-01-01T00:00:00.000Z',
  reasoning: 'Because the export path must actually render.',
  sources: [{ text: 'City of Nelson council minutes, 2025-11-04' }],
  audience: 'general_public' as const,
  jurisdiction: { name: 'Nelson, BC' },
}

/** A minimal valid spec per campaign template. */
const CAMPAIGN_FIXTURES: Record<
  (typeof PDF_CAMPAIGN_TYPES)[number],
  CampaignMaterial
> = {
  fact_sheet: {
    ...base,
    materialType: 'fact_sheet',
    headline: 'What the minutes show',
    keyFindings: [
      { finding: 'The variance was granted.', evidence: 'Minutes, item 7.', source: 'Minutes 2025-11-04' },
    ],
    playerProfiles: [
      { name: 'Planning Department', role: 'Recommending body', trackRecord: 'Recommended approval.' },
    ],
    actionItems: ['File a FIPPA request for the staff report.'],
  },
  talking_points: {
    ...base,
    materialType: 'talking_points',
    context: 'Council meeting, public comment period',
    points: [
      {
        claim: 'The variance departs from the OCP.',
        evidence: 'OCP s.4.2 sets a 9m height limit.',
        anticipatedPushback: 'The OCP allows discretion.',
        response: 'Discretion requires stated reasons; none were recorded.',
        source: 'OCP 2021, s.4.2',
      },
    ],
  },
  timeline: {
    ...base,
    materialType: 'timeline',
    events: [
      { date: '2025-11-04', event: 'Variance granted', significance: 'First departure from the OCP limit.' },
    ],
    deadlines: [{ date: '2026-02-01', action: 'Appeal window closes', critical: true }],
  },
  comparison: {
    ...base,
    materialType: 'comparison',
    subject: { jurisdiction: 'Nelson, BC', policy: 'Discretionary height variance' },
    alternatives: [
      {
        jurisdiction: 'Revelstoke, BC',
        policy: 'Written-reasons requirement',
        outcome: 'Variances dropped 40%.',
        source: 'Revelstoke bylaw 2287',
      },
    ],
    argumentFromExistence: 'A neighbouring municipality already does this.',
  },
}

/** A minimal valid action per lever template. */
const LEVER_FIXTURES: Record<
  (typeof PDF_LEVER_TYPES)[number],
  { title: string; content: string; actionType: string; metadata?: Record<string, unknown> }
> = {
  fippa_request: {
    title: 'FIPPA Request — Staff report, variance 2025-114',
    actionType: 'fippa_request',
    content: 'I request records relating to the height variance granted on 2025-11-04.',
    metadata: { publicBodyName: 'City of Nelson' },
  },
  public_comment: {
    title: 'Public comment — Variance 2025-114',
    actionType: 'public_comment',
    content: 'I am writing regarding the height variance granted on 2025-11-04.',
  },
  policy_brief: {
    title: 'Policy brief — Written reasons for variances',
    actionType: 'policy_brief',
    content: 'Council should require written reasons for every discretionary variance.',
  },
}

/** Drain a Node readable stream to a Buffer. */
async function drain(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

describe('PDF rendering — campaign templates', () => {
  // Driven off PDF_CAMPAIGN_TYPES so adding a template without a fixture fails
  // the suite rather than shipping untested.
  it.each(PDF_CAMPAIGN_TYPES)('%s renders a real PDF', async (materialType) => {
    const fixture = CAMPAIGN_FIXTURES[materialType]
    expect(fixture, `no fixture for campaign type ${materialType}`).toBeDefined()

    const buf = await drain(await renderCampaignPdf(fixture))

    expect(buf.length).toBeGreaterThan(0)
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })
})

describe('PDF rendering — lever templates', () => {
  it.each(PDF_LEVER_TYPES)('%s renders a real PDF', async (actionType) => {
    const fixture = LEVER_FIXTURES[actionType]
    expect(fixture, `no fixture for lever type ${actionType}`).toBeDefined()

    const buf = await drain(await renderLeverPdf(fixture))

    expect(buf.length).toBeGreaterThan(0)
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })
})

describe('font registration', () => {
  // The regression test for the original outage. Fonts must resolve from the
  // local filesystem; a remote URL puts every PDF export at the mercy of a
  // third party's directory layout, and the failure only surfaces in
  // production when someone tries to file a document.
  it('registers no font over http(s)', async () => {
    await import('@/lib/pdf/fonts')

    const registered = Font.getRegisteredFonts() as Record<
      string,
      { sources?: { src?: unknown }[] }
    >

    const remote: string[] = []
    for (const [family, entry] of Object.entries(registered)) {
      for (const source of entry.sources ?? []) {
        if (typeof source.src === 'string' && /^https?:\/\//i.test(source.src)) {
          remote.push(`${family}: ${source.src}`)
        }
      }
    }

    expect(remote, `fonts registered over the network: ${remote.join(', ')}`).toEqual([])
  })

  it('registers all three families used by the templates', async () => {
    await import('@/lib/pdf/fonts')
    const families = Object.keys(Font.getRegisteredFonts())
    expect(families).toEqual(
      expect.arrayContaining(['Instrument Sans', 'Inter', 'Source Serif 4'])
    )
  })
})
