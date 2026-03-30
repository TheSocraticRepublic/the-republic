'use client'

import { useMemo } from 'react'

interface ComparisonViewProps {
  text: string
  isStreaming: boolean
}

interface ParsedSection {
  heading: string
  content: string
}

/**
 * Split the AI markdown output into named sections keyed by ## headings.
 */
function parseSections(text: string): ParsedSection[] {
  const sections: ParsedSection[] = []
  const lines = text.split('\n')
  let currentHeading = ''
  let currentLines: string[] = []

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/)
    if (match) {
      if (currentHeading) {
        sections.push({ heading: currentHeading, content: currentLines.join('\n').trim() })
      }
      currentHeading = match[1].trim()
      currentLines = []
    } else {
      currentLines.push(line)
    }
  }

  if (currentHeading) {
    sections.push({ heading: currentHeading, content: currentLines.join('\n').trim() })
  }

  return sections
}

/**
 * Detect transferability level from text containing High/Medium/Low keyword.
 */
function detectTransferability(text: string): 'high' | 'medium' | 'low' | null {
  const lower = text.toLowerCase()
  if (lower.includes('high')) return 'high'
  if (lower.includes('medium') || lower.includes('moderate')) return 'medium'
  if (lower.includes('low')) return 'low'
  return null
}

function TransferabilityBadge({ level }: { level: 'high' | 'medium' | 'low' | null }) {
  if (!level) return null

  const styles: Record<string, { bg: string; border: string; color: string }> = {
    high: { bg: 'rgba(91, 200, 138, 0.1)', border: 'rgba(91, 200, 138, 0.3)', color: '#5BC88A' },
    medium: { bg: 'rgba(200, 168, 75, 0.1)', border: 'rgba(200, 168, 75, 0.3)', color: '#C8A84B' },
    low: { bg: 'rgba(200, 91, 91, 0.1)', border: 'rgba(200, 91, 91, 0.3)', color: '#C85B5B' },
  }

  const s = styles[level]
  const label = level.charAt(0).toUpperCase() + level.slice(1)

  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.color }}
    >
      {label} transferability
    </span>
  )
}

/**
 * Render a single field from an alternative block.
 * Parses bold-prefixed lines like "- **Label:** content"
 */
function AlternativeCard({ block }: { block: string }) {
  const lines = block.split('\n').filter((l) => l.trim())

  // Extract jurisdiction name from the first non-empty line if it starts with "###" or "**"
  let jurisdictionName = ''
  let remainingLines = lines

  const firstLine = lines[0]?.trim() ?? ''
  if (firstLine.startsWith('###')) {
    jurisdictionName = firstLine.replace(/^###\s*/, '').replace(/\*\*/g, '').trim()
    remainingLines = lines.slice(1)
  } else if (firstLine.startsWith('**') && firstLine.endsWith('**')) {
    jurisdictionName = firstLine.replace(/\*\*/g, '').trim()
    remainingLines = lines.slice(1)
  }

  // Parse field lines
  interface Field {
    label: string
    value: string
  }
  const fields: Field[] = []
  let currentField: Field | null = null

  for (const line of remainingLines) {
    const fieldMatch = line.match(/^[-*]\s+\*\*(.+?):\*\*\s*(.*)$/)
    if (fieldMatch) {
      if (currentField) fields.push(currentField)
      currentField = { label: fieldMatch[1].trim(), value: fieldMatch[2].trim() }
    } else if (currentField) {
      // continuation line
      currentField.value += ' ' + line.trim()
    }
  }
  if (currentField) fields.push(currentField)

  const transferabilityField = fields.find((f) => f.label.toLowerCase().includes('transferability'))
  const transferabilityLevel = transferabilityField
    ? detectTransferability(transferabilityField.value)
    : null

  return (
    <div
      className="rounded-xl border border-white/[0.08] bg-black/50 p-5 backdrop-blur-md"
    >
      {jurisdictionName && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <span
            className="text-sm font-semibold text-neutral-100"
            style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
          >
            {jurisdictionName}
          </span>
          <TransferabilityBadge level={transferabilityLevel} />
        </div>
      )}

      {fields.length > 0 ? (
        <div className="space-y-3">
          {fields.map((field, i) => (
            <div key={i}>
              <span className="block text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {field.label}
              </span>
              <p className="mt-0.5 text-sm leading-relaxed text-neutral-300">{field.value}</p>
            </div>
          ))}
        </div>
      ) : (
        // Fallback: render raw content if parsing yields nothing
        <p className="text-sm leading-relaxed text-neutral-300 whitespace-pre-wrap">{block}</p>
      )}
    </div>
  )
}

