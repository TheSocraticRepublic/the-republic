'use client'

import { useMemo, useCallback, useState } from 'react'
import Link from 'next/link'
import {
  Compass,
  Eye,
  MessageCircleQuestion,
  FileText,
  GitCompare,
  Copy,
  Check,
  Download,
} from 'lucide-react'

// ---- Types ----

interface BriefingViewProps {
  text: string
  isStreaming: boolean
}

interface ParsedSection {
  heading: string
  content: string
}

// ---- Arm color config (light surface values) ----

const ARM_COLORS: Record<
  string,
  { color: string; bg: string; border: string }
> = {
  scout: {
    color: '#B088C8',
    bg: 'rgba(176,136,200,0.06)',
    border: 'rgba(176,136,200,0.18)',
  },
  oracle: {
    color: '#89B4C8',
    bg: 'rgba(137,180,200,0.06)',
    border: 'rgba(137,180,200,0.18)',
  },
  lever: {
    color: '#C85B5B',
    bg: 'rgba(200,91,91,0.06)',
    border: 'rgba(200,91,91,0.18)',
  },
  mirror: {
    color: '#5BC88A',
    bg: 'rgba(91,200,138,0.06)',
    border: 'rgba(91,200,138,0.18)',
  },
  gadfly: {
    color: '#C8A84B',
    bg: 'rgba(200,168,75,0.06)',
    border: 'rgba(200,168,75,0.18)',
  },
}

// ---- Section parser — DO NOT MODIFY ----

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

// ---- Section header (no arm badge — color carries identity) ----

function SectionHeader({
  heading,
  color,
}: {
  heading: string
  color?: string
}) {
  return (
    <div className="mb-6 flex items-center gap-2">
      <h3
        className="text-[11px] font-semibold uppercase tracking-[0.1em]"
        style={{ color: color ?? '#78716c' }}
      >
        {heading}
      </h3>
    </div>
  )
}

// ---- Prose renderer ----

function renderInline(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1')
}

function ProseSection({ content }: { content: string }) {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <div className="space-y-4">
      {paragraphs.map((para, i) => {
        // Bullet list paragraph
        if (para.match(/^[-*]\s+/m)) {
          const items = para
            .split('\n')
            .filter((line) => line.trim())
            .map((line) => line.replace(/^[-*]\s+/, '').trim())
          return (
            <ul key={i} className="space-y-1.5 pl-0">
              {items.map((item, j) => (
                <li key={j} className="flex items-start gap-2" style={{ fontSize: '15px', lineHeight: '1.6', color: '#44403c' }}>
                  <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full" style={{ backgroundColor: '#a8a29e' }} />
                  <span>{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          )
        }

        // Bold field line (e.g. **Label:** value)
        const boldFieldMatch = para.match(/^\*\*(.+?):\*\*\s*(.+)$/)
        if (boldFieldMatch) {
          return (
            <div key={i}>
              <span
                className="block font-semibold uppercase tracking-wider"
                style={{ fontSize: '11px', color: '#78716c' }}
              >
                {boldFieldMatch[1]}
              </span>
              <p className="mt-0.5" style={{ fontSize: '16px', lineHeight: '1.7', color: '#292524' }}>
                {renderInline(boldFieldMatch[2])}
              </p>
            </div>
          )
        }

        return (
          <p key={i} className="whitespace-pre-wrap" style={{ fontSize: '16px', lineHeight: '1.7', color: '#292524' }}>
            {renderInline(para)}
          </p>
        )
      })}
    </div>
  )
}

// ---- Document field parser — DO NOT MODIFY ----

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

// ---- Access badge (light surface tint values) ----

type AccessLevel = 'public' | 'fippa' | 'council'

function detectAccess(text: string): AccessLevel | null {
  const lower = text.toLowerCase()
  if (lower.includes('fippa required') || lower.includes('fippa request')) return 'fippa'
  if (lower.includes('council record')) return 'council'
  if (lower.includes('public')) return 'public'
  return null
}

const ACCESS_STYLES: Record<AccessLevel, { bg: string; border: string; color: string; label: string }> = {
  public: {
    bg: 'rgba(91,200,138,0.06)',
    border: 'rgba(91,200,138,0.18)',
    color: '#5BC88A',
    label: 'Public',
  },
  fippa: {
    bg: 'rgba(200,168,75,0.06)',
    border: 'rgba(200,168,75,0.18)',
    color: '#C8A84B',
    label: 'FIPPA Required',
  },
  council: {
    bg: 'rgba(137,180,200,0.06)',
    border: 'rgba(137,180,200,0.18)',
    color: '#89B4C8',
    label: 'Council Record',
  },
}

function AccessBadge({ level }: { level: AccessLevel }) {
  const s = ACCESS_STYLES[level]
  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.color }}
    >
      {s.label}
    </span>
  )
}

