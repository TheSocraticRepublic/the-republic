'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Eye, MessageCircleQuestion, FileText, GitCompare } from 'lucide-react'

interface ScoutResultViewProps {
  text: string
  isStreaming: boolean
}

interface ParsedSection {
  heading: string
  content: string
}

// ---- Section parser (same logic as comparison-view) ----

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

// ---- Access badge ----

type AccessLevel = 'public' | 'fippa' | 'council'

function detectAccess(text: string): AccessLevel | null {
  const lower = text.toLowerCase()
  if (lower.includes('fippa required') || lower.includes('fippa request')) return 'fippa'
  if (lower.includes('council record')) return 'council'
  if (lower.includes('public')) return 'public'
  return null
}

function AccessBadge({ level }: { level: AccessLevel }) {
  const styles: Record<AccessLevel, { bg: string; border: string; color: string; label: string }> = {
    public: {
      bg: 'color-mix(in srgb, var(--accent-mirror) 10%, transparent)',
      border: 'color-mix(in srgb, var(--accent-mirror) 30%, transparent)',
      color: 'var(--accent-mirror)',
      label: 'Public',
    },
    fippa: {
      bg: 'color-mix(in srgb, var(--accent-gadfly) 10%, transparent)',
      border: 'color-mix(in srgb, var(--accent-gadfly) 30%, transparent)',
      color: 'var(--accent-gadfly)',
      label: 'FIPPA Required',
    },
    council: {
      bg: 'color-mix(in srgb, var(--accent-oracle) 10%, transparent)',
      border: 'color-mix(in srgb, var(--accent-oracle) 30%, transparent)',
      color: 'var(--accent-oracle)',
      label: 'Council Record',
    },
  }

  const s = styles[level]

  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.color }}
    >
      {s.label}
    </span>
  )
}

// ---- Document card (for Relevant Documents section) ----

interface DocumentField {
  label: string
  value: string
}

function parseDocumentFields(block: string): DocumentField[] {
  const lines = block.split('\n')
  const fields: DocumentField[] = []
  let current: DocumentField | null = null

  for (const line of lines) {
    const match = line.match(/^[-*]\s+\*\*(.+?):\*\*\s*(.*)$/)
    if (match) {
      if (current) fields.push(current)
      current = { label: match[1].trim(), value: match[2].trim() }
    } else if (current && line.trim()) {
      current.value += ' ' + line.trim()
    }
  }
  if (current) fields.push(current)
  return fields
}

