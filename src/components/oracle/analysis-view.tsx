'use client'

import { clsx } from 'clsx'
import type React from 'react'

interface AnalysisViewProps {
  content: string
  isStreaming?: boolean
}

interface ParsedSection {
  heading: string
  content: string
}

function parseSections(text: string): ParsedSection[] {
  const sections: ParsedSection[] = []
  const re = /##\s+(.+?)\s*\n([\s\S]*?)(?=\n##\s|$)/g
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    sections.push({
      heading: match[1].trim(),
      content: match[2].trim(),
    })
  }

  return sections
}

/**
 * Parse Power Map section into labeled sub-sections.
 * Looks for **Label:** patterns.
 */
function parsePowerMap(content: string): Array<{ label: string; text: string }> {
  const lines = content.split('\n')
  const entries: Array<{ label: string; text: string }> = []
  let current: { label: string; text: string } | null = null

  for (const line of lines) {
    const match = line.match(/^[-*]?\s*\*\*(.+?):\*\*\s*(.*)/)
    if (match) {
      if (current) entries.push(current)
      current = { label: match[1].trim(), text: match[2].trim() }
    } else if (current && line.trim()) {
      current.text += ' ' + line.trim()
    }
  }

  if (current) entries.push(current)
  return entries
}

/**
 * Parse a section with quoted text (Key Findings).
 * Returns items with quoted text identified.
 */
function parseKeyFindings(content: string): Array<{ text: string; hasQuote: boolean }> {
  return content
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => {
      const trimmed = line.replace(/^[-*]\s+/, '').trim()
      return {
        text: trimmed,
        hasQuote: trimmed.includes('"') || trimmed.includes('“'),
      }
    })
}

/**
 * Parse questions or bullet lists.
 */
function parseBullets(content: string): string[] {
  return content
    .split('\n')
    .map((l) => l.replace(/^[-*\d.]\s+/, '').trim())
    .filter(Boolean)
}

// ---

function PlainSummary({ content }: { content: string }) {
  return (
    <section>
      <h3 className="section-heading">Plain Language Summary</h3>
      <p className="font-serif text-sm leading-relaxed text-text-secondary">{content}</p>
    </section>
  )
}