/**
 * Split an "Alternatives Found" section into individual jurisdiction blocks.
 */
function splitAlternativeBlocks(content: string): string[] {
  // Blocks typically start with a ### heading or a **JurisdictionName** line
  const blocks: string[] = []
  const lines = content.split('\n')
  let currentBlock: string[] = []

  for (const line of lines) {
    const isBlockStart =
      line.match(/^###\s+/) ||
      (line.match(/^\*\*.+\*\*$/) && !line.match(/^[-*]\s+\*\*/))

    if (isBlockStart && currentBlock.length > 0) {
      blocks.push(currentBlock.join('\n').trim())
      currentBlock = [line]
    } else {
      currentBlock.push(line)
    }
  }

  if (currentBlock.length > 0 && currentBlock.join('').trim()) {
    blocks.push(currentBlock.join('\n').trim())
  }

  // If no block boundaries detected, treat the whole section as one block
  return blocks.length > 0 ? blocks : [content]
}

function ProseSection({ content }: { content: string }) {
  // Render markdown-like content as plain paragraphs
  const paragraphs = content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <div className="space-y-3">
      {paragraphs.map((para, i) => (
        <p key={i} className="text-sm leading-relaxed text-neutral-300 whitespace-pre-wrap">
          {para.replace(/\*\*(.+?)\*\*/g, '$1')}
        </p>
      ))}
    </div>
  )
}

export function ComparisonView({ text, isStreaming }: ComparisonViewProps) {
  const sections = useMemo(() => parseSections(text), [text])
  const hasSections = sections.length > 0

  // During streaming, if we haven't parsed any sections yet, show raw text
  if (isStreaming && !hasSections) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-black/40 p-5">
        <p className="text-sm leading-relaxed text-neutral-400 whitespace-pre-wrap">{text}</p>
        <span className="mt-1 inline-block h-4 w-1 animate-pulse bg-[#5BC88A]/60" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {sections.map((section, i) => {
        const headingLower = section.heading.toLowerCase()

        // --- Issue Summary ---
        if (headingLower.includes('issue summary')) {
          return (
            <div key={i}>
              <h3
                className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500"
              >
                Issue Summary
              </h3>
              <div className="rounded-xl border border-white/[0.08] bg-black/50 p-5 backdrop-blur-md">
                <ProseSection content={section.content} />
              </div>
            </div>
          )
        }

        // --- Alternatives Found ---
        if (headingLower.includes('alternatives')) {
          const blocks = splitAlternativeBlocks(section.content)
          return (
            <div key={i}>
              <h3
                className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500"
              >
                Alternatives Found
              </h3>
              <div className="space-y-4">
                {blocks.map((block, j) => (
                  <AlternativeCard key={j} block={block} />
                ))}
              </div>
            </div>
          )
        }

        // --- Pattern Analysis ---
        if (headingLower.includes('pattern')) {
          return (
            <div key={i}>
              <h3
                className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500"
              >
                Pattern Analysis
              </h3>
              <div className="rounded-xl border border-white/[0.08] bg-black/50 p-5 backdrop-blur-md">
                <ProseSection content={section.content} />
              </div>
            </div>
          )
        }

        // --- The Argument from Existence (highlighted) ---
        if (headingLower.includes('argument')) {
          return (
            <div key={i}>
              <h3
                className="mb-3 text-xs font-semibold uppercase tracking-widest"
                style={{ color: 'rgba(91, 200, 138, 0.7)' }}
              >
                The Argument from Existence
              </h3>
              <div
                className="rounded-xl p-5 backdrop-blur-md"
                style={{
                  backgroundColor: 'rgba(91, 200, 138, 0.05)',
                  border: '1px solid rgba(91, 200, 138, 0.30)',
                }}
              >
                <ProseSection content={section.content} />
              </div>
            </div>
          )
        }

        // --- Fallback for any other sections ---
        return (
          <div key={i}>
            <h3
              className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500"
            >
              {section.heading}
            </h3>
            <div className="rounded-xl border border-white/[0.08] bg-black/50 p-5 backdrop-blur-md">
              <ProseSection content={section.content} />
            </div>
          </div>
        )
      })}

      {isStreaming && (
        <span className="inline-block h-4 w-1 animate-pulse bg-[#5BC88A]/60" />
      )}
    </div>
  )
}
