import { Fragment, type ReactNode } from 'react'
import {
  parseLetter,
  blockPrefix,
  UNCLEAN_SPLIT_NOTICE,
  type Block,
  type Inline,
} from '@/lib/lever/letter-blocks'

/*
 * The FOI letter on screen (filings §1-2, A1 "Screen").
 *
 * - A paper island, 672px wide, pure white (R5), Source Serif 4 at 17/1.5.
 * - The letter is the projection of parseLetter's letter part: one element per
 *   block, so the paper's text is exactly the golden projection. A link is
 *   text, "text (url)", never an anchor.
 * - Placeholders are <mark> in the paper's own ink.
 * - Everything that is not the letter sits outside the paper: the §2 notice,
 *   the plain-text and empty-letter notes, and the guidance (marker-v1 only).
 *
 * The paper's colours are fixed, not theme tokens: the paper is light in a
 * dark app by doctrine ("dark where you work, light where you read"), and
 * the placeholder ink is the plan's exact value. D1 moves them into the
 * shared paper-ink tokens with the PDF.
 */
const PAPER = {
  width: 672,
  fontSize: 17,
  lineHeight: 1.5,
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
}

export function LetterPaper({ content, letterFormat }: LetterPaperProps) {
  if (typeof content !== 'string') {
    return (
      <p role="alert" className="text-sm text-status-danger">
        {UNREADABLE_NOTE}
      </p>
    )
  }

  const parsed = parseLetter(content, letterFormat)
  const clean = parsed.split === 'marker' && !parsed.fallback
  const notes: string[] = []
  if (!clean) notes.push(UNCLEAN_SPLIT_NOTICE)
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
        className="content-island mx-auto w-full rounded-xl px-5 py-8 shadow-sm sm:px-12 sm:py-12"
        style={{ maxWidth: PAPER.width, backgroundColor: '#FFFFFF', color: 'var(--island-text)' }}
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
              <PaperBlock key={i} block={b} guidance />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

const BLOCK_CLASS = 'min-h-[1.5em] whitespace-pre-wrap [overflow-wrap:anywhere]'

function PaperBlock({ block, guidance = false }: { block: Block; guidance?: boolean }) {
  switch (block.kind) {
    case 'heading': {
      // h1 is the page's own; the letter's levels sit below it.
      const Tag = `h${Math.min(6, block.level + 1)}` as 'h2'
      return (
        <Tag className={`${BLOCK_CLASS} font-semibold`} style={{ fontSize: 'inherit' }}>
          <Inlines inlines={block.inlines} guidance={guidance} />
        </Tag>
      )
    }
    case 'rule':
      return <p className={BLOCK_CLASS} />
    case 'bullet':
    case 'numbered':
      return (
        <p className={BLOCK_CLASS}>
          {blockPrefix(block)}
          <Inlines inlines={block.inlines} guidance={guidance} />
        </p>
      )
    case 'line':
      return (
        <p className={BLOCK_CLASS}>
          <Inlines inlines={block.inlines} guidance={guidance} />
        </p>
      )
    case 'verbatim':
      return <pre className={`${BLOCK_CLASS} font-[inherit]`}>{block.text}</pre>
  }
}

function Inlines({ inlines, guidance }: { inlines: Inline[]; guidance: boolean }): ReactNode {
  return inlines.map((inl, i) => {
    switch (inl.kind) {
      case 'text':
        return <Fragment key={i}>{inl.text}</Fragment>
      case 'placeholder':
        // Placeholders are marked in the letter only; in the guidance a
        // bracket is just a bracket (it is not counted either).
        return guidance ? (
          <Fragment key={i}>{inl.text}</Fragment>
        ) : (
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
            <Inlines inlines={inl.children} guidance={guidance} />
          </strong>
        )
      case 'em':
        return (
          <em key={i}>
            <Inlines inlines={inl.children} guidance={guidance} />
          </em>
        )
      case 'link':
        return (
          <Fragment key={i}>
            <Inlines inlines={inl.children} guidance={guidance} />
            {' ('}
            <span className="[overflow-wrap:anywhere]">{inl.url}</span>
            {')'}
          </Fragment>
        )
    }
  })
}
