import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
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
 *    what doesn't fit on its one line is lost. So a line holding any token
 *    longer than OVERSIZE_TOKEN characters is laid out as a wrapping row of
 *    separate text boxes, one per word, with each oversize token cut at
 *    character boundaries into CHUNK-character pieces, so the layout engine
 *    can wrap between them. Nothing is added at a cut.
 */

/** textkit's linebreak "infinity": a penalty of this size is never a break point. */
const NO_BREAK_PENALTY = 10000
const noBreak = { hyphenationPenalty: NO_BREAK_PENALTY } as Record<string, unknown>

/** Tokens longer than this are pre-chunked (A4 "Oversize tokens"). */
export const OVERSIZE_TOKEN = 60
/**
 * The piece length an oversize token is cut into. At 12pt, 30 characters of
 * even 1em-wide glyphs are 360pt, inside the 468pt measure.
 */
export const CHUNK = 30

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
  row: { flexDirection: 'row', flexWrap: 'wrap' },
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

  return (
    // R5 and A4: no Author, no Creator, nothing that names Open Cave in the
    // file's metadata. The title is the citizen's own.
    <Document title={data.title} author="" creator="">
      <Page size="LETTER" style={styles.page}>
        <View>
          {parsed.letter.map((b, i) => (
            <PdfBlock key={i} block={b} placeholders />
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
              <PdfBlock key={i} block={b} placeholders={false} />
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
            <PdfLine key={i} inlines={[{ kind: 'text', text: line }]} style={styles.sectionLine} placeholders={false} />
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

function PdfBlock({ block, placeholders }: { block: Block; placeholders: boolean }) {
  switch (block.kind) {
    case 'heading':
      return <PdfLine inlines={block.inlines} style={styles.heading} placeholders={placeholders} />
    case 'rule':
      // An empty line, as its projection is "". Unlike the screen, the PDF
      // draws no hairline: its pages are tested to be pure white outside the
      // glyphs, and nothing but the letter's own text is drawn on them.
      return <View style={styles.blank} />
    case 'bullet':
    case 'numbered':
      return (
        <View style={styles.item} wrap>
          <Text style={styles.prefix} {...noBreak}>
            {blockPrefix(block)}
          </Text>
          <View style={styles.itemBody}>
            <PdfLine inlines={block.inlines} placeholders={placeholders} />
          </View>
        </View>
      )
    case 'line':
      return block.inlines.length === 0 ? (
        <View style={styles.blank} />
      ) : (
        <PdfLine inlines={block.inlines} placeholders={placeholders} />
      )
    case 'verbatim':
      // The fallback: the whole text, untouched, one line per line.
      return (
        <View>
          {block.text.replace(/\r\n/g, '\n').split('\n').map((line, i) =>
            line === '' ? (
              <View key={i} style={styles.blank} />
            ) : (
              <PdfLine key={i} inlines={[{ kind: 'text', text: line }]} placeholders={false} />
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

function hasOversizeToken(pieces: Piece[]): boolean {
  const text = pieces.map((p) => p.text).join('')
  let run = 0
  for (const ch of text) {
    run = ch === ' ' ? 0 : run + 1
    if (run > OVERSIZE_TOKEN) return true
  }
  return false
}

/**
 * Cut a line's pieces into wrap segments: each word with the spaces after it,
 * and any word longer than OVERSIZE_TOKEN characters cut into CHUNK-character
 * pieces (by code point, so no surrogate pair is split). Every character
 * lands in exactly one segment, in order.
 */
export function wrapSegments(pieces: Piece[]): Piece[][] {
  // One entry per code point, keeping its piece's marks.
  const chars: { ch: string; marks: PieceStyle[] }[] = []
  for (const p of pieces) for (const ch of p.text) chars.push({ ch, marks: p.marks })

  const segments: { ch: string; marks: PieceStyle[] }[][] = []
  let i = 0
  while (i < chars.length) {
    let wordEnd = i
    while (wordEnd < chars.length && chars[wordEnd].ch !== ' ') wordEnd++
    let spaceEnd = wordEnd
    while (spaceEnd < chars.length && chars[spaceEnd].ch === ' ') spaceEnd++
    const wordLength = wordEnd - i
    if (wordLength > OVERSIZE_TOKEN) {
      for (let at = i; at < wordEnd; at += CHUNK) {
        const end = Math.min(at + CHUNK, wordEnd)
        // The spaces after the word ride on its last piece.
        segments.push(chars.slice(at, end === wordEnd ? spaceEnd : end))
      }
    } else {
      segments.push(chars.slice(i, spaceEnd))
    }
    i = spaceEnd
  }

  // Re-group each segment's characters into runs of equal marks.
  return segments.map((seg) => {
    const runs: Piece[] = []
    for (const c of seg) {
      const last = runs[runs.length - 1]
      if (last && last.marks.join() === c.marks.join()) last.text += c.ch
      else runs.push({ text: c.ch, marks: c.marks })
    }
    return runs
  })
}

function pieceStyle(marks: PieceStyle[]) {
  return marks.map((m) => styles[m])
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
}: {
  inlines: Inline[]
  style?: Style
  placeholders: boolean
}) {
  let pieces = flattenInlines(inlines)
  // Guidance has no placeholders (the parser yields none there); this keeps
  // the ink off any that a caller passes anyway.
  if (!placeholders) pieces = pieces.map((p) => ({ ...p, marks: p.marks.filter((m) => m !== 'placeholder') }))

  if (!hasOversizeToken(pieces)) {
    return (
      <Text style={style} {...noBreak}>
        <Runs pieces={pieces} />
      </Text>
    )
  }
  return (
    <View style={style ? [styles.row, style] : styles.row}>
      {wrapSegments(pieces).map((seg, i) => (
        <Text key={i} {...noBreak}>
          <Runs pieces={seg} />
        </Text>
      ))}
    </View>
  )
}
