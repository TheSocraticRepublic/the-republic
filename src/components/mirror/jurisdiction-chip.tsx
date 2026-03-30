interface JurisdictionChipProps {
  name: string
  population?: number | null
}

export function JurisdictionChip({ name, population }: JurisdictionChipProps) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: 'rgba(91, 200, 138, 0.08)',
        border: '1px solid rgba(91, 200, 138, 0.25)',
        color: '#5BC88A',
      }}
    >
      <span>{name}</span>
      {population != null && (
        <span style={{ color: 'rgba(91, 200, 138, 0.6)' }}>
          {population >= 1_000_000
            ? `${(population / 1_000_000).toFixed(1)}M`
            : population >= 1_000
              ? `${Math.round(population / 1_000)}k`
              : population.toString()}
        </span>
      )}
    </span>
  )
}
