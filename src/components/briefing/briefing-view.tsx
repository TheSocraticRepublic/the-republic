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

// ---- Arm attribution config ----

const ARM_BADGES: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  scout: {
    label: 'Scout',
    color: '#B088C8',
    bg: 'rgba(176, 136, 200, 0.10)',
    border: 'rgba(176, 136, 200, 0.25)',
  },
  oracle: {
    label: 'Oracle',
    color: '#89B4C8',
    bg: 'rgba(137, 180, 200, 0.10)',
    border: 'rgba(137, 180, 200, 0.25)',
  },
  lever: {
    label: 'Lever',
    color: '#C85B5B',
    bg: 'rgba(200, 91, 91, 0.10)',
    border: 'rgba(200, 91, 91, 0.25)',
  },
  mirror: {
    label: 'Mirror',
    color: '#5BC88A',
    bg: 'rgba(91, 200, 138, 0.10)',
    border: 'rgba(91, 200, 138, 0.25)',
  },
  gadfly: {
    label: 'Gadfly',
    color: '#C8A84B',
    bg: 'rgba(200, 168, 75, 0.10)',
    border: 'rgba(200, 168, 75, 0.25)',
  },
}

function getArmBadge(heading: string) {
  const lower = heading.toLowerCase()
  if (lower.includes('your concern')) return ARM_BADGES.scout
  if (lower.includes('what governs') || lower.includes('governs this')) return ARM_BADGES.scout
  if (lower.includes('public record') || lower.includes('record shows')) return ARM_BADGES.oracle
  if (lower.includes('what you can do') || lower.includes('you can do')) return ARM_BADGES.lever
  if (lower.includes('other places') || lower.includes('how other')) return ARM_BADGES.mirror
  if (lower.includes('questions worth') || lower.includes('worth asking')) return ARM_BADGES.gadfly
  return null
}

// ---- Section parser ----

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

// ---- Arm badge component ----

function ArmBadge({ arm }: { arm: { label: string; color: string; bg: string; border: string } }) {
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{
        color: arm.color,
        backgroundColor: arm.bg,
        border: `1px solid ${arm.border}`,
      }}
    >
      {arm.label}
    </span>
  )
}

// ---- Section header with arm badge ----

function SectionHeader({
  heading,
  arm,
}: {
  heading: string
  arm: { label: string; color: string; bg: string; border: string } | null
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3
        className="text-xs font-semibold uppercase tracking-widest text-neutral-500"
      >
        {heading}
      </h3>
      {arm && <ArmBadge arm={arm} />}
    </div>
  )
}

// ---- Prose renderer ----

function renderInline(text: string): string {
  // Strip bold markers for display — keep it clean
  return text.replace(/\*\*(.+?)\*\*/g, '$1')
}

function ProseSection({ content }: { content: string }) {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <div className="space-y-3">
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
                <li key={j} className="flex items-start gap-2 text-sm leading-relaxed text-neutral-300">
                  <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-neutral-600" />
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
              <span className="block text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {boldFieldMatch[1]}
              </span>
              <p className="mt-0.5 text-sm leading-relaxed text-neutral-300">
                {renderInline(boldFieldMatch[2])}
              </p>
            </div>
          )
        }

        return (
          <p key={i} className="text-sm leading-relaxed text-neutral-300 whitespace-pre-wrap">
            {renderInline(para)}
          </p>
        )
      })}
    </div>
  )
}

// ---- Document field parser ----

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

// ---- Access badge ----

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
    bg: 'rgba(91, 200, 138, 0.1)',
    border: 'rgba(91, 200, 138, 0.3)',
    color: '#5BC88A',
    label: 'Public',
  },
  fippa: {
    bg: 'rgba(200, 168, 75, 0.1)',
    border: 'rgba(200, 168, 75, 0.3)',
    color: '#C8A84B',
    label: 'FIPPA Required',
  },
  council: {
    bg: 'rgba(137, 180, 200, 0.1)',
    border: 'rgba(137, 180, 200, 0.3)',
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

// ---- Document card ----

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
      <div className="rounded-xl border border-white/[0.08] bg-black/50 p-5 backdrop-blur-md">
        <p className="text-sm leading-relaxed text-neutral-300 whitespace-pre-wrap">
          {renderInline(block)}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/50 p-5 backdrop-blur-md">
      <div className="mb-4 flex items-start justify-between gap-3">
        {docName && (
          <span
            className="text-sm font-semibold text-neutral-100"
            style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
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
              <span className="block text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {field.label}
              </span>
              <p className="mt-0.5 text-sm leading-relaxed text-neutral-300">{renderInline(field.value)}</p>
            </div>
          ))}
        </div>
      )}

      {howToFindField && (
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <span className="block text-xs font-semibold uppercase tracking-wider text-neutral-600">
            How to find it
          </span>
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
            {renderInline(howToFindField.value)}
          </p>
        </div>
      )}
    </div>
  )
}

