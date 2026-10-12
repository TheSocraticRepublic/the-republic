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
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import postgres from 'postgres'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
// @ts-expect-error -- jsdom ships no types and @types/jsdom is not a dependency; one constructor is used, typed below.
import { JSDOM as UntypedJSDOM } from 'jsdom'
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

// ---------------------------------------------------------------------------
// On the running QA harness: ownership through the real middleware, and the
// A-series acceptance over the seeded fixtures (scripts/qa/README.md).
// ---------------------------------------------------------------------------

const APP_URL = 'http://127.0.0.1:3177'
const QA_DATABASE_URL = 'postgres://qa_app:qa_app_dummy@127.0.0.1:55432/republic_qa'
const QA_USER_A = 'a0000000-0000-4000-8000-00000000000a'
const QA_USER_B = 'b0000000-0000-4000-8000-00000000000b'

function harnessJwtSecret(): string | null {
  const root = path.resolve(__dirname, '..', '..')
  const dir = path.join(os.tmpdir(), `open-cave-qa-${createHash('sha1').update(root).digest('hex').slice(0, 10)}`)
  try {
    return (JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8')) as { jwtSecret: string }).jwtSecret
  } catch {
    return null
  }
}

async function harnessAppUp(): Promise<boolean> {
  try {
    return (await fetch(`${APP_URL}/api/health`, { signal: AbortSignal.timeout(3000) })).ok
  } catch {
    return false
  }
}

const HARNESS_SECRET = harnessJwtSecret()
const HARNESS_APP = HARNESS_SECRET !== null && (await harnessAppUp())
if (!HARNESS_APP) {
  const message = '[fippa-pdf] harness layer SKIPPED: no running QA harness app for this worktree (npx tsx scripts/qa/harness.ts up).'
  if (process.env.QA_REQUIRE_HARNESS === '1') throw new Error(message.replace('SKIPPED', 'REQUIRED'))
  console.warn(message)
}

describe.skipIf(!HARNESS_APP)(
  HARNESS_APP ? 'on the QA harness (production build, real middleware)' : 'on the QA harness: SKIPPED (not running)',
  () => {
    let ownerCookie = ''
    let otherCookie = ''
    let sql: postgres.Sql
    const created: string[] = []

    beforeAll(async () => {
      process.env.JWT_SECRET = HARNESS_SECRET!
      const { signJWT } = await import('@/lib/auth/jwt')
      const { AUTH_COOKIE } = await import('@/lib/auth/middleware')
      ownerCookie = `${AUTH_COOKIE}=${await signJWT({ sub: QA_USER_A, email: 'qa-owner-a@example.test' })}`
      otherCookie = `${AUTH_COOKIE}=${await signJWT({ sub: QA_USER_B, email: 'qa-other-b@example.test' })}`
      sql = postgres(QA_DATABASE_URL, { max: 1, onnotice: () => {} })
    })

    afterAll(async () => {
      if (sql) {
        if (created.length) await sql`delete from lever_actions where id in ${sql(created)}`
        await sql.end({ timeout: 5 })
      }
    })

    /*
     * The production-mode limiter is live on the harness: 30 requests a
     * minute per user per route (sliding window, with an in-process block
     * list, so emptying Redis does not lift a block). This layer makes more
     * than that as user A, so it paces itself: at most 25 of A's requests to
     * one rate-limited route in any 61 seconds. Nothing in the app is changed.
     */
    const sent = new Map<string, number[]>()
    async function pace(method: string, pathname: string, cookie: string | null) {
      if (cookie !== ownerCookie) return
      const key = pathname.startsWith('/api/lever/export')
        ? 'export'
        : pathname.endsWith('/print')
          ? 'print'
          : pathname.startsWith('/api/lever/actions/')
            ? 'action'
            : null
      if (!key) return
      const times = (sent.get(key) ?? []).filter((t) => Date.now() - t < 61_000)
      if (times.length >= 14) await new Promise((r) => setTimeout(r, 61_000 - (Date.now() - times[0]) + 50))
      sent.set(key, [...times.filter((t) => Date.now() - t < 61_000), Date.now()])
    }

    async function http(method: string, pathname: string, cookie: string | null, body?: unknown) {
      await pace(method, pathname, cookie)
      const headers: Record<string, string> = { 'content-type': 'application/json' }
      if (cookie) headers.cookie = cookie
      if (method !== 'GET') headers.origin = APP_URL
      return fetch(`${APP_URL}${pathname}`, {
        method,
        redirect: 'manual',
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    }

    async function seeded(key: string, status: 'draft' | 'final' | 'filed') {
      const [row] = await sql<{ id: string; content: string; metadata: Record<string, unknown> }[]>`
        select id, content, metadata from lever_actions
        where user_id = ${QA_USER_A} and title = ${`FIPPA Request: QA ${key} (${status})`}`
      expect(row, `seeded ${key} (${status})`).toBeDefined()
      return row
    }

    const partOf = (el: Element | null) => (el ? Array.from(el.children).map((c) => c.textContent ?? '').join('\n') : null)
    const JSDOMCtor = UntypedJSDOM as new (html: string) => { window: { document: Document } }

    it('POST /api/lever/export, every format: owner 200, non-owner 404, anonymous 401', async () => {
      const { id } = await seeded('marker-v1', 'final')
      for (const format of ['txt', 'md', 'pdf'] as const) {
        expect((await http('POST', '/api/lever/export', ownerCookie, { actionId: id, format })).status, format).toBe(200)
        expect((await http('POST', '/api/lever/export', otherCookie, { actionId: id, format })).status, format).toBe(404)
        expect((await http('POST', '/api/lever/export', null, { actionId: id, format })).status, format).toBe(401)
      }
      expect((await http('GET', `/api/lever/actions/${id}/print`, ownerCookie)).status).toBe(200)
      expect((await http('GET', `/api/lever/actions/${id}/print`, otherCookie)).status).toBe(404)
      expect((await http('GET', `/api/lever/actions/${id}/print`, null)).status).toBe(401)
      const page = await http('GET', `/lever/${id}`, null)
      expect([302, 303, 307, 308]).toContain(page.status)
      expect(page.headers.get('location') ?? '').toContain('/login')
    }, 180_000)

    const ACCEPTANCE = SEEDED_LETTER_FIXTURES.flatMap((fx) =>
      (['draft', 'final', 'filed'] as const).map((status) => [`${fx.id} (${status})`, fx, status] as const)
    )

    it.each(ACCEPTANCE)(
      'A-series acceptance, %s: one letter in screen, print and PDF, equal to the golden; no branding; numbered; TXT and MD as stored',
      async (_label, fx, status) => {
        const row = await seeded(fx.seed!.key, status)

        // Screen: the server-rendered Lever page.
        const screenHtml = await (await http('GET', `/lever/${row.id}`, ownerCookie)).text()
        const screenDoc = new JSDOMCtor(screenHtml).window.document
        expect(screenDoc.querySelectorAll('[data-letter-paper]').length).toBe(1)
        expect(partOf(screenDoc.querySelector('[data-letter-text]'))).toBe(fx.expectedLetter)
        expect(screenDoc.querySelector('[data-letter-paper]')!.textContent).not.toMatch(/open\s*cave/i)
        expect(screenDoc.querySelector('[data-recipient-notice]')!.textContent).toContain(CHECK)

        // Print.
        const printDoc = new JSDOMCtor(await (await http('GET', `/api/lever/actions/${row.id}/print`, ownerCookie)).text())
          .window.document
        expect(printDoc.querySelectorAll('main > .letter').length).toBe(1)
        expect(partOf(printDoc.querySelector('main > .letter'))).toBe(fx.expectedLetter)
        expect(printDoc.querySelector('main > .letter')!.textContent).not.toMatch(/open\s*cave/i)
        expect(printDoc.querySelector('.guidance-page .where-to-send')!.textContent).toContain(CHECK)

        // PDF.
        const pdfRes = await http('POST', '/api/lever/export', ownerCookie, { actionId: row.id, format: 'pdf' })
        expect(pdfRes.status).toBe(200)
        const pdf = await readPdf(new Uint8Array(await pdfRes.arrayBuffer()))
        expect(squash(letterPagesText(pdf))).toBe(squash(fx.expectedLetter))
        expect(letterPagesText(pdf)).not.toMatch(/open\s*cave/i)
        expect(pdf.info.Author ?? '').toBe('')
        pdf.pages.forEach((p, k) => {
          expect(p.items.filter((i) => isFooter(i.str)).map((i) => i.str)).toEqual([`Page ${k + 1} of ${pdf.pages.length}`])
        })
        const g = guidanceIndex(pdf)
        expect(g).toBeGreaterThanOrEqual(1)
        if (fx.expectedGuidance) expect(squash(guidancePagesText(pdf))).toContain(squash(fx.expectedGuidance))

        // TXT and MD: the stored text, byte for byte.
        for (const format of ['txt', 'md'] as const) {
          const res = await http('POST', '/api/lever/export', ownerCookie, { actionId: row.id, format })
          expect(res.status, format).toBe(200)
          const body = Buffer.from(await res.arrayBuffer())
          expect(body.equals(Buffer.from(row.content, 'utf8')), format).toBe(true)
        }
      },
      600_000
    )

    it('edit, save and reload round-trip on a draft, with the hash, and the 409 on a stale one', async () => {
      const [row] = await sql<{ id: string }[]>`
        insert into lever_actions (user_id, action_type, title, content, metadata, status)
        values (${QA_USER_A}, 'fippa_request', 'QA A4 round trip', ${MARKER_V1_LETTER.content},
                ${sql.json({ publicBody: 'BC Ministry of Forests', jurisdiction: 'bc', letterFormat: 'marker-v1' })}, 'draft')
        returning id`
      created.push(row.id)
      const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')
      const edited = MARKER_V1_LETTER.content.replace('Dear FOI Coordinator,', 'Dear Records Officer,')
      const saved = await http('PATCH', `/api/lever/actions/${row.id}`, ownerCookie, {
        content: edited,
        expectedContentSha256: sha(MARKER_V1_LETTER.content),
      })
      expect(saved.status).toBe(200)
      expect(((await saved.json()) as { action: { content: string } }).action.content).toBe(edited)
      const doc = new JSDOMCtor(await (await http('GET', `/lever/${row.id}`, ownerCookie)).text()).window.document
      expect(partOf(doc.querySelector('[data-letter-text]'))).toBe(
        MARKER_V1_LETTER.expectedLetter.replace('Dear FOI Coordinator,', 'Dear Records Officer,')
      )
      const stale = await http('PATCH', `/api/lever/actions/${row.id}`, ownerCookie, {
        content: 'Lost?',
        expectedContentSha256: sha(MARKER_V1_LETTER.content),
      })
      expect(stale.status).toBe(409)
      expect(await stale.json()).toEqual({ error: 'This letter changed since you opened it' })
    }, 180_000)

    it('final and filed letter pages are unchanged when the recipient resolution changes (the directory-change proxy on a built app)', async () => {
      // The built app's directory can't be edited at runtime, so the resolver's
      // answer is changed the other way: the row's body moves from a checked
      // entry to an unlisted one. Only "Where to send this" may change. (The
      // directory itself is changed in the route test above.)
      for (const status of ['final', 'filed'] as const) {
        const [row] = await sql<{ id: string }[]>`
          insert into lever_actions (user_id, action_type, title, content, metadata, status)
          values (${QA_USER_A}, 'fippa_request', ${`QA A4 directory ${status}`}, ${MARKER_V1_LETTER.content},
                  ${sql.json({ publicBody: 'BC Ministry of Forests', jurisdiction: 'bc', letterFormat: 'marker-v1' })}, ${status})
          returning id`
        created.push(row.id)
        const get = async () => {
          const pdf = await readPdf(
            new Uint8Array(await (await http('POST', '/api/lever/export', ownerCookie, { actionId: row.id, format: 'pdf' })).arrayBuffer())
          )
          const print = new JSDOMCtor(await (await http('GET', `/api/lever/actions/${row.id}/print`, ownerCookie)).text()).window.document
          return { pdf, print }
        }
        const before = await get()
        await sql`update lever_actions set metadata = metadata || ${sql.json({ publicBody: 'Synthetic Unlisted Body (QA)' })} where id = ${row.id}`
        const after = await get()
        expect(letterPagesText(after.pdf)).toBe(letterPagesText(before.pdf))
        expect(partOf(after.print.querySelector('main > .letter'))).toBe(partOf(before.print.querySelector('main > .letter')))
        expect(guidancePagesText(before.pdf)).toContain('(checked 2026-10-12)')
        expect(guidancePagesText(after.pdf)).not.toContain('(checked 2026-10-12)')
      }
    }, 180_000)
  }
)
