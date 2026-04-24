type ShadowAlertType = 'missing_topic' | 'missing_entity' | 'missing_jurisdiction_pattern'

interface ShadowAlertProps {
  alertType: ShadowAlertType
  missingTopic: string
  confidence: number
  referenceCount: number
}

const ALERT_TYPE_LABELS: Record<ShadowAlertType, string> = {
  missing_topic: 'Missing topic',
  missing_entity: 'Missing entity',
  missing_jurisdiction_pattern: 'Missing jurisdiction pattern',
}

export function ShadowAlert({
  alertType,
  missingTopic,
  confidence,
  referenceCount,
}: ShadowAlertProps) {
  const confidencePct = Math.round(confidence * 100)

  return (
    <div className="rounded-xl border border-amber-700/30 bg-amber-950/20 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-amber-600/80">
              {ALERT_TYPE_LABELS[alertType]}
            </span>
            <span className="text-[10px] text-neutral-600">
              {referenceCount} reference{referenceCount !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-300">
            {missingTopic}
          </p>
        </div>

        {/* Confidence */}
        <div className="flex-shrink-0 text-right">
          <span className="text-xs font-medium tabular-nums text-amber-500">
            {confidencePct}%
          </span>
          <p className="text-[10px] text-neutral-600">confidence</p>
        </div>
      </div>
    </div>
  )
}
