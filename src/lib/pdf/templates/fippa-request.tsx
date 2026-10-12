import React from 'react'
import { Document, Page, View, Text, StyleSheet, Font } from '@react-pdf/renderer'
import type { Style } from '@react-pdf/types'
import { PageNumberFooter, FOOTER_BAND_TOP } from '../primitives'
import {
  parseLetter,
  blockPrefix,
  uncleanSplitNotice,
  type Block,
  type Inline,
} from '@/lib/lever/letter-blocks'
import { resolveRecipient, type RecipientResolution } from '@/lib/lever/public-body'
import { whereToSendLines, WHERE_TO_SEND_TITLE, ATTRIBUTION_LINE } from '@/lib/lever/recipient-notice'

/*
 * The FOI letter as a PDF (filings design §0-§3, A4).
 *
 * - The letter pages hold the letter part of parseLetter's one parse and
 *   nothing else: no letterhead, date, `[Address]` line, addressee,
 *   signature or wordmark. The template adds no letter parts of its own.
 * - Then a page titled "Not part of your request": the guidance (marker-v1
 *   only), the §2 notes, "Where to send this" (§3) and the attribution, the
 *   only place Open Cave is named (R5).
 * - Pure white pages; blank Author and Creator; placeholder ink #92400E.
 * - A fixed footer, "Page N of M", in a band the body can't enter: the page's
 *   bottom padding ends above the band's top.
 *
 * Nothing is ever inserted into the letter's text. Two react-pdf behaviours
 * are worked around for that (measured on @react-pdf/textkit 6.3.0):
 *
 * 1. textkit treats the boundary between two styled runs with no space
 *    between them as a hyphenation point, and a line broken there gets a "-"
 *    added. Every text node here sets hyphenationPenalty to textkit's
 *    "infinity" (10000), which removes those points from line breaking, so a
 *    line only ever breaks at a space. (Word hyphenation itself is off
 *    globally, `fonts.ts`.)
 * 2. A word wider than the measure is not broken: it runs past the margin and
 *    what doesn't fit on its one line is lost. So the width of every word is
 *    measured with the embedded font's own glyph advances (LetterMetrics),
 *    and a block holding any word wider than its measure (paragraph, heading
 *    and list-item measures each) is broken into lines here, greedily at
 *    spaces, with each too-wide word cut at character boundaries into pieces
 *    that fit. Each line is its own text box, so the layout engine never has
 *    to break one. Nothing is added at a cut. This path is linear in the
 *    text: an earlier flex-wrap row of one box per piece made react-pdf's
 *    page splitting superlinear (Razor C1: 35 s for 100,000 characters).
 */

/** textkit's linebreak "infinity": a penalty of this size is never a break point. */
const NO_BREAK_PENALTY = 10000
const noBreak = { hyphenationPenalty: NO_BREAK_PENALTY } as Record<string, unknown>

/**
 * A word fits a measure when its measured width is at most this share of
 * it. The margin covers what summing per-character advances leaves out
 * (kerning, shaping) so the layout engine never finds a pre-broken line wider
 * than the box it is given.
 */
export const FIT_FACTOR = 0.95

export const PDF_PAPER = {
  ground: '#FFFFFF',
  ink: '#1C1917',
  placeholderInk: '#92400E',
  fontSize: 12,
  lineHeight: 1.5,
  /** 1 inch. */
  margin: 72,
} as const

export const GUIDANCE_PAGE_TITLE = 'Not part of your request'
export const PDF_FALLBACK_NOTE = 'Shown as plain text.'
export const PDF_EMPTY_LETTER_NOTE = 'This letter part is empty.'

const LINE_PT = PDF_PAPER.fontSize * PDF_PAPER.lineHeight
/** US Letter is 612pt wide; the text measure is what the side margins leave. */
export const BODY_MEASURE = 612 - 2 * PDF_PAPER.margin
const PREFIX_MIN = 18
const SECTION_SIZE = 10.5

// ---------------------------------------------------------------------------
// Measuring: the embedded font's own advances
// ---------------------------------------------------------------------------

type FaceKey = 'regular' | 'bold' | 'italic' | 'boldItalic'

interface FontkitFace {
  unitsPerEm: number
  layout(text: string): { advanceWidth: number }
}

/** The width of text in points, for a face at a size. */
export interface LetterMetrics {
  width(text: string, face: FaceKey, fontSize: number): number
}

