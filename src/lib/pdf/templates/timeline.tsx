import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import {
  RepublicDocument,
  RepublicPage,
  Wordmark,
  SourceFooter,
  TimelineDot,
} from '../primitives'
import { colors, type as typeScale, space } from '../styles'
import type { TimelineSpec } from '@/lib/campaign/schemas'

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
    marginBottom: space.sm,
  },
  subtitle: {
    fontSize: typeScale.subHeading,
    color: colors.muted,
    fontWeight: 400,
  },

  // Legend
  legend: {
    flexDirection: 'row' as const,
    gap: 24,
    flexWrap: 'wrap' as const,
    marginBottom: 28,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.borderLight,
    borderRadius: 4,
  },
  legendItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  legendText: {
    fontSize: typeScale.small,
    color: colors.textMuted,
  },

  // Timeline container
  timeline: {
    paddingLeft: 140,
    position: 'relative' as const,
  },

  // Spine line
  spine: {
    position: 'absolute' as const,
    left: 128,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.border,
  },

  // Phase divider
  phaseDivider: {
    paddingTop: 20,
    paddingBottom: 14,
    marginLeft: -140,
  },
  phaseDividerFirst: {
    paddingTop: 0,
    paddingBottom: 14,
    marginLeft: -140,
  },
  phaseLabel: {
    fontFamily: 'Instrument Sans',
    fontWeight: 700,
    fontSize: typeScale.small,
    letterSpacing: 1.08,
    color: colors.muted,
  },

  // Event
  event: {
    paddingBottom: 28,
    paddingLeft: 28,
    minHeight: 48,
  },
  eventLast: {
    paddingBottom: 0,
    paddingLeft: 28,
    minHeight: 48,
  },

  // Date label (positioned left of spine)
  eventDate: {
    position: 'absolute' as const,
    left: -140,
    top: 0,
    width: 118,
    textAlign: 'right' as const,
    fontFamily: 'Instrument Sans',
    fontWeight: 600,
    fontSize: typeScale.bodySmall,
    color: colors.muted,
    lineHeight: 1.3,
    paddingRight: 18,
  },
  eventDateApprox: {
    position: 'absolute' as const,
    left: -140,
    top: 0,
    width: 118,
    textAlign: 'right' as const,
    fontFamily: 'Instrument Sans',
    fontWeight: 500,
    fontSize: typeScale.bodySmall,
    color: colors.footerText,
    fontStyle: 'italic' as const,
    lineHeight: 1.3,
    paddingRight: 18,
  },

  // Node positioned on spine
  nodeContainer: {
    position: 'absolute' as const,
    left: -6,
    top: 3,
  },

  // Connector line from spine to content
  connector: {
    position: 'absolute' as const,
    left: 4,
    top: 8,
    width: 18,
    height: 1,
    backgroundColor: colors.borderFaint,
  },
  connectorDashed: {
    position: 'absolute' as const,
    left: 4,
    top: 8,
    width: 18,
    height: 1,
    backgroundColor: colors.borderFaint,
    // Dashed not supported in react-pdf -- use thin line instead
  },

  // Event content
  eventContent: {
    paddingLeft: 6,
  },
  eventTitle: {
    fontWeight: 600,
    fontSize: typeScale.body,
    color: colors.text,
    marginBottom: 3,
    lineHeight: 1.4,
  },
  eventDescription: {
    fontSize: typeScale.bodySmall,
    color: colors.textMuted,
    lineHeight: 1.5,
    marginBottom: 6,
  },

  // Actor chips
  actorChips: {
    flexDirection: 'row' as const,
    gap: 6,
    flexWrap: 'wrap' as const,
  },
  actorChip: {
    paddingVertical: 2,
    paddingHorizontal: 10,
    borderRadius: 10,
    fontSize: typeScale.footnote,
    fontWeight: 500,
    lineHeight: 1.5,
  },
  chipDeadline: {
    backgroundColor: 'rgba(200, 91, 91, 0.15)',
    color: colors.accent,
    fontWeight: 600,
    letterSpacing: 0.32,
  },
})

interface TimelineTemplateProps {
  spec: TimelineSpec
}

