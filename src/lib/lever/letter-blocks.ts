/**
 * One parse for every letter renderer (screen, print, and in A4 the PDF).
 *
 * The rules are the plan's "filings design" §1 and §2, and nothing else:
 *
 * §1  A small, explicit markdown subset, evaluated per line (nothing spans
 *     lines). Headings, rules, list items, strong/emphasis and links are
 *     recognised; everything else is literal. No backslash escapes. CRLF is
 *     read as LF. The projection of a block is plain text, and a part's
 *     projection is its blocks' projections joined with "\n". Nothing is
 *     trimmed.
 *
 * §2  The letter and its guidance are split only for a recorded `marker-v1`
 *     letter with exactly one line that is exactly the marker (after trimming
 *     trailing whitespace). Legacy text (no recorded format) is never split,
 *     even when it contains the marker string.
 *
 * The hand-written goldens in tests/fixtures/letters.ts are the oracle for all
 * of this. If this file and a golden disagree, this file is wrong.
 *
 * parseLetter never throws. Over 200,000 characters, a non-string, or any
 * internal error, it returns `fallback: true` with one verbatim block holding
 * the whole text, unsplit: lossless by construction.
 */

import { esc as escapeHtml } from '@/lib/campaign/print-utils'

/**
 * HTML escaping for every string a renderer inserts. A re-export of the
 * campaign print escaper, not a second implementation: one escaper, one set
 * of tests.
 */
export { escapeHtml }

export const GUIDANCE_MARKER = '=== NOT PART OF YOUR REQUEST ==='

/** Inputs longer than this are not parsed (§1 "Bounds and failure"). */
export const MAX_PARSE_LENGTH = 200_000

/** The notice §2 puts outside any letter that is not a clean split. */
export const UNCLEAN_SPLIT_NOTICE =
  "This letter may include notes that aren't part of your request. Read it through and remove anything that isn't before you send it."

export type LetterSplit = 'marker' | 'none' | 'ambiguous' | 'legacy'

export type Inline =
  | { kind: 'text'; text: string }
  /** A `[...]` span that is not a link's text. `text` keeps its brackets. */
  | { kind: 'placeholder'; text: string }
  | { kind: 'strong'; children: Inline[] }
  | { kind: 'em'; children: Inline[] }
  | { kind: 'link'; children: Inline[]; url: string }

export type Block =
  | { kind: 'heading'; level: number; inlines: Inline[] }
  | { kind: 'rule' }
  | { kind: 'bullet'; inlines: Inline[] }
  /** `number` is the digits exactly as written; lists are never renumbered. */
  | { kind: 'numbered'; number: string; inlines: Inline[] }
  /** Any other line. An empty line has no inlines. */
  | { kind: 'line'; inlines: Inline[] }
  /** Fallback only: the whole input, untouched. */
  | { kind: 'verbatim'; text: string }

