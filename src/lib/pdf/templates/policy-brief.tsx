import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import {
  RepublicDocument,
  RepublicPage,
  AccentBand,
  Wordmark,
  SectionHeading,
  FindingBlock,
  PullQuote,
  SourceFooter,
} from '../primitives'
import { colors, type as typeScale, space } from '../styles'

const styles = StyleSheet.create({
  // Cover / header
  briefMeta: {
    fontSize: typeScale.small,
    color: colors.muted,
    marginBottom: 4,
    fontWeight: 500,
    letterSpacing: 0.45,
  },
  briefTitle: {
    fontFamily: 'Plus Jakarta Sans',
    fontWeight: 700,
    fontSize: typeScale.title,
    lineHeight: 1.2,
    color: colors.text,
    marginBottom: 10,
    maxWidth: 600,
  },
  briefAuthor: {
    fontSize: typeScale.bodySmall,
    color: colors.muted,
    marginBottom: 4,
  },
  briefDate: {
    fontSize: 9.5,
    color: colors.footerText,
    marginBottom: space.xxxl,
  },

  // Executive summary
  execSummary: {
    backgroundColor: 'rgba(200, 91, 91, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(200, 91, 91, 0.18)',
    borderRadius: 6,
    paddingVertical: 20,
    paddingHorizontal: 24,
    marginBottom: 36,
  },
  execLabel: {
    fontFamily: 'Plus Jakarta Sans',
    fontWeight: 700,
    fontSize: 8.5,
    letterSpacing: 1.02,
    color: colors.accent,
    marginBottom: 10,
  },
  execText: {
    fontSize: typeScale.body,
    lineHeight: 1.7,
    color: '#292524',
  },

  // Body text
  bodyText: {
    fontSize: typeScale.body,
    lineHeight: 1.65,
    marginBottom: 12,
    color: colors.text,
  },

  // Content with sidebar layout
  contentWithSidebar: {
    flexDirection: 'row' as const,
    gap: 28,
    alignItems: 'flex-start' as const,
    marginBottom: 16,
  },
  contentMain: {
    flex: 1,
  },
  sidebarCallout: {
    width: 180,
    backgroundColor: 'rgba(200, 91, 91, 0.05)',
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    padding: 16,
    paddingHorizontal: 18,
  },
  sidebarNumber: {
    fontFamily: 'Plus Jakarta Sans',
    fontWeight: 800,
    fontSize: 36,
    lineHeight: 1,
    color: colors.accent,
    marginBottom: 6,
  },
  sidebarLabel: {
    fontSize: 9.5,
    lineHeight: 1.45,
    color: colors.textMuted,
  },
  sidebarSource: {
    fontSize: typeScale.footnote,
    color: colors.footerText,
    marginTop: 8,
  },

  // Sub-heading
  subHeading: {
    fontFamily: 'Plus Jakarta Sans',
    fontWeight: 600,
    fontSize: typeScale.subHeading,
    color: colors.textSecondary,
    marginTop: 20,
    marginBottom: 8,
  },

  // Recommendations box
  recommendations: {
    backgroundColor: 'rgba(200, 91, 91, 0.06)',
    borderWidth: 2,
    borderColor: 'rgba(200, 91, 91, 0.25)',
    borderRadius: 8,
    paddingVertical: 24,
    paddingHorizontal: 28,
    marginVertical: 28,
  },
  recsLabel: {
    fontFamily: 'Plus Jakarta Sans',
    fontWeight: 800,
    fontSize: typeScale.small,
    letterSpacing: 1.26,
    color: colors.accent,
    marginBottom: 14,
  },
  recItem: {
    paddingVertical: 8,
    paddingLeft: 32,
    fontSize: typeScale.body,
    lineHeight: 1.6,
    color: '#292524',
  },
  recItemBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(200, 91, 91, 0.12)',
  },
  recNumber: {
    position: 'absolute' as const,
    left: 0,
    top: 8,
    fontFamily: 'Plus Jakarta Sans',
    fontWeight: 700,
    fontSize: 12,
    color: colors.accent,
  },

  // Implementation table
  implTable: {
    marginVertical: 12,
  },
  implHeaderRow: {
    flexDirection: 'row' as const,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  implHeaderCell: {
    fontFamily: 'Plus Jakarta Sans',
    fontWeight: 600,
    fontSize: typeScale.small,
    letterSpacing: 0.45,
    color: colors.muted,
    padding: 8,
    paddingHorizontal: 12,
  },
  implRow: {
    flexDirection: 'row' as const,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  implCell: {
    fontSize: typeScale.bodySmall,
    padding: 8,
    paddingHorizontal: 12,
    color: '#292524',
  },

  // Footer
  docFooter: {
    marginTop: 40,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  footerBrand: {
    fontFamily: 'Plus Jakarta Sans',
    fontWeight: 800,
    fontSize: typeScale.footnote,
    letterSpacing: 1.2,
    color: colors.borderFaint,
  },
  footerUrl: {
    fontSize: typeScale.footnote,
    color: colors.footerText,
  },
})

interface PolicyBriefData {
  title: string
  content: string
  metadata?: Record<string, unknown>
}

export function PolicyBriefTemplate({ data }: { data: PolicyBriefData }) {
  const date = new Date().toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
  })

  const sections = parsePolicyBriefContent(data.content)

  return (
    <RepublicDocument title={data.title}>
      {/* Page 1: Cover + Executive Summary */}
      <RepublicPage accentBand footer={false}>
        <Wordmark subtle />
        <Text style={styles.briefMeta}>POLICY BRIEF</Text>
        <Text style={styles.briefTitle}>{data.title}</Text>
        <Text style={styles.briefAuthor}>
          Prepared from investigation findings -- Open Cave Civic AI
        </Text>
        <Text style={styles.briefDate}>{date}</Text>

        {/* Executive Summary */}
        {sections.executiveSummary && (
          <View style={styles.execSummary}>
            <Text style={styles.execLabel}>EXECUTIVE SUMMARY</Text>
            <Text style={styles.execText}>{sections.executiveSummary}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.docFooter}>
          <Text style={styles.footerBrand}>OPEN CAVE</Text>
          <Text style={styles.footerUrl}>
            Generated from Open Cave -- opencave.ca -- {date}
          </Text>
        </View>
      </RepublicPage>

      {/* Subsequent pages: Body content */}
      <RepublicPage footer={false}>
        {sections.bodyContent.map((section, si) => (
          <React.Fragment key={si}>
            {section.heading && (
              <SectionHeading>{section.heading}</SectionHeading>
            )}
            {section.paragraphs.map((para, pi) => (
              <Text key={pi} style={styles.bodyText}>
                {para}
              </Text>
            ))}
          </React.Fragment>
        ))}

        {/* Recommendations */}
        {sections.recommendations.length > 0 && (
          <View style={styles.recommendations}>
            <Text style={styles.recsLabel}>RECOMMENDATIONS</Text>
            {sections.recommendations.map((rec, i) => (
              <View
                key={i}
                style={i > 0 ? [styles.recItem, styles.recItemBorder] : [styles.recItem]}
                wrap={false}
              >
                <Text style={styles.recNumber}>{i + 1}</Text>
                <Text>{rec}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Sources */}
        <SourceFooter sources={sections.sources} />

        {/* Footer */}
        <View style={styles.docFooter}>
          <Text style={styles.footerBrand}>OPEN CAVE</Text>
          <Text style={styles.footerUrl}>
            Generated from Open Cave -- opencave.ca -- {date}
          </Text>
        </View>
      </RepublicPage>
    </RepublicDocument>
  )
}

// -------------------------------------------------------------------
// Content parser for policy brief
// -------------------------------------------------------------------

interface ParsedPolicyBrief {
  executiveSummary: string | null
  bodyContent: { heading: string | null; paragraphs: string[] }[]
  recommendations: string[]
  sources: Array<{ text: string }>
}

function parsePolicyBriefContent(content: string): ParsedPolicyBrief {
  const lines = content.split('\n')
  const result: ParsedPolicyBrief = {
    executiveSummary: null,
    bodyContent: [],
    recommendations: [],
    sources: [],
  }

  let currentSection: { heading: string | null; paragraphs: string[] } = {
    heading: null,
    paragraphs: [],
  }
  let phase: 'body' | 'exec' | 'recs' | 'sources' = 'body'
  let execLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const lower = trimmed.toLowerCase()

    // Detect executive summary
    if (lower.includes('executive summary')) {
      phase = 'exec'
      continue
    }

    // Detect recommendations section
    if (lower === 'recommendations' || lower.startsWith('recommendation')) {
      if (phase === 'exec') {
        result.executiveSummary = execLines.join(' ')
        execLines = []
      }
      if (currentSection.paragraphs.length > 0) {
        result.bodyContent.push(currentSection)
        currentSection = { heading: null, paragraphs: [] }
      }
      phase = 'recs'
      continue
    }

    // Detect sources/references section
    if (lower === 'sources' || lower === 'references') {
      if (currentSection.paragraphs.length > 0) {
        result.bodyContent.push(currentSection)
        currentSection = { heading: null, paragraphs: [] }
      }
      phase = 'sources'
      continue
    }

    // Handle exec summary content
    if (phase === 'exec') {
      // Check if we hit a new section heading (not exec content)
      if (isHeading(trimmed)) {
        result.executiveSummary = execLines.join(' ')
        execLines = []
        phase = 'body'
        // Fall through to body handling below
      } else {
        execLines.push(trimmed)
        continue
      }
    }

    // Handle recommendations
    if (phase === 'recs') {
      const stripped = trimmed.replace(/^[\d\-\*\)\.]+\s*/, '')
      if (stripped && !isHeading(trimmed)) {
        result.recommendations.push(stripped)
        continue
      } else if (isHeading(trimmed)) {
        phase = 'body'
        // Fall through
      } else {
        continue
      }
    }

    // Handle sources
    if (phase === 'sources') {
      const stripped = trimmed.replace(/^[\d\-\*\)\.]+\s*/, '')
      if (stripped) {
        result.sources.push({ text: stripped })
      }
      continue
    }

    // Body content
    if (isHeading(trimmed)) {
      if (currentSection.paragraphs.length > 0 || currentSection.heading) {
        result.bodyContent.push(currentSection)
      }
      currentSection = { heading: trimmed, paragraphs: [] }
    } else {
      currentSection.paragraphs.push(trimmed)
    }
  }

  // Flush remaining exec lines
  if (execLines.length > 0 && !result.executiveSummary) {
    result.executiveSummary = execLines.join(' ')
  }

  // Flush remaining section
  if (currentSection.paragraphs.length > 0 || currentSection.heading) {
    result.bodyContent.push(currentSection)
  }

  return result
}

/**
 * Heuristic: detect heading lines.
 * Headings tend to be short, don't end with periods, and may be all-caps or title-case.
 */
function isHeading(line: string): boolean {
  if (line.length > 100) return false
  if (line.endsWith('.') || line.endsWith(',')) return false
  if (/^#{1,3}\s/.test(line)) return true // Markdown headings
  // All-caps short lines
  if (line === line.toUpperCase() && line.length < 60 && line.length > 3) return true
  // Title-case pattern: multiple capitalized words
  const words = line.split(/\s+/)
  if (words.length <= 8) {
    const capitalizedCount = words.filter((w) => /^[A-Z]/.test(w)).length
    if (capitalizedCount >= words.length * 0.6 && words.length >= 2) return true
  }
  return false
}
