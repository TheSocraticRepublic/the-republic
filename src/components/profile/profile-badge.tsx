// Deterministic avatar badge — colored circle with first letter + display name text

const COLORS = ['#B088C8', '#89B4C8', '#C8A84B', '#C85B5B', '#5BC88A']

function hashDisplayName(name: string): number {
  return name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
}

function getColor(displayName: string): string {
  return COLORS[hashDisplayName(displayName) % COLORS.length]
}

interface ProfileBadgeProps {
  displayName: string
  size?: 'sm' | 'md'
}

export function ProfileBadge({ displayName, size = 'md' }: ProfileBadgeProps) {
  const color = getColor(displayName)
  const circleSize = size === 'sm' ? 20 : 28
  const textSizeClass = size === 'sm' ? 'text-xs' : 'text-sm'
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="flex-shrink-0 flex items-center justify-center rounded-full font-semibold text-black"
        style={{
          width: circleSize,
          height: circleSize,
          backgroundColor: color,
          fontSize: size === 'sm' ? 10 : 13,
        }}
      >
        {initial}
      </span>
      <span className={`${textSizeClass} text-neutral-200 font-medium`}>
        {displayName}
      </span>
    </span>
  )
}
