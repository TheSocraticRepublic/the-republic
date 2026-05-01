import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import {
  RepublicDocument,
  RepublicPage,
  AccentBox,
  DataHighlight,
  FindingBlock,
  PlayerRow,
  SourceFooter,
} from '../primitives'
import { colors, type as typeScale, space } from '../styles'
import type { FactSheetSpec } from '@/lib/campaign/schemas'

const styles = StyleSheet.create({
  headline: {
    fontFamily: 'Plus Jakarta Sans',
    fontWeight: 700,
    fontSize: 23,
    lineHeight: 1.2,
    color: colors.text,
    marginBottom: space.xl,
    maxWidth: '90%',
  },
  sectionHeader: {
    fontFamily: 'Plus Jakarta Sans',
    fontWeight: 700,
    fontSize: typeScale.subHeading,
    letterSpacing: 0.44,
    color: colors.muted,
    marginBottom: space.md,
    marginTop: space.xl,
  },
  actionItem: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    marginBottom: 7,
    paddingLeft: 28,
  },
  actionCheckbox: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 3,
    position: 'absolute' as const,
    left: 2,
    top: 2,
  },
  actionText: {
    fontSize: typeScale.body,
    lineHeight: 1.5,
    fontWeight: 500,
    color: colors.text,
  },
  playerHeader: {
    flexDirection: 'row' as const,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 4,
  },
  playerHeaderText: {
    fontFamily: 'Plus Jakarta Sans',
    fontWeight: 600,
    fontSize: typeScale.small,
    color: colors.muted,
  },
})

interface FactSheetTemplateProps {
  spec: FactSheetSpec
}

export function FactSheetTemplate({ spec }: FactSheetTemplateProps) {
  // Extract lead stat from first key finding if it contains a number
  const leadStat = extractLeadStat(spec)

  return (
    <RepublicDocument title={spec.title}>
      <RepublicPage accentBand wordmark>
        {/* Headline */}
        <Text style={styles.headline}>{spec.headline}</Text>

        {/* Lead stat callout */}
        {leadStat && (
          <DataHighlight number={leadStat.number} label={leadStat.label} />
        )}

        {/* Callout box — reasoning as issue summary */}
        {spec.reasoning && (
          <AccentBox>{spec.reasoning}</AccentBox>
        )}

        {/* Key Findings */}
        <Text style={styles.sectionHeader}>KEY FINDINGS</Text>
        {spec.keyFindings.map((kf, i) => (
          <FindingBlock
            key={i}
            number={i + 1}
            finding={kf.finding}
            evidence={kf.evidence}
            source={kf.source}
          />
        ))}

        {/* Player Profiles */}
        {spec.playerProfiles.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>KEY PLAYERS</Text>
            <View style={styles.playerHeader}>
              <Text style={[styles.playerHeaderText, { width: '30%' }]}>Name</Text>
              <Text style={[styles.playerHeaderText, { width: '25%' }]}>Role</Text>
              <Text style={[styles.playerHeaderText, { flex: 1 }]}>Track Record</Text>
            </View>
            {spec.playerProfiles.map((p, i) => (
              <PlayerRow
                key={i}
                name={p.name}
                role={p.role}
                trackRecord={p.trackRecord}
              />
            ))}
          </>
        )}

        {/* Action Items */}
        {spec.actionItems.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>WHAT YOU CAN DO</Text>
            {spec.actionItems.map((item, i) => (
              <View key={i} style={styles.actionItem} wrap={false}>
                <View style={styles.actionCheckbox} />
                <Text style={styles.actionText}>{item}</Text>
              </View>
            ))}
          </>
        )}

        {/* Sources */}
        <SourceFooter sources={spec.sources} />
      </RepublicPage>
    </RepublicDocument>
  )
}

/**
 * Try to extract a lead stat from the headline or first finding.
 * Looks for numbers (with optional % or $ prefix) in the headline.
 */
function extractLeadStat(
  spec: FactSheetSpec
): { number: string; label: string } | null {
  // Try headline first
  const match = spec.headline.match(/(\$?[\d,]+\.?\d*%?)/)?.[1]
  if (match) {
    // Use headline minus the number as label
    const label = spec.headline.replace(match, '').trim()
    return { number: match, label: label || spec.headline }
  }

  // Fall back to first finding
  if (spec.keyFindings.length > 0) {
    const findingMatch = spec.keyFindings[0].finding.match(
      /(\$?[\d,]+\.?\d*%?)/
    )?.[1]
    if (findingMatch) {
      return {
        number: findingMatch,
        label: spec.keyFindings[0].finding.replace(findingMatch, '').trim(),
      }
    }
  }

  return null
}