/**
 * Loads the four Source Serif 4 faces react-pdf will embed (the same font
 * sources, through its own font store) and measures by per-character
 * advance, cached per face.
 */
export async function loadLetterMetrics(): Promise<LetterMetrics> {
  const faces = {} as Record<FaceKey, FontkitFace>
  const want: [FaceKey, number, 'normal' | 'italic'][] = [
    ['regular', 400, 'normal'],
    ['bold', 600, 'normal'],
    ['italic', 400, 'italic'],
    ['boldItalic', 600, 'italic'],
  ]
  for (const [key, fontWeight, fontStyle] of want) {
    const source = Font.getFont({ fontFamily: 'Source Serif 4', fontWeight, fontStyle }) as unknown as {
      load(): Promise<void>
      data: FontkitFace | null
    }
    await source.load()
    if (!source.data) throw new Error(`fippa-request: Source Serif 4 ${key} did not load`)
    faces[key] = source.data
  }
  const cache = new Map<string, number>()
  return {
    width(text, face, fontSize) {
      const f = faces[face]
      let units = 0
      for (const ch of text) {
        const k = face + ch
        let w = cache.get(k)
        if (w === undefined) {
          w = f.layout(ch).advanceWidth
          cache.set(k, w)
        }
        units += w
      }
      return (units / f.unitsPerEm) * fontSize
    },
  }
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Source Serif 4',
    fontSize: PDF_PAPER.fontSize,
    lineHeight: PDF_PAPER.lineHeight,
    color: PDF_PAPER.ink,
    backgroundColor: PDF_PAPER.ground,
    paddingTop: PDF_PAPER.margin,
    // Reserved: the body ends a full inch above the page edge, well above the
    // footer band's top (FOOTER_BAND_TOP), so body text can't enter the band.
    paddingBottom: PDF_PAPER.margin,
    paddingHorizontal: PDF_PAPER.margin,
  },
  heading: { fontWeight: 600 },
  item: { flexDirection: 'row' },
  prefix: { flexShrink: 0, minWidth: 18 },
  itemBody: { flex: 1 },
  blank: { height: LINE_PT },
  strong: { fontWeight: 600 },
  em: { fontStyle: 'italic' },
  placeholder: { color: PDF_PAPER.placeholderInk },
  guidanceTitle: { fontSize: 15, fontWeight: 600, marginBottom: 12 },
  guidance: { marginBottom: 12 },
  section: { marginTop: 14, fontSize: 10.5, color: '#44403c' },
  sectionTitle: { fontSize: 10.5, fontWeight: 600, color: PDF_PAPER.ink },
  sectionLine: { marginTop: 4 },
})

// The band the body must stay out of is FOOTER_BAND_TOP points high; the
// page's bottom padding must exceed it.
if (PDF_PAPER.margin <= FOOTER_BAND_TOP) {
  throw new Error('fippa-request: the bottom padding must clear the footer band')
}

export interface FippaRequestData {
  title: string
  content: string
  metadata?: Record<string, unknown>
  /** The action's status; it words the §2 notice. Defaults to draft. */
  status?: 'draft' | 'final' | 'filed'
  /**
   * The resolver's answer for this action, with its investigation. Without
   * one, the action's own metadata is resolved alone (no investigation).
   */
  recipient?: RecipientResolution
  /** Glyph metrics (loadLetterMetrics); renderLeverPdf loads them. */
  metrics: LetterMetrics
}