export interface ParsedLetter {
  letter: Block[]
  /** The part after the marker; null unless `split` is 'marker'. */
  guidance: Block[] | null
  split: LetterSplit
  /** `[...]` placeholders in the LETTER part only. */
  placeholders: number
  fallback: boolean
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Parse stored letter text. `format` is `metadata.letterFormat`, passed by the
 * caller explicitly; anything other than the string 'marker-v1' is legacy.
 */
export function parseLetter(content: unknown, format: unknown): ParsedLetter {
  if (typeof content !== 'string') {
    return fallbackResult(content == null ? '' : String(content), format)
  }
  if (content.length > MAX_PARSE_LENGTH) {
    return fallbackResult(content, format)
  }
  try {
    return parseUnchecked(content, format === 'marker-v1')
  } catch (err) {
    // Never thrown to a caller (§1). The fallback is lossless, and the error is
    // logged so a parser defect is visible rather than silently plain text.
    console.error('[letter-blocks] parse failed; rendering as plain text:', err)
    return fallbackResult(content, format)
  }
}

function fallbackResult(text: string, format: unknown): ParsedLetter {
  return {
    letter: [{ kind: 'verbatim', text }],
    guidance: null,
    // Not a clean split, so every renderer shows the §2 notice.
    split: format === 'marker-v1' ? 'none' : 'legacy',
    placeholders: 0,
    fallback: true,
  }
}

function parseUnchecked(content: string, markerV1: boolean): ParsedLetter {
  const lines = content.replace(/\r\n/g, '\n').split('\n')

  let split: LetterSplit = 'legacy'
  let letterLines = lines
  let guidanceLines: string[] | null = null

  if (markerV1) {
    const markerAt: number[] = []
    lines.forEach((line, i) => {
      if (line.trimEnd() === GUIDANCE_MARKER) markerAt.push(i)
    })
    if (markerAt.length === 1) {
      split = 'marker'
      letterLines = lines.slice(0, markerAt[0])
      guidanceLines = lines.slice(markerAt[0] + 1)
    } else {
      split = markerAt.length === 0 ? 'none' : 'ambiguous'
    }
  }

  const letter = letterLines.map(parseBlock)
  const guidance = guidanceLines ? guidanceLines.map(parseBlock) : null

  return {
    letter,
    guidance,
    split,
    placeholders: countPlaceholders(letter),
    fallback: false,
  }
}

// ---------------------------------------------------------------------------
// Blocks (one per line)
// ---------------------------------------------------------------------------

const HEADING = /^(#{1,6}) (.*)$/
const RULE = /^ *(?:---|\*\*\*) *$/
const BULLET = /^- (.*)$/
const NUMBERED = /^(\d+)\. (.*)$/

function parseBlock(line: string): Block {
  let m: RegExpExecArray | null
  if ((m = HEADING.exec(line))) return { kind: 'heading', level: m[1].length, inlines: parseInline(m[2]) }
  if (RULE.test(line)) return { kind: 'rule' }
  if ((m = BULLET.exec(line))) return { kind: 'bullet', inlines: parseInline(m[1]) }
  if ((m = NUMBERED.exec(line))) return { kind: 'numbered', number: m[1], inlines: parseInline(m[2]) }
  return { kind: 'line', inlines: parseInline(line) }
}

// ---------------------------------------------------------------------------
// Inlines
// ---------------------------------------------------------------------------

/** Characters an emphasis opener may follow, besides a space (§1). */
const OPENER_PRECEDERS = new Set(['(', '[', '"', "'"])
/** Characters a closing marker may be followed by, besides a space or end of line (§1). */
const CLOSER_FOLLOWERS = new Set(['.', ',', ';', ':', '!', '?', ')', ']', '"', "'"])
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u
const WHITESPACE = /\s/

function isOpenerPosition(s: string, i: number): boolean {
  if (i === 0) return true
  const prev = s[i - 1]
  return prev === ' ' || OPENER_PRECEDERS.has(prev)
}

function isCloserFollower(ch: string | undefined): boolean {
  return ch === undefined || ch === ' ' || CLOSER_FOLLOWERS.has(ch)
}

/**
 * Try `**x**` (width 2) or `*x*` (width 1) opening at i. Returns the inner
 * text and the index just past the closer, or null.
 *
 * The span may contain no other `*`, so the only possible closer is the first
 * `*` after the opener.
 */
function matchEmphasis(s: string, i: number, width: 1 | 2): { inner: string; end: number } | null {
  if (width === 2 && s[i + 1] !== '*') return null
  const first = s[i + width]
  if (first === undefined || !LETTER_OR_DIGIT.test(first)) return null
  const close = s.indexOf('*', i + width)
  if (close === -1) return null
  if (width === 2 && s[close + 1] !== '*') return null
  if (WHITESPACE.test(s[close - 1])) return null
  if (!isCloserFollower(s[close + width])) return null
  return { inner: s.slice(i + width, close), end: close + width }
}

/**
 * Try `[text](url)` at i: text has no brackets, url has balanced parentheses,
 * no whitespace, and is not empty.
 */
function matchLink(s: string, i: number): { text: string; url: string; end: number } | null {
  const closeBracket = s.indexOf(']', i + 1)
  if (closeBracket === -1) return null
  const text = s.slice(i + 1, closeBracket)
  if (text.includes('[')) return null
  if (s[closeBracket + 1] !== '(') return null
  let depth = 1
  let j = closeBracket + 2
  for (; j < s.length; j++) {
    const ch = s[j]
    if (WHITESPACE.test(ch)) return null
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth === 0) break
    }
  }
  if (depth !== 0) return null
  const url = s.slice(closeBracket + 2, j)
  if (url === '') return null
  return { text, url, end: j + 1 }
}

const PLACEHOLDER = /\[[^[\]\n]+\]/g

function textWithPlaceholders(text: string, allowPlaceholders: boolean): Inline[] {
  if (!allowPlaceholders) return [{ kind: 'text', text }]
  const out: Inline[] = []
  let last = 0
  for (const m of text.matchAll(PLACEHOLDER)) {
    const at = m.index ?? 0
    if (at > last) out.push({ kind: 'text', text: text.slice(last, at) })
    out.push({ kind: 'placeholder', text: m[0] })
    last = at + m[0].length
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) })
  return out
}

