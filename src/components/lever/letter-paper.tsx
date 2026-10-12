import { Fragment, useMemo, type ReactNode } from 'react'
import {
  parseLetter,
  blockPrefix,
  uncleanSplitNotice,
  type Block,
  type Inline,
} from '@/lib/lever/letter-blocks'

/*
 * The FOI letter on screen (filings §1-2, A1 "Screen").
 *
 * - A paper island, 672px wide, pure white (R5), Source Serif 4 at 17/1.5.
 *   Below 640px it runs full-bleed to the screen edges.
 * - The letter is the projection of parseLetter's letter part: one element per
 *   block, so the paper's text is exactly the golden projection. A link is
 *   text, "text (url)", never an anchor.
 * - Placeholders (letter part only) are <mark> in the paper's own ink.
 * - Everything that is not the letter sits outside the paper: the §2 notice,
 *   the plain-text and empty-letter notes, and the guidance (marker-v1 only).
 *
 * The paper's colours are fixed, not theme tokens: the paper is light in a
 * dark app by doctrine ("dark where you work, light where you read"), and
 * these are the plan's exact values. D1 moves them into the shared paper-ink
 * tokens with the PDF.
 */
const PAPER = {
  width: 672,
  fontSize: 17,
  lineHeight: 1.5,
  ground: '#FFFFFF',
  ink: '#1C1917',
  // The rule hairline is #A8A29E, written as a class (it styles ::before).
  markBg: '#FDF2D0',
  markInk: '#6B3A06',
} as const

export const EMPTY_LETTER_NOTE = 'This letter part is empty.'
export const FALLBACK_NOTE = 'Shown as plain text.'
export const UNREADABLE_NOTE = "This letter can't be shown. Reload the page; if it still fails, use Export, then Plain text."

interface LetterPaperProps {
  /** The stored text, exactly as saved. */
  content: unknown
  /** `metadata.letterFormat`, passed through untouched. */
  letterFormat: unknown
  /** The action's status; it words the §2 notice. */
  status: 'draft' | 'final' | 'filed'
}

export function LetterPaper({ content, letterFormat, status }: LetterPaperProps) {
  // Parse once per (content, format), not on every re-render of the viewer
  // (menu toggles, busy states). Razor C1.
  const parsed = useMemo(() => parseLetter(content, letterFormat), [content, letterFormat])

  if (typeof content !== 'string') {
    return (
      <p role="alert" className="text-sm text-status-danger">
        {UNREADABLE_NOTE}
      </p>
    )
  }

  const clean = parsed.split === 'marker' && !parsed.fallback
  const notes: string[] = []
  if (!clean) notes.push(uncleanSplitNotice(status))
  if (parsed.fallback) notes.push(FALLBACK_NOTE)
  if (parsed.letter.length === 0) notes.push(EMPTY_LETTER_NOTE)

  return (
    <div className="space-y-4">
      {notes.length > 0 && (
        <div
          role="note"
          data-letter-notice
          className="rounded-lg border border-border bg-surface-1 px-4 py-3 text-sm leading-relaxed text-text-secondary"
          style={{ borderLeft: '3px solid var(--status-warning)' }}
        >
          {notes.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      )}

      <article
        aria-label="Your letter"
        data-letter-paper
        className="content-island -mx-6 rounded-none px-5 py-8 shadow-sm sm:mx-auto sm:w-full sm:rounded-xl sm:px-12 sm:py-12"
        style={{ maxWidth: PAPER.width, backgroundColor: PAPER.ground, color: PAPER.ink }}
      >
        {/* The letter alone. z-index lifts it over the island's grain layer. */}
        <div
          data-letter-text
          className="relative z-[1] font-serif"
          style={{ fontSize: PAPER.fontSize, lineHeight: PAPER.lineHeight }}
        >
          {parsed.letter.map((b, i) => (
            <PaperBlock key={i} block={b} />
          ))}
        </div>
      </article>

      {parsed.guidance && (
        <section
          aria-labelledby="letter-guidance-title"
          data-letter-guidance
          className="mx-auto w-full rounded-xl border border-border bg-surface-1 px-5 py-5 sm:px-6"
          style={{ maxWidth: PAPER.width }}
        >
          <h2 id="letter-guidance-title" className="mb-3 text-3xs font-semibold uppercase tracking-wider text-text-faint">
            Not part of your request
          </h2>
          <div data-letter-guidance-text className="text-sm leading-relaxed text-text-secondary">
            {parsed.guidance.map((b, i) => (
              <PaperBlock key={i} block={b} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

const BLOCK_CLASS = 'min-h-[1.5em] whitespace-pre-wrap [overflow-wrap:anywhere]'
/** A hanging indent: wrapped lines of an item align after its prefix, which stays in the text. */
const ITEM_STYLE = { paddingLeft: '1.5em', textIndent: '-1.5em' } as const
const PREFIX_STYLE = { display: 'inline-block', minWidth: '1.5em', textIndent: 0 } as const

function PaperBlock({ block }: { block: Block }) {
  switch (block.kind) {
    case 'heading': {
      // h1 is the page's own; the letter's levels sit below it.
      const Tag = `h${Math.min(6, block.level + 1)}` as 'h2'
      return (
        <Tag className={`${BLOCK_CLASS} font-semibold`} style={{ fontSize: 'inherit' }}>
          <Inlines inlines={block.inlines} />
        </Tag>
      )
    }
    case 'rule':
      // A 1px hairline centred in its line, drawn by a pseudo-element so the
      // element's text stays empty (the projection of a rule is "").
      return (
        <p
          data-rule
          className={`${BLOCK_CLASS} relative before:absolute before:inset-x-0 before:top-1/2 before:border-t before:border-[#A8A29E] before:content-['']`}
        />
      )
    case 'bullet':
    case 'numbered':
      return (
        <p className={BLOCK_CLASS} style={ITEM_STYLE}>
          {/* The prefix box grows with its content (min-width), so "100. " never overflows. */}
          <span style={PREFIX_STYLE}>{blockPrefix(block)}</span>
          <Inlines inlines={block.inlines} />
        </p>
      )
    case 'line':
      return (
        <p className={BLOCK_CLASS}>
          <Inlines inlines={block.inlines} />
        </p>
      )
    case 'verbatim':
      return <pre className={`${BLOCK_CLASS} font-[inherit]`}>{block.text}</pre>
  }
}

function Inlines({ inlines }: { inlines: Inline[] }): ReactNode {
  return inlines.map((inl, i) => {
    switch (inl.kind) {
      case 'text':
        return <Fragment key={i}>{inl.text}</Fragment>
      case 'placeholder':
        // The parser yields placeholders in the letter part only (Razor W1).
        return (
          <mark
            key={i}
            className="rounded-[2px] px-[0.1em]"
            style={{ backgroundColor: PAPER.markBg, color: PAPER.markInk }}
          >
            {inl.text}
          </mark>
        )
      case 'strong':
        return (
          <strong key={i} className="font-semibold">
            <Inlines inlines={inl.children} />
          </strong>
        )
      case 'em':
        return (
          <em key={i}>
            <Inlines inlines={inl.children} />
          </em>
        )
      case 'link':
        return (
          <Fragment key={i}>
            <Inlines inlines={inl.children} />
            {' ('}
            <span className="[overflow-wrap:anywhere]">{inl.url}</span>
            {')'}
          </Fragment>
        )
    }
  })
}
