/**
 * A4: the footer change reaches campaign PDFs. The footer is fixed, so it
 * prints on every page (it used to follow the content, once, at the end),
 * with "Page k of N" in a band the body can't enter. And the global
 * hyphenation registration (fonts.ts) means no hyphen is inserted into a
 * campaign PDF's words either.
 *
 * Read back with pdfjs-dist; every assertion is on the rendered file.
 */
import { describe, it, expect } from 'vitest'
import { renderCampaignPdf } from '@/lib/pdf/render'
import { FOOTER_BAND_TOP } from '@/lib/pdf/primitives'
import { PDF_CAMPAIGN_TYPES } from '@/lib/pdf/types'
import type { CampaignMaterial } from '@/lib/campaign/schemas'
import { readPdf, drain, squash, PAGE_LABEL, type PdfRead } from './pdf-text'

const UUID = '00000000-0000-4000-8000-000000000001'

// Long words on narrow lines are where a hyphenator would act.
const LONG_WORDS =
  'Intergovernmental accountability notwithstanding, the decisionmakers characteristically underestimated the counterproductive environmental consequences of disproportionately discretionary authorisations.'

const base = {
  investigationId: UUID,
  title: 'QA campaign material',
  generatedAt: '2026-01-01T00:00:00.000Z',
  reasoning: 'Synthetic test material.',
  sources: [{ text: 'Synthetic source (QA)' }],
  audience: 'general_public' as const,
  jurisdiction: { name: 'Synthetic Town (QA)' },
}

/** Every campaign template, each with enough material to run past one page. */
const MANY = 14
const FIXTURES: Record<(typeof PDF_CAMPAIGN_TYPES)[number], CampaignMaterial> = {
  fact_sheet: {
    ...base,
    materialType: 'fact_sheet',
    headline: 'What the synthetic minutes show',
    keyFindings: Array.from({ length: MANY }, (_, i) => ({
      finding: `Finding ${i + 1}. ${LONG_WORDS}`,
      evidence: LONG_WORDS,
      source: `Synthetic minutes item ${i + 1}`,
    })),
    playerProfiles: [{ name: 'Synthetic Planning Department', role: 'Recommending body', trackRecord: LONG_WORDS }],
    actionItems: Array.from({ length: 4 }, () => LONG_WORDS),
  },
  talking_points: {
    ...base,
    materialType: 'talking_points',
    context: 'Synthetic council meeting',
    points: Array.from({ length: MANY }, (_, i) => ({
      claim: `Point ${i + 1}. ${LONG_WORDS}`,
      evidence: LONG_WORDS,
      anticipatedPushback: LONG_WORDS,
      response: LONG_WORDS,
      source: 'Synthetic source',
    })),
  },
  timeline: {
    ...base,
    materialType: 'timeline',
    events: Array.from({ length: MANY * 2 }, (_, i) => ({
      date: `2025-01-${String((i % 28) + 1).padStart(2, '0')}`,
      event: `Event ${i + 1}`,
      significance: LONG_WORDS,
    })),
    deadlines: [{ date: '2026-02-01', action: 'Synthetic deadline', critical: true }],
  },
  comparison: {
    ...base,
    materialType: 'comparison',
    subject: { jurisdiction: 'Synthetic Town (QA)', policy: LONG_WORDS },
    alternatives: Array.from({ length: 3 }, (_, i) => ({
      jurisdiction: `Synthetic Place ${i + 1} (QA)`,
      policy: LONG_WORDS,
      outcome: LONG_WORDS,
      source: 'Synthetic source',
    })),
    argumentFromExistence: LONG_WORDS,
  },
}

async function render(type: (typeof PDF_CAMPAIGN_TYPES)[number]): Promise<PdfRead> {
  return readPdf(await drain(await renderCampaignPdf(FIXTURES[type])))
}

describe('campaign PDFs: the A4 footer', () => {
  it.each(PDF_CAMPAIGN_TYPES)(
    '%s: every page carries "Page k of N" exactly once, and the attribution',
    async (type) => {
      const pdf = await render(type)
      const n = pdf.pages.length
      pdf.pages.forEach((p, k) => {
        expect(
          p.items.filter((i) => PAGE_LABEL.test(i.str)).map((i) => i.str),
          `${type} page ${k + 1}`
        ).toEqual([`Page ${k + 1} of ${n}`])
        expect(p.text, `${type} page ${k + 1}`).toContain('Generated from Open Cave -- opencave.ca')
      })
    },
    30_000
  )

  it('the multi-page fixtures are multi-page', async () => {
    for (const type of ['fact_sheet', 'talking_points', 'timeline'] as const) {
      expect((await render(type)).pages.length, type).toBeGreaterThan(1)
    }
  }, 60_000)

  it.each(PDF_CAMPAIGN_TYPES)(
    '%s: no body text enters the footer band',
    async (type) => {
      const pdf = await render(type)
      const footerLine = /^(Page \d+ of \d+|Generated from Open Cave -- opencave\.ca|[A-Z][a-z]+ \d{1,2}, \d{4})$/
      for (const [k, p] of pdf.pages.entries()) {
        for (const it of p.items) {
          if (!it.str.trim() || footerLine.test(it.str)) continue
          expect(it.bottom, `${type} "${it.str.slice(0, 30)}" on page ${k + 1}`).toBeGreaterThan(FOOTER_BAND_TOP)
        }
      }
    },
    30_000
  )

  it.each(PDF_CAMPAIGN_TYPES)(
    '%s: no hyphen is inserted into any word (global hyphenation off)',
    async (type) => {
      const pdf = await render(type)
      const all = squash(pdf.pages.map((p) => p.text).join(''))
      // Every long-word sentence survives whole: a "-" inserted at a line
      // break inside any of its words would break the match.
      const occurrences = all.split(squash(LONG_WORDS)).length - 1
      expect(occurrences, type).toBeGreaterThan(0)
      // A hyphenator's hyphen lands between two letters of one word ("decision-"
      // at a line end, "makers" on the next). The fixture has no such hyphen
      // anywhere, so any letter-hyphen-letter in the file was inserted.
      expect(JSON.stringify(FIXTURES[type])).not.toMatch(/\p{L}-\p{L}/u)
      expect(all.match(/\p{L}[-\u00ad\u2010]\p{L}/gu) ?? [], type).toEqual([])
    },
    30_000
  )
})
