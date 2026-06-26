import React from 'react'
import {
  Document,
  Page,
  View,
  Text,
  Link,
  StyleSheet,
} from '@react-pdf/renderer'
import { colors, type as typeScale, space, shared } from './styles'

// Ensure fonts are registered
import './fonts'

// -------------------------------------------------------------------
// RepublicPage — standard page wrapper
// -------------------------------------------------------------------

interface RepublicPageProps {
  children: React.ReactNode
  size?: 'LETTER' | 'A4'
  orientation?: 'portrait' | 'landscape'
  /** Show accent band at top of page */
  accentBand?: boolean
  /** Show wordmark below accent band */
  wordmark?: boolean
  /** Show standard footer */
  footer?: boolean
  /** Custom page style overrides */
  style?: React.ComponentProps<typeof Page>['style']
  /** Use serif font family (for legal documents) */
  serif?: boolean
}

export function RepublicPage({
  children,
  size = 'LETTER',
  orientation = 'portrait',
  accentBand = false,
  wordmark = false,
  footer = true,
  style,
  serif = false,
}: RepublicPageProps) {
  const baseStyle = serif
    ? shared.pageSerif
    : orientation === 'landscape'
    ? shared.pageLandscape
    : shared.page

  return (
    <Page size={size} orientation={orientation} style={style ? [baseStyle, style].flat() : baseStyle}>
      {accentBand && <AccentBand />}
      {wordmark && <Wordmark />}
      <View style={{ flex: 1 }}>{children}</View>
      {footer && <RepublicFooter />}
    </Page>
  )
}

// -------------------------------------------------------------------
// RepublicDocument — top-level Document wrapper
// -------------------------------------------------------------------

interface RepublicDocumentProps {
  children: React.ReactNode
  title?: string
  author?: string
}

export function RepublicDocument({
  children,
  title = 'Open Cave',
  author = 'Open Cave Civic AI',
}: RepublicDocumentProps) {
  return (
    <Document title={title} author={author} creator="Open Cave">
      {children}
    </Document>
  )
}

// -------------------------------------------------------------------
// AccentBand — 4px colored bar at page top
// -------------------------------------------------------------------

interface AccentBandProps {
  color?: string
}

export function AccentBand({ color }: AccentBandProps) {
  return (
    <View
      style={[
        shared.accentBand,
        ...(color ? [{ backgroundColor: color }] : []),
      ]}
    />
  )
}

// -------------------------------------------------------------------
// Wordmark — "OPEN CAVE" text
// -------------------------------------------------------------------

export function Wordmark({ subtle }: { subtle?: boolean }) {
  return (
    <Text style={subtle ? shared.wordmarkSubtle : shared.wordmark}>
      OPEN CAVE
    </Text>
  )
}

// -------------------------------------------------------------------
// SectionHeading — styled section title with bottom border
// -------------------------------------------------------------------

interface SectionHeadingProps {
  children: React.ReactNode
  /** Use uppercase muted label style instead of large heading */
  label?: boolean
}

export function SectionHeading({ children, label }: SectionHeadingProps) {
  return (
    <Text style={label ? shared.sectionLabel : shared.sectionHeading}>
      {children}
    </Text>
  )
}

// -------------------------------------------------------------------
// FindingBlock — numbered finding with evidence and source
// -------------------------------------------------------------------

const findingStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingLeft: 0,
  },
  number: {
    fontFamily: 'Instrument Sans',
    fontWeight: 700,
    fontSize: 11,
    color: colors.accent,
    width: 22,
    textAlign: 'right',
    marginRight: 10,
    flexShrink: 0,
  },
  content: {
    flex: 1,
  },
  findingText: {
    fontSize: typeScale.body,
    lineHeight: 1.55,
    color: colors.text,
  },
  findingBold: {
    fontWeight: 600,
  },
  evidence: {
    fontSize: typeScale.bodySmall,
    color: colors.textSecondary,
    lineHeight: 1.55,
    marginTop: 3,
  },
  source: {
    fontSize: 8.5,
    color: colors.muted,
    marginTop: 2,
  },
})

interface FindingBlockProps {
  number: number
  finding: string
  evidence?: string
  source?: string
}

export function FindingBlock({
  number,
  finding,
  evidence,
  source,
}: FindingBlockProps) {
  return (
    <View style={findingStyles.container} wrap={false}>
      <Text style={findingStyles.number}>{number}</Text>
      <View style={findingStyles.content}>
        <Text style={findingStyles.findingText}>{finding}</Text>
        {evidence && <Text style={findingStyles.evidence}>{evidence}</Text>}
        {source && <Text style={findingStyles.source}>Source: {source}</Text>}
      </View>
    </View>
  )
}

