const BALLOT_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  yes: { color: '#4ade80', bg: 'rgba(74,222,128,0.10)', label: 'Yea' },
  no: { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Nay' },
  paired: { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', label: 'Paired' },
  didnt_vote: { color: '#737373', bg: 'rgba(115,115,115,0.10)', label: 'Absent' },
}

interface VoteBadgeProps {
  ballot: string
  size?: 'sm' | 'md'
}

export function VoteBadge({ ballot, size = 'sm' }: VoteBadgeProps) {
  const style = BALLOT_STYLES[ballot] ?? BALLOT_STYLES.didnt_vote

  return (
    <span
      className={`inline-block rounded-md font-semibold uppercase tracking-wider ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'
      }`}
      style={{ color: style.color, backgroundColor: style.bg }}
    >
      {style.label}
    </span>
  )
}
