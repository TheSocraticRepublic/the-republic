interface CredentialBadgeProps {
  effectiveWeight: number
  size?: 'sm' | 'md'
}

export function CredentialBadge({ effectiveWeight, size = 'md' }: CredentialBadgeProps) {
  if (effectiveWeight === 0) return null

  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'

  return (
    <span
      className={`${textSize} font-medium px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.06] text-neutral-300`}
      aria-label={`Civic weight: ${effectiveWeight}`}
    >
      {effectiveWeight}
    </span>
  )
}
