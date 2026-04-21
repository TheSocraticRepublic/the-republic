interface ReviewSummaryProps {
  count: number
  averages: {
    factualAccuracy: number
    sourceQuality: number
    missingContext: number
    strategicEffectiveness: number
    jurisdictionalAccuracy: number
  }
}

const DIMENSION_LABELS = [
  { key: 'factualAccuracy', label: 'Factual Accuracy' },
  { key: 'sourceQuality', label: 'Source Quality' },
  { key: 'missingContext', label: 'Missing Context' },
  { key: 'strategicEffectiveness', label: 'Strategic Effectiveness' },
  { key: 'jurisdictionalAccuracy', label: 'Jurisdictional Accuracy' },
] as const

export function ReviewSummary({ count, averages }: ReviewSummaryProps) {
  const averageMap: Record<string, number> = averages

  return (
    <div className="mb-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Peer Review
        </p>
        <span className="text-xs text-neutral-600">
          {count} {count === 1 ? 'review' : 'reviews'}
        </span>
      </div>

      <div className="space-y-3">
        {DIMENSION_LABELS.map(({ key, label }) => {
          const avg = averageMap[key]
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="w-40 flex-shrink-0 text-xs text-neutral-500">{label}</span>
              <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-neutral-300/40"
                  style={{ width: `${(avg / 5) * 100}%` }}
                />
              </div>
              <span className="w-6 flex-shrink-0 text-xs text-neutral-400 text-right">
                {avg.toFixed(1)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
