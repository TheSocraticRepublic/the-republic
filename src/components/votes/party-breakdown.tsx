import { PARTY_COLORS } from './party-badge'

interface PartyVoteData {
  party: string
  position: string
  disagreement: number | null
}

interface PartyBreakdownProps {
  partyVotes: PartyVoteData[]
}

const POSITION_STYLES: Record<string, { color: string; label: string }> = {
  Yes: { color: 'var(--status-success)', label: 'Yes' },
  No: { color: 'var(--status-danger)', label: 'No' },
  Paired: { color: 'var(--status-warning)', label: 'Paired' },
  Unknown: { color: 'var(--status-neutral)', label: 'Unknown' },
}

export function PartyBreakdown({ partyVotes }: PartyBreakdownProps) {
  if (partyVotes.length === 0) return null

  return (
    <div className="space-y-3">
      <p className="text-3xs font-semibold uppercase text-text-faint">
        Party Breakdown
      </p>
      {partyVotes.map((pv) => {
        const partyColor = PARTY_COLORS[pv.party] ?? '#8F8F8F'
        const posStyle = POSITION_STYLES[pv.position] ?? POSITION_STYLES.Unknown

        return (
          <div key={pv.party} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 min-w-0">
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: partyColor }}
              />
              <span className="text-xs text-text-secondary truncate">{pv.party}</span>
            </span>
            <span className="flex items-center gap-2 flex-shrink-0">
              <span
                className="inline-flex items-center rounded-md px-2 py-0.5 text-2xs font-medium"
                style={{
                  color: posStyle.color,
                  backgroundColor: `color-mix(in srgb, ${posStyle.color} 12%, transparent)`,
                }}
              >
                {posStyle.label}
              </span>
              {pv.disagreement != null && pv.disagreement > 0 && (
                <span className="text-2xs text-text-faint">
                  {Math.round(pv.disagreement * 100)}% broke ranks
                </span>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function normalizeVotePosition(vote: string): string {
  const lower = (vote ?? '').toLowerCase()
  if (lower === 'yes' || lower === 'yea') return 'Yes'
  if (lower === 'no' || lower === 'nay') return 'No'
  if (lower === 'paired') return 'Paired'
  return 'Unknown'
}

export function parsePartyVotes(
  partyVotesJson: unknown
): PartyVoteData[] {
  if (!Array.isArray(partyVotesJson)) return []

  return partyVotesJson.map((pv) => ({
    party:
      pv?.party?.short_name?.en ?? pv?.party?.name?.en ?? 'Unknown',
    position: normalizeVotePosition(pv?.vote),
    disagreement:
      typeof pv?.disagreement === 'number' ? pv.disagreement : null,
  }))
}
