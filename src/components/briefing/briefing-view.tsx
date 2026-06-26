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
    color: 'var(--accent-scout)',
    bg: 'color-mix(in srgb, var(--accent-scout) 6%, transparent)',
    border: 'color-mix(in srgb, var(--accent-scout) 18%, transparent)',
  },
  oracle: {
    color: 'var(--accent-oracle)',
    bg: 'color-mix(in srgb, var(--accent-oracle) 6%, transparent)',
    border: 'color-mix(in srgb, var(--accent-oracle) 18%, transparent)',
  },
  lever: {
    color: 'var(--accent-lever)',
    bg: 'color-mix(in srgb, var(--accent-lever) 6%, transparent)',
    border: 'color-mix(in srgb, var(--accent-lever) 18%, transparent)',
  },
  mirror: {
    color: 'var(--accent-mirror)',
    bg: 'color-mix(in srgb, var(--accent-mirror) 6%, transparent)',
    border: 'color-mix(in srgb, var(--accent-mirror) 18%, transparent)',
  },
  gadfly: {
    color: 'var(--accent-gadfly)',
    bg: 'color-mix(in srgb, var(--accent-gadfly) 6%, transparent)',
    border: 'color-mix(in srgb, var(--accent-gadfly) 18%, transparent)',
  },
}

// ---- Section parser — DO NOT MODIFY (backward-compat: also strips # Title lines before section parsing) ----

function parseSections(text: string): ParsedSection[] {
  const sections: ParsedSection[] = []
  const lines = text.split('\n')
  let currentHeading = ''
  let currentLines: string[] = []

  for (const line of lines) {
    // Skip the # Title line — it is extracted separately by extractTitle()
    if (line.match(/^#\s+[^#]/)) continue

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

// ---- Title extractor (new prompt emits `# Title`; old prompts used ## Your Concern) ----

function extractTitle(text: string): string | null {
  // New format: `# Title text`
  const h1Match = text.match(/^#\s+([^#\n].+)$/m)
  if (h1Match) return h1Match[1].trim()

  // Old prompts (## Context / ## Your Concern) do not emit a # Title line.
  // Let ExecutiveCard handle the concern display — no title to extract.
  return null
}

// ---- Section accent color map ----

function getSectionAccentColor(heading: string): string | null {
  const h = heading.toLowerCase()
  if (h.includes('what governs')) return 'var(--accent-scout)'
  if (h.includes('public record')) return 'var(--accent-oracle)'
  if (h.includes('key players')) return 'var(--accent-oracle)'
  if (h.includes('what you can do')) return 'var(--accent-lever)'
  if (h.includes('other places') || h.includes('jurisdictions')) return 'var(--accent-mirror)'
  if (h.includes('questions')) return 'var(--accent-gadfly)'
  if (h.includes('context')) return 'var(--accent-scout)'
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

// ---- Prose renderer (extended: italic, link→text-only) ----
// Tokenizes **bold** first, then processes non-bold segments for *italic* and [links](url).
// This prevents nested bold/italic from producing orphaned asterisks.
// # characters are NOT stripped here — the block preprocessor handles line-start headings,
// and legitimate inline refs like "issue #4", "s. #12", "C#" must survive.

export function renderInline(text: string): React.ReactNode {
  // Step 1: split on **bold** spans first
  const boldParts = text.split(/(\*\*[^*]+\*\*)/)

  // If no markup at all, return plain string
  if (boldParts.length === 1 && !text.match(/\*[^*]+\*|\[[^\]]+\]\([^)]+\)/)) return text

  const nodes: React.ReactNode[] = []
  let keyCounter = 0

  for (const part of boldParts) {
    const boldMatch = part.match(/^\*\*([^*]+)\*\*$/)
    if (boldMatch) {
      nodes.push(<strong key={keyCounter++}>{boldMatch[1]}</strong>)
      continue
    }

    // Step 2: within non-bold segments, tokenize *italic* and [text](url).
    // Any orphaned ** or * left over from a nested/malformed bold are stripped
    // as plain strings so they don't leak into the rendered output.
    const subParts = part.split(/(\*[^*]+\*|\[[^\]]+\]\([^)]+\))/)
    for (const sub of subParts) {
      if (sub === '') continue

      const italicMatch = sub.match(/^\*([^*]+)\*$/)
      if (italicMatch) {
        nodes.push(<em key={keyCounter++}>{italicMatch[1]}</em>)
        continue
      }

      const linkMatch = sub.match(/^\[([^\]]+)\]\([^)]+\)$/)
      if (linkMatch) {
        nodes.push(<span key={keyCounter++}>{linkMatch[1]}</span>)
        continue
      }

      // Strip any orphaned ** or * markers left from nested/malformed bold
      const cleaned = sub.replace(/\*{1,2}/g, '')
      if (cleaned !== '') nodes.push(cleaned)
    }
  }

  // If we ended up with a single plain string, return it directly
  if (nodes.length === 1 && typeof nodes[0] === 'string') return nodes[0]
  return nodes
}

