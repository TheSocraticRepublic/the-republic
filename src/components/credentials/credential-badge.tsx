interface CredentialBadgeProps {
  effectiveWeight: number
  size?: 'sm' | 'md'
}

export function CredentialBadge({ effectiveWeight, size = 'md' }: CredentialBadgeProps) {
  if (effectiveWeight === 0) return null

  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs'

  return (
    <span className={`${textSize} font-medium text-neutral-400`}>
      {effectiveWeight}
    </span>
  )
}
