'use client'

import { useMemo, useCallback, useState } from 'react'
import Link from 'next/link'
import {
  Compass,
  Eye,
  MessageCircleQuestion,
  FileText,
  GitCompareArrows,
  Copy,
  Check,
  Download,
  Sun,
  Moon,
  EyeOff,
} from 'lucide-react'

// ---- Types ----

interface BriefingViewProps {
  text: string
  isStreaming: boolean
  darkMode?: boolean
  onToggleDarkMode?: () => void
  onOpenLens?: () => void
  onOpenCampaign?: () => void
  onOpenGadfly?: () => void
  onScrollToQuestions?: () => void
}

// ---- Palette (light / dark island themes) ----

const LIGHT_PALETTE = {
  bg: '#fafaf9',
  text: '#1c1917',
  secondary: '#44403c',
  body: '#292524',
  muted: '#78716c',
  faint: '#a8a29e',
  border: '#e7e5e4',
  cardBg: '#f5f4f3',
  cardBorder: '#e0ddd9',
  white: '#ffffff',
  warmLift: '#fffdf8',
  // Oracle teal accents -- arm colors that work in both modes
  evidenceCalloutBg: 'rgba(8,145,178,0.04)',
  evidenceCalloutBorder: 'rgba(8,145,178,0.3)',
  pullQuoteBorder: 'rgba(8,145,178,0.25)',
}

const DARK_PALETTE = {
  bg: '#111113',
  text: '#f4f4f5',
  secondary: '#d4d4d8',
  body: '#d4d4d8',
  muted: '#a1a1aa',
  faint: '#71717a',
  border: 'rgba(255,255,255,0.08)',
  cardBg: '#18181b',
  cardBorder: 'rgba(255,255,255,0.15)',
  white: '#1e1e20',
  warmLift: '#141416',
  // Oracle teal accents -- slightly higher opacity on dark surfaces
  evidenceCalloutBg: 'rgba(8,145,178,0.08)',
  evidenceCalloutBorder: 'rgba(8,145,178,0.3)',
  pullQuoteBorder: 'rgba(8,145,178,0.25)',
}

type Palette = typeof LIGHT_PALETTE

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

// ---- Section accent color map ----

function getSectionAccentColor(heading: string): string | null {
  const h = heading.toLowerCase()
  if (h.includes('what governs')) return '#B088C8'     // Scout purple
  if (h.includes('public record')) return '#89B4C8'    // Oracle teal
  if (h.includes('key players')) return '#89B4C8'      // Oracle teal
  if (h.includes('what you can do')) return '#C85B5B'  // Lever red
  if (h.includes('other places') || h.includes('jurisdictions')) return '#5BC88A' // Mirror green
  if (h.includes('questions')) return '#C8A84B'        // Gadfly gold
  // "cannot see" / "limitations" -> no bar
  return null
}

// (W4: isOracleSection removed — dead code)

// ---- Section header (no arm badge — color carries identity) ----

function SectionHeader({
  heading,
  color,
  palette,
}: {
  heading: string
  color?: string
  palette: Palette
}) {
  const accentColor = getSectionAccentColor(heading)

  return (
    <div className="mb-6 flex flex-col">
      {accentColor && (
        <div
          style={{
            width: '48px',
            height: '2px',
            backgroundColor: accentColor,
            opacity: 0.4,
            marginBottom: '8px',
          }}
        />
      )}
      <h3
        className="text-[11px] font-semibold uppercase tracking-[0.1em]"
        style={{ color: color ?? palette.muted }}
      >
        {heading}
      </h3>
    </div>
  )
}

// ---- Prose renderer ----

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  if (parts.length === 1) return text
  return parts.map((part, i) => {
    const boldMatch = part.match(/^\*\*([^*]+)\*\*$/)
    if (boldMatch) return <strong key={i}>{boldMatch[1]}</strong>
    return part
  })
}

// ---- Evidence citation detection ----

function isEvidenceParagraph(text: string): boolean {
  return /s\.\s*\d/.test(text) ||
    /FIPPA/i.test(text) ||
    /\b[A-Z][a-z]+ Act\b/.test(text) ||
    /\bpursuant\b/i.test(text) ||
    /\bCertificate\b/.test(text) ||
    /\([^)]*(?:19|20)\d{2}[^)]*\)/.test(text)
}

// ---- Pull quote detection ----

function isPullQuote(text: string): boolean {
  const trimmed = text.trim()
  // Starts and ends with quotation marks (straight or curly)
  if (/^[""“]/.test(trimmed) && /[""”][\.\,\;]?$/.test(trimmed)) return true
  // Contains a full sentence in quotes (at least 30 chars inside quotes)
  if (/[""“][^""”]{30,}[""”]/.test(trimmed)) return true
  return false
}

