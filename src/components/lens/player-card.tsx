// PlayerCard — displays a single player entity with role context and type badge.

interface PlayerCardProps {
  name: string
  playerType: string
  role: string
  context: string | null
  description: string | null
}

const PLAYER_TYPE_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  company: {
    color: '#a3a3a3',       // neutral-400
    bg: 'rgba(163,163,163,0.08)',
    border: 'rgba(163,163,163,0.18)',
  },
  official: {
    color: '#60a5fa',       // blue-400
    bg: 'rgba(96,165,250,0.08)',
    border: 'rgba(96,165,250,0.18)',
  },
  agency: {
    color: '#22d3ee',       // cyan-400
    bg: 'rgba(34,211,238,0.08)',
    border: 'rgba(34,211,238,0.18)',
  },
  organization: {
    color: '#4ade80',       // green-400
    bg: 'rgba(74,222,128,0.08)',
    border: 'rgba(74,222,128,0.18)',
  },
  rights_holder: {
    color: '#f59e0b',       // amber-500
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.18)',
  },
}

function formatPlayerType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function PlayerCard({
  name,
  playerType,
  role,
  context,
  description,
}: PlayerCardProps) {
  const styles = PLAYER_TYPE_STYLES[playerType] ?? PLAYER_TYPE_STYLES.company
  const isRightsHolder = playerType === 'rights_holder'

  return (
    <div
      className="flex flex-col gap-3 rounded-xl p-5 flex-shrink-0"
      style={{
        border: '1px solid rgba(255,255,255,0.08)',
        borderLeft: isRightsHolder
          ? '3px solid #f59e0b'
          : '1px solid rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(255,255,255,0.02)',
        width: '260px',
        minWidth: '220px',
      }}
    >
      {/* Name */}
      <p
        className="text-sm font-semibold leading-snug"
        style={{ color: '#f5f5f5' }}
      >
        {name}
      </p>

      {/* Type + role badges */}
      <div className="flex flex-wrap gap-1.5">
        <span
          className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{
            color: styles.color,
            backgroundColor: styles.bg,
            border: `1px solid ${styles.border}`,
          }}
        >
          {formatPlayerType(playerType)}
        </span>
        <span
          className="rounded-md px-2 py-0.5 text-[10px] font-medium"
          style={{
            color: '#78716c',
            backgroundColor: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {formatRole(role)}
        </span>
      </div>

      {/* Context text */}
      {(context || description) && (
        <p className="text-sm leading-relaxed" style={{ color: '#a3a3a3' }}>
          {context || description}
        </p>
      )}
    </div>
  )
}
