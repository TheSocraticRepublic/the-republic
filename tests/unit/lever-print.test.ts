import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'crypto'
// @ts-expect-error -- jsdom ships no types and @types/jsdom is not a dependency; one constructor is used, typed below.
import { JSDOM as UntypedJSDOM } from 'jsdom'
import { NextRequest } from 'next/server'
// Imported at module scope (vi.mock is hoisted above it), so the route's cold
// import is paid at collection, not inside the first test's 5s timeout.
import { GET } from '@/app/api/lever/actions/[id]/print/route'
import {
  LETTER_FIXTURES,
  MARKER_V1_LETTER,
  LEGACY_LETTER,
  HOSTILE_INPUT,
  LITERAL_EXAMPLES,
  OVERSIZE_FALLBACK,
  MARKER_FIRST_LINE,
  PUBLIC_COMMENT_FIXTURE,
  type LetterFixture,
} from '../fixtures/letters'

/*
 * GET /api/lever/actions/[id]/print, through the real handler (safeRoute and
 * all), with the database and the rate limiter replaced. Ownership is a SQL
 * filter (id AND user_id), so "non-owner" here means the query found no row;
 * the real owner / non-owner / anonymous run is on the QA harness.
 */

interface Row {
  id: string
  userId: string
  actionType: string
  title: string
  content: string | null
  status: string
  metadata: Record<string, unknown> | null
  createdAt: Date
}

let rows: Row[] = []
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: async () => ({ success: true }) }))
vi.mock('@/lib/db', () => ({
  getDb: () => ({ select: () => ({ from: () => ({ where: () => ({ limit: async () => rows }) }) }) }),
}))

const JSDOM = UntypedJSDOM as new (html: string) => { window: { document: Document } }

const ID = '11111111-1111-4111-8111-111111111111'
const CREATED = new Date('2026-10-01T12:00:00Z')

function fippaRow(fx: LetterFixture, extra: Record<string, unknown> = {}): Row {
  return {
    id: ID,
    userId: 'user-a',
    actionType: 'fippa_request',
    title: `QA ${fx.id}`,
    content: fx.content,
    status: 'final',
    metadata: { publicBody: 'Addressee Body (QA) Unique', addressee: 'Addressee Person (QA) Unique', ...(fx.format ? { letterFormat: fx.format } : {}), ...extra },
    createdAt: CREATED,
  }
}

async function print(userId: string | null = 'user-a') {
  const headers: Record<string, string> = {}
  if (userId) headers['x-user-id'] = userId
  return GET(new NextRequest(`http://localhost/api/lever/actions/${ID}/print`, { headers }), {
    params: Promise.resolve({ id: ID }),
  })
}

async function printFixture(fx: LetterFixture) {
  rows = [fippaRow(fx)]
  const res = await print()
  expect(res.status).toBe(200)
  const html = await res.text()
  return { html, doc: new JSDOM(html).window.document }
}

/** A part's text: its block elements' textContent joined with "\n" (the projection's definition). */
function partText(container: Element | null): string | null {
  if (!container) return null
  return Array.from(container.children)
    .map((el) => el.textContent ?? '')
    .join('\n')
}

beforeEach(() => {
  rows = []
})

describe('print route: access', () => {
  it('anonymous is 401', async () => {
    rows = [fippaRow(MARKER_V1_LETTER)]
    expect((await print(null)).status).toBe(401)
  })
  it('no row for this user (non-owner) is 404', async () => {
    rows = []
    expect((await print('user-b')).status).toBe(404)
  })
})

describe('print route: the letter text equals the golden projection exactly', () => {
  for (const fx of LETTER_FIXTURES) {
    it(fx.id, async () => {
      const { doc } = await printFixture(fx)
      const main = doc.querySelector('main')
      expect(main).not.toBeNull()
      const letter = main!.querySelector(':scope > .letter')
      expect(partText(letter)).toBe(fx.expectedLetter)
      expect(partText(doc.querySelector('.guidance-page .guidance-text'))).toBe(fx.expectedGuidance)
      // jsdom's textContent over the 200,000-character fixture's ~5,000
      // elements takes seconds; the route itself renders it in milliseconds.
    }, 60_000)
  }
})