// -------------------------------------------------------------------
// PlayerRow — name / role / track record
// -------------------------------------------------------------------

const playerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderLight,
  },
  name: {
    fontWeight: 600,
    fontSize: typeScale.body,
    width: '30%',
    color: colors.text,
  },
  role: {
    fontSize: typeScale.body,
    width: '25%',
    color: colors.textMuted,
  },
  trackRecord: {
    fontSize: typeScale.bodySmall,
    flex: 1,
    color: colors.textSecondary,
  },
})

interface PlayerRowProps {
  name: string
  role: string
  trackRecord: string
}

export function PlayerRow({ name, role, trackRecord }: PlayerRowProps) {
  return (
    <View style={playerStyles.row} wrap={false}>
      <Text style={playerStyles.name}>{name}</Text>
      <Text style={playerStyles.role}>{role}</Text>
      <Text style={playerStyles.trackRecord}>{trackRecord}</Text>
    </View>
  )
}

// -------------------------------------------------------------------
// TimelineDot — circle node (solid or hollow)
// -------------------------------------------------------------------

const dotStyles = StyleSheet.create({
  solid: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  hollow: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.muted,
    backgroundColor: colors.bg,
  },
})

export function TimelineDot({ solid }: { solid?: boolean }) {
  return <View style={solid ? dotStyles.solid : dotStyles.hollow} />
}

// -------------------------------------------------------------------
// ComparisonTable — multi-column table with header row
// -------------------------------------------------------------------

const tableStyles = StyleSheet.create({
  table: {
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: colors.text,
  },
  headerCell: {
    fontFamily: 'Instrument Sans',
    fontWeight: 700,
    fontSize: typeScale.bodySmall,
    padding: space.md,
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  rowEven: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    backgroundColor: 'rgba(0, 0, 0, 0.015)',
  },
  cell: {
    fontSize: typeScale.bodySmall,
    padding: space.md,
    lineHeight: 1.5,
    color: colors.text,
  },
  subjectCell: {
    fontSize: typeScale.bodySmall,
    padding: space.md,
    lineHeight: 1.5,
    color: colors.text,
    backgroundColor: 'rgba(91, 200, 138, 0.08)',
    borderLeftWidth: 2,
    borderLeftColor: colors.mirror,
  },
  groupHeader: {
    flexDirection: 'row',
    paddingTop: 14,
    paddingBottom: 6,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.borderFaint,
  },
  groupHeaderText: {
    fontFamily: 'Instrument Sans',
    fontWeight: 700,
    fontSize: 8.5,
    letterSpacing: 0.85,
    color: colors.muted,
  },
})

interface ComparisonTableProps {
  headers: string[]
  /** Index of the subject column (highlighted in green) */
  subjectIndex?: number
  rows: {
    group?: string
    cells: string[]
  }[]
  columnWidths?: string[]
}

export function ComparisonTable({
  headers,
  subjectIndex = 1,
  rows,
  columnWidths,
}: ComparisonTableProps) {
  const colCount = headers.length
  const defaultWidth = `${100 / colCount}%`

  return (
    <View style={tableStyles.table}>
      {/* Header row */}
      <View style={tableStyles.headerRow}>
        {headers.map((h, i) => (
          <Text
            key={i}
            style={[
              tableStyles.headerCell,
              {
                width: columnWidths?.[i] ?? defaultWidth,
              },
              ...(i === subjectIndex
                ? [
                    {
                      backgroundColor: 'rgba(91, 200, 138, 0.08)',
                      borderLeftWidth: 2,
                      borderLeftColor: colors.mirror,
                    },
                  ]
                : []),
              ...(i === 0
                ? [
                    {
                      color: colors.muted,
                      fontSize: typeScale.small,
                      fontWeight: 600,
                    },
                  ]
                : []),
            ]}
          >
            {h}
          </Text>
        ))}
      </View>

      {/* Data rows */}
      {rows.map((row, ri) => {
        if (row.group) {
          return (
            <View key={ri} style={tableStyles.groupHeader}>
              <Text style={[tableStyles.groupHeaderText, { paddingHorizontal: space.md }]}>
                {row.group}
              </Text>
            </View>
          )
        }

        const isEven = ri % 2 === 0
        return (
          <View
            key={ri}
            style={isEven ? tableStyles.rowEven : tableStyles.row}
            wrap={false}
          >
            {row.cells.map((cell, ci) => (
              <Text
                key={ci}
                style={[
                  ci === subjectIndex ? tableStyles.subjectCell : tableStyles.cell,
                  ...(ci === 0 ? [{ fontWeight: 600 }] : []),
                  {
                    width: columnWidths?.[ci] ?? defaultWidth,
                  },
                ]}
              >
                {cell}
              </Text>
            ))}
          </View>
        )
      })}
    </View>
  )
}