// ---- Gap/insight paragraph detection (for Gadfly-gold callout in Public Record Shows) ----

function isInsightParagraph(text: string): boolean {
  const lower = text.toLowerCase()
  return (
    lower.includes('the gap') ||
    lower.includes('what is absent') ||
    lower.includes('not publicly') ||
    lower.includes('absent from') ||
    lower.includes('should be there') ||
    lower.includes('remain unanswerable') ||
    lower.includes('remains unanswerable') ||
    lower.includes('the absence') ||
    lower.includes('is absent')
  )
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
  if (/^["""]/.test(trimmed) && /["""][\.\,\;]?$/.test(trimmed)) return true
  // Contains a full sentence in quotes (at least 30 chars inside quotes)
  if (/["""][^"""]{30,}["""]/.test(trimmed)) return true
  return false
}

// ---- Block preprocessor result ----

type BlockElement =
  | { type: 'paragraph'; text: string }
  | { type: 'subheading'; text: string }
  | { type: 'hr' }
  | { type: 'list'; items: string[] }

// ---- Block preprocessor — handles ###, ---, bold-only lines (no colon) ----
// Called by ProseSection before paragraph-level rendering.

export function preprocessBlocks(content: string): BlockElement[] {
  const result: BlockElement[] = []

  // Split into raw paragraphs first (blank-line separated)
  const rawParagraphs = content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)

  for (const para of rawParagraphs) {
    // --- separator → hr (only when it's JUST "---" on its own, not inside other text)
    if (/^---\s*$/.test(para)) {
      result.push({ type: 'hr' })
      continue
    }

    // ### Sub-heading
    if (para.match(/^###\s+/)) {
      const text = para.replace(/^###\s+/, '').replace(/\*\*/g, '').trim()
      result.push({ type: 'subheading', text })
      continue
    }

    // Bullet/numbered list paragraph
    if (para.match(/^[-*]\s+/m) || para.match(/^\d+[.)]\s+/m)) {
      const lines = para.split('\n').filter((l) => l.trim())
      const items = lines.map((l) => l.replace(/^[-*]\s+/, '').replace(/^\d+[.)]\s+/, '').trim())
      result.push({ type: 'list', items })
      continue
    }

    // Bold-only line (no colon) → treat as sub-heading
    // Must be a single line, wrapped entirely in **, no colon inside
    const boldOnlyMatch = para.match(/^\*\*([^*:]+)\*\*\s*$/)
    if (boldOnlyMatch && !para.includes('\n')) {
      result.push({ type: 'subheading', text: boldOnlyMatch[1].trim() })
      continue
    }

    result.push({ type: 'paragraph', text: para })
  }

  return result
}

function ProseSection({
  content,
  palette,
  oracleSerif,
  showInsightCallouts,
}: {
  content: string
  palette: Palette
  oracleSerif?: boolean
  showInsightCallouts?: boolean
}) {
  const baseFont = oracleSerif
    ? { fontFamily: 'var(--font-serif)', fontSize: '16px', lineHeight: '1.75', fontWeight: 400 as const }
    : { fontFamily: 'var(--font-serif)', fontSize: '16px', lineHeight: '1.7' }

  const blocks = preprocessBlocks(content)
  const elements: React.ReactNode[] = []

  // Insert section break rule before every 5th/9th/13th paragraph-type block
  // (matches original i % 4 === 0 timing: divider appears before the 5th paragraph, then every 4)
  let paraCount = 0

  blocks.forEach((block, i) => {
    if (block.type === 'paragraph') {
      paraCount++
      if (paraCount > 1 && paraCount % 4 === 1) {
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
    }

    switch (block.type) {
      case 'hr':
        elements.push(
          <hr
            key={i}
            aria-hidden="true"
            style={{
              border: 'none',
              borderTop: `1px solid ${palette.border}`,
              margin: '24px 0',
            }}
          />
        )
        break

      case 'subheading':
        elements.push(
          <h4
            key={i}
            style={{
              fontFamily: '"Inter", system-ui, sans-serif',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.06em',
              color: palette.muted,
              marginTop: i === 0 ? '0' : '24px',
              marginBottom: '4px',
            }}
          >
            {block.text}
          </h4>
        )
        break

      case 'list': {
        elements.push(
          <ul key={i} className="space-y-1.5 pl-0">
            {block.items.map((item, j) => (
              <li key={j} className="flex items-start gap-2" style={{ fontSize: '15px', lineHeight: '1.6', color: palette.secondary }}>
                <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full" style={{ backgroundColor: palette.faint }} />
                <span>{renderInline(item)}</span>
              </li>
            ))}
          </ul>
        )
        break
      }

      case 'paragraph': {
        const para = block.text

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
          break
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
          break
        }

        // Insight/gap callout (for "Public Record Shows" when showInsightCallouts=true)
        if (showInsightCallouts && isInsightParagraph(para)) {
          elements.push(
            <div
              key={i}
              style={{
                borderLeft: `3px solid rgba(200,168,75,0.4)`,
                backgroundColor: 'rgba(200,168,75,0.05)',
                padding: '14px 16px',
                borderRadius: '0 8px 8px 0',
                margin: '4px 0',
              }}
            >
              <p className="whitespace-pre-wrap" style={{ ...baseFont, color: palette.body, margin: 0, fontStyle: 'italic' }}>
                {renderInline(para)}
              </p>
            </div>
          )
          break
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
          break
        }

        // Lead paragraph (first paragraph gets larger treatment)
        const isLead = paraCount === 1
        const leadFont = isLead
          ? { fontSize: '17px', lineHeight: '1.75' }
          : {}

        elements.push(
          <p key={i} className="whitespace-pre-wrap" style={{ ...baseFont, ...leadFont, color: palette.body }}>
            {renderInline(para)}
          </p>
        )
        break
      }
    }
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
    return <ProseSection content={content} palette={palette} />
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
            borderLeft: '2px solid var(--accent-mirror)',
            borderRadius: '12px',
            padding: '16px 20px',
          }}
        >
          {/* Jurisdiction name */}
          <span
            style={{
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
    bg: 'color-mix(in srgb, var(--accent-mirror) 6%, transparent)',
    border: 'color-mix(in srgb, var(--accent-mirror) 18%, transparent)',
    color: 'var(--accent-mirror)',
    label: 'Public',
  },
  fippa: {
    bg: 'color-mix(in srgb, var(--accent-gadfly) 6%, transparent)',
    border: 'color-mix(in srgb, var(--accent-gadfly) 18%, transparent)',
    color: 'var(--accent-gadfly)',
    label: 'FIPPA Required',
  },
  council: {
    bg: 'color-mix(in srgb, var(--accent-oracle) 6%, transparent)',
    border: 'color-mix(in srgb, var(--accent-oracle) 18%, transparent)',
    color: 'var(--accent-oracle)',
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

// ---- Document card — two-tier: primary authority + supporting list ----
// First block rendered by WhatGovernsSection gets isPrimary=true.
// Touched: previously a single-tier flat card; now split into primary/supporting visual tiers.

function DocumentCard({
  block,
  palette,
  isPrimary = false,
}: {
  block: string
  palette: Palette
  isPrimary?: boolean
}) {
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

  // Primary Authority: warmLift bg, Scout-purple left accent
  if (isPrimary) {
    return (
      <div
        className="rounded-xl p-5"
        style={{
          backgroundColor: palette.warmLift,
          border: `1px solid ${palette.cardBorder}`,
          borderLeft: '3px solid rgba(176,136,200,0.5)',
        }}
      >
        {/* Header row — flexWrap for responsive */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: docName ? '12px' : '0',
          }}
        >
          {docName && (
            <span
              style={{
                fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
                fontSize: '14px',
                fontWeight: 700,
                lineHeight: '1.4',
                color: palette.text,
                textDecoration: 'underline',
                textDecorationThickness: '1px',
                textUnderlineOffset: '3px',
                flex: '1 1 0',
                minWidth: '0',
              }}
            >
              {docName}
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-block',
                borderRadius: '9999px',
                padding: '2px 8px',
                fontSize: '10px',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.06em',
                backgroundColor: 'rgba(176,136,200,0.10)',
                color: '#B088C8',
                fontWeight: 600,
              }}
            >
              Primary Authority
            </span>
            {accessLevel && <AccessBadge level={accessLevel} />}
          </div>
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
            style={{
              borderTop: `1px solid ${palette.border}`,
              marginTop: '16px',
              paddingTop: '12px',
            }}
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

  // Supporting document — full card (matches the Key Players spread-out treatment:
  // distinct card, bold+underlined name, labelled fields, How-to-find divider).
  return (
    <div
      className="rounded-xl p-5"
      style={{ backgroundColor: palette.cardBg, border: `1px solid ${palette.cardBorder}` }}
    >
      {/* Header row — flexWrap for responsive */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: docName ? '12px' : '0',
        }}
      >
        {docName && (
          <span
            style={{
              fontSize: '14px',
              fontWeight: 700,
              lineHeight: '1.4',
              color: palette.text,
              textDecoration: 'underline',
              textDecorationThickness: '1px',
              textUnderlineOffset: '3px',
              flex: '1 1 0',
              minWidth: '0',
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
        <div style={{ borderTop: `1px solid ${palette.border}`, marginTop: '16px', paddingTop: '12px' }}>
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

// ---- What Governs This section renderer (two-tier) ----

function WhatGovernsSection({ content, palette }: { content: string; palette: Palette }) {
  const blocks = splitDocumentBlocks(content)
  const hasCards = blocks.some((b) => parseDocumentFields(b).length > 0)

  if (!hasCards) {
    return <ProseSection content={content} palette={palette} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {blocks.map((block, j) => (
        <DocumentCard key={j} block={block} palette={palette} isPrimary={j === 0} />
      ))}
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
        borderTop: '2px solid var(--accent-lever)',
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--accent-lever) 5%, transparent)',
          borderBottom: '1px solid color-mix(in srgb, var(--accent-lever) 12%, transparent)',
        }}
      >
        <span
          className="font-bold uppercase tracking-[0.1em]"
          style={{ fontSize: '11px', lineHeight: '1', color: 'var(--accent-lever)' }}
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
              backgroundColor: 'color-mix(in srgb, var(--accent-lever) 6%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-lever) 15%, transparent)',
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
              backgroundColor: copied ? 'color-mix(in srgb, var(--accent-mirror) 10%, transparent)' : 'color-mix(in srgb, var(--accent-lever) 6%, transparent)',
              border: copied
                ? '1px solid color-mix(in srgb, var(--accent-mirror) 25%, transparent)'
                : '1px solid color-mix(in srgb, var(--accent-lever) 15%, transparent)',
              color: copied ? 'var(--accent-mirror)' : palette.muted,
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
      {/* Introductory line — Source Serif 4 is appropriate here (rhetorical frame) */}
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
                backgroundColor: 'color-mix(in srgb, var(--accent-gadfly) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-gadfly) 25%, transparent)',
                color: 'var(--accent-gadfly)',
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

function LimitationsSection({ content, palette, darkMode }: { content: string; palette: Palette; darkMode?: boolean }) {
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
          // Use cardBg on dark mode (warmLift is invisible on dark)
          backgroundColor: darkMode ? palette.cardBg : 'rgba(120,113,108,0.04)',
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
    backgroundColor: 'color-mix(in srgb, var(--accent-gadfly) 8%, transparent)',
    border: '1px solid color-mix(in srgb, var(--accent-gadfly) 20%, transparent)',
    color: 'var(--accent-gadfly)',
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

// ---- Executive card (nav + action hub — concern text removed per spec 3.3) ----

function ExecutiveCard({ sections, onOpenCampaign, onOpenGadfly, onScrollToQuestions, palette }: { sections: ParsedSection[]; onOpenCampaign?: () => void; onOpenGadfly?: () => void; onScrollToQuestions?: () => void; palette: Palette }) {
  // Key findings: all section headings except concern, context, and limitations
  const findingHeadings = sections
    .map((s) => s.heading)
    .filter(
      (h) =>
        !h.toLowerCase().includes('your concern') &&
        !h.toLowerCase().includes('context') &&
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

  if (findingHeadings.length === 0 && chips.length === 0) return null

  return (
    <div
      style={{
        marginBottom: '40px',
        borderBottom: `2px solid ${palette.border}`,
        backgroundColor: palette.warmLift,
        borderRadius: '12px',
        // spec 3.3: padding 20/24/24/24
        padding: '20px 24px 24px 24px',
      }}
    >


      {findingHeadings.length > 0 && (
        <>
          <div
            className="font-semibold uppercase tracking-[0.1em]"
            style={{ fontSize: '11px', color: palette.muted, marginBottom: '12px' }}
          >
            Key Areas
          </div>
          <ul className="space-y-2 list-none p-0">
            {findingHeadings.map((heading, i) => (
              <li key={i} className="flex items-start gap-2.5" style={{ fontSize: '14px', lineHeight: '1.5', color: palette.body }}>
                <span
                  className="flex-shrink-0 rounded-full"
                  style={{ width: '6px', height: '6px', backgroundColor: palette.faint, marginTop: '6px' }}
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
          style={{ marginTop: findingHeadings.length > 0 ? '20px' : '0' }}
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
    color: 'var(--accent-scout)',
    border: 'color-mix(in srgb, var(--accent-scout) 18%, transparent)',
  },
  {
    arm: 'Oracle',
    archetype: 'THE PYTHIA',
    tagline: 'Read what the document says. Then read what it doesn\'t.',
    href: '/oracle',
    icon: Eye,
    color: 'var(--accent-oracle)',
    border: 'color-mix(in srgb, var(--accent-oracle) 18%, transparent)',
  },
  {
    arm: 'Gadfly',
    archetype: 'THE GADFLY',
    tagline: 'The question nobody asked.',
    href: '/gadfly',
    icon: MessageCircleQuestion,
    color: 'var(--accent-gadfly)',
    border: 'color-mix(in srgb, var(--accent-gadfly) 18%, transparent)',
  },
  {
    arm: 'Lever',
    archetype: 'THE HERALD',
    tagline: 'Your concern. Their paperwork.',
    href: '/lever',
    icon: FileText,
    color: 'var(--accent-lever)',
    border: 'color-mix(in srgb, var(--accent-lever) 18%, transparent)',
  },
  {
    arm: 'Mirror',
    archetype: 'THE TRAVELLER',
    tagline: 'Someone else already solved this.',
    href: '/mirror',
    icon: GitCompareArrows,
    color: 'var(--accent-mirror)',
    border: 'color-mix(in srgb, var(--accent-mirror) 18%, transparent)',
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
            background: `linear-gradient(to bottom, color-mix(in srgb, ${link.color} 3%, transparent), color-mix(in srgb, ${link.color} 6%, transparent))`,
            border: `1px solid ${link.border}`,
          }
          const cardContent = (
            <>
              <span
                className="flex flex-shrink-0 items-center justify-center rounded-full"
                style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: `color-mix(in srgb, ${link.color} 10%, transparent)`,
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
  const docTitle = useMemo(() => extractTitle(text), [text])
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

      {/* Document title — rendered from # Title (new prompt) */}
      {docTitle && (
        <div style={{ marginBottom: '28px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.1em',
              color: palette.muted,
              marginBottom: '8px',
            }}
          >
            Investigation
          </div>
          <h1
            style={{
              fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
              fontSize: '22px',
              fontWeight: 700,
              lineHeight: '1.3',
              color: palette.text,
              maxWidth: '60ch',
              margin: 0,
            }}
          >
            {docTitle}
          </h1>
        </div>
      )}

      {/* Executive card — always first when we have sections */}
      {hasSections && <ExecutiveCard sections={sections} onOpenCampaign={onOpenCampaign} onOpenGadfly={onOpenGadfly} onScrollToQuestions={onScrollToQuestions} palette={palette} />}

      {sections.map((section, i) => {
        const headingLower = section.heading.toLowerCase()
        const isFirst = i === 0
        const showDivider = !isFirst

        // --- Context (new prompt) or Your Concern (old prompt, backward compat) ---
        // Both render as lead prose without a card box.
        if (headingLower.includes('context') || headingLower.includes('your concern')) {
          return (
            <div key={i}>
              {showDivider && <SectionDivider palette={palette} />}
              <SectionHeader heading={section.heading} palette={palette} />
              <ProseSection content={section.content} palette={palette} />
            </div>
          )
        }

        // --- What Governs This (document discovery) ---
        if (headingLower.includes('what governs') || headingLower.includes('governs this')) {
          return (
            <div key={i}>
              {showDivider && <SectionDivider palette={palette} />}
              <SectionHeader heading="What Governs This" palette={palette} />
              <WhatGovernsSection content={section.content} palette={palette} />
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

        // --- What the Public Record Shows (analysis, Inter only — spec 3.1) ---
        if (headingLower.includes('public record') || headingLower.includes('record shows')) {
          return (
            <div key={i}>
              {showDivider && <SectionDivider palette={palette} />}
              <SectionHeader heading="What the Public Record Shows" palette={palette} />
              {/* oracleSerif=false per spec 3.1 — analytical journalism reads cleaner in Inter */}
              <ProseSection content={section.content} palette={palette} showInsightCallouts />
              <InlineGadflyAction onOpenGadfly={onOpenGadfly} palette={palette} />
            </div>
          )
        }

        // --- What You Can Do (civic actions + FIPPA letter) ---
        if (headingLower.includes('what you can do') || headingLower.includes('you can do')) {
          return (
            <div key={i}>
              {showDivider && <SectionDivider palette={palette} />}
              <SectionHeader heading="What You Can Do" color="var(--accent-lever)" palette={palette} />
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
                // spec 3.4: bg → cardBg (warmLift is invisible on dark)
                backgroundColor: palette.cardBg,
                borderRadius: '12px',
                padding: '24px',
                // spec 3.2: remove rogue marginTop:16px
              }}
            >
              {showDivider && <SectionDivider palette={palette} />}
              <SectionHeader heading="Questions Worth Asking" color="var(--accent-gadfly)" palette={palette} />
              <QuestionsSection content={section.content} palette={palette} />
            </div>
          )
        }

        // --- What This Analysis Cannot See (limitations) ---
        if (headingLower.includes('cannot see') || headingLower.includes('limitations')) {
          return (
            <div key={i}>
              {showDivider && <SectionDivider palette={palette} />}
              <LimitationsSection content={section.content} palette={palette} darkMode={darkMode} />
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