describe('print route: structure (filings §1, A1 Print)', () => {
  it('no recognised markup token is left in the letter, and literals survive', async () => {
    const { doc } = await printFixture(MARKER_V1_LETTER)
    const text = doc.querySelector('main')!.textContent ?? ''
    expect(text).not.toContain('**')
    expect(text).not.toContain('](')
    expect(text).not.toMatch(/^#{1,6} /m)
    expect(text).not.toContain('=== NOT PART OF YOUR REQUEST ===')
    expect(text).toContain('Freedom of Information and Protection of Privacy Act')

    const lit = (await printFixture(LITERAL_EXAMPLES)).doc.querySelector('.letter')!.textContent ?? ''
    expect(lit).toContain('*.pdf and *.txt')
    expect(lit).toContain('src/*/x*')
    expect(lit).toContain('A backslash \\*stays\\* a backslash.')
  })

  it('placeholders are <mark> elements in the paper colours', async () => {
    const { html, doc } = await printFixture(MARKER_V1_LETTER)
    const marks = Array.from(doc.querySelectorAll('.letter mark.ph')).map((m) => m.textContent)
    expect(marks).toEqual(['[Your name]', '[Your email]'])
    expect(html).toContain('mark.ph { background: #FDF2D0; color: #6B3A06;')
  })

  it('no template header, date, addressee, signature or branding inside the letter', async () => {
    const { html, doc } = await printFixture(LEGACY_LETTER)
    expect(html).not.toContain('2026-10-01')
    expect(html).not.toContain('Addressee Body (QA) Unique')
    expect(html).not.toContain('Addressee Person (QA) Unique')
    expect(html).not.toContain('signature')
    expect(html).not.toContain('OPEN CAVE')
    expect(doc.title).toBe('QA legacy')
    const letter = doc.querySelector('.letter')!.textContent ?? ''
    expect(letter).not.toContain('Open Cave')
    // The letter's own sign-off is there, once: nothing was added around it.
    expect(letter.match(/Yours truly,/g)).toHaveLength(1)
    // Attribution is on the guidance page only (R5).
    expect(doc.querySelector('.guidance-page .attribution')?.textContent).toContain('Open Cave')
  })

  it('guidance comes after the letter, on a page of its own', async () => {
    const { html, doc } = await printFixture(MARKER_V1_LETTER)
    const main = doc.querySelector('main')!
    const kids = Array.from(main.children).map((c) => c.className)
    expect(kids).toEqual(['letter', 'guidance-page'])
    expect(html).toMatch(/\.guidance-page \{ break-before: page;/)
    expect(doc.querySelector('.guidance-page h1')?.textContent).toBe('Not part of your request')
    expect(doc.querySelector('.letter')!.textContent).not.toContain('Before you send this')
    expect(doc.querySelector('.guidance-page')!.textContent).toContain('Before you send this')
    // The page names the browser header/footer limit and how to turn it off.
    expect(doc.querySelector('.guidance-page .tip')?.textContent).toContain('Headers and footers')
  })

  it('white ground, 1in page margin, <main>, a 6.5in measure', async () => {
    const { html } = await printFixture(MARKER_V1_LETTER)
    expect(html).toContain('html, body { background: #FFFFFF; }')
    expect(html).toContain('@page { margin: 1in; }')
    expect(html).toContain('main { max-width: 6.5in;')
  })

  it('the Print button is outside the letter and hidden in print', async () => {
    const { html, doc } = await printFixture(MARKER_V1_LETTER)
    const btn = doc.querySelector('button.print-btn')
    expect(btn?.textContent).toBe('Print')
    expect(btn!.closest('.screen-bar')).not.toBeNull()
    expect(btn!.closest('main')).toBeNull()
    expect(html).toMatch(/@media print \{\s*\.screen-bar \{ display: none; \}/)
    // In flow at every width, never position: fixed over the text (RS-P2-5).
    const css = html.slice(html.indexOf('.print-btn {'), html.indexOf('}', html.indexOf('.print-btn {')))
    expect(css).not.toContain('position')
  })

  it('the §2 notice is outside the letter for an unclean split, absent for a clean one', async () => {
    const notice = "This letter may include notes that aren't part of your request."
    const legacy = (await printFixture(LEGACY_LETTER)).doc
    expect(legacy.querySelector('.screen-bar')!.textContent).toContain(notice)
    expect(legacy.querySelector('.letter')!.textContent).not.toContain(notice)
    const clean = (await printFixture(MARKER_V1_LETTER)).doc
    expect(clean.body.textContent).not.toContain(notice)
  })

  it('an empty letter part says so, outside the letter', async () => {
    const { doc } = await printFixture(MARKER_FIRST_LINE)
    expect(partText(doc.querySelector('.letter'))).toBe('')
    expect(doc.querySelector('.screen-bar')!.textContent).toContain('This letter part is empty.')
  })

  it('fallback prints the whole text verbatim, with "Shown as plain text."', async () => {
    const { doc } = await printFixture(OVERSIZE_FALLBACK)
    expect(doc.querySelector('.letter pre.lb-verbatim')!.textContent).toBe(OVERSIZE_FALLBACK.content)
    expect(doc.querySelector('.screen-bar')!.textContent).toContain('Shown as plain text.')
  })

  it('hostile input is escaped text: no script, no anchor', async () => {
    const { html, doc } = await printFixture(HOSTILE_INPUT)
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/<a[\s>]/i)
    expect(html).toContain('&lt;script&gt;')
    expect(doc.querySelectorAll('.letter b')).toHaveLength(0)
    expect(partText(doc.querySelector('.letter'))).toBe(HOSTILE_INPUT.expectedLetter)
  })

  it('a hostile title is escaped', async () => {
    rows = [{ ...fippaRow(MARKER_V1_LETTER), title: `</title><script>x()</script> & 'q'` }]
    const html = await (await print()).text()
    expect(html).toContain('<title>&lt;/title&gt;&lt;script&gt;x()&lt;/script&gt; &amp; &#39;q&#39;</title>')
  })
})

describe('print route: non-FIPPA output is unchanged', () => {
  /*
   * Captured from the route as it stood before A1 (commit 1da9b56, with the
   * original esc()), for exactly this row, by running this same handler. The
   * public-comment page shares the old shell, which A1 does not touch.
   */
  const BEFORE_SHA256 = 'bc8bde6927850ce50dc84d726e4ff5043a8d2ba9e2af729c00a63be0ef762149'

  it('the public comment page is byte-identical to before A1', async () => {
    rows = [
      {
        id: ID,
        userId: 'user-a',
        actionType: 'public_comment',
        title: 'Comment on the Mill Creek watershed plan',
        content: PUBLIC_COMMENT_FIXTURE.content,
        status: 'draft',
        metadata: { publicBody: 'Synthetic Regional District (QA)' },
        createdAt: CREATED,
      },
    ]
    const html = await (await print()).text()
    expect(createHash('sha256').update(html).digest('hex')).toBe(BEFORE_SHA256)
    // And, readably: the old shell is still there.
    expect(html).toContain('<p class="wordmark">OPEN CAVE</p>')
    expect(html).toContain('Submitted to: Synthetic Regional District (QA)')
  })
})