function ProseSection({ content, palette, oracleSerif }: { content: string; palette: Palette; oracleSerif?: boolean }) {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  const baseFont = oracleSerif
    ? { fontFamily: '"Source Serif 4", Georgia, serif', fontSize: '16px', lineHeight: '1.75', fontWeight: 400 as const }
    : { fontSize: '16px', lineHeight: '1.7' }

  const elements: React.ReactNode[] = []

  paragraphs.forEach((para, i) => {
    // Insert section break rule after every 4th paragraph
    if (i > 0 && i % 4 === 0) {
      elements.push(
        <div
          key={`rule-${i}`}
          style={{
            width: '40%',
            margin: '24px auto',
            height: '1px',
            backgroundColor: palette.border,
          }}
        />
      )
    }

    // Bullet list paragraph
    if (para.match(/^[-*]\s+/m)) {
      const items = para
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => line.replace(/^[-*]\s+/, '').trim())
      elements.push(
        <ul key={i} className="space-y-1.5 pl-0">
          {items.map((item, j) => (
            <li key={j} className="flex items-start gap-2" style={{ fontSize: '15px', lineHeight: '1.6', color: palette.secondary }}>
              <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full" style={{ backgroundColor: palette.faint }} />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      )
      return
    }

    // Bold field line (e.g. **Label:** value)
    const boldFieldMatch = para.match(/^\*\*(.+?):\*\*\s*(.+)$/)
    if (boldFieldMatch) {
      elements.push(
        <div key={i}>
          <span
            className="block font-semibold uppercase tracking-wider"
            style={{ fontSize: '11px', color: palette.muted }}
          >
            {boldFieldMatch[1]}
          </span>
          <p className="mt-0.5" style={{ ...baseFont, color: palette.body }}>
            {renderInline(boldFieldMatch[2])}
          </p>
        </div>
      )
      return
    }

    // Pull quote (Oracle sections only)
    if (oracleSerif && isPullQuote(para)) {
      elements.push(
        <blockquote
          key={i}
          style={{
            fontFamily: '"Source Serif 4", Georgia, serif',
            fontStyle: 'italic',
            fontSize: '18px',
            lineHeight: '1.5',
            color: palette.secondary,
            paddingLeft: '24px',
            borderLeft: `2px solid ${palette.pullQuoteBorder}`,
            margin: '24px 0',
            maxWidth: '55ch',
          }}
        >
          {renderInline(para)}
        </blockquote>
      )
      return
    }

    // Evidence callout
    if (isEvidenceParagraph(para)) {
      elements.push(
        <div
          key={i}
          style={{
            borderLeft: `3px solid ${palette.evidenceCalloutBorder}`,
            backgroundColor: palette.evidenceCalloutBg,
            padding: '16px',
            borderRadius: '0 8px 8px 0',
            margin: '16px 0',
          }}
        >
          <p className="whitespace-pre-wrap" style={{ ...baseFont, color: palette.body, margin: 0 }}>
            {renderInline(para)}
          </p>
        </div>
      )
      return
    }

    // Lead paragraph (first paragraph gets larger treatment)
    const isLead = i === 0
    const leadFont = isLead
      ? { fontSize: '17px', lineHeight: '1.75' }
      : {}

    elements.push(
      <p key={i} className="whitespace-pre-wrap" style={{ ...baseFont, ...leadFont, color: palette.body }}>
        {renderInline(para)}
      </p>
    )
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {elements}
    </div>
  )
}

// ---- Key Players parser and renderer (Step 1) ----

interface PlayerData {
  name: string
  role: string
  whyTheyMatter: string
  trackRecord: string
}

function getRoleColor(role: string): string {
  const r = role.toLowerCase().replace(/_/g, ' ')
  if (r.includes('regulator') || r.includes('decision maker')) return '#0891B2'
  if (r.includes('proponent') || r.includes('applicant') || r.includes('certificate holder')) return '#B45309'
  if (r.includes('beneficiary') || r.includes('affected')) return '#059669'
  if (r.includes('rights holder') || r.includes('community') || r.includes('local')) return '#059669'
  if (r.includes('indigenous') || r.includes('nation') || r.includes('first nation')) return '#7C3AED'
  if (r.includes('federal')) return '#64748B'
  return '#64748B'
}

function parsePlayers(content: string): PlayerData[] {
  const players: PlayerData[] = []

  const lines = content.split('\n').map((l) => l.replace(/^\s*[-*]\s+/, '').trim()).filter(Boolean)

  const fieldLabels = /^(?:\*\*)?(?:role|why they matter|track record|what they do|how they relate)(?:\*\*)?[:\s]/i

  let current: { name: string; role: string; whyTheyMatter: string; trackRecord: string } | null = null

  for (const line of lines) {
    const cleanLine = line.replace(/\*\*/g, '')

    if (!fieldLabels.test(cleanLine) && !cleanLine.startsWith('Role:')) {
      if (current && current.name) players.push({ ...current })
      current = { name: cleanLine, role: '', whyTheyMatter: '', trackRecord: '' }
      continue
    }

    if (!current) continue

    const roleMatch = cleanLine.match(/^(?:role)[:\s]+(.+)/i)
    if (roleMatch) { current.role = roleMatch[1].replace(/^[-\s]+|[-\s]+$/g, ''); continue }

    const whyMatch = cleanLine.match(/^(?:why they matter)[:\s]+(.+)/i)
    if (whyMatch) { current.whyTheyMatter = whyMatch[1].replace(/^[-\s]+|[-\s]+$/g, ''); continue }

    const trackMatch = cleanLine.match(/^(?:track record)[:\s]+(.+)/i)
    if (trackMatch) { current.trackRecord = trackMatch[1].replace(/^[-\s]+|[-\s]+$/g, ''); continue }
  }

  if (current && current.name) players.push({ ...current })

  return players
}

function PlayersSection({ content, palette }: { content: string; palette: Palette }) {
  const players = parsePlayers(content)

  if (players.length === 0) {
    return <ProseSection content={content} palette={palette} oracleSerif />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {players.map((player, i) => {
        const roleColor = getRoleColor(player.role)
        return (
          <div
            key={i}
            style={{
              backgroundColor: palette.cardBg,
              border: `1px solid ${palette.cardBorder}`,
              borderLeft: `2px solid ${roleColor}`,
              borderRadius: '12px',
              padding: '16px 20px',
            }}
          >
            {/* Name + role badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: palette.text,
                }}
              >
                {player.name}
              </span>
              {player.role && (
                <span
                  style={{
                    display: 'inline-block',
                    borderRadius: '9999px',
                    padding: '2px 10px',
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    backgroundColor: `${roleColor}14`,
                    color: roleColor,
                    fontWeight: 500,
                  }}
                >
                  {player.role}
                </span>
              )}
            </div>

            {/* Why they matter */}
            {player.whyTheyMatter && (
              <p
                style={{
                  fontFamily: '"Inter", system-ui, sans-serif',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  color: palette.secondary,
                  marginTop: '8px',
                  marginBottom: 0,
                }}
              >
                {player.whyTheyMatter}
              </p>
            )}

            {/* Track record */}
            {player.trackRecord && (
              <p
                style={{
                  fontFamily: '"Inter", system-ui, sans-serif',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  color: palette.muted,
                  marginTop: '8px',
                  marginBottom: 0,
                }}
              >
                {player.trackRecord}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---- Mirror Comparison parser and renderer (Step 2) ----

interface JurisdictionData {
  name: string
  whatTheyDid: string
  whyItMatters: string
  outcome: string
}

function parseJurisdictions(content: string): JurisdictionData[] {
  const jurisdictions: JurisdictionData[] = []

  // Split on ### headings or **Bold Name** delimiters
  const blocks = content.split(/(?=^###\s+|^\*\*[^*]+\*\*\s*$)/m).filter((b) => b.trim())

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) continue

    // Extract jurisdiction name from heading or bold text
    let name = ''
    const h3Match = lines[0].match(/^###\s+(.+)/)
    const boldMatch = lines[0].match(/^\*\*(.+?)\*\*/)
    if (h3Match) name = h3Match[1].replace(/\*\*/g, '').trim()
    else if (boldMatch) name = boldMatch[1].trim()
    else continue

    const restLines = lines.slice(1)
    const restText = restLines.join('\n')

    // Try structured field extraction
    let whatTheyDid = ''
    let whyItMatters = ''
    let outcome = ''

    // Capture only the VALUE after the label — handle optional trailing words like "differently", "for you"
    const whatMatch = restText.match(/(?:\*\*)?[Ww]hat\s+they\s+did(?:\s+\w+)?(?:\*\*)?[:\s]+([\s\S]+?)(?=(?:\*\*)?(?:[Ww]hy\s+it|[Oo]utcome|$))/i)
    if (whatMatch) whatTheyDid = whatMatch[1].replace(/\*\*/g, '').replace(/^[-\s]+|[-\s]+$/g, '').trim()

    const whyMatch = restText.match(/(?:\*\*)?[Ww]hy\s+it\s+matters(?:\s+\w+)?(?:\*\*)?[:\s]+([\s\S]+?)(?=(?:\*\*)?(?:[Oo]utcome|$))/i)
    if (whyMatch) whyItMatters = whyMatch[1].replace(/\*\*/g, '').replace(/^[-\s]+|[-\s]+$/g, '').trim()

    const outcomeMatch = restText.match(/(?:\*\*)?[Oo]utcome(?:\s+\w+)?(?:\*\*)?[:\s]+([\s\S]+)/i)
    if (outcomeMatch) outcome = outcomeMatch[1].replace(/\*\*/g, '').replace(/^[-\s]+|[-\s]+$/g, '').trim()

    // Fallback: split paragraphs positionally
    if (!whatTheyDid && !whyItMatters) {
      const paras = restText.split(/\n{2,}/).map((p) => p.replace(/\*\*/g, '').trim()).filter(Boolean)
      if (paras.length >= 1) whatTheyDid = paras[0]
      if (paras.length >= 2) whyItMatters = paras[1]
      if (paras.length >= 3) outcome = paras[2]
    }

    if (name) {
      jurisdictions.push({ name, whatTheyDid, whyItMatters, outcome })
    }
  }

  return jurisdictions
}

function ComparisonSection({ content, palette }: { content: string; palette: Palette }) {
  const jurisdictions = parseJurisdictions(content)

  if (jurisdictions.length === 0) {
    return <ProseSection content={content} palette={palette} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {jurisdictions.map((jur, i) => (
        <div
          key={i}
          style={{
            backgroundColor: palette.cardBg,
            border: `1px solid ${palette.cardBorder}`,
            borderLeft: '2px solid #5BC88A',
            borderRadius: '12px',
            padding: '16px 20px',
          }}
        >
          {/* Jurisdiction name */}
          <span
            style={{
              fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
              fontSize: '14px',
              fontWeight: 600,
              color: palette.text,
              display: 'block',
              marginBottom: '12px',
            }}
          >
            {jur.name}
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {jur.whatTheyDid && (
              <div>
                <span
                  style={{
                    display: 'block',
                    fontFamily: '"Inter", system-ui, sans-serif',
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.08em',
                    color: palette.muted,
                    marginBottom: '4px',
                  }}
                >
                  WHAT THEY DID
                </span>
                <p style={{ fontSize: '14px', lineHeight: '1.5', color: palette.secondary, margin: 0 }}>
                  {jur.whatTheyDid}
                </p>
              </div>
            )}

            {jur.whyItMatters && (
              <div>
                <span
                  style={{
                    display: 'block',
                    fontFamily: '"Inter", system-ui, sans-serif',
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.08em',
                    color: palette.muted,
                    marginBottom: '4px',
                  }}
                >
                  WHY IT MATTERS
                </span>
                <p style={{ fontSize: '14px', lineHeight: '1.5', color: palette.secondary, margin: 0 }}>
                  {jur.whyItMatters}
                </p>
              </div>
            )}

            {jur.outcome && (
              <div>
                <span
                  style={{
                    display: 'block',
                    fontFamily: '"Inter", system-ui, sans-serif',
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.08em',
                    color: palette.muted,
                    marginBottom: '4px',
                  }}
                >
                  OUTCOME
                </span>
                <p style={{ fontSize: '14px', lineHeight: '1.5', color: palette.secondary, margin: 0 }}>
                  {jur.outcome}
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
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

function DocumentCard({ block, palette }: { block: string; palette: Palette }) {
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
        style={{ backgroundColor: palette.cardBg, border: `1px solid ${palette.cardBorder}` }}
      >
        <p className="whitespace-pre-wrap" style={{ fontSize: '16px', lineHeight: '1.7', color: palette.body }}>
          {renderInline(block)}
        </p>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl p-5"
      style={{ backgroundColor: palette.cardBg, border: `1px solid ${palette.cardBorder}` }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        {docName && (
          <span
            className="font-semibold"
            style={{
              fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
              fontSize: '14px',
              lineHeight: '1.4',
              color: palette.text,
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
                style={{ fontSize: '10px', color: palette.muted, marginBottom: '4px' }}
              >
                {field.label}
              </span>
              <p style={{ fontSize: '14px', lineHeight: '1.5', color: palette.secondary }}>
                {renderInline(field.value)}
              </p>
            </div>
          ))}
        </div>
      )}

      {howToFindField && (
        <div
          className="mt-4 pt-3"
          style={{ borderTop: `1px solid ${palette.border}`, marginTop: '16px', paddingTop: '12px' }}
        >
          <span
            className="block font-semibold uppercase tracking-[0.08em]"
            style={{ fontSize: '10px', color: palette.faint }}
          >
            How to find it
          </span>
          <p className="mt-0.5" style={{ fontSize: '12px', lineHeight: '1.5', color: palette.muted }}>
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

function FippaLetterCard({ letter, palette }: { letter: string; palette: Palette }) {
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
        backgroundColor: palette.white,
        border: `1px solid ${palette.border}`,
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
              color: palette.muted,
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
              color: copied ? '#5BC88A' : palette.muted,
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
          color: palette.muted,
          borderBottom: `1px dashed ${palette.border}`,
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
            color: palette.body,
          }}
        >
          {letter}
        </pre>
      </div>
    </div>
  )
}

// ---- Civic Actions section renderer ----

function CivicActionsSection({ content, palette }: { content: string; palette: Palette }) {
  const fippa = extractFippaLetter(content)

  if (!fippa) {
    return <ProseSection content={content} palette={palette} />
  }

  return (
    <div className="space-y-5">
      {fippa.before && <ProseSection content={fippa.before} palette={palette} />}
      <FippaLetterCard letter={fippa.letter} palette={palette} />
      {fippa.after && <ProseSection content={fippa.after} palette={palette} />}
    </div>
  )
}

// ---- Questions section renderer (Gadfly gold, light surface) ----

function QuestionsSection({ content, palette }: { content: string; palette: Palette }) {
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
    return <ProseSection content={content} palette={palette} />
  }

  return (
    <div>
      {/* Introductory line */}
      <p
        style={{
          fontFamily: '"Source Serif 4", Georgia, serif',
          fontStyle: 'italic',
          fontSize: '15px',
          color: palette.muted,
          marginBottom: '20px',
        }}
      >
        These are questions this analysis surfaced but cannot answer.
      </p>
      <ol style={{ display: 'flex', flexDirection: 'column', gap: '20px', listStyle: 'none', padding: 0, margin: 0 }} aria-label="Questions worth asking">
        {questions.map((q, i) => (
          <li key={i} className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className="flex-shrink-0 flex items-center justify-center rounded-full font-bold"
              style={{
                width: '28px',
                height: '28px',
                fontSize: '12px',
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
              style={{ fontSize: '16px', lineHeight: '1.55', color: palette.text }}
            >
              {renderInline(q)}
            </p>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ---- Limitations section renderer ----

function LimitationsSection({ content, palette }: { content: string; palette: Palette }) {
  return (
    <div
      style={{
        borderTop: `2px solid ${palette.cardBorder}`,
        marginTop: '32px',
        paddingTop: '24px',
      }}
    >
      <div
        role="note"
        style={{
          backgroundColor: 'rgba(120,113,108,0.04)',
          border: `1px solid ${palette.cardBorder}`,
          borderLeft: `3px solid ${palette.faint}`,
          borderRadius: '0 8px 8px 0',
          padding: '16px 20px',
        }}
      >
        <div
          className="font-semibold uppercase tracking-[0.1em]"
          style={{ fontSize: '10px', color: palette.faint, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <EyeOff size={14} strokeWidth={1.75} style={{ color: palette.faint }} />
          What This Analysis Cannot See
        </div>
        <div style={{ fontSize: '15px', lineHeight: '1.6', color: palette.muted }}>
          <ProseSection content={content} palette={palette} />
        </div>
      </div>
    </div>
  )
}

// ---- Inline Gadfly action (after Oracle section) ----

function InlineGadflyAction({ onOpenGadfly, palette }: { onOpenGadfly?: () => void; palette: Palette }) {
  const actionClassName = "inline-flex items-center gap-1.5 rounded-lg font-semibold transition-all duration-150 hover:opacity-90"
  const actionStyle = {
    padding: '7px 14px',
    fontSize: '12px',
    lineHeight: '1' as const,
    backgroundColor: 'rgba(200,168,75,0.08)',
    border: '1px solid rgba(200,168,75,0.20)',
    color: '#C8A84B',
  }

  return (
    <div
      className="action-button mt-5 pt-5 flex items-center justify-between gap-4"
      style={{ borderTop: `1px solid ${palette.border}` }}
    >
      <span style={{ fontSize: '13px', lineHeight: '1', color: palette.muted }}>
        Have more questions about this?
      </span>
      {onOpenGadfly ? (
        <button
          type="button"
          onClick={onOpenGadfly}
          className={actionClassName}
          style={actionStyle}
        >
          <MessageCircleQuestion size={12} strokeWidth={2} />
          Explore with Gadfly
        </button>
      ) : (
        <Link
          href="/gadfly"
          className={actionClassName}
          style={actionStyle}
        >
          <MessageCircleQuestion size={12} strokeWidth={2} />
          Explore with Gadfly
        </Link>
      )}
    </div>
  )
}

// ---- Executive card (always first) ----

function ExecutiveCard({ sections, onOpenCampaign, onOpenGadfly, onScrollToQuestions, palette }: { sections: ParsedSection[]; onOpenCampaign?: () => void; onOpenGadfly?: () => void; onScrollToQuestions?: () => void; palette: Palette }) {
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
  const chips: { label: string; arm: keyof typeof ARM_COLORS; href?: string; onClick?: () => void }[] = []
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
      ...(onOpenCampaign ? { onClick: onOpenCampaign } : { href: '/lever' }),
    })
  }
  if (hasMirror) chips.push({ label: 'Compare Jurisdictions', arm: 'mirror', href: '/mirror' })
  if (hasGadfly) chips.push({ label: 'Questions Worth Asking', arm: 'gadfly', ...(onScrollToQuestions ? { onClick: onScrollToQuestions } : { href: '#questions-section' }) })
  if (hasOracle) chips.push({ label: 'Analyse Documents', arm: 'oracle', href: '/oracle' })

  if (!concernText && findingHeadings.length === 0) return null

  return (
    <div
      style={{
        marginBottom: '40px',
        borderBottom: `2px solid ${palette.border}`,
        backgroundColor: palette.warmLift,
        borderRadius: '12px',
        padding: '24px 24px 32px 24px',
      }}
    >
      {concernText && (
        <>
          <div
            className="font-semibold uppercase tracking-[0.1em]"
            style={{ fontSize: '11px', color: palette.muted, marginBottom: '8px' }}
          >
            Your Concern
          </div>
          <p style={{
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            fontSize: '24px',
            fontWeight: 700,
            lineHeight: '1.3',
            color: palette.text,
            maxWidth: '60ch',
            marginBottom: '16px',
          }}>
            {concernText}
          </p>
          <div style={{ height: '1px', backgroundColor: palette.border, marginBottom: '16px' }} />
        </>
      )}

      {findingHeadings.length > 0 && (
        <>
          <div
            className="font-semibold uppercase tracking-[0.1em]"
            style={{ fontSize: '11px', color: palette.muted, marginTop: '24px', marginBottom: '12px' }}
          >
            Key Areas
          </div>
          <ul className="space-y-2 list-none p-0">
            {findingHeadings.map((heading, i) => (
              <li key={i} className="flex items-start gap-2.5" style={{ fontSize: '14px', lineHeight: '1.5', color: palette.body }}>
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
            const chipStyle = {
              padding: '6px 14px',
              minHeight: '36px',
              fontSize: '12px',
              lineHeight: '1' as const,
              backgroundColor: arm.bg,
              border: `1px solid ${arm.border}`,
              color: arm.color,
            }
            const chipClassName = "inline-flex items-center rounded-full font-semibold transition-opacity duration-150 hover:opacity-80"

            if (chip.onClick) {
              return (
                <button
                  key={chip.label}
                  type="button"
                  onClick={chip.onClick}
                  className={chipClassName}
                  style={chipStyle}
                >
                  {chip.label}
                </button>
              )
            }

            return (
              <Link
                key={chip.label}
                href={chip.href!}
                className={chipClassName}
                style={chipStyle}
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

function SectionDivider({ palette }: { palette: Palette }) {
  return (
    <div
      style={{
        borderTop: `1px solid ${palette.border}`,
        margin: '32px 0',
      }}
    />
  )
}

// ---- Go Deeper strip (light surface) ----

const EXPERT_LINKS = [
  {
    arm: 'Scout',
    archetype: 'THE PERIPATETIC',
    tagline: 'Find what they filed. Find what they didn\'t.',
    href: '/scout',
    icon: Compass,
    color: '#B088C8',
    border: 'rgba(176,136,200,0.18)',
  },
  {
    arm: 'Oracle',
    archetype: 'THE PYTHIA',
    tagline: 'Read what the document says. Then read what it doesn\'t.',
    href: '/oracle',
    icon: Eye,
    color: '#89B4C8',
    border: 'rgba(137,180,200,0.18)',
  },
  {
    arm: 'Gadfly',
    archetype: 'THE GADFLY',
    tagline: 'The question nobody asked.',
    href: '/gadfly',
    icon: MessageCircleQuestion,
    color: '#C8A84B',
    border: 'rgba(200,168,75,0.18)',
  },
  {
    arm: 'Lever',
    archetype: 'THE HERALD',
    tagline: 'Your concern. Their paperwork.',
    href: '/lever',
    icon: FileText,
    color: '#C85B5B',
    border: 'rgba(200,91,91,0.18)',
  },
  {
    arm: 'Mirror',
    archetype: 'THE TRAVELLER',
    tagline: 'Someone else already solved this.',
    href: '/mirror',
    icon: GitCompareArrows,
    color: '#5BC88A',
    border: 'rgba(91,200,138,0.18)',
  },
]

function GoDeeper({ onOpenCampaign, onOpenGadfly, palette }: { onOpenCampaign?: () => void; onOpenGadfly?: () => void; palette: Palette }) {
  // Map arm names to callbacks for arms that support in-page panels
  const armCallbacks: Record<string, (() => void) | undefined> = {
    Gadfly: onOpenGadfly,
    Lever: onOpenCampaign,
  }

  return (
    <div style={{ marginTop: '40px', paddingTop: '32px', borderTop: `1px solid ${palette.border}` }}>
      <p
        className="font-semibold uppercase tracking-[0.1em]"
        style={{ fontSize: '11px', color: palette.faint, marginBottom: '16px' }}
      >
        Want to go deeper?
      </p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {EXPERT_LINKS.map((link) => {
          const Icon = link.icon
          const callback = armCallbacks[link.arm]
          const cardClassName = "link-card flex items-center gap-3 rounded-[10px] transition-opacity duration-150 hover:opacity-85"
          const cardStyle = {
            padding: '12px 14px',
            minHeight: '44px',
            background: `linear-gradient(to bottom, ${link.color}08, ${link.color}10)`,
            border: `1px solid ${link.border}`,
          }
          const cardContent = (
            <>
              <span
                className="flex flex-shrink-0 items-center justify-center rounded-full"
                style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: `${link.color}1A`,
                }}
              >
                <Icon size={14} strokeWidth={1.75} style={{ color: link.color }} />
              </span>
              <span className="flex flex-col">
                <span
                  className="font-semibold leading-snug"
                  style={{ fontSize: '12px', color: link.color }}
                >
                  {link.arm}
                </span>
                <span
                  style={{
                    fontSize: '9px',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.1em',
                    color: palette.faint,
                    marginTop: '1px',
                  }}
                >
                  {link.archetype}
                </span>
                <span
                  className="leading-snug"
                  style={{ fontSize: '11px', color: palette.muted, marginTop: '4px' }}
                >
                  {link.tagline}
                </span>
              </span>
            </>
          )

          if (callback) {
            return (
              <button
                key={link.arm}
                type="button"
                onClick={callback}
                className={cardClassName}
                style={cardStyle}
              >
                {cardContent}
              </button>
            )
          }

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cardClassName}
              style={cardStyle}
            >
              {cardContent}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ---- Main component ----

export function BriefingView({ text, isStreaming, darkMode, onToggleDarkMode, onOpenLens, onOpenCampaign, onOpenGadfly, onScrollToQuestions }: BriefingViewProps) {
  const sections = useMemo(() => parseSections(text), [text])
  const hasSections = sections.length > 0
  const palette = darkMode ? DARK_PALETTE : LIGHT_PALETTE

  // Raw streaming before first section
  if (isStreaming && !hasSections) {
    return (
      <article
        className="content-island"
        style={{
          position: 'relative',
          backgroundColor: palette.bg,
          color: palette.text,
          maxWidth: '672px',
          margin: '0 auto',
          padding: '40px',
          borderRadius: '16px',
          boxShadow: '0 4px 8px rgba(28,25,23,0.04), 0 8px 16px rgba(28,25,23,0.03), 0 16px 32px rgba(28,25,23,0.02)',
        }}
      >
        {onToggleDarkMode && (
          <button
            onClick={onToggleDarkMode}
            type="button"
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              borderRadius: '9999px',
              padding: '6px',
              backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
              color: palette.muted,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 150ms ease',
            }}
          >
            {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        )}
        <p
          className="whitespace-pre-wrap"
          style={{ fontSize: '16px', lineHeight: '1.7', color: palette.secondary }}
        >
          {text}
        </p>
        <span className="mt-1 inline-block h-4 w-0.5 animate-pulse" style={{ backgroundColor: palette.muted }} />
      </article>
    )
  }

  return (
    <article
      className="content-island"
      style={{
        position: 'relative',
        backgroundColor: palette.bg,
        color: palette.text,
        maxWidth: '672px',
        margin: '0 auto',
        padding: 'clamp(32px, 5vw, 40px) clamp(20px, 5vw, 40px)',
        borderRadius: 'clamp(12px, 2vw, 16px)',
        boxShadow: '0 4px 8px rgba(28,25,23,0.04), 0 8px 16px rgba(28,25,23,0.03), 0 16px 32px rgba(28,25,23,0.02), 0 32px 64px rgba(120,90,50,0.015)',
      }}
    >
      {onToggleDarkMode && (
        <button
          onClick={onToggleDarkMode}
          type="button"
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            borderRadius: '9999px',
            padding: '6px',
            backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
            color: palette.muted,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 150ms ease',
          }}
        >
          {darkMode ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      )}

      {/* Executive card — always first when we have sections */}
      {hasSections && <ExecutiveCard sections={sections} onOpenCampaign={onOpenCampaign} onOpenGadfly={onOpenGadfly} onScrollToQuestions={onScrollToQuestions} palette={palette} />}

      {sections.map((section, i) => {
        const headingLower = section.heading.toLowerCase()
        const isFirst = i === 0
        const showDivider = !isFirst

        // --- Your Concern ---
        if (headingLower.includes('your concern')) {
          return (
            <div key={i}>
              {showDivider && <SectionDivider palette={palette} />}
              <SectionHeader heading="Your Concern" palette={palette} />
              <div
                className="rounded-xl p-5"
                style={{
                  backgroundColor: 'rgba(176,136,200,0.06)',
                  border: '1px solid rgba(176,136,200,0.18)',
                }}
              >
                <ProseSection content={section.content} palette={palette} />
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
              {showDivider && <SectionDivider palette={palette} />}
              <SectionHeader heading="What Governs This" palette={palette} />
              {hasCards ? (
                <div className="space-y-4">
                  {blocks.map((block, j) => (
                    <DocumentCard key={j} block={block} palette={palette} />
                  ))}
                </div>
              ) : (
                <ProseSection content={section.content} palette={palette} oracleSerif />
              )}
            </div>
          )
        }

        // --- Key Players ---
        if (headingLower.includes('key players')) {
          return (
            <div key={i}>
              {showDivider && <SectionDivider palette={palette} />}
              <SectionHeader heading="Key Players" palette={palette} />
              <PlayersSection content={section.content} palette={palette} />
            </div>
          )
        }

        // --- What the Public Record Shows (analysis) ---
        if (headingLower.includes('public record') || headingLower.includes('record shows')) {
          return (
            <div key={i}>
              {showDivider && <SectionDivider palette={palette} />}
              <SectionHeader heading="What the Public Record Shows" palette={palette} />
              <ProseSection content={section.content} palette={palette} oracleSerif />
              <InlineGadflyAction onOpenGadfly={onOpenGadfly} palette={palette} />
            </div>
          )
        }

        // --- What You Can Do (civic actions + FIPPA letter) ---
        if (headingLower.includes('what you can do') || headingLower.includes('you can do')) {
          return (
            <div key={i}>
              {showDivider && <SectionDivider palette={palette} />}
              <SectionHeader heading="What You Can Do" color="#C85B5B" palette={palette} />
              <CivicActionsSection content={section.content} palette={palette} />
            </div>
          )
        }

        // --- How Other Places Handle This (mirror comparison) ---
        if (headingLower.includes('other places') || headingLower.includes('how other')) {
          return (
            <div key={i}>
              {showDivider && <SectionDivider palette={palette} />}
              <SectionHeader heading="How Other Places Handle This" palette={palette} />
              <ComparisonSection content={section.content} palette={palette} />
            </div>
          )
        }

        // --- Questions Worth Asking (gadfly) ---
        if (headingLower.includes('questions worth') || headingLower.includes('worth asking')) {
          return (
            <div
              key={i}
              id="questions-section"
              style={{
                backgroundColor: palette.warmLift,
                borderRadius: '12px',
                padding: '24px',
                marginTop: '16px',
              }}
            >
              {showDivider && <SectionDivider palette={palette} />}
              <SectionHeader heading="Questions Worth Asking" color="#C8A84B" palette={palette} />
              <QuestionsSection content={section.content} palette={palette} />
            </div>
          )
        }

        // --- What This Analysis Cannot See (limitations) ---
        if (headingLower.includes('cannot see') || headingLower.includes('limitations')) {
          return (
            <div key={i}>
              {showDivider && <SectionDivider palette={palette} />}
              <LimitationsSection content={section.content} palette={palette} />
            </div>
          )
        }

        // --- Fallback ---
        return (
          <div key={i}>
            {showDivider && <SectionDivider palette={palette} />}
            <SectionHeader heading={section.heading} palette={palette} />
            <ProseSection content={section.content} palette={palette} />
          </div>
        )
      })}

      {isStreaming && (
        <span
          className="mt-2 inline-block h-4 w-0.5 animate-pulse"
          style={{ backgroundColor: palette.muted }}
        />
      )}

      {/* Go Deeper footer — only when streaming is complete */}
      {!isStreaming && hasSections && <GoDeeper onOpenCampaign={onOpenCampaign} onOpenGadfly={onOpenGadfly} palette={palette} />}
    </article>
  )
}