function KeyFindingsSection({ content }: { content: string }) {
  const findings = parseKeyFindings(content)
  if (!findings.length) {
    return (
      <section>
        <h3 className="section-heading">Key Findings</h3>
        <p className="font-serif text-sm text-text-secondary">{content}</p>
      </section>
    )
  }

  return (
    <section>
      <h3 className="section-heading">Key Findings</h3>
      <ol className="space-y-3">
        {findings.map((f, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="font-mono text-xs text-text-muted flex-shrink-0 pt-0.5 w-4 text-right tabular-nums">
              {i + 1}
            </span>
            <p
              className={clsx(
                'font-serif text-sm leading-relaxed',
                f.hasQuote
                  ? 'border-l-2 pl-3 text-text-primary'
                  : 'text-text-secondary'
              )}
              style={
                f.hasQuote
                  ? { borderColor: 'color-mix(in srgb, var(--accent-oracle) 40%, transparent)' }
                  : undefined
              }
            >
              {f.text}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}

const POWER_MAP_ENTRIES: Record<
  string,
  { textClass?: string; textStyle?: React.CSSProperties; borderColor: string }
> = {
  Beneficiaries:      { textClass: 'text-emerald-400', borderColor: 'rgb(52, 211, 153)' },
  'Affected Parties': { textClass: 'text-yellow-400',  borderColor: 'rgb(250, 204, 21)' },
  'Decision Makers':  { textStyle: { color: 'var(--accent-oracle)' }, borderColor: 'var(--accent-oracle)' },
  'Funding Flows':    { textClass: 'text-violet-400',  borderColor: 'rgb(167, 139, 250)' },
  'Oversight Gaps':   { textClass: 'text-red-400',     borderColor: 'rgb(248, 113, 113)' },
}

function PowerMapSection({ content }: { content: string }) {
  const entries = parsePowerMap(content)

  if (!entries.length) {
    return (
      <section>
        <h3 className="section-heading">Power Map</h3>
        <p className="font-serif text-sm text-text-secondary whitespace-pre-line">{content}</p>
      </section>
    )
  }

  return (
    <section>
      <h3 className="section-heading">Power Map</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {entries.map((entry) => {
          const tokens = POWER_MAP_ENTRIES[entry.label]
          const borderColor = tokens?.borderColor ?? 'var(--border-strong)'
          const textClass = tokens?.textClass ?? 'text-text-muted'
          const textStyle = tokens?.textStyle
          return (
            <div
              key={entry.label}
              className="border-l-4 py-2 pl-4"
              style={{ borderColor }}
            >
              <p
                className={clsx('mb-1 text-[11px] font-semibold uppercase tracking-wider', textClass)}
                style={textStyle}
              >
                {entry.label}
              </p>
              <p className="font-serif text-sm leading-relaxed text-text-secondary">
                {entry.text || <span className="italic text-text-muted">Not identified</span>}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function BulletSection({ heading, content }: { heading: string; content: string }) {
  const bullets = parseBullets(content)

  return (
    <section>
      <h3 className="section-heading">{heading}</h3>
      {bullets.length > 0 ? (
        <ul className="space-y-2">
          {bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2.5 font-serif text-sm text-text-secondary leading-relaxed">
              <span
                className="mt-2 h-2 w-2 flex-shrink-0 rounded-full"
                style={{ backgroundColor: 'var(--accent-oracle)', opacity: 0.7 }}
              />
              {bullet}
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-serif text-sm text-text-secondary whitespace-pre-line">{content}</p>
      )}
    </section>
  )
}

function QuestionsSection({ content }: { content: string }) {
  const questions = parseBullets(content)

  return (
    <section>
      <h3 className="section-heading">Questions to Ask</h3>
      {questions.length > 0 ? (
        <ol className="space-y-2.5">
          {questions.map((q, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded font-mono text-[11px] font-bold"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--accent-oracle) 12%, transparent)',
                  color: 'var(--accent-oracle)',
                }}
              >
                {i + 1}
              </span>
              <p className="font-serif text-sm leading-relaxed text-text-secondary">{q}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="font-serif text-sm text-text-secondary whitespace-pre-line">{content}</p>
      )}
    </section>
  )
}

// Streaming placeholder
function StreamingFallback({ content }: { content: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-1 shadow-sm px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <span
          className="h-1.5 w-1.5 rounded-full animate-pulse"
          style={{ backgroundColor: 'var(--accent-oracle)' }}
        />
        <span className="text-xs text-text-muted tracking-wide">Analyzing...</span>
      </div>
      <pre className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary font-sans">
        {content}
      </pre>
    </div>
  )
}

const SECTION_RENDERERS: Record<
  string,
  (content: string) => React.ReactNode
> = {
  'Plain Language Summary': (c) => <PlainSummary content={c} />,
  'Key Findings': (c) => <KeyFindingsSection content={c} />,
  'Power Map': (c) => <PowerMapSection content={c} />,
  'What is Missing': (c) => (
    <BulletSection heading="What is Missing" content={c} />
  ),
  'Hidden Assumptions': (c) => (
    <BulletSection heading="Hidden Assumptions" content={c} />
  ),
  'Questions to Ask': (c) => <QuestionsSection content={c} />,
}

export function AnalysisView({ content, isStreaming = false }: AnalysisViewProps) {
  const sections = parseSections(content)

  // During streaming, if we haven't hit any ## headings yet, show raw content
  if (isStreaming && sections.length === 0) {
    return <StreamingFallback content={content} />
  }

  return (
    <div>
      {sections.map((section) => {
        const renderer = SECTION_RENDERERS[section.heading]
        if (renderer) {
          return <div key={section.heading}>{renderer(section.content)}</div>
        }
        // Generic fallback for unknown sections
        return (
          <BulletSection
            key={section.heading}
            heading={section.heading}
            content={section.content}
          />
        )
      })}
      {isStreaming && (
        <div className="flex items-center gap-2 px-1 pt-4">
          <span
            className="h-1.5 w-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: 'var(--accent-oracle)' }}
          />
          <span className="text-xs text-text-muted">Oracle is thinking...</span>
        </div>
      )}
    </div>
  )
}
