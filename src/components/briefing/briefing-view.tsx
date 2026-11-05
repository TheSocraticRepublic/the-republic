'use client'

import { useMemo, useCallback, useState } from 'react'
import Link from 'next/link'
import {
  Compass,
  Eye,
  MessageCircleQuestion,
  FileText,
  GitCompareArrows,
  Search,
  Copy,
  Check,
  Download,
  Sun,
  Moon,
  EyeOff,
} from 'lucide-react'
import {
  type ParsedSection,
  type RoleKey,
  type AccessLevel,
  parseSections,
  extractTitle,
  isInsightParagraph,
  isPullQuote,
  preprocessBlocks,
  getRoleKey,
  roleLabel,
  parsePlayers,
  parseJurisdictions,
  parseDocumentFields,
  detectAccess,
  splitDocumentBlocks,
  extractFippaLetter,
} from '@/lib/briefing/parse'

// Re-exported so existing importers (tests/unit/briefing-view.test.ts,
// tests/unit/paper-ink.test.ts) keep their import path.
export { preprocessBlocks, getRoleKey }

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

// Island tokens consumed via CSS custom properties (globals.css).
// Dark overrides come from .dark-island scope class on the root element.

// ---- Arm color config ----
// `color` (the arm accent) draws shapes: tints, borders, icons, rules. Text on
// the paper uses `ink`, the arm's light-ground ink, which .content-island
// re-points to the light values (globals.css): the accent resolves to the dark
// chrome's hue under <html class="dark"> and falls to ~2:1 on paper (Jen D1 C1).

const ARM_COLORS: Record<
  string,
  { color: string; ink: string; bg: string; border: string }