export function FippaRequestTemplate({ data }: { data: FippaRequestData }) {
  const metadata = data.metadata ?? {}
  const format = metadata.letterFormat
  const status = data.status ?? 'draft'
  const parsed = parseLetter(data.content, format)
  const recipient = data.recipient ?? resolveRecipient({ metadata })

  const clean = parsed.split === 'marker' && !parsed.fallback
  const notes: string[] = []
  if (!clean) notes.push(uncleanSplitNotice(status))
  if (parsed.fallback) notes.push(PDF_FALLBACK_NOTE)
  if (parsed.letter.length === 0) notes.push(PDF_EMPTY_LETTER_NOTE)

  const where = whereToSendLines(recipient, data.content, format)
  const m: Measure = { metrics: data.metrics, fontSize: PDF_PAPER.fontSize, measure: BODY_MEASURE, bold: false }

  return (
    // R5 and A4: no Author, no Creator, nothing that names Open Cave in the
    // file's metadata. The title is the citizen's own.
    <Document title={data.title} author="" creator="">
      <Page size="LETTER" style={styles.page}>
        <View>
          {parsed.letter.map((b, i) => (
            <PdfBlock key={i} block={b} placeholders m={m} />
          ))}
        </View>
        <PageNumberFooter insetX={PDF_PAPER.margin} />
      </Page>

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.guidanceTitle} {...noBreak}>
          {GUIDANCE_PAGE_TITLE}
        </Text>
        {parsed.guidance && (
          <View style={styles.guidance}>
            {parsed.guidance.map((b, i) => (
              <PdfBlock key={i} block={b} placeholders={false} m={m} />
            ))}
          </View>
        )}
        {notes.map((n) => (
          <Text key={n} style={styles.section} {...noBreak}>
            {n}
          </Text>
        ))}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} {...noBreak}>
            {WHERE_TO_SEND_TITLE}
          </Text>
          {where.map((line, i) => (
            <PdfLine
              key={i}
              inlines={[{ kind: 'text', text: line }]}
              style={styles.sectionLine}
              placeholders={false}
              m={{ ...m, fontSize: SECTION_SIZE }}
            />
          ))}
        </View>
        <Text style={styles.section} {...noBreak}>
          {ATTRIBUTION_LINE}
        </Text>
        <PageNumberFooter insetX={PDF_PAPER.margin} />
      </Page>
    </Document>
  )
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

/** How a line is measured: the metrics, its size, its box width, and whether its base face is bold. */
interface Measure {
  metrics: LetterMetrics
  fontSize: number
  measure: number
  bold: boolean
}

function PdfBlock({ block, placeholders, m }: { block: Block; placeholders: boolean; m: Measure }) {
  switch (block.kind) {
    case 'heading':
      return <PdfLine inlines={block.inlines} style={styles.heading} placeholders={placeholders} m={{ ...m, bold: true }} />
    case 'rule':
      // An empty line, as its projection is "". Unlike the screen, the PDF
      // draws no hairline: its pages are tested to be pure white outside the
      // glyphs, and nothing but the letter's own text is drawn on them.
      return <View style={styles.blank} />
    case 'bullet':
    case 'numbered': {
      const prefix = blockPrefix(block)
      // The prefix box is at least PREFIX_MIN wide and grows with its text;
      // the item's text gets the rest of the measure.
      const prefixWidth = Math.max(PREFIX_MIN, m.metrics.width(prefix, 'regular', m.fontSize))
      return (
        <View style={styles.item} wrap>
          <Text style={[styles.prefix, { width: prefixWidth }]} {...noBreak}>
            {prefix}
          </Text>
          <View style={styles.itemBody}>
            <PdfLine inlines={block.inlines} placeholders={placeholders} m={{ ...m, measure: m.measure - prefixWidth }} />
          </View>
        </View>
      )
    }
    case 'line':
      return block.inlines.length === 0 ? (
        <View style={styles.blank} />
      ) : (
        <PdfLine inlines={block.inlines} placeholders={placeholders} m={m} />
      )
    case 'verbatim':
      // The fallback: the whole text, untouched, one line per line.
      return (
        <View>
          {block.text.replace(/\r\n/g, '\n').split('\n').map((line, i) =>
            line === '' ? (
              <View key={i} style={styles.blank} />
            ) : (
              <PdfLine key={i} inlines={[{ kind: 'text', text: line }]} placeholders={false} m={m} />
            )
          )}
        </View>
      )
  }
}

// ---------------------------------------------------------------------------
// Lines: inline runs flattened to styled pieces
// ---------------------------------------------------------------------------

type PieceStyle = 'strong' | 'em' | 'placeholder'

interface Piece {
  text: string
  marks: PieceStyle[]
}

/**
 * The line's inlines as flat styled pieces whose texts concatenate to the
 * block's projection: a link is its text then " (url)".
 */
export function flattenInlines(inlines: Inline[], marks: PieceStyle[] = []): Piece[] {
  const out: Piece[] = []
  for (const inl of inlines) {
    switch (inl.kind) {
      case 'text':
        out.push({ text: inl.text, marks })
        break
      case 'placeholder':
        out.push({ text: inl.text, marks: [...marks, 'placeholder'] })
        break
      case 'strong':
        out.push(...flattenInlines(inl.children, [...marks, 'strong']))
        break
      case 'em':
        out.push(...flattenInlines(inl.children, [...marks, 'em']))
        break
      case 'link':
        out.push(...flattenInlines(inl.children, marks))
        out.push({ text: ` (${inl.url})`, marks })
        break
    }
  }
  return out.filter((p) => p.text.length > 0)
}