function DocumentCard({ block }: { block: string }) {
  const fields = parseDocumentFields(block)

  // Try to extract document name from first line if it uses ### or **name**
  let docName = ''
  let bodyFields = fields
  const firstLine = block.split('\n')[0]?.trim() ?? ''
  if (firstLine.startsWith('###')) {
    docName = firstLine.replace(/^###\s*/, '').replace(/\*\*/g, '').trim()
  } else if (firstLine.startsWith('**') && firstLine.endsWith('**') && !firstLine.match(/^[-*]\s+\*\*/)) {
    docName = firstLine.replace(/\*\*/g, '').trim()
  }

  // If name came from the first line, look for it in fields too
  if (!docName) {
    const nameField = fields.find(
      (f) => f.label.toLowerCase() === 'document name' || f.label.toLowerCase() === 'document'
    )
    if (nameField) {
      docName = nameField.value
      bodyFields = fields.filter((f) => f !== nameField)
    }
  }

  // Detect access level from the Access field
  const accessField = bodyFields.find((f) => f.label.toLowerCase() === 'access')
  const accessLevel = accessField ? detectAccess(accessField.value) : null

  // Fields to render without the access field (shown as badge instead)
  const displayFields = bodyFields.filter((f) => f.label.toLowerCase() !== 'access')

  // "How to find it" field gets special footer styling
  const howToFindField = displayFields.find(
    (f) => f.label.toLowerCase().includes('how to find') || f.label.toLowerCase().includes('where to find')
  )
  const mainFields = displayFields.filter((f) => f !== howToFindField)

  if (fields.length === 0) {
    // Fallback: render as prose
    return (
      <div className="rounded-xl border border-border bg-surface-1 shadow-sm p-5">
        <p className="text-sm leading-relaxed text-text-secondary whitespace-pre-wrap">
          {block.replace(/\*\*(.+?)\*\*/g, '$1')}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface-1 shadow-sm p-5">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        {docName ? (
          <span
            className="text-sm font-semibold text-text-primary"
          >
            {docName}
          </span>
        ) : null}
        {accessLevel && <AccessBadge level={accessLevel} />}
      </div>

      {/* Body fields */}
      {mainFields.length > 0 && (
        <div className="space-y-3">
          {mainFields.map((field, i) => (
            <div key={i}>
              <span className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                {field.label}
              </span>
              <p className="mt-0.5 text-sm leading-relaxed text-text-secondary">{field.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* "How to find it" footer */}
      {howToFindField && (
        <div
          className="mt-4 border-t border-border pt-3"
        >
          <span className="block text-xs font-semibold uppercase tracking-wider text-text-faint">
            How to find it
          </span>
          <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{howToFindField.value}</p>
        </div>
      )}
    </div>
  )
}

// ---- FIPPA warning card (for Documents You Cannot Easily Get) ----

function FippaCard({ block }: { block: string }) {
  const fields = parseDocumentFields(block)
  let docName = ''
  let bodyFields = fields

  const firstLine = block.split('\n')[0]?.trim() ?? ''
  if (firstLine.startsWith('###')) {
    docName = firstLine.replace(/^###\s*/, '').replace(/\*\*/g, '').trim()
  } else if (firstLine.startsWith('**') && firstLine.endsWith('**') && !firstLine.match(/^[-*]\s+\*\*/)) {
    docName = firstLine.replace(/\*\*/g, '').trim()
  }

  if (!docName) {
    const nameField = fields.find(
      (f) => f.label.toLowerCase() === 'document name' || f.label.toLowerCase() === 'document'
    )
    if (nameField) {
      docName = nameField.value
      bodyFields = fields.filter((f) => f !== nameField)
    }
  }

  if (fields.length === 0) {
    return (
      <div
        className="rounded-xl p-5 backdrop-blur-md"
        style={{
          backgroundColor: 'rgba(200, 168, 75, 0.05)',
          border: '1px solid rgba(200, 168, 75, 0.25)',
        }}
      >
        <p className="text-sm leading-relaxed text-text-secondary whitespace-pre-wrap">
          {block.replace(/\*\*(.+?)\*\*/g, '$1')}
        </p>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl p-5 backdrop-blur-md"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--accent-gadfly) 5%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent-gadfly) 25%, transparent)',
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        {docName && (
          <span
            className="text-sm font-semibold text-text-primary"
          >
            {docName}
          </span>
        )}
        <AccessBadge level="fippa" />
      </div>

      <div className="space-y-3">
        {bodyFields.map((field, i) => (
          <div key={i}>
            <span className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
              {field.label}
            </span>
            <p className="mt-0.5 text-sm leading-relaxed text-text-secondary">{field.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Block splitter (same as comparison-view) ----

function splitDocumentBlocks(content: string): string[] {
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

  return blocks.length > 0 ? blocks : [content]
}

// ---- Prose section ----

function ProseSection({ content }: { content: string }) {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <div className="space-y-3">
      {paragraphs.map((para, i) => (
        <p key={i} className="text-sm leading-relaxed text-text-secondary whitespace-pre-wrap">
          {para.replace(/\*\*(.+?)\*\*/g, '$1')}
        </p>
      ))}
    </div>
  )
}

// ---- Cross-arm next steps ----

function NextStepsSection({ content }: { content: string }) {
  const actions = [
    {
      label: 'Analyze a document',
      description: 'Upload a specific document for detailed analysis',
      href: '/oracle',
      icon: Eye,
      color: 'var(--accent-oracle)',
      bg: 'color-mix(in srgb, var(--accent-oracle) 8%, transparent)',
      border: 'color-mix(in srgb, var(--accent-oracle) 20%, transparent)',
    },
    {
      label: 'File a FIPPA request',
      description: 'Generate a ready-to-file request for non-public documents',
      href: '/lever?actionType=fippa_request',
      icon: FileText,
      color: 'var(--accent-lever)',
      bg: 'color-mix(in srgb, var(--accent-lever) 8%, transparent)',
      border: 'color-mix(in srgb, var(--accent-lever) 20%, transparent)',
    },
    {
      label: 'Explore this issue',
      description: 'Work through the implications via Socratic inquiry',
      href: '/gadfly',
      icon: MessageCircleQuestion,
      color: 'var(--accent-gadfly)',
      bg: 'color-mix(in srgb, var(--accent-gadfly) 8%, transparent)',
      border: 'color-mix(in srgb, var(--accent-gadfly) 20%, transparent)',
    },
    {
      label: 'Compare jurisdictions',
      description: 'See how other municipalities have handled this issue',
      href: '/mirror',
      icon: GitCompare,
      color: 'var(--accent-mirror)',
      bg: 'color-mix(in srgb, var(--accent-mirror) 8%, transparent)',
      border: 'color-mix(in srgb, var(--accent-mirror) 20%, transparent)',
    },
  ]

  return (
    <div className="space-y-3">
      {/* Narrative content from the AI if any */}
      {content.trim() && (
        <div className="mb-4">
          <ProseSection content={content} />
        </div>
      )}

      {/* Fixed cross-arm action buttons */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <Link
              key={action.label}
              href={action.href}
              className="group flex items-center gap-3 rounded-xl p-4 transition-all duration-150 hover:opacity-90"
              style={{
                backgroundColor: action.bg,
                border: `1px solid ${action.border}`,
              }}
            >
              <span
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${action.color}20` }}
              >
                <Icon size={15} strokeWidth={1.75} style={{ color: action.color }} />
              </span>
              <span className="flex flex-col">
                <span
                  className="text-sm font-semibold leading-tight"
                  style={{ color: action.color }}
                >
                  {action.label}
                </span>
                <span className="mt-0.5 text-xs leading-tight text-text-muted">
                  {action.description}
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ---- Main component ----

export function ScoutResultView({ text, isStreaming }: ScoutResultViewProps) {
  const sections = useMemo(() => parseSections(text), [text])
  const hasSections = sections.length > 0

  // During streaming, if no sections yet, show raw text with cursor
  if (isStreaming && !hasSections) {
    return (
      <div className="rounded-xl border border-border bg-surface-1 shadow-sm p-5">
        <p className="text-sm leading-relaxed text-text-secondary whitespace-pre-wrap">{text}</p>
        <span className="mt-1 inline-block h-4 w-1 animate-pulse bg-[var(--accent-scout)]/60" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {sections.map((section, i) => {
        const headingLower = section.heading.toLowerCase()

        // --- Your Concern ---
        if (headingLower.includes('your concern') || headingLower.includes('concern')) {
          return (
            <div key={i}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">
                Your Concern
              </h3>
              <div
                className="rounded-xl p-5 backdrop-blur-md"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--accent-scout) 5%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--accent-scout) 15%, transparent)',
                }}
              >
                <ProseSection content={section.content} />
              </div>
            </div>
          )
        }

        // --- Relevant Documents ---
        if (headingLower.includes('relevant documents') || headingLower.includes('relevant document')) {
          const blocks = splitDocumentBlocks(section.content)
          return (
            <div key={i}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">
                Relevant Documents
              </h3>
              <div className="space-y-4">
                {blocks.map((block, j) => (
                  <DocumentCard key={j} block={block} />
                ))}
              </div>
            </div>
          )
        }

        // --- Documents You Cannot Easily Get ---
        if (
          headingLower.includes('cannot easily get') ||
          headingLower.includes("can't easily get") ||
          headingLower.includes('not easily') ||
          headingLower.includes('restricted') ||
          (headingLower.includes('documents') && headingLower.includes('cannot'))
        ) {
          const blocks = splitDocumentBlocks(section.content)
          return (
            <div key={i}>
              <h3
                className="mb-3 text-xs font-semibold uppercase tracking-widest"
                style={{ color: 'color-mix(in srgb, var(--accent-gadfly) 70%, transparent)' }}
              >
                Documents You Cannot Easily Get
              </h3>
              <div className="space-y-4">
                {blocks.map((block, j) => (
                  <FippaCard key={j} block={block} />
                ))}
              </div>
            </div>
          )
        }

        // --- The Paper Trail ---
        if (headingLower.includes('paper trail') || headingLower.includes('trail')) {
          return (
            <div key={i}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">
                The Paper Trail
              </h3>
              <div className="rounded-xl border border-border bg-surface-1 shadow-sm p-5">
                <ProseSection content={section.content} />
              </div>
            </div>
          )
        }

        // --- Next Steps ---
        if (headingLower.includes('next steps') || headingLower.includes('next step')) {
          return (
            <div key={i}>
              <h3
                className="mb-3 text-xs font-semibold uppercase tracking-widest"
                style={{ color: 'color-mix(in srgb, var(--accent-scout) 70%, transparent)' }}
              >
                Next Steps
              </h3>
              <NextStepsSection content={section.content} />
            </div>
          )
        }

        // --- Fallback ---
        return (
          <div key={i}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">
              {section.heading}
            </h3>
            <div className="rounded-xl border border-border bg-surface-1 shadow-sm p-5">
              <ProseSection content={section.content} />
            </div>
          </div>
        )
      })}

      {isStreaming && (
        <span className="inline-block h-4 w-1 animate-pulse bg-[var(--accent-scout)]/60" />
      )}
    </div>
  )
}
