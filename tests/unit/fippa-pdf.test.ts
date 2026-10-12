/**
 * A4: the FOI letter as a PDF, read back with pdfjs-dist and rasterised with
 * pdftoppm. Every assertion is on the rendered file, never on the React tree.
 *
 * - Text oracle: per page, footer line removed, ALL whitespace removed from
 *   both sides (wrapping is layout), compared exactly with the hand-written
 *   golden projections in tests/fixtures/letters.ts. The guidance page is
 *   compared with its golden guidance plus hand-written "Where to send this"
 *   text.
 * - Geometry: "Page k of N" exactly once per page; every body text item
 *   above the footer band and inside the side margins.
 * - Raster: every pixel outside the text items' glyph boxes is #FFFFFF.
 *   Skipped, with a marker, only where pdftoppm is absent (CI); mandatory in
 *   the relay's local run.
 * - Metadata: Author and Creator blank.
 * - Directory change, the 8-second render timeout and the export route's
 *   ownership, through the real route handler.
 *
 * The capacity benchmark at the end runs only with PDF_CAPACITY=1 (see the
 * relay report for the taskset / heap-limit command).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { renderLeverPdf } from '@/lib/pdf/render'
import { FOOTER_BAND_TOP, FOOTER_BAND_BOTTOM } from '@/lib/pdf/primitives'
import { PUBLIC_BODY_DIRECTORY, resolveRecipient, type RecipientResolution } from '@/lib/lever/public-body'
import {
  readPdf,
  drain,
  squash,
  PAGE_LABEL,
  hasPdftoppm,
  rasterise,
  nonWhiteOutsideText,
  type PdfRead,
  type PdfPage,
} from './pdf-text'
import {
  LETTER_FIXTURES,
  SEEDED_LETTER_FIXTURES,
  MARKER_V1_LETTER,
  LEGACY_LETTER,
  PLACEHOLDER_LETTER,
  FIFTY_KB_LETTER,
  LONG_TOKEN_LETTER,
  LONG_URL_LETTER,
  WRAPPING_LINK_LETTER,
  TYPOGRAPHY_LETTER,
  LONG_GUIDANCE_LETTER,
  MARKER_FIRST_LINE,
  type LetterFixture,
} from '../fixtures/letters'

// ---------------------------------------------------------------------------
// Hand-written expected text (independent of the code under test)
// ---------------------------------------------------------------------------

const TITLE = 'Not part of your request'
const CHECK = "Check the recipient before you send. Open Cave doesn't confirm it for you."
const NO_CHECKED =
  'Open Cave has no checked address for this body. Find its FOI contact on its own website and confirm it before you send.'
const UNCLEAN_DRAFT =
  "This letter may include notes that aren't part of your request. Read it through and remove anything that isn't before you send it."
const UNCLEAN_FILED = "This letter may include notes that weren't part of your request."
const ATTRIBUTION = 'Prepared with Open Cave, opencave.ca'
const WHERE = 'Where to send this'
const FAQ =
  'https://www2.gov.bc.ca/gov/content/governments/about-the-bc-government/open-government/open-information/freedom-of-information/foi-faq'
const FOI_OPS = 'FOI Operations, PO Box 9569, Stn Prov Govt, Victoria BC V8W 9K1'

/** A recipient that resolves nothing: no jurisdiction recorded (most fixtures' metadata). */
const UNRESOLVED_WHERE = [WHERE, CHECK, NO_CHECKED]

// ---------------------------------------------------------------------------
// Rendering and reading
// ---------------------------------------------------------------------------

async function renderFixture(
  fx: Pick<LetterFixture, 'content' | 'format'>,
  opts: { status?: 'draft' | 'final' | 'filed'; metadata?: Record<string, unknown>; recipient?: RecipientResolution } = {}
): Promise<{ buf: Buffer; pdf: PdfRead }> {
  const buf = await drain(
    await renderLeverPdf({
      title: 'QA letter',
      content: fx.content,
      actionType: 'fippa_request',
      metadata: { ...(fx.format ? { letterFormat: fx.format } : {}), ...(opts.metadata ?? {}) },
      status: opts.status,
      recipient: opts.recipient,
    })
  )
  return { buf, pdf: await readPdf(buf) }
}