// ---- Document card (light surface) ----

function DocumentCard({ block }: { block: string }) {
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

  const accessField = bodyFields.find((f) => f.label.toLowerCase() === 'access')
  const accessLevel = accessField ? detectAccess(accessField.value) : null
  const displayFields = bodyFields.filter((f) => f.label.toLowerCase() !== 'access')
  const howToFindField = displayFields.find(
    (f) => f.label.toLowerCase().includes('how to find') || f.label.toLowerCase().includes('where to find')
  )
  const mainFields = displayFields.filter((f) => f !== howToFindField)

  if (fields.length === 0) {
    return (
      <div
        className="rounded-xl p-5"
        style={{ backgroundColor: '#f5f4f3', border: '1px solid #e0ddd9' }}
      >
        <p className="whitespace-pre-wrap" style={{ fontSize: '16px', lineHeight: '1.7', color: '#292524' }}>
          {renderInline(block)}
        </p>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl p-5"
      style={{ backgroundColor: '#f5f4f3', border: '1px solid #e0ddd9' }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        {docName && (
          <span
            className="font-semibold"
            style={{
              fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
              fontSize: '14px',
              lineHeight: '1.4',
              color: '#1c1917',
            }}
          >
            {docName}
          </span>
        )}
        {accessLevel && <AccessBadge level={accessLevel} />}
      </div>

      {mainFields.length > 0 && (
        <div className="space-y-3">
          {mainFields.map((field, i) => (
            <div key={i}>
              <span
                className="block font-semibold uppercase tracking-[0.08em]"
                style={{ fontSize: '10px', color: '#78716c', marginBottom: '4px' }}
              >
                {field.label}
              </span>
              <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#44403c' }}>
                {renderInline(field.value)}
              </p>
            </div>
          ))}
        </div>
      )}

      {howToFindField && (
        <div
          className="mt-4 pt-3"
          style={{ borderTop: '1px solid #e7e5e4', marginTop: '16px', paddingTop: '12px' }}
        >
          <span
            className="block font-semibold uppercase tracking-[0.08em]"
            style={{ fontSize: '10px', color: '#a8a29e' }}
          >
            How to find it
          </span>
          <p className="mt-0.5" style={{ fontSize: '12px', lineHeight: '1.5', color: '#78716c' }}>
            {renderInline(howToFindField.value)}
          </p>
        </div>
      )}
    </div>
  )
}

// ---- Block splitter — DO NOT MODIFY ----

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

// ---- FIPPA letter extractor — DO NOT MODIFY ----

function extractFippaLetter(content: string): { before: string; letter: string; after: string } | null {
  const hrPattern = /\n---\n([\s\S]+?)\n---\n/
  const match = content.match(hrPattern)
  if (!match) return null

  const idx = content.indexOf(match[0])
  return {
    before: content.slice(0, idx).trim(),
    letter: match[1].trim(),
    after: content.slice(idx + match[0].length).trim(),
  }
}

// ---- FIPPA letter card (light surface, Inter body) ----

function FippaLetterCard({ letter }: { letter: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(letter)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable
    }
  }, [letter])

  const handleDownload = useCallback(() => {
    const blob = new Blob([letter], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'fippa-request.txt'
    a.click()
    URL.revokeObjectURL(url)
  }, [letter])

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e7e5e4',
        borderTop: '2px solid #C85B5B',
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{
          backgroundColor: 'rgba(200,91,91,0.05)',
          borderBottom: '1px solid rgba(200,91,91,0.12)',
        }}
      >
        <span
          className="font-bold uppercase tracking-[0.1em]"
          style={{ fontSize: '11px', lineHeight: '1', color: '#C85B5B' }}
        >
          FIPPA Request — Ready to File
        </span>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={handleDownload}
            aria-label="Download FIPPA letter as text file"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors duration-150 hover:border-opacity-30"
            style={{
              fontSize: '11px',
              lineHeight: '1',
              backgroundColor: 'rgba(200,91,91,0.06)',
              border: '1px solid rgba(200,91,91,0.15)',
              color: '#78716c',
            }}
          >
            <Download size={11} strokeWidth={2} />
            <span className="hidden sm:inline">Download</span>
          </button>
          <button
            onClick={handleCopy}
            aria-label="Copy FIPPA letter to clipboard"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-all duration-150"
            style={{
              fontSize: '11px',
              lineHeight: '1',
              backgroundColor: copied ? 'rgba(91,200,138,0.10)' : 'rgba(200,91,91,0.06)',
              border: copied
                ? '1px solid rgba(91,200,138,0.25)'
                : '1px solid rgba(200,91,91,0.15)',
              color: copied ? '#5BC88A' : '#78716c',
            }}
          >
            {copied ? (
              <>
                <Check size={11} strokeWidth={2.5} />
                Copied
              </>
            ) : (
              <>
                <Copy size={11} strokeWidth={2} />
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Plain-language preamble */}
      <div
        className="px-5 pt-4 pb-4"
        style={{
          fontSize: '13px',
          lineHeight: '1.6',
          color: '#78716c',
          borderBottom: '1px dashed #e7e5e4',
        }}
      >
        This is a formal request under the Freedom of Information and Protection of Privacy Act. You can copy and send this directly to the public body named above.
      </div>

      {/* Letter body */}
      <div className="p-5">
        <pre
          role="region"
          aria-label="FIPPA Request Letter"
          className="whitespace-pre-wrap"
          style={{
            fontFamily: '"Inter", system-ui, sans-serif',
            fontSize: '14px',
            lineHeight: '1.65',
            color: '#292524',
          }}
        >
          {letter}
        </pre>
      </div>
    </div>
  )
}

