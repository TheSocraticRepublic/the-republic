import type { CredentialSummary, CredentialType } from '@/lib/credentials'

interface CredentialBreakdownProps {
  summary: CredentialSummary
}

// Arm accent colors mapped to type clusters
const TYPE_COLORS: Record<CredentialType, string> = {
  // Investigation/oracle cluster
  investigation_completed: '#89B4C8',
  outcome_tracked: '#89B4C8',
  investigation_archived: '#89B4C8',
  // Forum/scout cluster
  forum_contribution: '#B088C8',
  // Review/gadfly cluster
  peer_review: 'var(--accent-gadfly)',
  // Action/lever cluster
  foi_filed: 'var(--accent-lever)',
  foi_response_shared: 'var(--accent-lever)',
  campaign_used: 'var(--accent-lever)',
  // Contribution/mirror cluster
  jurisdiction_contributed: 'var(--accent-mirror)',
  code_contributed: 'var(--accent-mirror)',
  bug_report: 'var(--accent-mirror)',
  translation: 'var(--accent-mirror)',
}

export function CredentialBreakdown({ summary }: CredentialBreakdownProps) {
  const { rawTotal, effectiveTotal, decayMultiplier, breakdown } = summary

  const activeBreakdown = breakdown.filter((item) => item.count > 0)

  return (
    <div className="rounded-xl border border-border bg-surface-1 shadow-sm p-6 backdrop-blur-md">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">
          Civic Credentials
        </p>
      </div>

      {/* Effective weight */}
      <div className="mb-5">
        <p
          className="text-3xl font-bold text-text-primary"
        >
          {effectiveTotal}
        </p>
        {decayMultiplier < 1.0 && rawTotal > 0 && (
          <p className="mt-0.5 text-xs text-text-faint">
            (decayed from {rawTotal})
          </p>
        )}
      </div>

      {/* Empty state */}
      {rawTotal === 0 && (
        <p className="text-sm text-text-faint">No civic contributions yet.</p>
      )}

      {/* Breakdown list */}
      {activeBreakdown.length > 0 && (
        <div className="space-y-3">
          {activeBreakdown.map((item) => {
            const barWidth = rawTotal > 0 ? (item.rawWeight / rawTotal) * 100 : 0
            const color = TYPE_COLORS[item.type]
            return (
              <div key={item.type} className="flex items-center gap-3">
                <span className="w-44 flex-shrink-0 text-xs text-text-muted">
                  {item.label}
                </span>
                <div className="flex-1 h-2 bg-surface-3 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: color,
                      opacity: 0.7,
                    }}
                  />
                </div>
                <span className="w-6 flex-shrink-0 text-right text-xs text-text-muted font-medium">
                  {item.count}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