interface Glyph {
  ch: string
  marks: PieceStyle[]
  width: number
}

function faceOf(marks: PieceStyle[], bold: boolean): FaceKey {
  const b = bold || marks.includes('strong')
  const i = marks.includes('em')
  return b ? (i ? 'boldItalic' : 'bold') : i ? 'italic' : 'regular'
}

/**
 * Break a line's pieces into lines that each fit `m.measure`, or return null
 * when no word is too wide and the block fits on a page (the layout engine
 * then wraps at spaces itself).
 *
 * Greedy: words, each with the spaces after it, fill a line while they fit;
 * a word wider than the measure starts a new line and is cut at character
 * boundaries (by code point, so no surrogate pair is split) into pieces that
 * each fit. Every character lands in exactly one line, in order, and nothing
 * is added. Linear in the line's length.
 */
export function breakToFit(pieces: Piece[], m: Measure): Piece[][] | null {
  const limit = m.measure * FIT_FACTOR
  const glyphs: Glyph[] = []
  for (const p of pieces) {
    const face = faceOf(p.marks, m.bold)
    for (const ch of p.text) glyphs.push({ ch, marks: p.marks, width: m.metrics.width(ch, face, m.fontSize) })
  }

  // Words: [start, wordEnd) non-space, [wordEnd, spaceEnd) spaces.
  const words: { start: number; wordEnd: number; spaceEnd: number; width: number }[] = []
  let tooWide = false
  let total = 0
  for (let i = 0; i < glyphs.length; ) {
    let wordEnd = i
    let width = 0
    while (wordEnd < glyphs.length && glyphs[wordEnd].ch !== ' ') width += glyphs[wordEnd++].width
    let spaceEnd = wordEnd
    while (spaceEnd < glyphs.length && glyphs[spaceEnd].ch === ' ') spaceEnd++
    if (width > limit) tooWide = true
    for (let k = i; k < spaceEnd; k++) total += glyphs[k].width
    words.push({ start: i, wordEnd, spaceEnd, width })
    i = spaceEnd
  }
  // A paragraph that would run past a page is broken here too: react-pdf
  // re-lays a text node for every page it cuts it at, so one long node costs
  // its lines times its pages (Razor C1: 19 s for one 100,000-character
  // paragraph). As one box per line it splits like any other block.
  if (!tooWide && Math.ceil(total / m.measure) <= LINES_PER_PAGE) return null

  const lines: Glyph[][] = [[]]
  let used = 0
  const newLine = () => {
    lines.push([])
    used = 0
  }
  for (const w of words) {
    const spaces = glyphs.slice(w.wordEnd, w.spaceEnd)
    const spaceWidth = spaces.reduce((n, g) => n + g.width, 0)
    if (w.width <= limit) {
      if (used > 0 && used + w.width > limit) newLine()
      lines[lines.length - 1].push(...glyphs.slice(w.start, w.spaceEnd))
      used += w.width + spaceWidth
      continue
    }
    if (used > 0) newLine()
    for (let k = w.start; k < w.wordEnd; k++) {
      const g = glyphs[k]
      if (used > 0 && used + g.width > limit) newLine()
      lines[lines.length - 1].push(g)
      used += g.width
    }
    lines[lines.length - 1].push(...spaces)
    used += spaceWidth
  }

  // Re-group each line's characters into runs of equal marks.
  return lines
    .filter((l) => l.length > 0)
    .map((line) => {
      const runs: Piece[] = []
      for (const g of line) {
        const last = runs[runs.length - 1]
        if (last && last.marks.join() === g.marks.join()) last.text += g.ch
        else runs.push({ text: g.ch, marks: g.marks })
      }
      return runs
    })
}

function pieceStyle(marks: PieceStyle[]) {
  return marks.map((mk) => styles[mk])
}

function Runs({ pieces }: { pieces: Piece[] }) {
  return (
    <>
      {pieces.map((p, i) =>
        p.marks.length === 0 ? (
          <React.Fragment key={i}>{p.text}</React.Fragment>
        ) : (
          <Text key={i} style={pieceStyle(p.marks)} {...noBreak}>
            {p.text}
          </Text>
        )
      )}
    </>
  )
}

