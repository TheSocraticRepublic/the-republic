import type {
  CampaignMaterial,
  InfographicSpec,
  FactSheetSpec,
  SocialPostSpec,
  TalkingPointsSpec,
  TimelineSpec,
  ComparisonSpec,
} from './schemas'
import { MATERIAL_TYPE_LABELS } from './schemas'

/**
 * Convert a parsed campaign material spec to human-readable Markdown.
 * Each material type gets a purpose-built layout.
 */
export function campaignSpecToMarkdown(
  materialType: CampaignMaterial['materialType'],
  spec: CampaignMaterial
): string {
  const date = new Date().toISOString().slice(0, 10)

  switch (materialType) {
    case 'infographic':
      return infographicToMarkdown(spec as InfographicSpec, date)
    case 'fact_sheet':
      return factSheetToMarkdown(spec as FactSheetSpec, date)
    case 'social_post':
      return socialPostToMarkdown(spec as SocialPostSpec, date)
    case 'talking_points':
      return talkingPointsToMarkdown(spec as TalkingPointsSpec, date)
    case 'timeline':
      return timelineToMarkdown(spec as TimelineSpec, date)
    case 'comparison':
      return comparisonToMarkdown(spec as ComparisonSpec, date)
    default:
      return fallbackToMarkdown(spec, date)
  }
}

// ---------------------------------------------------------------------------
// Per-type formatters
// ---------------------------------------------------------------------------

function infographicToMarkdown(spec: InfographicSpec, date: string): string {
  const lines: string[] = []

  lines.push(`# ${spec.title}`)
  lines.push('')

  // Data points
  lines.push('## Key Data Points')
  lines.push('')
  spec.dataPoints.forEach((dp, i) => {
    const emphasis = dp.emphasis ? ' *' : ''
    lines.push(`${i + 1}. **${dp.label}**: ${dp.value}${emphasis}`)
    lines.push(`   Source: ${dp.source}`)
  })
  lines.push('')

  // Comparison
  if (spec.comparison) {
    lines.push('## Before / After')
    lines.push('')
    lines.push(`- **Before:** ${spec.comparison.before}`)
    lines.push(`- **After:** ${spec.comparison.after}`)
    lines.push(`- Source: ${spec.comparison.source}`)
    lines.push('')
  }

  // Timeline
  if (spec.timeline && spec.timeline.length > 0) {
    lines.push('## Timeline')
    lines.push('')
    spec.timeline.forEach((t) => {
      lines.push(`- **${t.date}** -- ${t.event}`)
    })
    lines.push('')
  }

  // Call to action
  lines.push('## Call to Action')
  lines.push('')
  lines.push(spec.callToAction)
  lines.push('')

  lines.push(sourcesSection(spec))
  lines.push(footer(date))

  return lines.join('\n')
}

function factSheetToMarkdown(spec: FactSheetSpec, date: string): string {
  const lines: string[] = []

  lines.push(`# ${spec.title}`)
  lines.push('')
  lines.push(`**${spec.headline}**`)
  lines.push('')

  // Key findings
  lines.push('## Key Findings')
  lines.push('')
  spec.keyFindings.forEach((kf, i) => {
    lines.push(`${i + 1}. ${kf.finding}`)
    lines.push(`   Evidence: ${kf.evidence}`)
    lines.push(`   Source: ${kf.source}`)
    lines.push('')
  })

  // Player profiles
  if (spec.playerProfiles.length > 0) {
    lines.push('## Key Players')
    lines.push('')
    spec.playerProfiles.forEach((p) => {
      lines.push(`### ${p.name}`)
      lines.push(`- **Role:** ${p.role}`)
      lines.push(`- **Track Record:** ${p.trackRecord}`)
      lines.push('')
    })
  }

  // Action items
  if (spec.actionItems.length > 0) {
    lines.push('## Action Items')
    lines.push('')
    spec.actionItems.forEach((item) => {
      lines.push(`- [ ] ${item}`)
    })
    lines.push('')
  }

  lines.push(sourcesSection(spec))
  lines.push(footer(date))

  return lines.join('\n')
}

function talkingPointsToMarkdown(spec: TalkingPointsSpec, date: string): string {
  const lines: string[] = []

  lines.push(`# ${spec.title}`)
  lines.push('')
  lines.push(`> ${spec.context}`)
  lines.push('')

  spec.points.forEach((p, i) => {
    lines.push(`## Point ${i + 1}`)
    lines.push('')
    lines.push(`**Claim:** ${p.claim}`)
    lines.push('')
    lines.push(`**Evidence:** ${p.evidence}`)
    lines.push('')
    lines.push(`**Anticipated Pushback:** ${p.anticipatedPushback}`)
    lines.push('')
    lines.push(`**Response:** ${p.response}`)
    lines.push('')
    lines.push(`Source: ${p.source}`)
    lines.push('')
  })

  lines.push(sourcesSection(spec))
  lines.push(footer(date))

  return lines.join('\n')
}

