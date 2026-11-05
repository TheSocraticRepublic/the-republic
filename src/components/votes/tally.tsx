/**
 * A division's totals as the House records them: `yea_total`, `nay_total`
 * and `paired_total`. There is no "Absent" figure and no percentage, because
 * the House publishes no denominator for either. Paired shows whenever the
 * total is a number, 0 included; a null total means the source gave none.
 *
 * The visible line is terse; screen readers get the long form instead.
 */

interface TallyProps {
  yeaTotal: number
  nayTotal: number
  pairedTotal: number | null
  className?: string
}

export function tallyLongForm({ yeaTotal, nayTotal, pairedTotal }: TallyProps): string {
  const parts = [`${yeaTotal} voted yea`, `${nayTotal} voted nay`]
  if (pairedTotal != null) parts.push(`${pairedTotal} paired`)
  return parts.join(', ')
}

export function Tally(props: TallyProps) {
  const { yeaTotal, nayTotal, pairedTotal, className } = props
  const items: { label: string; value: number }[] = [
    { label: 'Yea', value: yeaTotal },
    { label: 'Nay', value: nayTotal },
  ]
  if (pairedTotal != null) items.push({ label: 'Paired', value: pairedTotal })

  return (
    <p data-tally className={`text-xs text-text-muted${className ? ` ${className}` : ''}`}>
      <span aria-hidden="true" className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {items.map((item) => (
          <span key={item.label} data-tally-item={item.label}>
            <span className="font-semibold tabular-nums text-text-primary">{item.value}</span>{' '}
            {item.label}
          </span>
        ))}
      </span>
      <span className="sr-only">{tallyLongForm(props)}</span>
    </p>
  )
}