const isFooter = (s: string) => PAGE_LABEL.test(s)
const bodyText = (p: PdfPage) => p.items.filter((i) => !isFooter(i.str)).map((i) => i.str).join('')

/** The index of the guidance page: the first page whose body starts with its title. */
function guidanceIndex(pdf: PdfRead): number {
  const i = pdf.pages.findIndex((p) => bodyText(p).startsWith(TITLE))
  expect(i, 'no guidance page').toBeGreaterThanOrEqual(0)
  return i
}

function letterPagesText(pdf: PdfRead): string {
  return pdf.pages.slice(0, guidanceIndex(pdf)).map(bodyText).join('')
}

function guidancePagesText(pdf: PdfRead): string {
  return pdf.pages.slice(guidanceIndex(pdf)).map(bodyText).join('')
}

/** Fixtures small enough to render in a unit test (the 200K fallbacks take minutes; see the report). */
const RENDERABLE = LETTER_FIXTURES.filter((fx) => fx.content.length <= 60_000)

// ---------------------------------------------------------------------------
// Text oracle
// ---------------------------------------------------------------------------

describe('FIPPA PDF: text oracle', () => {
  it.each(RENDERABLE.map((fx) => [fx.id, fx] as const))(
    '%s: the letter pages equal the golden letter projection exactly (whitespace aside)',
    async (_id, fx) => {
      const { pdf } = await renderFixture(fx)
      expect(squash(letterPagesText(pdf))).toBe(squash(fx.expectedLetter))
    },
    30_000
  )

  it.each(RENDERABLE.map((fx) => [fx.id, fx] as const))(
    '%s: the guidance page is the title, the golden guidance, the notes, "Where to send this" and the attribution',
    async (_id, fx) => {
      const { pdf } = await renderFixture(fx)
      const clean = fx.expectedSplit === 'marker' && !fx.expectedFallback
      const notes = [
        ...(clean ? [] : [UNCLEAN_DRAFT]),
        ...(fx.expectedLetter === '' && clean ? ['This letter part is empty.'] : []),
      ]
      const expected = [TITLE, fx.expectedGuidance ?? '', ...notes, ...UNRESOLVED_WHERE, ATTRIBUTION].join('')
      expect(squash(guidancePagesText(pdf))).toBe(squash(expected))
    },
    30_000
  )

  it('a checked recipient whose letter carries an old ministry box: listed, "couldn\'t find", source; the letter keeps its box (Razor N4, A3)', async () => {
    const recipient = resolveRecipient({ metadata: { publicBody: 'BC Ministry of Forests', jurisdiction: 'bc' } })
    expect(recipient.status).toBe('checked')
    const { pdf } = await renderFixture(MARKER_V1_LETTER, { recipient })
    const guidance = guidancePagesText(pdf)
    expect(squash(guidance)).toBe(
      squash(
        [
          TITLE,
          MARKER_V1_LETTER.expectedGuidance,
          WHERE,
          CHECK,
          `Open Cave's directory lists BC Ministry of Forests's FOI address as ${FOI_OPS} (checked 2026-10-12). We couldn't find that address in your letter.`,
          `Source: ${FAQ}`,
          ATTRIBUTION,
        ].join('')
      )
    )
    // Never phrased as a confirmation.
    expect(guidance).not.toMatch(/\b(verified|confirmed|is correct)\b/i)
    expect(letterPagesText(pdf)).toContain('PO Box 9049')
  })

  it('a checked recipient whose letter has the address: listed with its date and source, never "couldn\'t find"', async () => {
    const recipient = resolveRecipient({ metadata: { publicBody: 'BC Ministry of Forests', jurisdiction: 'bc' } })
    const content = MARKER_V1_LETTER.content.replace('PO Box 9049 Stn Prov Govt\nVictoria, BC V8W 9E2', FOI_OPS)
    const { pdf } = await renderFixture({ content, format: 'marker-v1' }, { recipient })
    const guidance = squash(guidancePagesText(pdf))
    expect(guidance).toContain(squash(`lists BC Ministry of Forests's FOI address as ${FOI_OPS} (checked 2026-10-12).`))
    expect(guidance).not.toContain(squash("We couldn't find that address"))
    expect(guidance).toContain(squash(`Source: ${FAQ}`))
  })

  it('an unchecked recipient (EAO): "unchecked address … from no recorded source", and no address', async () => {
    const recipient = resolveRecipient({ metadata: { publicBody: 'BC Environmental Assessment Office', jurisdiction: 'bc' } })
    expect(recipient.status).toBe('unchecked')
    const { pdf } = await renderFixture(PLACEHOLDER_LETTER, { recipient })
    const guidance = squash(guidancePagesText(pdf))
    expect(guidance).toContain(
      squash(
        'Open Cave has an unchecked address for BC Environmental Assessment Office, from no recorded source. Confirm it with them before you send.'
      )
    )
    expect(guidance).not.toContain(squash('PO Box 9426'))
  })

  it('the filed notice words the guidance page for a filed legacy letter', async () => {
    const { pdf } = await renderFixture(LEGACY_LETTER, { status: 'filed' })
    expect(squash(guidancePagesText(pdf))).toContain(squash(UNCLEAN_FILED))
  })

  it('the guidance page holds no letter text; the letter pages hold no guidance, notice or branding', async () => {
    const { pdf } = await renderFixture(MARKER_V1_LETTER)
    const guidance = guidancePagesText(pdf)
    const letter = letterPagesText(pdf)
    expect(guidance).toContain('Before you send this')
    for (const line of ['Dear FOI Coordinator', 'Cedar Ridge cutblock approvals', 'silviculture prescription']) {
      expect(letter).toContain(line)
      expect(guidance).not.toContain(line)
    }
    expect(letter).not.toContain('Before you send this')
    expect(letter).not.toMatch(/open\s*cave/i)
    expect(letter).not.toContain(WHERE)
    // The guidance starts on its own page.
    expect(guidanceIndex(pdf)).toBe(1)
  })

  it('nothing is inserted: no hyphen appears that the letter does not have', async () => {
    for (const fx of [TYPOGRAPHY_LETTER, LONG_TOKEN_LETTER, LONG_URL_LETTER, WRAPPING_LINK_LETTER, FIFTY_KB_LETTER]) {
      const { pdf } = await renderFixture(fx)
      const text = letterPagesText(pdf)
      const dashes = (s: string) => (s.match(/[-­‐‑]/g) ?? []).length
      expect(dashes(text), fx.id).toBe(dashes(fx.expectedLetter))
    }
  }, 60_000)
})

