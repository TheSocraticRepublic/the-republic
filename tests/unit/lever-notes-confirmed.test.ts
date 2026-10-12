import { describe, it, expect, vi, beforeEach } from 'vitest'
// @ts-expect-error -- jsdom ships no types and @types/jsdom is not a dependency; one constructor is used, typed below.
import { JSDOM as UntypedJSDOM } from 'jsdom'
import { NextRequest } from 'next/server'
import { GET as printRoute } from '@/app/api/lever/actions/[id]/print/route'
import { POST as exportRoute } from '@/app/api/lever/export/route'
import { parseLetter, letterIsClean } from '@/lib/lever/letter-blocks'
import { readPdf, squash } from './pdf-text'
import {
  MISSING_MARKER_LETTER,
  AMBIGUOUS_LETTER,
  MARKER_V1_LETTER,
  LEGACY_LETTER,
  OVERSIZE_FALLBACK,
  type LetterFixture,
} from '../fixtures/letters'

/*
 * A5 (Lee, 2026-10-12): a final or filed marker-v1 letter with no marker line,
 * whose finalise the citizen confirmed (`metadata.notesRemovalConfirmedAt`),
 * shows no "may include notes" notice in print or in the PDF, and its whole
 * text is the letter. Drafts, two-marker letters and fallback parses keep the
 * notice. Print and PDF go through their real routes (export for the PDF),
 * with only the database and the rate limiter replaced. The screen is in
 * action-viewer-conflict.test.tsx.
 */

const ID = '55555555-5555-4555-8555-555555555555'
const CONFIRMED_AT = '2026-10-12T16:00:00.000Z'
// The notice's shared opening, whatever its status wording.
const NOTES = 'may include notes'
const UNCLEAN_FILED = "This letter may include notes that weren't part of your request."
const UNCLEAN_FINAL =
  "This letter may include notes that aren't part of your request. Export it as plain text and remove anything that isn't part of your request before you send it."

interface Row {
  id: string
  userId: string
  actionType: string
  title: string
  content: string | null
  status: string
  metadata: Record<string, unknown> | null
  investigationId: string | null
  createdAt: Date
}

let rows: Row[] = []
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: async () => ({ success: true }) }))
vi.mock('@/lib/db', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => rows }),
        leftJoin: () => ({ where: () => ({ limit: async () => [] }) }),
      }),
    }),
  }),
}))

const JSDOM = UntypedJSDOM as new (html: string) => { window: { document: Document } }

function row(fx: LetterFixture, status: 'draft' | 'final' | 'filed', confirmedAt?: unknown): Row {
  return {
    id: ID,
    userId: 'user-a',
    actionType: 'fippa_request',
    title: 'QA A5 letter',
    content: fx.content,
    status,
    metadata: {
      publicBody: 'BC Ministry of Forests',
      jurisdiction: 'bc',
      ...(fx.format ? { letterFormat: fx.format } : {}),
      ...(confirmedAt !== undefined ? { notesRemovalConfirmedAt: confirmedAt } : {}),
    },
    investigationId: null,
    createdAt: new Date('2026-10-01T12:00:00Z'),
  }
}

async function printDoc(r: Row): Promise<Document> {
  rows = [r]
  const res = await printRoute(
    new NextRequest(`http://localhost/api/lever/actions/${ID}/print`, { headers: { 'x-user-id': 'user-a' } }),
    { params: Promise.resolve({ id: ID }) }
  )
  expect(res.status).toBe(200)
  return new JSDOM(await res.text()).window.document
}

async function exportPdfText(r: Row): Promise<{ letter: string; guidance: string; all: string }> {
  rows = [r]
  const res = await exportRoute(
    new NextRequest('http://localhost/api/lever/export', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': 'user-a' },
      body: JSON.stringify({ actionId: ID, format: 'pdf' }),
    }),
    { params: Promise.resolve({}) }
  )
  expect(res.status).toBe(200)
  const pdf = await readPdf(new Uint8Array(await res.arrayBuffer()))
  const pages = pdf.pages.map((p) => p.items.map((i) => i.str).join(''))
  const g = pages.findIndex((t) => t.startsWith('Not part of your request'))
  expect(g, 'no guidance page').toBeGreaterThan(0)
  return { letter: pages.slice(0, g).join(''), guidance: pages.slice(g).join(''), all: pages.join('') }
}

beforeEach(() => {
  rows = []
})

