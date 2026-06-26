import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import {
  RepublicDocument,
  RepublicPage,
  Wordmark,
  AccentBox,
  SourceFooter,
} from '../primitives'
import { colors, type as typeScale, space } from '../styles'
import type { ComparisonSpec } from '@/lib/campaign/schemas'

const styles = StyleSheet.create({
  // Title block
  titleBlock: {
    marginBottom: space.xxl,
    paddingBottom: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontFamily: 'Instrument Sans',
    fontWeight: 700,
    fontSize: 20,
    lineHeight: 1.25,
    color: colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: typeScale.subHeading,
    color: colors.muted,
    fontWeight: 400,
  },

  // Table
  table: {
    marginBottom: 28,
  },
  headerRow: {
    flexDirection: 'row' as const,
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
  headerCellDimension: {
    fontFamily: 'Instrument Sans',
    fontWeight: 600,
    fontSize: typeScale.small,
    padding: space.md,
    color: colors.muted,
  },
  headerCellSubject: {
    fontFamily: 'Instrument Sans',
    fontWeight: 700,
    fontSize: typeScale.bodySmall,
    padding: space.md,
    color: colors.text,
    backgroundColor: 'rgba(91, 200, 138, 0.08)',
    borderLeftWidth: 2,
    borderLeftColor: colors.mirror,
  },
  row: {
    flexDirection: 'row' as const,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  cell: {
    fontSize: typeScale.bodySmall,
    padding: space.md,
    lineHeight: 1.5,
    color: colors.text,
  },
  cellDimension: {
    fontSize: typeScale.bodySmall,
    fontWeight: 600,
    padding: space.md,
    lineHeight: 1.5,
    color: colors.text,
  },
  cellSubject: {
    fontSize: typeScale.bodySmall,
    padding: space.md,
    lineHeight: 1.5,
    color: colors.text,
    backgroundColor: 'rgba(91, 200, 138, 0.08)',
    borderLeftWidth: 2,
    borderLeftColor: colors.mirror,
  },

  // Argument from existence block
  argumentBlock: {
    backgroundColor: 'rgba(91, 200, 138, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(91, 200, 138, 0.2)',
    borderLeftWidth: 3,
    borderLeftColor: colors.mirror,
    borderRadius: 4,
    padding: 20,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  argumentHeader: {
    fontFamily: 'Instrument Sans',
    fontWeight: 700,
    fontSize: typeScale.subHeading,
    color: colors.text,
    marginBottom: 10,
  },
  argumentText: {
    fontSize: typeScale.body,
    lineHeight: 1.6,
    color: colors.textSecondary,
  },
})

interface ComparisonTemplateProps {
  spec: ComparisonSpec
}

export function ComparisonTemplate({ spec }: ComparisonTemplateProps) {
  // Build the column structure: dimension | subject | alternatives...
  const allJurisdictions = [
    spec.subject.jurisdiction,
    ...spec.alternatives.map((a) => a.jurisdiction),
  ]
  const colCount = allJurisdictions.length + 1 // +1 for dimension column
  const dimWidth = '22%'
  const dataWidth = `${78 / allJurisdictions.length}%`

  return (
    <RepublicDocument title={spec.title}>
      <RepublicPage
        orientation="landscape"
        style={{
          paddingTop: space.pageMarginLandscape + 16,
          paddingBottom: space.pageMarginLandscape,
          paddingHorizontal: 48,
        }}
      >
        <Wordmark subtle />

        <View style={styles.titleBlock}>
          <Text style={styles.title}>{spec.title}</Text>
          <Text style={styles.subtitle}>
            How {spec.subject.jurisdiction} compares to{' '}
            {spec.alternatives.map((a) => a.jurisdiction).join(', ')}
          </Text>
        </View>

        {/* Comparison table */}
        <View style={styles.table}>
          {/* Header row */}
          <View style={styles.headerRow}>
            <Text style={[styles.headerCellDimension, { width: dimWidth }]}>
              Policy Dimension
            </Text>
            <Text style={[styles.headerCellSubject, { width: dataWidth }]}>
              {spec.subject.jurisdiction}
            </Text>
            {spec.alternatives.map((alt, i) => (
              <Text
                key={i}
                style={[styles.headerCell, { width: dataWidth }]}
              >
                {alt.jurisdiction}
              </Text>
            ))}
          </View>

          {/* Policy row */}
          <View style={styles.row} wrap={false}>
            <Text style={[styles.cellDimension, { width: dimWidth }]}>
              Policy
            </Text>
            <Text style={[styles.cellSubject, { width: dataWidth }]}>
              {spec.subject.policy}
            </Text>
            {spec.alternatives.map((alt, i) => (
              <Text key={i} style={[styles.cell, { width: dataWidth }]}>
                {alt.policy}
              </Text>
            ))}
          </View>

          {/* Outcome row */}
          <View style={styles.row} wrap={false}>
            <Text style={[styles.cellDimension, { width: dimWidth }]}>
              Outcome
            </Text>
            <Text style={[styles.cellSubject, { width: dataWidth }]}>
              {spec.subject.outcome ?? '--'}
            </Text>
            {spec.alternatives.map((alt, i) => (
              <Text key={i} style={[styles.cell, { width: dataWidth }]}>
                {alt.outcome}
              </Text>
            ))}
          </View>

          {/* Source row */}
          <View style={styles.row} wrap={false}>
            <Text style={[styles.cellDimension, { width: dimWidth }]}>
              Source
            </Text>
            <Text style={[styles.cellSubject, { width: dataWidth }]}>
              --
            </Text>
            {spec.alternatives.map((alt, i) => (
              <Text key={i} style={[styles.cell, { width: dataWidth, fontSize: 8.5, color: colors.muted }]}>
                {alt.source}
              </Text>
            ))}
          </View>
        </View>

        {/* Argument from Existence */}
        <View style={styles.argumentBlock} wrap={false}>
          <Text style={styles.argumentHeader}>Argument from Existence</Text>
          <Text style={styles.argumentText}>
            {spec.argumentFromExistence}
          </Text>
        </View>

        {/* Sources */}
        <SourceFooter sources={spec.sources} />
      </RepublicPage>
    </RepublicDocument>
  )
}