// ---------------------------------------------------------------------------
// Footer, band and margins
// ---------------------------------------------------------------------------

const GEOMETRY_FIXTURES = [
  FIFTY_KB_LETTER,
  LONG_TOKEN_LETTER,
  LONG_URL_LETTER,
  WRAPPING_LINK_LETTER,
  TYPOGRAPHY_LETTER,
  LONG_GUIDANCE_LETTER,
  MARKER_V1_LETTER,
]

describe('FIPPA PDF: footer, band and margins', () => {
  it.each(GEOMETRY_FIXTURES.map((fx) => [fx.id, fx] as const))(
    '%s: "Page k of N" exactly once on every page, with the right N',
    async (_id, fx) => {
      const { pdf } = await renderFixture(fx)
      const n = pdf.pages.length
      pdf.pages.forEach((p, k) => {
        const labels = p.items.filter((i) => isFooter(i.str)).map((i) => i.str)
        expect(labels, `page ${k + 1}`).toEqual([`Page ${k + 1} of ${n}`])
      })
    },
    30_000
  )

  it('the multi-page fixtures are multi-page (so the checks above mean something)', async () => {
    expect((await renderFixture(FIFTY_KB_LETTER)).pdf.pages.length).toBeGreaterThan(3)
    expect((await renderFixture(LONG_TOKEN_LETTER)).pdf.pages.length).toBeGreaterThan(2)
    // Guidance long enough to span two pages after the letter's own page.
    expect((await renderFixture(LONG_GUIDANCE_LETTER)).pdf.pages.length).toBeGreaterThanOrEqual(3)
  }, 30_000)

  it.each(GEOMETRY_FIXTURES.map((fx) => [fx.id, fx] as const))(
    '%s: no body text item enters the footer band; the footer sits in it',
    async (_id, fx) => {
      const { pdf } = await renderFixture(fx)
      for (const [k, p] of pdf.pages.entries()) {
        for (const it of p.items) {
          if (!it.str.trim()) continue
          if (isFooter(it.str)) {
            expect(it.bottom, `footer bottom, page ${k + 1}`).toBeGreaterThanOrEqual(FOOTER_BAND_BOTTOM - 3)
            expect(it.top, `footer top, page ${k + 1}`).toBeLessThanOrEqual(FOOTER_BAND_TOP)
            continue
          }
          expect(it.bottom, `"${it.str.slice(0, 30)}" on page ${k + 1}`).toBeGreaterThan(FOOTER_BAND_TOP)
        }
      }
    },
    30_000
  )

  it.each(GEOMETRY_FIXTURES.map((fx) => [fx.id, fx] as const))(
    '%s: every text item lies inside the side margins',
    async (_id, fx) => {
      const { pdf } = await renderFixture(fx)
      for (const [k, p] of pdf.pages.entries()) {
        for (const it of p.items) {
          if (!it.str.trim()) continue
          expect(it.x, `"${it.str.slice(0, 30)}" on page ${k + 1}`).toBeGreaterThanOrEqual(72 - 0.5)
          expect(it.right, `"${it.str.slice(0, 30)}" on page ${k + 1}`).toBeLessThanOrEqual(p.width - 72 + 0.5)
        }
      }
    },
    30_000
  )
})