> = {
  scout: {
    color: 'var(--accent-scout)',
    ink: 'var(--accent-scout-ink)',
    bg: 'color-mix(in srgb, var(--accent-scout) 6%, transparent)',
    border: 'color-mix(in srgb, var(--accent-scout) 18%, transparent)',
  },
  oracle: {
    color: 'var(--accent-oracle)',
    ink: 'var(--accent-oracle-ink)',
    bg: 'color-mix(in srgb, var(--accent-oracle) 6%, transparent)',
    border: 'color-mix(in srgb, var(--accent-oracle) 18%, transparent)',
  },
  lever: {
    color: 'var(--accent-lever)',
    ink: 'var(--accent-lever-ink)',
    bg: 'color-mix(in srgb, var(--accent-lever) 6%, transparent)',
    border: 'color-mix(in srgb, var(--accent-lever) 18%, transparent)',
  },
  mirror: {
    color: 'var(--accent-mirror)',
    ink: 'var(--accent-mirror-ink)',
    bg: 'color-mix(in srgb, var(--accent-mirror) 6%, transparent)',
    border: 'color-mix(in srgb, var(--accent-mirror) 18%, transparent)',
  },
  gadfly: {
    color: 'var(--accent-gadfly)',
    ink: 'var(--accent-gadfly-ink)',
    bg: 'color-mix(in srgb, var(--accent-gadfly) 6%, transparent)',
    border: 'color-mix(in srgb, var(--accent-gadfly) 18%, transparent)',
  },
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
}: {
  heading: string
  color?: string
  
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
        className="text-2xs font-semibold uppercase"
        style={{ color: color ?? 'var(--color-island-muted)' }}
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

function ProseSection({
  content,
  oracleSerif,
  showInsightCallouts,
}: {
  content: string
  
  oracleSerif?: boolean
  showInsightCallouts?: boolean
}) {
  const baseFont = oracleSerif
    ? { fontFamily: 'var(--font-serif)', fontSize: '16px', lineHeight: '1.75', fontWeight: 400 as const }
    : { fontFamily: 'var(--font-serif)', fontSize: '16px', lineHeight: '1.7' }

  const blocks = preprocessBlocks(content)
  const elements: React.ReactNode[] = []

  // paraCount drives the lead paragraph only (D2 deleted the every-5th-paragraph divider).
  let paraCount = 0

  blocks.forEach((block, i) => {
    if (block.type === 'paragraph') paraCount++

    switch (block.type) {
      case 'hr':
        elements.push(
          <hr
            key={i}
            aria-hidden="true"
            style={{
              border: 'none',
              borderTop: `1px solid var(--color-island-border)`,
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
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.06em',
              color: 'var(--color-island-muted)',
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
              <li key={j} className="flex items-start gap-2" style={{ fontSize: '15px', lineHeight: '1.6', color: 'var(--color-island-secondary)' }}>
                <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full" style={{ backgroundColor: 'var(--color-island-mark)' }} />
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
                style={{ fontSize: '11px', color: 'var(--color-island-muted)' }}
              >
                {boldFieldMatch[1]}
              </span>
              <p className="mt-0.5" style={{ ...baseFont, color: 'var(--color-island-body)' }}>
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
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontSize: '18px',
                lineHeight: '1.5',
                color: 'var(--color-island-secondary)',
                paddingLeft: '24px',
                borderLeft: `2px solid color-mix(in srgb, var(--color-island-accent-oracle) 25%, transparent)`,
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
                borderLeft: '3px solid color-mix(in srgb, var(--color-island-accent-gadfly) 40%, transparent)',
                backgroundColor: 'color-mix(in srgb, var(--color-island-accent-gadfly) 5%, transparent)',
                padding: '14px 16px',
                borderRadius: '0 8px 8px 0',
                margin: '4px 0',
              }}
            >
              <p className="whitespace-pre-wrap" style={{ ...baseFont, color: 'var(--color-island-body)', margin: 0, fontStyle: 'italic' }}>
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
          <p key={i} className="whitespace-pre-wrap" style={{ ...baseFont, ...leadFont, color: 'var(--color-island-body)' }}>
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

/**
 * Each role's colour (the card rule and the badge tint) and its -ink twin (the
 * badge text, 4.5:1 on that tint). Written out whole, never built from a key:
 * Tailwind emits a theme variable only when it finds its full name in source.
 */
const ROLE_TOKENS: Record<RoleKey, { color: string; ink: string }> = {
  regulator: { color: 'var(--color-island-role-regulator)', ink: 'var(--color-island-role-regulator-ink)' },
  proponent: { color: 'var(--color-island-role-proponent)', ink: 'var(--color-island-role-proponent-ink)' },
  affected: { color: 'var(--color-island-role-affected)', ink: 'var(--color-island-role-affected-ink)' },
  indigenous: { color: 'var(--color-island-role-indigenous)', ink: 'var(--color-island-role-indigenous-ink)' },
  other: { color: 'var(--color-island-role-other)', ink: 'var(--color-island-role-other-ink)' },
}

function PlayersSection({ content }: { content: string }) {
  const players = parsePlayers(content)

  if (players.length === 0) {
    return <ProseSection content={content} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {players.map((player, i) => {
        // The role colour draws the rule and the tint; badge text is its darker -ink twin (4.5:1 on the tint).
        const { color: roleColor, ink: roleInk } = ROLE_TOKENS[getRoleKey(player.role)]
        return (
          <div
            key={i}
            style={{
              backgroundColor: 'var(--color-island-card)',
              border: `1px solid var(--color-island-card-border)`,
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
                  color: 'var(--color-island-text)',
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
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    // 8% of the role colour: the old `${hex}14` alpha (20/255).
                    backgroundColor: `color-mix(in srgb, ${roleColor} 8%, transparent)`,
                    color: roleInk,
                    fontWeight: 500,
                  }}
                >
                  {roleLabel(player.role)}
                </span>
              )}
            </div>

            {/* Why they matter */}
            {player.whyTheyMatter && (
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  color: 'var(--color-island-secondary)',
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
                  fontFamily: 'var(--font-body)',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  color: 'var(--color-island-muted)',
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

function ComparisonSection({ content }: { content: string }) {
  const jurisdictions = parseJurisdictions(content)

  if (jurisdictions.length === 0) {
    return <ProseSection content={content} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {jurisdictions.map((jur, i) => (
        <div
          key={i}
          style={{
            backgroundColor: 'var(--color-island-card)',
            border: `1px solid var(--color-island-card-border)`,
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
              color: 'var(--color-island-text)',
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
                    fontFamily: 'var(--font-body)',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.08em',
                    color: 'var(--color-island-muted)',
                    marginBottom: '4px',
                  }}
                >
                  WHAT THEY DID
                </span>
                <p style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--color-island-secondary)', margin: 0 }}>
                  {jur.whatTheyDid}
                </p>
              </div>
            )}

            {jur.whyItMatters && (
              <div>
                <span
                  style={{
                    display: 'block',
                    fontFamily: 'var(--font-body)',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.08em',
                    color: 'var(--color-island-muted)',
                    marginBottom: '4px',
                  }}
                >
                  WHY IT MATTERS
                </span>
                <p style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--color-island-secondary)', margin: 0 }}>
                  {jur.whyItMatters}
                </p>
              </div>
            )}

            {jur.outcome && (
              <div>
                <span
                  style={{
                    display: 'block',
                    fontFamily: 'var(--font-body)',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.08em',
                    color: 'var(--color-island-muted)',
                    marginBottom: '4px',
                  }}
                >
                  OUTCOME
                </span>
                <p style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--color-island-secondary)', margin: 0 }}>
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

// ---- Access badge (light surface tint values) ----

const ACCESS_STYLES: Record<AccessLevel, { bg: string; border: string; color: string; label: string }> = {
  public: {
    bg: 'color-mix(in srgb, var(--accent-mirror) 6%, transparent)',
    border: 'color-mix(in srgb, var(--accent-mirror) 18%, transparent)',
    color: 'var(--accent-mirror-ink)',
    label: 'Public',
  },
  fippa: {
    bg: 'color-mix(in srgb, var(--accent-gadfly) 6%, transparent)',
    border: 'color-mix(in srgb, var(--accent-gadfly) 18%, transparent)',
    color: 'var(--accent-gadfly-ink)',
    label: 'FIPPA Required',
  },
  council: {
    bg: 'color-mix(in srgb, var(--accent-oracle) 6%, transparent)',
    border: 'color-mix(in srgb, var(--accent-oracle) 18%, transparent)',
    color: 'var(--accent-oracle-ink)',
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
  isPrimary = false,
}: {
  block: string
  
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
        style={{ backgroundColor: 'var(--color-island-card)', border: `1px solid var(--color-island-card-border)` }}
      >
        <p className="whitespace-pre-wrap" style={{ fontSize: '16px', lineHeight: '1.7', color: 'var(--color-island-body)' }}>
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
          backgroundColor: 'var(--color-island-warm-lift)',
          border: `1px solid var(--color-island-card-border)`,
          borderLeft: '3px solid color-mix(in srgb, var(--color-island-accent-scout) 50%, transparent)',
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
                fontSize: '14px',
                fontWeight: 700,
                lineHeight: '1.4',
                color: 'var(--color-island-text)',
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
                fontSize: '11px',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.06em',
                backgroundColor: 'color-mix(in srgb, var(--accent-scout) 10%, transparent)',
                color: 'var(--accent-scout-ink)',
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
                  style={{ fontSize: '11px', color: 'var(--color-island-muted)', marginBottom: '4px' }}
                >
                  {field.label}
                </span>
                <p style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--color-island-secondary)' }}>
                  {renderInline(field.value)}
                </p>
              </div>
            ))}
          </div>
        )}

        {howToFindField && (
          <div
            style={{
              borderTop: `1px solid var(--color-island-border)`,
              marginTop: '16px',
              paddingTop: '12px',
            }}
          >
            <span
              className="block font-semibold uppercase tracking-[0.08em]"
              style={{ fontSize: '11px', color: 'var(--color-island-faint)' }}
            >
              How to find it
            </span>
            <p className="mt-0.5" style={{ fontSize: '12px', lineHeight: '1.5', color: 'var(--color-island-muted)' }}>
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
      style={{ backgroundColor: 'var(--color-island-card)', border: `1px solid var(--color-island-card-border)` }}
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
              color: 'var(--color-island-text)',
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
                style={{ fontSize: '11px', color: 'var(--color-island-muted)', marginBottom: '4px' }}
              >
                {field.label}
              </span>
              <p style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--color-island-secondary)' }}>
                {renderInline(field.value)}
              </p>
            </div>
          ))}
        </div>
      )}

      {howToFindField && (
        <div style={{ borderTop: `1px solid var(--color-island-border)`, marginTop: '16px', paddingTop: '12px' }}>
          <span
            className="block font-semibold uppercase tracking-[0.08em]"
            style={{ fontSize: '11px', color: 'var(--color-island-faint)' }}
          >
            How to find it
          </span>
          <p className="mt-0.5" style={{ fontSize: '12px', lineHeight: '1.5', color: 'var(--color-island-muted)' }}>
            {renderInline(howToFindField.value)}
          </p>
        </div>
      )}
    </div>
  )
}

// ---- What Governs This section renderer (two-tier) ----

function WhatGovernsSection({ content }: { content: string }) {
  const blocks = splitDocumentBlocks(content)
  const hasCards = blocks.some((b) => parseDocumentFields(b).length > 0)

  if (!hasCards) {
    return <ProseSection content={content} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {blocks.map((block, j) => (
        <DocumentCard key={j} block={block} isPrimary={j === 0} />
      ))}
    </div>
  )
}

// ---- FIPPA letter card (light surface, body face) ----

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
        backgroundColor: 'var(--color-island-white)',
        border: `1px solid var(--color-island-border)`,
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
          style={{ fontSize: '11px', lineHeight: '1', color: 'var(--accent-lever-ink)' }}
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
              color: 'var(--color-island-muted)',
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
              color: copied ? 'var(--accent-mirror-ink)' : 'var(--color-island-muted)',
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
          color: 'var(--color-island-muted)',
          borderBottom: `1px dashed var(--color-island-border)`,
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
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            lineHeight: '1.65',
            color: 'var(--color-island-body)',
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
    <div>
      {/* Introductory line — Source Serif 4 is appropriate here (rhetorical frame) */}
      <p
        style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: '15px',
          color: 'var(--color-island-muted)',
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
                color: 'var(--accent-gadfly-ink)',
                marginTop: '1px',
              }}
            >
              {i + 1}
            </span>
            <p
              className="font-medium"
              style={{ fontSize: '16px', lineHeight: '1.55', color: 'var(--color-island-text)' }}
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

function LimitationsSection({ content }: { content: string }) {
  return (
    <div
      style={{
        borderTop: `2px solid var(--color-island-card-border)`,
        marginTop: '32px',
        paddingTop: '24px',
      }}
    >
      <div
        role="note"
        style={{
          // The note's ground is a token with a dark value (card) in .dark-island.
          backgroundColor: 'var(--color-island-note)',
          border: `1px solid var(--color-island-card-border)`,
          // A mark, not text: its own lighter ink (Jen, B1 review C4).
          borderLeft: `3px solid var(--color-island-mark)`,
          borderRadius: '0 8px 8px 0',
          padding: '16px 20px',
        }}
      >
        <div
          className="font-semibold uppercase tracking-[0.1em]"
          style={{ fontSize: '11px', color: 'var(--color-island-faint)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <EyeOff size={14} strokeWidth={1.75} style={{ color: 'var(--color-island-faint)' }} />
          What This Analysis Cannot See
        </div>
        <div style={{ fontSize: '15px', lineHeight: '1.6', color: 'var(--color-island-muted)' }}>
          <ProseSection content={content} />
        </div>
      </div>
    </div>
  )
}

// ---- Inline Gadfly action (after Oracle section) ----

function InlineGadflyAction({ onOpenGadfly }: { onOpenGadfly?: () => void }) {
  const actionClassName = "inline-flex items-center gap-1.5 rounded-lg font-semibold transition-all duration-150 hover:opacity-90"
  const actionStyle = {
    padding: '7px 14px',
    fontSize: '12px',
    lineHeight: '1' as const,
    backgroundColor: 'color-mix(in srgb, var(--accent-gadfly) 8%, transparent)',
    border: '1px solid color-mix(in srgb, var(--accent-gadfly) 20%, transparent)',
    color: 'var(--accent-gadfly-ink)',
  }

  return (
    <div
      className="action-button mt-5 pt-5 flex items-center justify-between gap-4"
      style={{ borderTop: `1px solid var(--color-island-border)` }}
    >
      <span style={{ fontSize: '13px', lineHeight: '1', color: 'var(--color-island-muted)' }}>
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

function ExecutiveCard({ sections, onOpenCampaign, onScrollToQuestions }: { sections: ParsedSection[]; onOpenCampaign?: () => void; onScrollToQuestions?: () => void }) {
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
        borderBottom: `2px solid var(--color-island-border)`,
        backgroundColor: 'var(--color-island-warm-lift)',
        borderRadius: '12px',
        // spec 3.3: padding 20/24/24/24
        padding: '20px 24px 24px 24px',
      }}
    >


      {findingHeadings.length > 0 && (
        <>
          <div
            className="font-semibold uppercase tracking-[0.1em]"
            style={{ fontSize: '11px', color: 'var(--color-island-muted)', marginBottom: '12px' }}
          >
            Key Areas
          </div>
          <ul className="space-y-2 list-none p-0">
            {findingHeadings.map((heading, i) => (
              <li key={i} className="flex items-start gap-2.5" style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--color-island-body)' }}>
                <span
                  className="flex-shrink-0 rounded-full"
                  style={{ width: '6px', height: '6px', backgroundColor: 'var(--color-island-mark)', marginTop: '6px' }}
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
              color: arm.ink,
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

function SectionDivider() {
  return (
    <div
      style={{
        borderTop: `1px solid var(--color-island-border)`,
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
    ink: 'var(--accent-scout-ink)',
    border: 'color-mix(in srgb, var(--accent-scout) 18%, transparent)',
  },
  {
    arm: 'Oracle',
    archetype: 'THE PYTHIA',
    tagline: 'Read what the document says. Then read what it doesn\'t.',
    href: '/oracle',
    icon: Eye,
    color: 'var(--accent-oracle)',
    ink: 'var(--accent-oracle-ink)',
    border: 'color-mix(in srgb, var(--accent-oracle) 18%, transparent)',
  },
  {
    arm: 'Gadfly',
    archetype: 'THE GADFLY',
    tagline: 'The question nobody asked.',
    href: '/gadfly',
    icon: MessageCircleQuestion,
    color: 'var(--accent-gadfly)',
    ink: 'var(--accent-gadfly-ink)',
    border: 'color-mix(in srgb, var(--accent-gadfly) 18%, transparent)',
  },
  {
    arm: 'Lever',
    archetype: 'THE HERALD',
    tagline: 'Your concern. Their paperwork.',
    href: '/lever',
    icon: FileText,
    color: 'var(--accent-lever)',
    ink: 'var(--accent-lever-ink)',
    border: 'color-mix(in srgb, var(--accent-lever) 18%, transparent)',
  },
  {
    arm: 'Mirror',
    archetype: 'THE TRAVELLER',
    tagline: 'Someone else already solved this.',
    href: '/mirror',
    icon: GitCompareArrows,
    color: 'var(--accent-mirror)',
    ink: 'var(--accent-mirror-ink)',
    border: 'color-mix(in srgb, var(--accent-mirror) 18%, transparent)',
  },
]

const LENS_LINK = {
  arm: 'Lens',
  archetype: 'THE EXAMINER',
  tagline: 'Who is involved. What came before.',
  href: '',
  icon: Search,
  color: 'var(--accent-oracle)',
  ink: 'var(--accent-oracle-ink)',
  border: 'color-mix(in srgb, var(--accent-oracle) 18%, transparent)',
}

function GoDeeper({ onOpenCampaign, onOpenGadfly, onOpenLens }: { onOpenCampaign?: () => void; onOpenGadfly?: () => void; onOpenLens?: () => void }) {
  const armCallbacks: Record<string, (() => void) | undefined> = {
    Gadfly: onOpenGadfly,
    Lever: onOpenCampaign,
    Lens: onOpenLens,
  }
  const links = onOpenLens ? [...EXPERT_LINKS, LENS_LINK] : EXPERT_LINKS

  return (
    <div style={{ marginTop: '40px', paddingTop: '32px', borderTop: `1px solid var(--color-island-border)` }}>
      <p
        className="font-semibold uppercase tracking-[0.1em]"
        style={{ fontSize: '11px', color: 'var(--color-island-faint)', marginBottom: '16px' }}
      >
        Want to go deeper?
      </p>
      {/* The 11px archetype ("THE PERIPATETIC", one unbreakable word, ~82px)
          needs ~85px beside the 32px icon. One card per row below 480px, two
          up to 1024px, three from there: two columns at 320-375 and three at
          768 both left it short (Razor D1 W2). briefing-geometry.test.ts
          holds it at 320 to 1440. */}
      <div data-go-deeper className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => {
          const Icon = link.icon
          const callback = armCallbacks[link.arm]
          // text-left: Gadfly, Lever and Lens are <button>s, which centre by default (Jen D1 C2).
          const cardClassName = "link-card flex items-center gap-3 rounded-[10px] text-left transition-opacity duration-150 hover:opacity-85"
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
              <span className="flex min-w-0 flex-col">
                <span
                  className="font-semibold leading-snug"
                  style={{ fontSize: '12px', color: link.ink }}
                >
                  {link.arm}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.06em',
                    color: 'var(--color-island-faint)',
                    marginTop: '1px',
                  }}
                >
                  {link.archetype}
                </span>
                <span
                  className="leading-snug"
                  style={{ fontSize: '11px', color: 'var(--color-island-muted)', marginTop: '4px' }}
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

  // Raw streaming before first section
  if (isStreaming && !hasSections) {
    return (
      <article
        className={`content-island${darkMode ? ' content-island--dark dark-island' : ''}`}
        style={{
          position: 'relative',
          backgroundColor: 'var(--color-island-bg)',
          color: 'var(--color-island-text)',
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
              backgroundColor: 'var(--color-island-toggle)',
              color: 'var(--color-island-muted)',
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
          style={{ fontSize: '16px', lineHeight: '1.7', color: 'var(--color-island-secondary)' }}
        >
          {text}
        </p>
        <span className="mt-1 inline-block h-4 w-0.5 animate-pulse" style={{ backgroundColor: 'var(--color-island-muted)' }} />
      </article>
    )
  }

  return (
    <article
      className={`content-island${darkMode ? ' content-island--dark dark-island' : ''}`}
      style={{
        position: 'relative',
        backgroundColor: 'var(--color-island-bg)',
        color: 'var(--color-island-text)',
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
            backgroundColor: 'var(--color-island-toggle)',
            color: 'var(--color-island-muted)',
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
              color: 'var(--color-island-muted)',
              marginBottom: '8px',
            }}
          >
            Investigation
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '22px',
              fontWeight: 700,
              lineHeight: '1.3',
              color: 'var(--color-island-text)',
              maxWidth: '60ch',
              margin: 0,
            }}
          >
            {docTitle}
          </h1>
        </div>
      )}

      {/* Executive card — always first when we have sections */}
      {hasSections && <ExecutiveCard sections={sections} onOpenCampaign={onOpenCampaign} onScrollToQuestions={onScrollToQuestions} />}

      {sections.map((section, i) => {
        const headingLower = section.heading.toLowerCase()
        const isFirst = i === 0
        const showDivider = !isFirst

        // --- Context (new prompt) or Your Concern (old prompt, backward compat) ---
        // Both render as lead prose without a card box.
        if (headingLower.includes('context') || headingLower.includes('your concern')) {
          return (
            <div key={i}>
              {showDivider && <SectionDivider />}
              <SectionHeader heading={section.heading} />
              <ProseSection content={section.content} />
            </div>
          )
        }

        // --- What Governs This (document discovery) ---
        if (headingLower.includes('what governs') || headingLower.includes('governs this')) {
          return (
            <div key={i}>
              {showDivider && <SectionDivider />}
              <SectionHeader heading="What Governs This" />
              <WhatGovernsSection content={section.content} />
            </div>
          )
        }

        // --- Key Players ---
        if (headingLower.includes('key players')) {
          return (
            <div key={i}>
              {showDivider && <SectionDivider />}
              <SectionHeader heading="Key Players" />
              <PlayersSection content={section.content} />
            </div>
          )
        }

        // --- What the Public Record Shows (analysis, Inter only — spec 3.1) ---
        if (headingLower.includes('public record') || headingLower.includes('record shows')) {
          return (
            <div key={i}>
              {showDivider && <SectionDivider />}
              <SectionHeader heading="What the Public Record Shows" />
              {/* oracleSerif=false per spec 3.1 — analytical journalism reads cleaner in Inter */}
              <ProseSection content={section.content} showInsightCallouts />
              <InlineGadflyAction onOpenGadfly={onOpenGadfly} />
            </div>
          )
        }

        // --- What You Can Do (civic actions + FIPPA letter) ---
        if (headingLower.includes('what you can do') || headingLower.includes('you can do')) {
          return (
            <div key={i}>
              {showDivider && <SectionDivider />}
              <SectionHeader heading="What You Can Do" color="var(--accent-lever-ink)" />
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
              <ComparisonSection content={section.content} />
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
                backgroundColor: 'var(--color-island-card)',
                borderRadius: '12px',
                padding: '24px',
                // spec 3.2: remove rogue marginTop:16px
              }}
            >
              {showDivider && <SectionDivider />}
              <SectionHeader heading="Questions Worth Asking" color="var(--accent-gadfly-ink)" />
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
          style={{ backgroundColor: 'var(--color-island-muted)' }}
        />
      )}

      {/* Go Deeper footer — only when streaming is complete */}
      {!isStreaming && hasSections && <GoDeeper onOpenCampaign={onOpenCampaign} onOpenGadfly={onOpenGadfly} onOpenLens={onOpenLens} />}
    </article>
  )
}
