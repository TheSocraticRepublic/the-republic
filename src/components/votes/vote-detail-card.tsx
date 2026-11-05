import { ResultLabel } from './result-label'
import { Tally } from './tally'

/**
 * The outcome and the totals of one division. The motion's description, its
 * division number and its date live in the page's DetailHeader (the h1 and
 * the meta line), so the card does not repeat them.
 */
interface VoteDetailCardProps {
  result: string
  yeaTotal: number
  nayTotal: number
  pairedTotal: number | null
}

export function VoteDetailCard({
  result,
  yeaTotal,
  nayTotal,
  pairedTotal,
}: VoteDetailCardProps) {
  return (
    <div
      data-vote-detail-card
      className="flex flex-col gap-1 rounded-xl border shadow-sm px-6 py-5"
      style={{
        borderColor: 'var(--border)',
        backgroundColor: 'var(--surface-1)',
      }}
    >
      {/* The answer reads first, on its own line, with the totals beneath (Jen E2b C2). */}
      <ResultLabel result={result} size="lg" />
      <Tally yeaTotal={yeaTotal} nayTotal={nayTotal} pairedTotal={pairedTotal} size="sm" />
    </div>
  )
}
