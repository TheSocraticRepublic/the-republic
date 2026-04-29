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
      className="rounded-xl border px-6 py-6"
      style={{
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(255,255,255,0.02)',
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-600 mb-3">
        Vote {session}/{number}
      </p>

      <p
        className="text-base font-semibold text-neutral-100 leading-relaxed mb-4"
        style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
      >
        {descriptionEn}
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <span className="text-xs text-neutral-500">{date}</span>

        <span
          className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{
            color: result === 'passed' ? '#4ade80' : '#ef4444',
            backgroundColor:
              result === 'passed'
                ? 'rgba(74,222,128,0.10)'
                : 'rgba(239,68,68,0.10)',
          }}
        >
          {result}
        </span>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-emerald-400">{yeaTotal} Yea</span>
          <span className="text-red-400">{nayTotal} Nay</span>
          {pairedTotal != null && pairedTotal > 0 && (
            <span className="text-amber-400">{pairedTotal} Paired</span>
          )}
        </div>
      </div>
    </div>
  )
}
