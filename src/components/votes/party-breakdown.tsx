import { PARTY_COLORS } from './party-badge'

interface PartyVoteData {
  party: string
  yea: number
  nay: number
  paired: number
}

interface PartyBreakdownProps {
  partyVotes: PartyVoteData[]
}

export function PartyBreakdown({ partyVotes }: PartyBreakdownProps) {
  if (partyVotes.length === 0) return null

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-600">
        Party Breakdown
      </p>
      {partyVotes.map((pv) => {
        const total = pv.yea + pv.nay + pv.paired
        if (total === 0) return null
        const yeaPct = (pv.yea / total) * 100
        const nayPct = (pv.nay / total) * 100
        const pairedPct = (pv.paired / total) * 100
        const partyColor = PARTY_COLORS[pv.party] ?? '#737373'

        return (
          <div key={pv.party} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: partyColor }}
                />
                <span className="text-xs text-neutral-300">{pv.party}</span>
              </span>
              <span className="text-[10px] text-neutral-600">
                {pv.yea}Y / {pv.nay}N{pv.paired > 0 ? ` / ${pv.paired}P` : ''}
              </span>
            </div>
            <div
              className="flex h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
            >
              {yeaPct > 0 && (
                <div
                  className="h-full"
                  style={{
                    width: `${yeaPct}%`,
                    backgroundColor: '#4ade80',
                  }}
                />
              )}
              {nayPct > 0 && (
                <div
                  className="h-full"
                  style={{
                    width: `${nayPct}%`,
                    backgroundColor: '#ef4444',
                  }}
                />
              )}
              {pairedPct > 0 && (
                <div
                  className="h-full"
                  style={{
                    width: `${pairedPct}%`,
                    backgroundColor: '#f59e0b',
                  }}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function parsePartyVotes(
  partyVotesJson: unknown
): PartyVoteData[] {
  if (!Array.isArray(partyVotesJson)) return []

  const partyMap = new Map<string, { yea: number; nay: number; paired: number }>()

  for (const pv of partyVotesJson) {
    const partyName =
      pv?.party?.short_name?.en ?? pv?.party?.name?.en ?? 'Unknown'
    const voteDirection = (pv?.vote ?? '').toLowerCase()

    if (!partyMap.has(partyName)) {
      partyMap.set(partyName, { yea: 0, nay: 0, paired: 0 })
    }

    const entry = partyMap.get(partyName)!

    if (voteDirection === 'yes' || voteDirection === 'yea') {
      entry.yea += pv?.party_size ?? 1
    } else if (voteDirection === 'no' || voteDirection === 'nay') {
      entry.nay += pv?.party_size ?? 1
    } else if (voteDirection === 'paired') {
      entry.paired += pv?.party_size ?? 1
    }
  }

  return Array.from(partyMap.entries()).map(([party, counts]) => ({
    party,
    ...counts,
  }))
}