// ---------------------------------------------------------------------------
// Pure white page
// ---------------------------------------------------------------------------

const PDFTOPPM = hasPdftoppm()
if (!PDFTOPPM) {
  console.warn('[fippa-pdf] pure-white raster test SKIPPED: pdftoppm is not installed (mandatory in the relay local run).')
}

describe.skipIf(!PDFTOPPM)(
  PDFTOPPM ? 'FIPPA PDF: pure white page' : 'FIPPA PDF: pure white page SKIPPED (no pdftoppm)',
  () => {
    it.each(
      [...SEEDED_LETTER_FIXTURES, TYPOGRAPHY_LETTER, LONG_TOKEN_LETTER, MARKER_FIRST_LINE].map((fx) => [fx.id, fx] as const)
    )(
      '%s: every pixel outside the glyph boxes is #FFFFFF, on every page',
      async (_id, fx) => {
        const { buf, pdf } = await renderFixture(fx)
        const rasters = rasterise(buf, 50)
        expect(rasters.length).toBe(pdf.pages.length)
        rasters.forEach((r, k) => {
          const bad = nonWhiteOutsideText(r, pdf.pages[k], 2)
          expect(bad.slice(0, 3), `page ${k + 1}: ${bad.length} non-white pixels`).toEqual([])
          // The test is not vacuous: the glyphs themselves are dark.
          let dark = 0
          for (let o = 0; o < r.data.length; o += 3) if (r.data[o] < 128) dark++
          expect(dark, `page ${k + 1} has ink`).toBeGreaterThan(0)
        })
      },
      30_000
    )
  }
)

// ---------------------------------------------------------------------------
// Metadata and ink
// ---------------------------------------------------------------------------

describe('FIPPA PDF: metadata and ink', () => {
  it('Author and Creator are blank; the title is the letter title', async () => {
    const { pdf } = await renderFixture(MARKER_V1_LETTER)
    expect(pdf.info.Title).toBe('QA letter')
    expect(pdf.info.Author ?? '').toBe('')
    expect(pdf.info.Creator ?? '').toBe('')
    expect(JSON.stringify(pdf.info)).not.toMatch(/open\s*cave/i)
  })

  it('placeholders are inked #92400E, the letter #1C1917', async () => {
    const { buf } = await renderFixture(PLACEHOLDER_LETTER)
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise
    const ops = await (await doc.getPage(1)).getOperatorList()
    const fills = new Set<string>()
    ops.fnArray.forEach((fn, i) => {
      if (fn === pdfjs.OPS.setFillRGBColor) {
        const arg = ops.argsArray[i] as unknown
        fills.add(typeof arg === 'string' ? arg.toLowerCase() : String((arg as unknown[])[0]).toLowerCase())
      }
    })
    await doc.destroy()
    expect([...fills]).toContain('#92400e')
    expect([...fills]).toContain('#1c1917')
  })
})