/** Left-to-right scan of one line's text. A link's text holds no placeholders. */
function parseInline(s: string, allowPlaceholders = true): Inline[] {
  const out: Inline[] = []
  let buf = ''
  const flush = () => {
    if (buf) out.push(...textWithPlaceholders(buf, allowPlaceholders))
    buf = ''
  }

  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (ch === '[') {
      const link = matchLink(s, i)
      if (link) {
        flush()
        out.push({ kind: 'link', url: link.url, children: parseInline(link.text, false) })
        i = link.end
        continue
      }
    } else if (ch === '*' && isOpenerPosition(s, i)) {
      const strong = matchEmphasis(s, i, 2)
      if (strong) {
        flush()
        out.push({ kind: 'strong', children: parseInline(strong.inner, allowPlaceholders) })
        i = strong.end
        continue
      }
      const em = matchEmphasis(s, i, 1)
      if (em) {
        flush()
        out.push({ kind: 'em', children: parseInline(em.inner, allowPlaceholders) })
        i = em.end
        continue
      }
    }
    buf += ch
    i++
  }
  flush()
  return out
}

function countInlinePlaceholders(inlines: Inline[]): number {
  let n = 0
  for (const inl of inlines) {
    if (inl.kind === 'placeholder') n++
    else if (inl.kind === 'strong' || inl.kind === 'em') n += countInlinePlaceholders(inl.children)
    // A link's text is a link, never a placeholder.
  }
  return n
}

function countPlaceholders(blocks: Block[]): number {
  let n = 0
  for (const b of blocks) {
    if (b.kind === 'heading' || b.kind === 'bullet' || b.kind === 'numbered' || b.kind === 'line') {
      n += countInlinePlaceholders(b.inlines)
    }
  }
  return n
}

// ---------------------------------------------------------------------------
// Projection (the plain text every renderer's letter must equal)
// ---------------------------------------------------------------------------

export const BULLET_GLYPH = '•'

export function projectInlines(inlines: Inline[]): string {
  return inlines
    .map((inl) => {
      switch (inl.kind) {
        case 'text':
        case 'placeholder':
          return inl.text
        case 'strong':
        case 'em':
          return projectInlines(inl.children)
        case 'link':
          return `${projectInlines(inl.children)} (${inl.url})`
      }
    })
    .join('')
}

/** The block's text without its list prefix (used by renderers that draw the prefix themselves). */
export function blockPrefix(block: Block): string {
  if (block.kind === 'bullet') return `${BULLET_GLYPH} `
  if (block.kind === 'numbered') return `${block.number}. `
  return ''
}

export function projectBlock(block: Block): string {
  switch (block.kind) {
    case 'rule':
      return ''
    case 'verbatim':
      return block.text
    default:
      return blockPrefix(block) + projectInlines(block.inlines)
  }
}

export function projectBlocks(blocks: Block[]): string {
  return blocks.map(projectBlock).join('\n')
}

// ---------------------------------------------------------------------------
// HTML (print, and anything else that needs markup as a string)
// ---------------------------------------------------------------------------

/**
 * Inline HTML. Every inserted string goes through escapeHtml. A link is
 * rendered as text, "text (url)", never as an anchor: the letter is a filing,
 * and a stored `javascript:` URL must never become clickable.
 */
export function inlinesToHtml(inlines: Inline[]): string {
  return inlines
    .map((inl) => {
      switch (inl.kind) {
        case 'text':
          return escapeHtml(inl.text)
        case 'placeholder':
          return `<mark class="ph">${escapeHtml(inl.text)}</mark>`
        case 'strong':
          return `<strong>${inlinesToHtml(inl.children)}</strong>`
        case 'em':
          return `<em>${inlinesToHtml(inl.children)}</em>`
        case 'link':
          return `${inlinesToHtml(inl.children)} (<span class="url">${escapeHtml(inl.url)}</span>)`
      }
    })
    .join('')
}

/**
 * One HTML element per block, so the element's textContent is exactly that
 * block's projection and the part's projection is the elements' text joined
 * with "\n". A heading keeps its level as h2-h6 (h1 is the page's own) and
 * a rule renders as an empty line, as its projection is empty.
 */
export function blocksToHtml(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.kind) {
        case 'heading': {
          const level = Math.min(6, b.level + 1)
          return `<h${level} class="lb lb-h">${inlinesToHtml(b.inlines)}</h${level}>`
        }
        case 'rule':
          return '<p class="lb lb-blank"></p>'
        case 'bullet':
        case 'numbered':
          return `<p class="lb lb-item">${escapeHtml(blockPrefix(b))}${inlinesToHtml(b.inlines)}</p>`
        case 'line':
          return b.inlines.length === 0
            ? '<p class="lb lb-blank"></p>'
            : `<p class="lb">${inlinesToHtml(b.inlines)}</p>`
        case 'verbatim':
          return `<pre class="lb lb-verbatim">${escapeHtml(b.text)}</pre>`
      }
    })
    .join('\n')
}
