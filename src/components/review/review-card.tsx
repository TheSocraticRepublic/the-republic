import { ProfileBadge } from '@/components/profile/profile-badge'
import { formatRelativeTime } from '@/lib/format-relative-time'

interface ReviewCardProps {
  reviewerDisplayName: string
  factualAccuracy: number
  sourceQuality: number
  missingContext: number
  strategicEffectiveness: number
  jurisdictionalAccuracy: number
  summary?: string | null
  createdAt: Date | string
}

const DIMENSION_LABELS = [
  { key: 'factualAccuracy', label: 'Factual' },
  { key: 'sourceQuality', label: 'Sources' },
  { key: 'missingContext', label: 'Context' },
  { key: 'strategicEffectiveness', label: 'Strategy' },
  { key: 'jurisdictionalAccuracy', label: 'Jurisdiction' },
] as const

export function ReviewCard({
  reviewerDisplayName,
  factualAccuracy,
  sourceQuality,
  missingContext,
  strategicEffectiveness,
  jurisdictionalAccuracy,
  summary,
  createdAt,
}: ReviewCardProps) {
  const scoreMap: Record<string, number> = {
    factualAccuracy,
    sourceQuality,
    missingContext,
    strategicEffectiveness,
    jurisdictionalAccuracy,
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/40 p-5">
      <div className="mb-4 flex items-center justify-between">
        <ProfileBadge displayName={reviewerDisplayName} size="sm" />
        <span className="text-[10px] text-neutral-600">{formatRelativeTime(createdAt)}</span>
      </div>

      <div className="space-y-2">
        {DIMENSION_LABELS.map(({ key, label }) => {
          const score = scoreMap[key]
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="w-20 flex-shrink-0 text-[10px] text-neutral-600">{label}</span>
              <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-white/20"
                  style={{ width: `${(score / 5) * 100}%` }}
                />
              </div>
              <span className="w-4 flex-shrink-0 text-xs text-neutral-500 text-right">
                {score}
              </span>
            </div>
          )
        })}
      </div>

      {summary && (
        <p className="mt-4 text-sm leading-relaxed text-neutral-400">{summary}</p>
      )}
    </div>
  )
}