// ---- Civic Actions section renderer ----

function CivicActionsSection({ content }: { content: string }) {
  const fippa = extractFippaLetter(content)

  if (!fippa) {
    return <ProseSection content={content} />
  }

  return (
    <div className="space-y-5">
      {fippa.before && <ProseSection content={fippa.before} />}
      <FippaLetterCard letter={fippa.letter} />
      {fippa.after && <ProseSection content={fippa.after} />}
    </div>
  )
}

// ---- Questions section renderer (Gadfly gold, light surface) ----

function QuestionsSection({ content }: { content: string }) {
  const lines = content.split('\n').filter((l) => l.trim())
  const questions: string[] = []

  for (const line of lines) {
    const numbered = line.match(/^\d+[.)]\s+(.+)$/)
    if (numbered) {
      questions.push(numbered[1].trim())
    } else if (line.match(/^[-*]\s+/)) {
      questions.push(line.replace(/^[-*]\s+/, '').trim())
    }
  }

  if (questions.length === 0) {
    return <ProseSection content={content} />
  }

  return (
    <ol className="space-y-4 list-none p-0" aria-label="Questions worth asking">
      {questions.map((q, i) => (
        <li key={i} className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="flex-shrink-0 flex items-center justify-center rounded-full font-bold"
            style={{
              width: '24px',
              height: '24px',
              fontSize: '11px',
              lineHeight: '1',
              backgroundColor: 'rgba(200,168,75,0.10)',
              border: '1px solid rgba(200,168,75,0.25)',
              color: '#C8A84B',
              marginTop: '1px',
            }}
          >
            {i + 1}
          </span>
          <p
            className="font-medium"
            style={{ fontSize: '15px', lineHeight: '1.55', color: '#1c1917' }}
          >
            {renderInline(q)}
          </p>
        </li>
      ))}
    </ol>
  )
}

// ---- Limitations section renderer ----

function LimitationsSection({ content }: { content: string }) {
  return (
    <div
      role="note"
      style={{
        backgroundColor: 'rgba(120,113,108,0.04)',
        border: '1px solid #e0ddd9',
        borderLeft: '3px solid #a8a29e',
        borderRadius: '0 8px 8px 0',
        padding: '16px 20px',
      }}
    >
      <div
        className="font-semibold uppercase tracking-[0.1em]"
        style={{ fontSize: '10px', color: '#a8a29e', marginBottom: '10px' }}
      >
        What This Analysis Cannot See
      </div>
      <div style={{ fontSize: '15px', lineHeight: '1.6', color: '#57534e' }}>
        <ProseSection content={content} />
      </div>
    </div>
  )
}