// ---------------------------------------------------------------------------
// The export route: directory change, timeout, access
// ---------------------------------------------------------------------------

interface ActionRow {
  id: string
  title: string
  actionType: string
  content: string | null
  status: 'draft' | 'final' | 'filed'
  metadata: Record<string, unknown> | null
  investigationId: string | null
  createdAt: Date
}

const ACTION_ID = '22222222-2222-4222-8222-222222222222'
let actionRows: ActionRow[] = []
let investigationRows: Array<{ concern: string; jurisdictionName: string | null; province: string | null }> = []
let renderOverride: (() => Promise<NodeJS.ReadableStream>) | null = null

vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: async () => ({ success: true }) }))
vi.mock('@/lib/db', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => actionRows }),
        leftJoin: () => ({ where: () => ({ limit: async () => investigationRows }) }),
      }),
    }),
  }),
}))
vi.mock('@/lib/pdf/render', async (orig) => {
  const real = (await orig()) as typeof import('@/lib/pdf/render')
  return {
    ...real,
    renderLeverPdf: (...args: Parameters<typeof real.renderLeverPdf>) =>
      renderOverride ? renderOverride() : real.renderLeverPdf(...args),
  }
})

const { POST: exportRoute } = await import('@/app/api/lever/export/route')

function exportRequest(format: 'txt' | 'md' | 'pdf', userId: string | null = 'user-a') {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (userId) headers['x-user-id'] = userId
  return exportRoute(
    new NextRequest('http://localhost/api/lever/export', {
      method: 'POST',
      headers,
      body: JSON.stringify({ actionId: ACTION_ID, format }),
    }),
    { params: Promise.resolve({}) }
  )
}

function filedRow(fx: LetterFixture): ActionRow {
  return {
    id: ACTION_ID,
    title: 'QA filed letter',
    actionType: 'fippa_request',
    content: fx.content,
    status: 'filed',
    metadata: { publicBody: 'BC Ministry of Forests', jurisdiction: 'bc', ...(fx.format ? { letterFormat: fx.format } : {}) },
    investigationId: null,
    createdAt: new Date('2026-10-01T12:00:00Z'),
  }
}

