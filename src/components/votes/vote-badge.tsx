const BALLOT_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  yes:        { color: 'var(--status-success)', bg: 'color-mix(in srgb, var(--status-success) 10%, transparent)', label: 'Yea' },
  no:         { color: 'var(--status-danger)',  bg: 'color-mix(in srgb, var(--status-danger) 10%, transparent)',  label: 'Nay' },
  paired:     { color: 'var(--status-warning)', bg: 'color-mix(in srgb, var(--status-warning) 10%, transparent)', label: 'Paired' },
  didnt_vote: { color: 'var(--status-neutral)', bg: 'color-mix(in srgb, var(--status-neutral) 10%, transparent)', label: 'Absent' },
}

interface VoteBadgeProps {
  ballot: string
}

export function VoteBadge({ ballot }: VoteBadgeProps) {
  const style = BALLOT_STYLES[ballot] ?? BALLOT_STYLES.didnt_vote
  return (
    <span
      className="inline-block rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wider"
      style={{ color: style.color, backgroundColor: style.bg }}
    >
      {style.label}
    </span>
  )
}
