interface VoteDetailCardProps {
  date: string
  descriptionEn: string
  result: string
  yeaTotal: number
  nayTotal: number
  pairedTotal: number | null
  session: string
  number: number
}

export function VoteDetailCard({
  date,
  descriptionEn,
  result,
  yeaTotal,
  nayTotal,
  pairedTotal,
  session,
  number,
}: VoteDetailCardProps) {
  return (
    <div
      className="rounded-xl border shadow-sm px-6 py-6"
      style={{
        borderColor: 'var(--border)',
        backgroundColor: 'var(--surface-1)',
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-text-faint mb-3">
        Vote {session}/{number}
      </p>

      <p
        className="text-base font-semibold text-text-primary leading-relaxed mb-4"
      >
        {descriptionEn}
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <span className="text-xs text-text-muted">{date}</span>

        <span
          className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{
            color: result === 'passed' ? 'var(--status-success)' : 'var(--status-danger)',
            backgroundColor:
              result === 'passed'
                ? 'color-mix(in srgb, var(--status-success) 10%, transparent)'
                : 'color-mix(in srgb, var(--status-danger) 10%, transparent)',
          }}
        >
          {result}
        </span>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-status-success">{yeaTotal} Yea</span>
          <span className="text-status-danger">{nayTotal} Nay</span>
          {pairedTotal != null && pairedTotal > 0 && (
            <span className="text-status-warning">{pairedTotal} Paired</span>
          )}
        </div>
      </div>
    </div>
  )
}