export function TimelineTemplate({ spec }: TimelineTemplateProps) {
  // Merge events and deadlines into a single sorted list
  const allItems = buildTimelineItems(spec)

  // Group items into phases by year
  const phases = groupByYear(allItems)

  return (
    <RepublicDocument title={spec.title}>
      <RepublicPage>
        <Wordmark subtle />

        <View style={styles.titleBlock}>
          <Text style={styles.title}>{spec.title}</Text>
          <Text style={styles.subtitle}>
            {spec.jurisdiction.name} -- Key events and deadlines
          </Text>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <TimelineDot solid />
            <Text style={styles.legendText}>Critical deadline</Text>
          </View>
          <View style={styles.legendItem}>
            <TimelineDot />
            <Text style={styles.legendText}>Historical event</Text>
          </View>
        </View>

        {/* Timeline */}
        <View style={styles.timeline}>
          <View style={styles.spine} />

          {phases.map((phase, pi) => (
            <React.Fragment key={pi}>
              {/* Phase divider */}
              <View
                style={
                  pi === 0
                    ? styles.phaseDividerFirst
                    : styles.phaseDivider
                }
              >
                <Text style={styles.phaseLabel}>{phase.label}</Text>
              </View>

              {/* Events in this phase */}
              {phase.items.map((item, ei) => {
                const isLast =
                  pi === phases.length - 1 && ei === phase.items.length - 1

                return (
                  <View
                    key={ei}
                    style={isLast ? styles.eventLast : styles.event}
                    wrap={false}
                  >
                    {/* Date label */}
                    <Text
                      style={
                        item.approximate
                          ? styles.eventDateApprox
                          : styles.eventDate
                      }
                    >
                      {item.dateLabel}
                    </Text>

                    {/* Node on spine */}
                    <View style={styles.nodeContainer}>
                      <TimelineDot solid={item.isDeadline} />
                    </View>

                    {/* Connector */}
                    <View style={styles.connector} />

                    {/* Content */}
                    <View style={styles.eventContent}>
                      <Text style={styles.eventTitle}>{item.title}</Text>
                      {item.description && (
                        <Text style={styles.eventDescription}>
                          {item.description}
                        </Text>
                      )}
                      <View style={styles.actorChips}>
                        {item.actor && (
                          <Text style={[styles.actorChip, getActorChipStyle(item.actor)]}>
                            {item.actor}
                          </Text>
                        )}
                        {item.isDeadline && item.isCritical && (
                          <Text style={[styles.actorChip, styles.chipDeadline]}>
                            DEADLINE
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                )
              })}
            </React.Fragment>
          ))}
        </View>

        {/* Sources */}
        <SourceFooter sources={spec.sources} />
      </RepublicPage>
    </RepublicDocument>
  )
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

interface TimelineItem {
  date: Date | null
  dateLabel: string
  title: string
  description: string
  actor?: string
  isDeadline: boolean
  isCritical: boolean
  approximate: boolean
}

function buildTimelineItems(spec: TimelineSpec): TimelineItem[] {
  const items: TimelineItem[] = []

  for (const e of spec.events) {
    const parsed = new Date(e.date)
    items.push({
      date: isNaN(parsed.getTime()) ? null : parsed,
      dateLabel: e.date,
      title: e.event,
      description: e.significance,
      actor: e.actor,
      isDeadline: false,
      isCritical: false,
      approximate: e.date.startsWith('~') || e.date.startsWith('Q'),
    })
  }

  for (const d of spec.deadlines) {
    const parsed = new Date(d.date)
    items.push({
      date: isNaN(parsed.getTime()) ? null : parsed,
      dateLabel: d.date,
      title: d.action,
      description: '',
      isDeadline: true,
      isCritical: d.critical,
      approximate: false,
    })
  }

  // Sort by date, null dates go to end
  items.sort((a, b) => {
    if (!a.date && !b.date) return 0
    if (!a.date) return 1
    if (!b.date) return -1
    return a.date.getTime() - b.date.getTime()
  })

  return items
}

interface Phase {
  label: string
  items: TimelineItem[]
}

function groupByYear(items: TimelineItem[]): Phase[] {
  const phases: Phase[] = []
  let currentYear = ''

  for (const item of items) {
    const year = item.date
      ? item.date.getFullYear().toString()
      : 'Unknown'

    if (year !== currentYear) {
      currentYear = year
      phases.push({ label: year, items: [] })
    }

    phases[phases.length - 1].items.push(item)
  }

  return phases
}

function getActorChipStyle(actor: string): Record<string, string> {
  const lower = actor.toLowerCase()
  if (lower.includes('council') || lower.includes('staff') || lower.includes('planning')) {
    return { backgroundColor: 'rgba(137, 180, 200, 0.18)', color: '#5a8ea6' }
  }
  if (lower.includes('developer') || lower.includes('corp') || lower.includes('inc')) {
    return { backgroundColor: 'rgba(200, 91, 91, 0.12)', color: '#b04a4a' }
  }
  if (lower.includes('resident') || lower.includes('community') || lower.includes('citizen')) {
    return { backgroundColor: 'rgba(200, 168, 75, 0.18)', color: '#9a8236' }
  }
  if (lower.includes('ministry') || lower.includes('provincial') || lower.includes('federal')) {
    return { backgroundColor: 'rgba(91, 200, 138, 0.15)', color: '#3d8a5a' }
  }
  // Default
  return { backgroundColor: 'rgba(0, 0, 0, 0.06)', color: '#57534e' }
}
