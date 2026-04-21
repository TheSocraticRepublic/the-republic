import type { CredentialSummary, CredentialType } from '@/lib/credentials'

interface CredentialBreakdownProps {
  summary: CredentialSummary
}

// Arm accent colors mapped to type clusters
const TYPE_COLORS: Record<CredentialType, string> = {
  // Investigation/oracle cluster
  investigation_completed: '#89B4C8',
  outcome_tracked: '#89B4C8',
  // Forum/scout cluster
  forum_contribution: '#B088C8',
  // Review/gadfly cluster
  peer_review: '#C8A84B',
  // Action/lever cluster
  foi_filed: '#C85B5B',
  foi_response_shared: '#C85B5B',
  campaign_used: '#C85B5B',
  // Contribution/mirror cluster
  jurisdiction_contributed: '#5BC88A',
  code_contributed: '#5BC88A',
  bug_report: '#5BC88A',
  translation: '#5BC88A',
}

export function CredentialBreakdown({ summary }: CredentialBreakdownProps) {
  const { rawTotal, effectiveTotal, decayMultiplier, breakdown } = summary

  const activeBreakdown = breakdown.filter((item) => item.count > 0)

  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/60 p-6 backdrop-blur-md">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Civic Credentials
        </p>
      </div>

      {/* Effective weight */}
      <div className="mb-5">
        <p
          className="text-3xl font-bold text-neutral-100"
          style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
        >
          {effectiveTotal}
        </p>
        {decayMultiplier < 1.0 && rawTotal > 0 && (
          <p className="mt-0.5 text-xs text-neutral-600">
            (decayed from {rawTotal})
          </p>
        )}
      </div>

      {/* Empty state */}
      {rawTotal === 0 && (
        <p className="text-sm text-neutral-600">No civic contributions yet.</p>
      )}

      {/* Breakdown list */}
      {activeBreakdown.length > 0 && (
        <div className="space-y-3">
          {activeBreakdown.map((item) => {
            const barWidth = rawTotal > 0 ? (item.rawWeight / rawTotal) * 100 : 0
            const color = TYPE_COLORS[item.type]
            return (
              <div key={item.type} className="flex items-center gap-3">
                <span className="w-44 flex-shrink-0 text-xs text-neutral-500">
                  {item.label}
                </span>
                <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: color,
                      opacity: 0.7,
                    }}
                  />
                </div>
                <span className="w-6 flex-shrink-0 text-right text-xs text-neutral-500 font-medium">
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
