import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import {
  RepublicDocument,
  RepublicPage,
  Wordmark,
  SourceFooter,
} from '../primitives'
import { colors, type as typeScale, space } from '../styles'
import type { TalkingPointsSpec } from '@/lib/campaign/schemas'

const styles = StyleSheet.create({
  // Header strip — accent-tinted bar with context and meta
  headerStrip: {
    backgroundColor: 'rgba(200, 91, 91, 0.06)',
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    padding: 16,
    paddingLeft: 20,
    marginBottom: 28,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
  },
  headerContext: {
    fontFamily: 'Instrument Sans',
    fontWeight: 700,
    fontSize: 13,
    color: colors.text,
    flex: 1,
  },
  headerMeta: {
    fontSize: 9.5,
    color: colors.muted,
    fontWeight: 500,
    textAlign: 'right' as const,
  },

  // The Ask box
  theAsk: {
    marginBottom: 28,
    padding: 18,
    paddingHorizontal: 22,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: 4,
  },
  theAskLabel: {
    fontFamily: 'Instrument Sans',
    fontWeight: 700,
    fontSize: typeScale.bodySmall,
    letterSpacing: 1.2,
    color: colors.accent,
    marginBottom: 6,
  },
  theAskText: {
    fontFamily: 'Instrument Sans',
    fontWeight: 700,
    fontSize: typeScale.sectionHeading,
    lineHeight: 1.35,
    color: colors.text,
  },

  // Section headers
  sectionHeader: {
    fontFamily: 'Instrument Sans',
    fontWeight: 700,
    fontSize: typeScale.bodySmall,
    letterSpacing: 0.6,
    color: colors.muted,
    marginBottom: 14,
    marginTop: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  // Talking point container
  pointContainer: {
    marginBottom: 20,
    paddingLeft: 36,
  },
  pointNumber: {
    position: 'absolute' as const,
    left: 0,
    top: -1,
    fontFamily: 'Instrument Sans',
    fontWeight: 700,
    fontSize: 18,
    color: colors.accent,
    lineHeight: 1,
  },
  pointClaim: {
    fontFamily: 'Instrument Sans',
    fontWeight: 600,
    fontSize: 12,
    lineHeight: 1.35,
    color: colors.text,
    marginBottom: 5,
  },
  pointEvidence: {
    fontSize: typeScale.body,
    color: colors.textSecondary,
    lineHeight: 1.55,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },
  pointSource: {
    color: colors.muted,
    fontSize: 8.5,
    fontStyle: 'italic' as const,
  },

  // Pushback grid — two columns with alternating rows
  pushbackContainer: {
    marginBottom: 28,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
  },
  pushbackHeaders: {
    flexDirection: 'row' as const,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pushbackColHeader: {
    fontFamily: 'Instrument Sans',
    fontWeight: 700,
    fontSize: typeScale.small,
    letterSpacing: 0.54,
    paddingVertical: 10,
    paddingHorizontal: 16,
    width: '50%',
  },
  pushbackColTheyll: {
    backgroundColor: colors.borderLight,
    color: colors.muted,
    fontStyle: 'italic' as const,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  pushbackColResponse: {
    backgroundColor: 'rgba(200, 91, 91, 0.04)',
    color: colors.accent,
  },
  pushbackRow: {
    flexDirection: 'row' as const,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pushbackRowLast: {
    flexDirection: 'row' as const,
  },
  pushbackCellTheyll: {
    width: '50%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: typeScale.body,
    lineHeight: 1.5,
    backgroundColor: colors.borderLight,
    fontStyle: 'italic' as const,
    color: colors.textMuted,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  pushbackCellResponse: {
    width: '50%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: typeScale.body,
    lineHeight: 1.5,
    backgroundColor: 'rgba(200, 91, 91, 0.02)',
    color: colors.text,
    fontWeight: 500,
  },

  // Notes space
  notesSpace: {
    marginTop: 24,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderFaint,
    borderTopStyle: 'dashed' as const,
  },
  notesLabel: {
    fontFamily: 'Instrument Sans',
    fontWeight: 600,
    fontSize: typeScale.footnote,
    letterSpacing: 0.64,
    color: colors.borderFaint,
  },
})

interface TalkingPointsTemplateProps {
  spec: TalkingPointsSpec
}

export function TalkingPointsTemplate({ spec }: TalkingPointsTemplateProps) {
  const date = new Date().toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Extract "the ask" from reasoning or title
  const theAsk = spec.reasoning || spec.title

  return (
    <RepublicDocument title={spec.title}>
      <RepublicPage>
        <Wordmark subtle />

        {/* Header strip */}
        <View style={styles.headerStrip}>
          <Text style={styles.headerContext}>{spec.context}</Text>
          <Text style={styles.headerMeta}>{date}</Text>
        </View>

        {/* The Ask */}
        <View style={styles.theAsk} wrap={false}>
          <Text style={styles.theAskLabel}>THE ASK</Text>
          <Text style={styles.theAskText}>{theAsk}</Text>
        </View>

        {/* Talking Points */}
        <Text style={styles.sectionHeader}>TALKING POINTS</Text>
        {spec.points.map((point, i) => (
          <View key={i} style={styles.pointContainer} wrap={false}>
            <Text style={styles.pointNumber}>{i + 1}</Text>
            <Text style={styles.pointClaim}>{point.claim}</Text>
            <Text style={styles.pointEvidence}>
              {point.evidence}{' '}
              <Text style={styles.pointSource}>Source: {point.source}</Text>
            </Text>
          </View>
        ))}

        {/* Anticipated Pushback */}
        <Text style={styles.sectionHeader}>ANTICIPATED PUSHBACK</Text>
        <View style={styles.pushbackContainer}>
          <View style={styles.pushbackHeaders}>
            <Text style={[styles.pushbackColHeader, styles.pushbackColTheyll]}>
              WHAT THEY WILL SAY
            </Text>
            <Text style={[styles.pushbackColHeader, styles.pushbackColResponse]}>
              YOUR RESPONSE
            </Text>
          </View>
          {spec.points.map((point, i) => (
            <View
              key={i}
              style={
                i < spec.points.length - 1
                  ? styles.pushbackRow
                  : styles.pushbackRowLast
              }
              wrap={false}
            >
              <Text style={styles.pushbackCellTheyll}>
                {point.anticipatedPushback}
              </Text>
              <Text style={styles.pushbackCellResponse}>
                {point.response}
              </Text>
            </View>
          ))}
        </View>

        {/* Sources */}
        <SourceFooter sources={spec.sources} />

        {/* Notes space */}
        <View style={styles.notesSpace}>
          <Text style={styles.notesLabel}>NOTES</Text>
        </View>
      </RepublicPage>
    </RepublicDocument>
  )
}