describe('export route', () => {
  beforeEach(() => {
    actionRows = []
    investigationRows = []
    renderOverride = null
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('a directory change alters only "Where to send this": letter pages identical, TXT and MD byte-identical', async () => {
    actionRows = [filedRow(MARKER_V1_LETTER)]
    const before = {
      pdf: Buffer.from(await (await exportRequest('pdf')).arrayBuffer()),
      txt: Buffer.from(await (await exportRequest('txt')).arrayBuffer()),
      md: Buffer.from(await (await exportRequest('md')).arrayBuffer()),
    }

    // The simulated change: the directory loses its evidence for the body.
    const saved = PUBLIC_BODY_DIRECTORY.bc
    PUBLIC_BODY_DIRECTORY.bc = saved.map((b) =>
      b.name === 'BC Ministry of Forests' ? { name: b.name, foiAddress: 'FOI Desk (QA), PO Box 1, Victoria BC', jurisdiction: b.jurisdiction } : b
    )
    let after: typeof before
    try {
      after = {
        pdf: Buffer.from(await (await exportRequest('pdf')).arrayBuffer()),
        txt: Buffer.from(await (await exportRequest('txt')).arrayBuffer()),
        md: Buffer.from(await (await exportRequest('md')).arrayBuffer()),
      }
    } finally {
      PUBLIC_BODY_DIRECTORY.bc = saved
    }

    expect(after.txt.equals(Buffer.from(MARKER_V1_LETTER.content, 'utf8'))).toBe(true)
    expect(after.txt.equals(before.txt)).toBe(true)
    expect(after.md.equals(before.md)).toBe(true)
    expect(after.md.equals(Buffer.from(MARKER_V1_LETTER.content, 'utf8'))).toBe(true)

    const [b, a] = [await readPdf(before.pdf), await readPdf(after.pdf)]
    expect(letterPagesText(a)).toBe(letterPagesText(b))
    expect(squash(letterPagesText(a))).toBe(squash(MARKER_V1_LETTER.expectedLetter))

    // Only the block differs: strip it (from its title to the attribution) and the rest is equal.
    const strip = (s: string) => s.replace(/Where to send this[\s\S]*Prepared with Open Cave/, '')
    expect(strip(guidancePagesText(a))).toBe(strip(guidancePagesText(b)))
    expect(guidancePagesText(b)).toContain('(checked 2026-10-12)')
    expect(guidancePagesText(a)).not.toContain('(checked 2026-10-12)')
    expect(squash(guidancePagesText(a))).toContain(squash('Open Cave has an unchecked address for BC Ministry of Forests'))
  }, 60_000)

  it('the route resolves the recipient with the action\'s investigation (no stored province)', async () => {
    actionRows = [{ ...filedRow(MARKER_V1_LETTER), metadata: { publicBody: 'BC Ministry of Forests', letterFormat: 'marker-v1' }, investigationId: '33333333-3333-4333-8333-333333333333' }]
    investigationRows = [{ concern: 'QA concern', jurisdictionName: null, province: 'British Columbia' }]
    const pdf = await readPdf(Buffer.from(await (await exportRequest('pdf')).arrayBuffer()))
    expect(guidancePagesText(pdf)).toContain('(checked 2026-10-12)')

    investigationRows = []
    const none = await readPdf(Buffer.from(await (await exportRequest('pdf')).arrayBuffer()))
    expect(squash(guidancePagesText(none))).toContain(squash(NO_CHECKED))
  }, 30_000)

  it('a render past 8 seconds is a 503 with a way out, never a file', async () => {
    actionRows = [filedRow(MARKER_V1_LETTER)]
    vi.useFakeTimers()
    renderOverride = () => new Promise(() => {})
    const pending = exportRequest('pdf')
    await vi.advanceTimersByTimeAsync(7_999)
    let settled = false
    void pending.then(() => (settled = true))
    await vi.advanceTimersByTimeAsync(0)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    const res = await pending
    expect(res.status).toBe(503)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toEqual({ error: "The PDF couldn't be made right now. Use Print or Plain text instead." })
  })

  it('a render that finishes in time is a whole PDF with its length declared', async () => {
    actionRows = [filedRow(MARKER_V1_LETTER)]
    const res = await exportRequest('pdf')
    expect(res.status).toBe(200)
    const body = Buffer.from(await res.arrayBuffer())
    expect(res.headers.get('content-length')).toBe(String(body.length))
    expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  }, 30_000)

  it.each(['txt', 'md', 'pdf'] as const)('%s: anonymous is 401, a non-owner (no row) is 404', async (format) => {
    actionRows = []
    expect((await exportRequest(format, null)).status).toBe(401)
    expect((await exportRequest(format, 'user-b')).status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// Capacity (PDF_CAPACITY=1 only)
// ---------------------------------------------------------------------------

describe.skipIf(process.env.PDF_CAPACITY !== '1')('FIPPA PDF: capacity (PDF_CAPACITY=1)', () => {
  it('the 50KB letter renders in at most 5 s at the 95th percentile over 10 runs', async () => {
    const times: number[] = []
    for (let i = 0; i < 10; i++) {
      const t0 = performance.now()
      await drain(await renderLeverPdf({ title: 'QA', content: FIFTY_KB_LETTER.content, actionType: 'fippa_request', metadata: {} }))
      times.push(performance.now() - t0)
    }
    const sorted = [...times].sort((a, b) => a - b)
    const p95 = sorted[Math.ceil(0.95 * sorted.length) - 1]
    console.log(`[fippa-pdf capacity] runs(ms)=${times.map((t) => t.toFixed(0)).join(',')} p95=${p95.toFixed(0)}`)
    expect(p95).toBeLessThanOrEqual(5_000)
  }, 120_000)
})
