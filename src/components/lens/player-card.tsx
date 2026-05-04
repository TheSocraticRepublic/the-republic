export interface PlayerAppearance {
  investigationId: string
  role: string
  concern: string
  jurisdictionName: string | null
}

export interface RelatedPlayer {
  playerId: string
  name: string
  playerType: string
  role: string
}

const LIGHT_CARD = {
  bg: '#ffffff',
  bgHover: '#f5f4f2',
  bgExpanded: '#eeece8',
  border: '#e0ddd9',
  text: '#1c1917',
  secondary: '#44403c',
  muted: '#78716c',
  faint: '#a8a29e',
  roleBg: '#ffffff',
  roleBorder: '#e0ddd9',
  trackRecordBg: '#ffffff',
  connectionBg: '#ffffff',
  connectionBorder: '#e0ddd9',
  divider: 'rgba(28, 25, 23, 0.06)',
}

const DARK_CARD = {
  bg: '#1e1e20',
  bgHover: '#27272a',
  bgExpanded: '#27272a',
  border: 'rgba(255,255,255,0.1)',
  text: '#f4f4f5',
  secondary: '#d4d4d8',
  muted: '#a1a1aa',
  faint: '#71717a',
  roleBg: '#27272a',
  roleBorder: 'rgba(255,255,255,0.1)',
  trackRecordBg: '#18181b',
  connectionBg: '#18181b',
  connectionBorder: 'rgba(255,255,255,0.1)',
  divider: 'rgba(255, 255, 255, 0.06)',
}

interface PlayerCardProps {
  name: string
  playerType: string
  role: string
  context: string | null
  description: string | null
  expanded?: boolean
  onToggle?: () => void
  appearances?: PlayerAppearance[]
  relatedPlayers?: RelatedPlayer[]
  darkMode?: boolean
}

const PLAYER_TYPE_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  company: {
    color: '#a3a3a3',
    bg: 'rgba(163,163,163,0.08)',
    border: 'rgba(163,163,163,0.18)',
  },
  official: {
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.08)',
    border: 'rgba(96,165,250,0.18)',
  },
  agency: {
    color: '#22d3ee',
    bg: 'rgba(34,211,238,0.08)',
    border: 'rgba(34,211,238,0.18)',
  },
  organization: {
    color: '#4ade80',
    bg: 'rgba(74,222,128,0.08)',
    border: 'rgba(74,222,128,0.18)',
  },
  rights_holder: {
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.18)',
  },
}

const EXTERNAL_LINKS: Record<string, Array<{ label: string; urlTemplate: (name: string) => string }>> = {
  company: [
    {
      label: 'BC Corporate Registry',
      urlTemplate: (name) =>
        `https://www.corporateonline.gov.bc.ca/WebHelp/searches.htm#${encodeURIComponent(name)}`,
    },
  ],
  organization: [
    {
      label: 'CRA Charity Search',
      urlTemplate: (name) =>
        `https://apps.cra-arc.gc.ca/ebci/hacc/srch/pub/dsplyBscSrch?q.stts=0007&q.nme=${encodeURIComponent(name)}`,
    },
  ],
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
  expanded = false,
  onToggle,
  appearances,
  relatedPlayers,
  darkMode = false,
}: PlayerCardProps) {
  const styles = PLAYER_TYPE_STYLES[playerType] ?? PLAYER_TYPE_STYLES.company
  const isRightsHolder = playerType === 'rights_holder'
  const links = EXTERNAL_LINKS[playerType] ?? []
  const p = darkMode ? DARK_CARD : LIGHT_CARD

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl p-5 flex-shrink-0 transition-all duration-150 ${
        onToggle ? 'cursor-pointer' : ''
      } ${expanded ? 'sm:col-span-2' : ''}`}
      style={{
        border: `1px solid ${p.border}`,
        borderLeft: isRightsHolder
          ? '3px solid #f59e0b'
          : `1px solid ${p.border}`,
        backgroundColor: expanded ? p.bgExpanded : p.bg,
        width: expanded ? '100%' : '260px',
        minWidth: '220px',
      }}
      onMouseEnter={(e) => {
        if (onToggle && !expanded) e.currentTarget.style.backgroundColor = p.bgHover
      }}
      onMouseLeave={(e) => {
        if (onToggle) e.currentTarget.style.backgroundColor = expanded ? p.bgExpanded : p.bg
      }}
      onClick={onToggle}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <p
          className="text-sm font-semibold leading-snug"
          style={{ color: p.text }}
        >
          {name}
        </p>
        {onToggle && (
          <span
            className="text-[10px] mt-0.5 flex-shrink-0 transition-transform duration-150"
            style={{
              color: p.muted,
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            ▾
          </span>
        )}
      </div>

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
            color: p.muted,
            backgroundColor: p.roleBg,
            border: `1px solid ${p.roleBorder}`,
          }}
        >
          {formatRole(role)}
        </span>
      </div>

      {/* Context text */}
      {(context || description) && (
        <p className="text-sm leading-relaxed" style={{ color: p.secondary }}>
          {context || description}
        </p>
      )}

      {/* Expanded sections */}
      {expanded && (
        <div
          className="mt-2 space-y-4 border-t pt-4"
          style={{ borderColor: p.divider }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Track Record */}
          {appearances && appearances.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: p.faint }}>
                Track Record
              </p>
              <div className="space-y-2">
                {appearances.map((a) => (
                  <div
                    key={a.investigationId}
                    className="rounded-lg px-3 py-2"
                    style={{ backgroundColor: p.trackRecordBg }}
                  >
                    <p className="text-xs leading-snug" style={{ color: p.secondary }}>
                      {a.concern}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px]" style={{ color: p.faint }}>
                        {formatRole(a.role)}
                      </span>
                      {a.jurisdictionName && (
                        <span className="text-[10px]" style={{ color: p.faint }}>
                          {a.jurisdictionName}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Connections */}
          {relatedPlayers && relatedPlayers.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: p.faint }}>
                Connections
              </p>
              <div className="flex flex-wrap gap-2">
                {relatedPlayers.map((rp) => {
                  const rpStyles = PLAYER_TYPE_STYLES[rp.playerType] ?? PLAYER_TYPE_STYLES.company
                  return (
                    <span
                      key={rp.playerId}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1"
                      style={{
                        backgroundColor: p.connectionBg,
                        border: `1px solid ${p.connectionBorder}`,
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: rpStyles.color }}
                      />
                      <span className="text-xs" style={{ color: p.secondary }}>{rp.name}</span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* External links */}
          {links.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: p.faint }}>
                External Records
              </p>
              <div className="flex flex-wrap gap-2">
                {links.map((link) => (
                  <a
                    key={link.label}
                    href={link.urlTemplate(name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline underline-offset-2 transition-colors"
                    style={{ color: p.muted }}
                  >
                    {link.label} →
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* No enrichment data available */}
          {(!appearances || appearances.length === 0) &&
            (!relatedPlayers || relatedPlayers.length === 0) &&
            links.length === 0 && (
              <p className="text-xs" style={{ color: p.faint }}>
                No additional intelligence available for this entity.
              </p>
            )}
        </div>
      )}
    </div>
  )
}