// ---- Inline Gadfly action (after Oracle section) ----

function InlineGadflyAction() {
  return (
    <div
      className="action-button mt-5 pt-5 flex items-center justify-between gap-4"
      style={{ borderTop: '1px solid #e7e5e4' }}
    >
      <span style={{ fontSize: '13px', lineHeight: '1', color: '#78716c' }}>
        Have more questions about this?
      </span>
      <Link
        href="/gadfly"
        className="inline-flex items-center gap-1.5 rounded-lg font-semibold transition-all duration-150 hover:opacity-90"
        style={{
          padding: '7px 14px',
          fontSize: '12px',
          lineHeight: '1',
          backgroundColor: 'rgba(200,168,75,0.08)',
          border: '1px solid rgba(200,168,75,0.20)',
          color: '#C8A84B',
        }}
      >
        <MessageCircleQuestion size={12} strokeWidth={2} />
        Explore with Gadfly
      </Link>
    </div>
  )
}

// ---- Executive card (always first) ----

function ExecutiveCard({ sections }: { sections: ParsedSection[] }) {
  const concernSection = sections.find((s) => s.heading.toLowerCase().includes('your concern'))
  const concernText = concernSection?.content
    ? concernSection.content
        .split(/\n{2,}/)[0]
        ?.replace(/^[-*]\s+/, '')
        .replace(/\*\*/g, '')
        .trim()
    : null

  // Key findings: all section headings except concern and limitations
  const findingHeadings = sections
    .map((s) => s.heading)
    .filter(
      (h) =>
        !h.toLowerCase().includes('your concern') &&
        !h.toLowerCase().includes('cannot see') &&
        !h.toLowerCase().includes('limitations')
    )

  // Detect which action chips to show
  const chips: { label: string; arm: keyof typeof ARM_COLORS; href: string }[] = []
  const hasLever = sections.some(
    (s) => s.heading.toLowerCase().includes('what you can do') || s.heading.toLowerCase().includes('you can do')
  )
  const hasMirror = sections.some(
    (s) => s.heading.toLowerCase().includes('other places') || s.heading.toLowerCase().includes('how other')
  )
  const hasGadfly = sections.some(
    (s) => s.heading.toLowerCase().includes('questions worth') || s.heading.toLowerCase().includes('worth asking')
  )
  const hasOracle = sections.some(
    (s) => s.heading.toLowerCase().includes('public record') || s.heading.toLowerCase().includes('record shows')
  )

  if (hasLever) {
    const leverSection = sections.find(
      (s) => s.heading.toLowerCase().includes('what you can do') || s.heading.toLowerCase().includes('you can do')
    )
    const hasFippa = leverSection ? extractFippaLetter(leverSection.content) !== null : false
    chips.push({
      label: hasFippa ? 'File a FIPPA Request' : 'Take Civic Action',
      arm: 'lever',
      href: '/lever',
    })
  }
  if (hasMirror) chips.push({ label: 'Compare Jurisdictions', arm: 'mirror', href: '/mirror' })
  if (hasGadfly) chips.push({ label: 'Ask Gadfly', arm: 'gadfly', href: '/gadfly' })
  if (hasOracle) chips.push({ label: 'Analyse Documents', arm: 'oracle', href: '/oracle' })

  if (!concernText && findingHeadings.length === 0) return null

  return (
    <div
      style={{
        marginBottom: '40px',
        paddingBottom: '32px',
        borderBottom: '2px solid #e7e5e4',
      }}
    >
      {concernText && (
        <>
          <div
            className="font-semibold uppercase tracking-[0.1em]"
            style={{ fontSize: '11px', color: '#78716c', marginBottom: '8px' }}
          >
            Your Concern
          </div>
          <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#44403c', maxWidth: '60ch' }}>
            {concernText}
          </p>
        </>
      )}

      {findingHeadings.length > 0 && (
        <>
          <div
            className="font-semibold uppercase tracking-[0.1em]"
            style={{ fontSize: '11px', color: '#78716c', marginTop: '24px', marginBottom: '12px' }}
          >
            Key Areas
          </div>
          <ul className="space-y-2 list-none p-0">
            {findingHeadings.map((heading, i) => (
              <li key={i} className="flex items-start gap-2.5" style={{ fontSize: '14px', lineHeight: '1.5', color: '#292524' }}>
                <span
                  className="flex-shrink-0 rounded-full"
                  style={{ width: '6px', height: '6px', backgroundColor: '#C85B5B', marginTop: '6px' }}
                />
                {heading}
              </li>
            ))}
          </ul>
        </>
      )}

      {chips.length > 0 && (
        <div
          className="flex flex-wrap gap-2"
          style={{ marginTop: '20px' }}
        >
          {chips.map((chip) => {
            const arm = ARM_COLORS[chip.arm]
            return (
              <Link
                key={chip.label}
                href={chip.href}
                className="inline-flex items-center rounded-full font-semibold transition-opacity duration-150 hover:opacity-80"
                style={{
                  padding: '6px 14px',
                  minHeight: '36px',
                  fontSize: '12px',
                  lineHeight: '1',
                  backgroundColor: arm.bg,
                  border: `1px solid ${arm.border}`,
                  color: arm.color,
                }}
              >
                {chip.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---- Section divider ----

function SectionDivider() {
  return (
    <div
      style={{
        borderTop: '1px solid #e7e5e4',
        margin: '32px 0',
      }}
    />
  )
}

// ---- Go Deeper strip (light surface) ----

const EXPERT_LINKS = [
  {
    label: 'Explore documents in detail',
    href: '/scout',
    icon: Compass,
    color: '#B088C8',
    bg: 'rgba(176,136,200,0.06)',
    border: 'rgba(176,136,200,0.18)',
    arm: 'Scout',
  },
  {
    label: 'Upload a document for analysis',
    href: '/oracle',
    icon: Eye,
    color: '#89B4C8',
    bg: 'rgba(137,180,200,0.06)',
    border: 'rgba(137,180,200,0.18)',
    arm: 'Oracle',
  },
  {
    label: 'Investigate through questions',
    href: '/gadfly',
    icon: MessageCircleQuestion,
    color: '#C8A84B',
    bg: 'rgba(200,168,75,0.06)',
    border: 'rgba(200,168,75,0.18)',
    arm: 'Gadfly',
  },
  {
    label: 'Generate more civic actions',
    href: '/lever',
    icon: FileText,
    color: '#C85B5B',
    bg: 'rgba(200,91,91,0.06)',
    border: 'rgba(200,91,91,0.18)',
    arm: 'Lever',
  },
  {
    label: 'Compare more jurisdictions',
    href: '/mirror',
    icon: GitCompare,
    color: '#5BC88A',
    bg: 'rgba(91,200,138,0.06)',
    border: 'rgba(91,200,138,0.18)',
    arm: 'Mirror',
  },
]

function GoDeeper() {
  return (
    <div style={{ marginTop: '40px', paddingTop: '32px', borderTop: '1px solid #e7e5e4' }}>
      <p
        className="font-semibold uppercase tracking-[0.1em]"
        style={{ fontSize: '11px', color: '#a8a29e', marginBottom: '16px' }}
      >
        Want to go deeper?
      </p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {EXPERT_LINKS.map((link) => {
          const Icon = link.icon
          return (
            <Link
              key={link.href}
              href={link.href}
              className="link-card flex items-center gap-3 rounded-[10px] transition-opacity duration-150 hover:opacity-85"
              style={{
                padding: '12px 14px',
                minHeight: '44px',
                backgroundColor: link.bg,
                border: `1px solid ${link.border}`,
              }}
            >
              <span
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${link.color}18` }}
              >
                <Icon size={13} strokeWidth={1.75} style={{ color: link.color }} />
              </span>
              <span className="flex flex-col">
                <span
                  className="font-semibold leading-snug"
                  style={{ fontSize: '11px', color: link.color }}
                >
                  {link.arm}
                </span>
                <span
                  className="leading-snug"
                  style={{ fontSize: '11px', color: '#78716c', marginTop: '3px' }}
                >
                  {link.label}
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

export function BriefingView({ text, isStreaming }: BriefingViewProps) {
  const sections = useMemo(() => parseSections(text), [text])
  const hasSections = sections.length > 0

  // Raw streaming before first section
  if (isStreaming && !hasSections) {
    return (
      <article
        className="content-island"
        style={{
          backgroundColor: '#fafaf9',
          color: '#1c1917',
          maxWidth: '672px',
          margin: '0 auto',
          padding: '40px',
          borderRadius: '16px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.4), 0 20px 60px -10px rgba(0,0,0,0.6)',
        }}
      >
        <p
          className="whitespace-pre-wrap"
          style={{ fontSize: '16px', lineHeight: '1.7', color: '#44403c' }}
        >
          {text}
        </p>
        <span className="mt-1 inline-block h-4 w-0.5 animate-pulse" style={{ backgroundColor: '#78716c' }} />
      </article>
    )
  }

  return (
    <article
      className="content-island"
      style={{
        backgroundColor: '#fafaf9',
        color: '#1c1917',
        maxWidth: '672px',
        margin: '0 auto',
        padding: 'clamp(32px, 5vw, 40px) clamp(20px, 5vw, 40px)',
        borderRadius: 'clamp(12px, 2vw, 16px)',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.4), 0 20px 60px -10px rgba(0,0,0,0.6)',
      }}
    >
      {/* Executive card — always first when we have sections */}
      {hasSections && <ExecutiveCard sections={sections} />}

      {sections.map((section, i) => {
        const headingLower = section.heading.toLowerCase()
        const isFirst = i === 0
        const showDivider = !isFirst

        // --- Your Concern ---
        if (headingLower.includes('your concern')) {
          return (
            <div key={i}>
              {showDivider && <SectionDivider />}
              <SectionHeader heading="Your Concern" />
              <div
                className="rounded-xl p-5"
                style={{
                  backgroundColor: 'rgba(176,136,200,0.06)',
                  border: '1px solid rgba(176,136,200,0.18)',
                }}
              >
                <ProseSection content={section.content} />
              </div>
            </div>
          )
        }

        // --- What Governs This (document discovery) ---
        if (headingLower.includes('what governs') || headingLower.includes('governs this')) {
          const blocks = splitDocumentBlocks(section.content)
          const hasCards = blocks.some((b) => parseDocumentFields(b).length > 0)
          return (
            <div key={i}>
              {showDivider && <SectionDivider />}
              <SectionHeader heading="What Governs This" />
              {hasCards ? (
                <div className="space-y-4">
                  {blocks.map((block, j) => (
                    <DocumentCard key={j} block={block} />
                  ))}
                </div>
              ) : (
                <ProseSection content={section.content} />
              )}
            </div>
          )
        }

        // --- What the Public Record Shows (analysis) ---
        if (headingLower.includes('public record') || headingLower.includes('record shows')) {
          return (
            <div key={i}>
              {showDivider && <SectionDivider />}
              <SectionHeader heading="What the Public Record Shows" />
              <ProseSection content={section.content} />
              <InlineGadflyAction />
            </div>
          )
        }

        // --- What You Can Do (civic actions + FIPPA letter) ---
        if (headingLower.includes('what you can do') || headingLower.includes('you can do')) {
          return (
            <div key={i}>
              {showDivider && <SectionDivider />}
              <SectionHeader heading="What You Can Do" color="#C85B5B" />
              <CivicActionsSection content={section.content} />
            </div>
          )
        }

        // --- How Other Places Handle This (mirror comparison) ---
        if (headingLower.includes('other places') || headingLower.includes('how other')) {
          return (
            <div key={i}>
              {showDivider && <SectionDivider />}
              <SectionHeader heading="How Other Places Handle This" />
              <ProseSection content={section.content} />
            </div>
          )
        }

        // --- Questions Worth Asking (gadfly) ---
        if (headingLower.includes('questions worth') || headingLower.includes('worth asking')) {
          return (
            <div key={i}>
              {showDivider && <SectionDivider />}
              <SectionHeader heading="Questions Worth Asking" color="#C8A84B" />
              <QuestionsSection content={section.content} />
            </div>
          )
        }

        // --- What This Analysis Cannot See (limitations) ---
        if (headingLower.includes('cannot see') || headingLower.includes('limitations')) {
          return (
            <div key={i}>
              {showDivider && <SectionDivider />}
              <LimitationsSection content={section.content} />
            </div>
          )
        }

        // --- Fallback ---
        return (
          <div key={i}>
            {showDivider && <SectionDivider />}
            <SectionHeader heading={section.heading} />
            <ProseSection content={section.content} />
          </div>
        )
      })}

      {isStreaming && (
        <span
          className="mt-2 inline-block h-4 w-0.5 animate-pulse"
          style={{ backgroundColor: '#78716c' }}
        />
      )}

      {/* Go Deeper footer — only when streaming is complete */}
      {!isStreaming && hasSections && <GoDeeper />}
    </article>
  )
}
