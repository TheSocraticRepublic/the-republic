interface Contradiction {
  statement: string
  statementDate: string
  statementContext: string
  vote: string
  voteDate: string
  ballot: string
  analysis: string
}

interface ContradictionCardProps {
  contradiction: Contradiction
}

export function ContradictionCard({ contradiction }: ContradictionCardProps) {
  return (
    <div
      className="rounded-xl border px-5 py-4"
      style={{
        borderColor: 'var(--border)',
        backgroundColor: 'var(--surface-1)',
      }}
    >
      {/* Statement */}
      <div className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-text-faint mb-1">
          Said
        </p>
        <p className="text-xs text-text-secondary leading-relaxed italic">
          &quot;{contradiction.statement}&quot;
        </p>
        <p className="mt-1 text-[10px] text-text-faint">
          {contradiction.statementDate} — {contradiction.statementContext}
        </p>
      </div>

      {/* Divider */}
      <div
        className="my-3 h-px"
        style={{ backgroundColor: 'var(--surface-3)' }}
      />

      {/* Vote */}
      <div className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-text-faint mb-1">
          Voted
        </p>
        <p className="text-xs text-text-secondary leading-relaxed">
          <span
            className="inline-block rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider mr-1.5"
            style={{
              color: contradiction.ballot.toLowerCase() === 'yes' ? 'var(--status-success)' : 'var(--status-danger)',
              backgroundColor:
                contradiction.ballot.toLowerCase() === 'yes'
                  ? 'color-mix(in srgb, var(--status-success) 10%, transparent)'
                  : 'color-mix(in srgb, var(--status-danger) 10%, transparent)',
            }}
          >
            {contradiction.ballot}
          </span>
          {contradiction.vote}
        </p>
        <p className="mt-1 text-[10px] text-text-faint">
          {contradiction.voteDate}
        </p>
      </div>

      {/* Analysis */}
      <p className="text-xs text-text-muted leading-relaxed">
        {contradiction.analysis}
      </p>
    </div>
  )
}

export type { Contradiction }