function timelineToMarkdown(spec: TimelineSpec, date: string): string {
  const lines: string[] = []

  lines.push(`# ${spec.title}`)
  lines.push('')

  // Sort events by date
  const sortedEvents = [...spec.events].sort((a, b) => {
    const aTime = new Date(a.date).getTime()
    const bTime = new Date(b.date).getTime()
    if (isNaN(aTime) && isNaN(bTime)) return 0
    if (isNaN(aTime)) return 1
    if (isNaN(bTime)) return -1
    return aTime - bTime
  })

  if (sortedEvents.length > 0) {
    lines.push('## Events')
    lines.push('')
    sortedEvents.forEach((e) => {
      const actor = e.actor ? ` (${e.actor})` : ''
      lines.push(`- **${e.date}**${actor}: ${e.event}`)
      if (e.significance) {
        lines.push(`  Significance: ${e.significance}`)
      }
    })
    lines.push('')
  }

  if (spec.deadlines.length > 0) {
    lines.push('## Deadlines')
    lines.push('')
    spec.deadlines.forEach((d) => {
      const critical = d.critical ? ' [CRITICAL]' : ''
      lines.push(`- **${d.date}**: ${d.action}${critical}`)
    })
    lines.push('')
  }

  lines.push(sourcesSection(spec))
  lines.push(footer(date))

  return lines.join('\n')
}

function comparisonToMarkdown(spec: ComparisonSpec, date: string): string {
  const lines: string[] = []

  lines.push(`# ${spec.title}`)
  lines.push('')

  // Subject jurisdiction
  lines.push('## Subject')
  lines.push('')
  lines.push(`**Jurisdiction:** ${spec.subject.jurisdiction}`)
  lines.push(`**Policy:** ${spec.subject.policy}`)
  if (spec.subject.outcome) {
    lines.push(`**Outcome:** ${spec.subject.outcome}`)
  }
  lines.push('')

  // Alternatives as a list (table would require fixed column widths and breaks on long content)
  lines.push('## Alternatives')
  lines.push('')
  spec.alternatives.forEach((alt, i) => {
    lines.push(`### ${i + 1}. ${alt.jurisdiction}`)
    lines.push(`- **Policy:** ${alt.policy}`)
    lines.push(`- **Outcome:** ${alt.outcome}`)
    lines.push(`- Source: ${alt.source}`)
    lines.push('')
  })

  // Argument from existence
  lines.push('## The Argument from Existence')
  lines.push('')
  lines.push(spec.argumentFromExistence)
  lines.push('')

  lines.push(sourcesSection(spec))
  lines.push(footer(date))

  return lines.join('\n')
}

function socialPostToMarkdown(spec: SocialPostSpec, date: string): string {
  const lines: string[] = []

  lines.push(`# ${spec.title}`)
  lines.push('')

  spec.variations.forEach((v, i) => {
    lines.push(`## Variation ${i + 1}: ${v.tone.charAt(0).toUpperCase() + v.tone.slice(1)}`)
    lines.push('')
    lines.push(v.text)
    lines.push('')
    if (v.hashtags.length > 0) {
      lines.push(`Hashtags: ${v.hashtags.map((h) => `#${h}`).join(' ')}`)
    }
    lines.push(`Character count: ${v.characterCount}`)
    lines.push(`Source: ${v.source}`)
    lines.push('')
  })

  lines.push(sourcesSection(spec))
  lines.push(footer(date))

  return lines.join('\n')
}

function fallbackToMarkdown(spec: CampaignMaterial, date: string): string {
  const label = MATERIAL_TYPE_LABELS[spec.materialType] ?? spec.materialType
  const lines: string[] = []
  lines.push(`# ${spec.title}`)
  lines.push('')
  lines.push(`Type: ${label}`)
  lines.push('')
  lines.push('```json')
  lines.push(JSON.stringify(spec, null, 2))
  lines.push('```')
  lines.push('')
  lines.push(sourcesSection(spec))
  lines.push(footer(date))
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function sourcesSection(spec: CampaignMaterial): string {
  if (!spec.sources || spec.sources.length === 0) return ''
  const lines: string[] = []
  lines.push('---')
  lines.push('')
  lines.push('## Sources')
  lines.push('')
  spec.sources.forEach((s, i) => {
    if (s.url) {
      lines.push(`${i + 1}. [${s.text}](${s.url})`)
    } else {
      lines.push(`${i + 1}. ${s.text}`)
    }
  })
  lines.push('')
  return lines.join('\n')
}

function footer(date: string): string {
  return `\n---\n\n*Generated by The Republic -- ${date}*\n`
}
