import { BALLOT_LABELS, ballotLabel } from './result-label'

const BALLOT_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  yes:        { color: 'var(--status-success)', bg: 'color-mix(in srgb, var(--status-success) 10%, transparent)', label: BALLOT_LABELS.yes },
  no:         { color: 'var(--status-danger)',  bg: 'color-mix(in srgb, var(--status-danger) 10%, transparent)',  label: BALLOT_LABELS.no },
  paired:     { color: 'var(--status-warning)', bg: 'color-mix(in srgb, var(--status-warning) 10%, transparent)', label: BALLOT_LABELS.paired },
  didnt_vote: { color: 'var(--status-neutral)', bg: 'color-mix(in srgb, var(--status-neutral) 10%, transparent)', label: BALLOT_LABELS.didnt_vote },
}

interface VoteBadgeProps {
  ballot: string
}

// A value outside the ballot enum is neutral and shown as stored, the way
// BallotList groups it, never folded into "Didn't vote" (Razor b1 N4).
const UNKNOWN_STYLE = { color: 'var(--status-neutral)', bg: 'color-mix(in srgb, var(--status-neutral) 10%, transparent)' }

/**
 * A ballot is a value, so it is written as a word in sentence case, not in
 * tracked caps (Jen E2b C4, the D2 rule), and never wraps ("Didn't vote" fits
 * the 96px ballot column on one line).
 */
export function VoteBadge({ ballot }: VoteBadgeProps) {
  const style = BALLOT_STYLES[ballot] ?? { ...UNKNOWN_STYLE, label: ballotLabel(ballot) }
  return (
    <span
      data-ballot={ballot}
      className="inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold"
      style={{ color: style.color, backgroundColor: style.bg }}
    >
      {style.label}
    </span>
  )
}
