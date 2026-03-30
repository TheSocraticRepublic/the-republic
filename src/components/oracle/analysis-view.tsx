'use client'

import { clsx } from 'clsx'

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
 * Returns paragraphs, with quoted text identified.
 */
function parseKeyFindings(content: string): Array<{ text: string; hasQuote: boolean }> {
  return content
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => {
      const trimmed = line.replace(/^[-*]\s+/, '').trim()
      return {
        text: trimmed,
        hasQuote: trimmed.includes('"') || trimmed.includes('\u201c'),
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

function SectionShell({
  heading,
  children,
}: {
  heading: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-black/60 backdrop-blur-md">
      <div className="border-b border-white/[0.06] px-5 py-3.5">
        <h3
          className="text-sm font-semibold tracking-wide"
          style={{
            color: '#89B4C8',
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
          }}
        >
          {heading}
        </h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

function PlainSummary({ content }: { content: string }) {
  return (
    <SectionShell heading="Plain Language Summary">
      <p className="text-sm leading-relaxed text-neutral-300">{content}</p>
    </SectionShell>
  )
}

function KeyFindingsSection({ content }: { content: string }) {
  const findings = parseKeyFindings(content)
  if (!findings.length) {
    return (
      <SectionShell heading="Key Findings">
        <p className="text-sm text-neutral-400">{content}</p>
      </SectionShell>
    )
  }

  return (
    <SectionShell heading="Key Findings">
      <ul className="space-y-3">
        {findings.map((f, i) => (
          <li
            key={i}
            className={clsx(
              'rounded-lg px-4 py-3 text-sm leading-relaxed',
              f.hasQuote
                ? 'border-l-2 border-[#89B4C8]/40 bg-white/[0.03] text-neutral-200'
                : 'text-neutral-300'
            )}
          >
            {f.text}
          </li>
        ))}
      </ul>
    </SectionShell>
  )
}

const POWER_MAP_COLORS: Record<string, string> = {
  Beneficiaries: 'text-emerald-400',
  'Affected Parties': 'text-yellow-400',
  'Decision Makers': 'text-[#89B4C8]',
  'Funding Flows': 'text-violet-400',
  'Oversight Gaps': 'text-red-400',
}

function PowerMapSection({ content }: { content: string }) {
  const entries = parsePowerMap(content)

  if (!entries.length) {
    return (
      <SectionShell heading="Power Map">
        <p className="text-sm text-neutral-400 whitespace-pre-line">{content}</p>
      </SectionShell>
    )
  }

  return (
    <SectionShell heading="Power Map">
      <div className="grid gap-3 sm:grid-cols-2">
        {entries.map((entry) => {
          const labelColor = POWER_MAP_COLORS[entry.label] ?? 'text-neutral-400'
          return (
            <div
              key={entry.label}
              className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3"
            >
              <p className={clsx('mb-1.5 text-[11px] font-semibold uppercase tracking-widest', labelColor)}>
                {entry.label}
              </p>
              <p className="text-sm leading-relaxed text-neutral-300">
                {entry.text || <span className="italic text-neutral-500">Not identified</span>}
              </p>
            </div>
          )
        })}
      </div>
    </SectionShell>
  )
}

function BulletSection({ heading, content }: { heading: string; content: string }) {
  const bullets = parseBullets(content)

  return (
    <SectionShell heading={heading}>
      {bullets.length > 0 ? (
        <ul className="space-y-2">
          {bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-neutral-300 leading-relaxed">
              <span
                className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: '#89B4C8', opacity: 0.7 }}
              />
              {bullet}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-neutral-400 whitespace-pre-line">{content}</p>
      )}
    </SectionShell>
  )
}

function QuestionsSection({ content }: { content: string }) {
  const questions = parseBullets(content)

  return (
    <SectionShell heading="Questions to Ask">
      {questions.length > 0 ? (
        <ol className="space-y-2.5">
          {questions.map((q, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[11px] font-bold"
                style={{
                  backgroundColor: 'rgba(137, 180, 200, 0.12)',
                  color: '#89B4C8',
                }}
              >
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed text-neutral-300">{q}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-neutral-400 whitespace-pre-line">{content}</p>
      )}
    </SectionShell>
  )
}

// Streaming placeholder
function StreamingFallback({ content }: { content: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/60 backdrop-blur-md px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <span
          className="h-1.5 w-1.5 rounded-full animate-pulse"
          style={{ backgroundColor: '#89B4C8' }}
        />
        <span className="text-xs text-neutral-500 tracking-wide">Analyzing...</span>
      </div>
      <pre className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-300 font-sans">
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
    <div className="space-y-4">
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
        <div className="flex items-center gap-2 px-1">
          <span
            className="h-1.5 w-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: '#89B4C8' }}
          />
          <span className="text-xs text-neutral-500">Oracle is thinking...</span>
        </div>
      )}
    </div>
  )
}
