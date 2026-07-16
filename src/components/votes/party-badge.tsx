const PARTY_COLORS: Record<string, string> = {
  Liberal: '#E4434E',
  Conservative: '#5B84B8',
  NDP: '#F58220',
  // federal_mps.party stores the short form "Bloc" (verified against prod DB);
  // keep the full name as an alias so either feed form resolves to the cyan.
  Bloc: '#33B2CC',
  'Bloc Québécois': '#33B2CC',
  Green: '#3D9B35',
  Independent: '#8F8F8F',
}

interface PartyBadgeProps {
  party: string
}

export function PartyBadge({ party }: PartyBadgeProps) {
  const color = PARTY_COLORS[party] ?? PARTY_COLORS.Independent

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2 w-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-text-secondary">{party}</span>
    </span>
  )
}

export { PARTY_COLORS }