describe('letterIsClean (A5)', () => {
  const none = parseLetter(MISSING_MARKER_LETTER.content, 'marker-v1')
  const ambiguous = parseLetter(AMBIGUOUS_LETTER.content, 'marker-v1')
  const marker = parseLetter(MARKER_V1_LETTER.content, 'marker-v1')
  const legacy = parseLetter(LEGACY_LETTER.content, undefined)
  const fallback = parseLetter(OVERSIZE_FALLBACK.content, 'marker-v1')

  it('a confirmed final or filed letter with no marker line is clean', () => {
    expect(none.split).toBe('none')
    expect(none.fallback).toBe(false)
    expect(letterIsClean(none, 'final', CONFIRMED_AT)).toBe(true)
    expect(letterIsClean(none, 'filed', CONFIRMED_AT)).toBe(true)
  })

  it('unconfirmed, a draft, an empty or non-string time: still unclean', () => {
    expect(letterIsClean(none, 'final', undefined)).toBe(false)
    expect(letterIsClean(none, 'filed', null)).toBe(false)
    expect(letterIsClean(none, 'draft', CONFIRMED_AT)).toBe(false)
    expect(letterIsClean(none, 'final', '')).toBe(false)
    expect(letterIsClean(none, 'final', true)).toBe(false)
  })

  it('two markers, a fallback parse and legacy text never become clean; a marker split always is', () => {
    expect(letterIsClean(ambiguous, 'final', CONFIRMED_AT)).toBe(false)
    expect(fallback.split).toBe('none')
    expect(fallback.fallback).toBe(true)
    expect(letterIsClean(fallback, 'final', CONFIRMED_AT)).toBe(false)
    expect(letterIsClean(legacy, 'final', CONFIRMED_AT)).toBe(false)
    expect(letterIsClean(marker, 'draft', undefined)).toBe(true)
  })
})

describe('print: a confirmed letter (A5)', () => {
  it('final and confirmed: no notice anywhere, and the whole text is the letter', async () => {
    const doc = await printDoc(row(MISSING_MARKER_LETTER, 'final', CONFIRMED_AT))
    expect(doc.body.textContent).not.toContain(NOTES)
    // Positive sibling: the page did render, with the letter whole.
    expect(doc.querySelector('.letter')!.textContent).toContain('Please send me the final inspection report')
    expect(doc.querySelector('.letter')!.textContent).toContain('Tip: keep a dated copy of this request.')
    expect(doc.querySelector('.guidance-text')).toBeNull()
  })

  it('filed and confirmed: no notice', async () => {
    const doc = await printDoc(row(MISSING_MARKER_LETTER, 'filed', CONFIRMED_AT))
    expect(doc.body.textContent).not.toContain(NOTES)
    expect(doc.querySelector('.letter')!.textContent).toContain('Dear FOI Coordinator,')
  })

  it('the same letter unconfirmed keeps the notice, in the bar and on the guidance page', async () => {
    const doc = await printDoc(row(MISSING_MARKER_LETTER, 'final'))
    expect(doc.querySelector('.screen-bar .notes')!.textContent!.trim()).toBe(UNCLEAN_FINAL)
    expect(doc.querySelector('.guidance-page')!.textContent).toContain(UNCLEAN_FINAL)
  })

  it('a draft carrying the time, a two-marker letter and a fallback keep the notice', async () => {
    expect((await printDoc(row(MISSING_MARKER_LETTER, 'draft', CONFIRMED_AT))).querySelector('.screen-bar')!.textContent).toContain(NOTES)
    expect((await printDoc(row(AMBIGUOUS_LETTER, 'final', CONFIRMED_AT))).querySelector('.screen-bar')!.textContent).toContain(NOTES)
    expect((await printDoc(row(OVERSIZE_FALLBACK, 'final', CONFIRMED_AT))).querySelector('.screen-bar')!.textContent).toContain(NOTES)
  })
})

describe('PDF (export route): a confirmed letter (A5)', () => {
  it('filed and confirmed: no notice on any page, and the whole text is the letter', async () => {
    const pdf = await exportPdfText(row(MISSING_MARKER_LETTER, 'filed', CONFIRMED_AT))
    expect(pdf.all).not.toContain(NOTES)
    expect(squash(pdf.letter)).toContain(squash(MISSING_MARKER_LETTER.expectedLetter))
    // The guidance page still says where to send it.
    expect(pdf.guidance).toContain('Where to send this')
  }, 30_000)

  it('the same letter unconfirmed carries the notice on the guidance page', async () => {
    const pdf = await exportPdfText(row(MISSING_MARKER_LETTER, 'filed'))
    expect(squash(pdf.guidance)).toContain(squash(UNCLEAN_FILED))
  }, 30_000)

  it('a two-marker letter keeps the notice even with the time', async () => {
    const pdf = await exportPdfText(row(AMBIGUOUS_LETTER, 'filed', CONFIRMED_AT))
    expect(squash(pdf.guidance)).toContain(squash(UNCLEAN_FILED))
  }, 30_000)
})