function PdfLine({
  inlines,
  style,
  placeholders,
  m,
}: {
  inlines: Inline[]
  style?: Style
  placeholders: boolean
  m: Measure
}) {
  let pieces = flattenInlines(inlines)
  // Guidance has no placeholders (the parser yields none there); this keeps
  // the ink off any that a caller passes anyway.
  if (!placeholders) pieces = pieces.map((p) => ({ ...p, marks: p.marks.filter((mk) => mk !== 'placeholder') }))

  const lines = breakToFit(pieces, m)
  if (!lines) {
    return (
      <Text style={style} {...noBreak}>
        <Runs pieces={pieces} />
      </Text>
    )
  }
  return (
    <View style={style}>
      {lines.map((line, i) => (
        <Text key={i} {...noBreak}>
          <Runs pieces={line} />
        </Text>
      ))}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Render cost, estimated before rendering (Razor C1)
// ---------------------------------------------------------------------------

/*
 * react-pdf lays a document out synchronously, and its page splitting
 * re-lays the rest of a <Page>'s children for every page it cuts, so its time
 * grows with (nodes in a Page) x (pages that Page fills). A timer can't stop
 * it: nothing yields until it is done. So the export route asks first: this
 * estimate counts the nodes the template will create and the lines they will
 * fill, per <Page> element, exactly as the template lays them out, and the
 * route refuses a letter over RENDER_COST_LIMIT with its 503 before any
 * layout starts.
 *
 * The limit is set from measurements across letter shapes (prose, short
 * lines, blank lines, bullets, one long token, long URLs, wide glyphs) under
 * `taskset -c 0` with a 1 GB heap; see the A4 report's fix-pass table.
 */
export const RENDER_COST_LIMIT = 20_000

/** Lines of text a page holds: its height less the margins, over the line height. */
const LINES_PER_PAGE = Math.floor((792 - 2 * PDF_PAPER.margin) / LINE_PT)

interface Tally {
  nodes: number
  lines: number
}

function marked(pieces: Piece[]): number {
  return pieces.filter((p) => p.marks.length > 0).length
}

function tallyLine(inlines: Inline[], m: Measure, t: Tally) {
  const pieces = flattenInlines(inlines)
  const broken = breakToFit(pieces, m)
  if (broken) {
    t.nodes += 1 + broken.length + broken.reduce((n, l) => n + marked(l), 0)
    t.lines += broken.length
    return
  }
  let width = 0
  for (const p of pieces) width += m.metrics.width(p.text, faceOf(p.marks, m.bold), m.fontSize)
  t.nodes += 1 + marked(pieces)
  t.lines += Math.max(1, Math.ceil(width / m.measure))
}

function tallyBlocks(blocks: Block[], m: Measure, t: Tally) {
  for (const b of blocks) {
    switch (b.kind) {
      case 'heading':
        tallyLine(b.inlines, { ...m, bold: true }, t)
        break
      case 'rule':
        t.nodes += 1
        t.lines += 1
        break
      case 'bullet':
      case 'numbered': {
        const prefixWidth = Math.max(PREFIX_MIN, m.metrics.width(blockPrefix(b), 'regular', m.fontSize))
        t.nodes += 3
        tallyLine(b.inlines, { ...m, measure: m.measure - prefixWidth }, t)
        break
      }
      case 'line':
        if (b.inlines.length === 0) {
          t.nodes += 1
          t.lines += 1
        } else tallyLine(b.inlines, m, t)
        break
      case 'verbatim':
        t.nodes += 1
        for (const line of b.text.replace(/\r\n/g, '\n').split('\n')) {
          if (line === '') {
            t.nodes += 1
            t.lines += 1
          } else tallyLine([{ kind: 'text', text: line }], m, t)
        }
        break
    }
  }
}

/** The estimate: for each <Page> element, its nodes times the pages it fills. */
export function estimateRenderCost(content: string, letterFormat: unknown, metrics: LetterMetrics): number {
  const parsed = parseLetter(content, letterFormat)
  const m: Measure = { metrics, fontSize: PDF_PAPER.fontSize, measure: BODY_MEASURE, bold: false }
  const letter: Tally = { nodes: 2, lines: 0 }
  tallyBlocks(parsed.letter, m, letter)
  // The guidance page: its own blocks plus a fixed set of short notes,
  // "Where to send this" and the attribution (counted generously).
  const guidance: Tally = { nodes: 16, lines: 14 }
  if (parsed.guidance) tallyBlocks(parsed.guidance, m, guidance)
  const pages = (t: Tally) => Math.max(1, Math.ceil(t.lines / LINES_PER_PAGE))
  return letter.nodes * pages(letter) + guidance.nodes * pages(guidance)
}
