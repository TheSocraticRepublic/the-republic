interface InsightBadgeProps {
  insight: string
}

export function InsightBadge({ insight }: InsightBadgeProps) {
  return (
    <div
      className="mt-2 inline-flex items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] leading-relaxed"
      style={{
        borderColor: 'rgba(200, 168, 75, 0.25)',
        backgroundColor: 'rgba(200, 168, 75, 0.08)',
        color: '#C8A84B',
      }}
    >
      <span className="mt-px flex-shrink-0 text-[10px] font-semibold uppercase tracking-widest opacity-60">
        insight
      </span>
      <span className="text-neutral-300">{insight}</span>
    </div>
  )
}