// -------------------------------------------------------------------
// SourceFooter — formatted source list
// -------------------------------------------------------------------

interface SourceFooterProps {
  sources: Array<{ text: string; url?: string }>
}

export function SourceFooter({ sources }: SourceFooterProps) {
  if (!sources || sources.length === 0) return null

  return (
    <View style={shared.sourcesContainer}>
      <Text style={shared.sourcesHeader}>SOURCES</Text>
      {sources.map((s, i) => (
        <Text key={i} style={shared.sourceItem}>
          {i + 1}. {s.text}
        </Text>
      ))}
    </View>
  )
}

// -------------------------------------------------------------------
// AccentBox — bordered callout with tinted background
// -------------------------------------------------------------------

const accentBoxStyles = StyleSheet.create({
  container: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    backgroundColor: 'rgba(200, 91, 91, 0.06)',
    padding: 14,
    paddingLeft: 18,
    marginBottom: 22,
  },
  text: {
    fontSize: typeScale.body,
    lineHeight: 1.55,
    color: colors.text,
  },
})

interface AccentBoxProps {
  children: React.ReactNode
  borderColor?: string
  bgColor?: string
}

export function AccentBox({ children, borderColor, bgColor }: AccentBoxProps) {
  return (
    <View
      style={[
        accentBoxStyles.container,
        ...(borderColor ? [{ borderLeftColor: borderColor }] : []),
        ...(bgColor ? [{ backgroundColor: bgColor }] : []),
      ]}
    >
      {typeof children === 'string' ? (
        <Text style={accentBoxStyles.text}>{children}</Text>
      ) : (
        children
      )}
    </View>
  )
}

// -------------------------------------------------------------------
// DataHighlight — large number + caption
// -------------------------------------------------------------------

const highlightStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 14,
    marginBottom: space.xxl,
    paddingBottom: space.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  number: {
    fontFamily: 'Instrument Sans',
    fontWeight: 800,
    fontSize: 42,
    color: colors.accent,
    lineHeight: 1,
  },
  label: {
    fontFamily: 'Inter',
    fontSize: typeScale.sectionHeading,
    fontWeight: 400,
    color: colors.text,
    lineHeight: 1.3,
    maxWidth: 400,
  },
})

interface DataHighlightProps {
  number: string
  label: string
}

export function DataHighlight({ number, label }: DataHighlightProps) {
  return (
    <View style={highlightStyles.container}>
      <Text style={highlightStyles.number}>{number}</Text>
      <Text style={highlightStyles.label}>{label}</Text>
    </View>
  )
}

// -------------------------------------------------------------------
// PullQuote — accent-colored quote with left border
// -------------------------------------------------------------------

const quoteStyles = StyleSheet.create({
  container: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    paddingVertical: space.md,
    paddingLeft: space.xl,
    marginVertical: space.xxl,
  },
  text: {
    fontFamily: 'Instrument Sans',
    fontWeight: 600,
    fontSize: typeScale.sectionHeading,
    lineHeight: 1.45,
    color: colors.accent,
  },
  attribution: {
    fontFamily: 'Inter',
    fontWeight: 400,
    fontSize: typeScale.small,
    color: colors.muted,
    marginTop: 6,
  },
})

interface PullQuoteProps {
  text: string
  attribution?: string
}

export function PullQuote({ text, attribution }: PullQuoteProps) {
  return (
    <View style={quoteStyles.container}>
      <Text style={quoteStyles.text}>{text}</Text>
      {attribution && (
        <Text style={quoteStyles.attribution}>{attribution}</Text>
      )}
    </View>
  )
}

// -------------------------------------------------------------------
// RepublicFooter — standard page footer
// -------------------------------------------------------------------

function RepublicFooter() {
  const date = new Date().toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <View style={shared.footer}>
      <Text style={shared.footerText}>
        Generated from Open Cave -- opencave.ca
      </Text>
      <Text style={shared.footerText}>{date}</Text>
    </View>
  )
}

// -------------------------------------------------------------------
// Inline text helpers
// -------------------------------------------------------------------

const inlineStyles = StyleSheet.create({
  bold: { fontWeight: 600 },
  italic: { fontStyle: 'italic' },
  muted: { color: colors.muted },
  accent: { color: colors.accent },
  small: { fontSize: typeScale.small },
  footnote: { fontSize: typeScale.footnote },
})

export { inlineStyles, RepublicFooter }
