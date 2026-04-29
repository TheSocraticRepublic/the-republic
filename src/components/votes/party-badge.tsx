const PARTY_COLORS: Record<string, string> = {
  Liberal: '#D71920',
  Conservative: '#1A4782',
  NDP: '#F58220',
  'Bloc Québécois': '#33B2CC',
  Green: '#3D9B35',
  Independent: '#737373',
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
      <span className="text-xs text-neutral-400">{party}</span>
    </span>
  )
}

export { PARTY_COLORS }
