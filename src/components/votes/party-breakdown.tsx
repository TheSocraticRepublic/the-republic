import { PARTY_COLORS } from './party-badge'
import { VoteBadge } from './vote-badge'

interface PartyVoteData {
  party: string
  position: string
  disagreement: number | null
}

interface PartyBreakdownProps {
  partyVotes: PartyVoteData[]
}

// parsePartyVotes' normalised positions, as the stored ballot they are, so a
// party's position draws the same chip as an MP's ballot (Jen E2b C4).
const POSITION_BALLOTS: Record<string, string> = {
  Yes: 'yes',
  No: 'no',
  Paired: 'paired',
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
              <VoteBadge ballot={POSITION_BALLOTS[pv.position] ?? pv.position} />
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