// ---- Block splitter ----

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

// ---- FIPPA letter detector and renderer ----

function extractFippaLetter(content: string): { before: string; letter: string; after: string } | null {
  // Look for the horizontal rule delimiters surrounding the letter
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
      className="rounded-xl backdrop-blur-md"
      style={{
        backgroundColor: 'rgba(200, 91, 91, 0.04)',
        border: '1px solid rgba(200, 91, 91, 0.20)',
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between rounded-t-xl px-5 py-3"
        style={{
          backgroundColor: 'rgba(200, 91, 91, 0.08)',
          borderBottom: '1px solid rgba(200, 91, 91, 0.15)',
        }}
      >
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: '#C85B5B' }}
        >
          FIPPA Request — Ready to File
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-neutral-500 transition-colors hover:text-neutral-300"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
            title="Download as text file"
          >
            <Download size={11} strokeWidth={2} />
            Download
          </button>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors"
            style={{
              backgroundColor: copied ? 'rgba(91, 200, 138, 0.12)' : 'rgba(255,255,255,0.05)',
              color: copied ? '#5BC88A' : '#a3a3a3',
            }}
            title="Copy to clipboard"
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

      {/* Letter body */}
      <div className="p-5">
        <pre
          className="whitespace-pre-wrap text-xs leading-relaxed text-neutral-300"
          style={{ fontFamily: '"SF Mono", "JetBrains Mono", "Fira Code", ui-monospace, monospace' }}
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

// ---- Questions section renderer ----

function QuestionsSection({ content }: { content: string }) {
  const lines = content.split('\n').filter((l) => l.trim())
  const questions: string[] = []

  for (const line of lines) {
    // Numbered list: "1. Question text" or "1) Question text"
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
    <ol className="space-y-3 list-none p-0">
      {questions.map((q, i) => (
        <li key={i} className="flex items-start gap-4">
          <span
            className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
            style={{
              backgroundColor: 'rgba(200, 168, 75, 0.12)',
              color: '#C8A84B',
              border: '1px solid rgba(200, 168, 75, 0.25)',
            }}
          >
            {i + 1}
          </span>
          <p className="text-sm font-medium leading-relaxed text-neutral-200">
            {renderInline(q)}
          </p>
        </li>
      ))}
    </ol>
  )
}

// ---- "Go deeper" footer ----

const EXPERT_LINKS = [
  {
    label: 'Explore documents in detail',
    href: '/scout',
    icon: Compass,
    color: '#B088C8',
    bg: 'rgba(176, 136, 200, 0.06)',
    border: 'rgba(176, 136, 200, 0.18)',
    arm: 'Scout',
  },
  {
    label: 'Upload a document for analysis',
    href: '/oracle',
    icon: Eye,
    color: '#89B4C8',
    bg: 'rgba(137, 180, 200, 0.06)',
    border: 'rgba(137, 180, 200, 0.18)',
    arm: 'Oracle',
  },
  {
    label: 'Investigate through questions',
    href: '/gadfly',
    icon: MessageCircleQuestion,
    color: '#C8A84B',
    bg: 'rgba(200, 168, 75, 0.06)',
    border: 'rgba(200, 168, 75, 0.18)',
    arm: 'Gadfly',
  },
  {
    label: 'Generate more civic actions',
    href: '/lever',
    icon: FileText,
    color: '#C85B5B',
    bg: 'rgba(200, 91, 91, 0.06)',
    border: 'rgba(200, 91, 91, 0.18)',
    arm: 'Lever',
  },
  {
    label: 'Compare more jurisdictions',
    href: '/mirror',
    icon: GitCompare,
    color: '#5BC88A',
    bg: 'rgba(91, 200, 138, 0.06)',
    border: 'rgba(91, 200, 138, 0.18)',
    arm: 'Mirror',
  },
]

function GoDeeper() {
  return (
    <div>
      <div
        className="mb-6 h-px w-full"
        style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)' }}
      />
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-600">
        Want to go deeper?
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {EXPERT_LINKS.map((link) => {
          const Icon = link.icon
          return (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-center gap-3 rounded-xl p-3.5 transition-all duration-150 hover:opacity-90"
              style={{
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
                  className="text-[11px] font-semibold leading-tight"
                  style={{ color: link.color }}
                >
                  {link.arm}
                </span>
                <span className="mt-0.5 text-[11px] leading-tight text-neutral-600">
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
      <div className="rounded-xl border border-white/[0.06] bg-black/40 p-5">
        <p className="text-sm leading-relaxed text-neutral-400 whitespace-pre-wrap">{text}</p>
        <span className="mt-1 inline-block h-4 w-1 animate-pulse bg-white/30" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {sections.map((section, i) => {
        const headingLower = section.heading.toLowerCase()
        const arm = getArmBadge(section.heading)

        // --- Your Concern ---
        if (headingLower.includes('your concern')) {
          return (
            <div key={i}>
              <SectionHeader heading="Your Concern" arm={arm} />
              <div
                className="rounded-xl p-5 backdrop-blur-md"
                style={{
                  backgroundColor: 'rgba(176, 136, 200, 0.04)',
                  border: '1px solid rgba(176, 136, 200, 0.12)',
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
              <SectionHeader heading="What Governs This" arm={arm} />
              {hasCards ? (
                <div className="space-y-4">
                  {blocks.map((block, j) => (
                    <DocumentCard key={j} block={block} />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-white/[0.08] bg-black/50 p-5 backdrop-blur-md">
                  <ProseSection content={section.content} />
                </div>
              )}
            </div>
          )
        }

        // --- What the Public Record Shows (analysis) ---
        if (headingLower.includes('public record') || headingLower.includes('record shows')) {
          return (
            <div key={i}>
              <SectionHeader heading="What the Public Record Shows" arm={arm} />
              <div className="rounded-xl border border-white/[0.08] bg-black/50 p-5 backdrop-blur-md">
                <ProseSection content={section.content} />
              </div>
            </div>
          )
        }

        // --- What You Can Do (civic actions + FIPPA letter) ---
        if (headingLower.includes('what you can do') || headingLower.includes('you can do')) {
          return (
            <div key={i}>
              <SectionHeader heading="What You Can Do" arm={arm} />
              <CivicActionsSection content={section.content} />
            </div>
          )
        }

        // --- How Other Places Handle This (mirror comparison) ---
        if (headingLower.includes('other places') || headingLower.includes('how other')) {
          return (
            <div key={i}>
              <SectionHeader heading="How Other Places Handle This" arm={arm} />
              <div className="rounded-xl border border-white/[0.08] bg-black/50 p-5 backdrop-blur-md">
                <ProseSection content={section.content} />
              </div>
            </div>
          )
        }

        // --- Questions Worth Asking (gadfly) ---
        if (headingLower.includes('questions worth') || headingLower.includes('worth asking')) {
          return (
            <div key={i}>
              <SectionHeader heading="Questions Worth Asking" arm={arm} />
              <div className="rounded-xl border border-white/[0.08] bg-black/50 p-5 backdrop-blur-md">
                <QuestionsSection content={section.content} />
              </div>
            </div>
          )
        }

        // --- Fallback ---
        return (
          <div key={i}>
            <SectionHeader heading={section.heading} arm={arm} />
            <div className="rounded-xl border border-white/[0.08] bg-black/50 p-5 backdrop-blur-md">
              <ProseSection content={section.content} />
            </div>
          </div>
        )
      })}

      {isStreaming && (
        <span className="inline-block h-4 w-1 animate-pulse bg-white/30" />
      )}

      {/* Go Deeper footer — only when streaming is complete */}
      {!isStreaming && hasSections && <GoDeeper />}
    </div>
  )
}
