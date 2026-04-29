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
}: PlayerCardProps) {
  const styles = PLAYER_TYPE_STYLES[playerType] ?? PLAYER_TYPE_STYLES.company
  const isRightsHolder = playerType === 'rights_holder'
  const links = EXTERNAL_LINKS[playerType] ?? []

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl p-5 flex-shrink-0 transition-all duration-150 ${
        onToggle ? 'cursor-pointer hover:bg-white/[0.04]' : ''
      } ${expanded ? 'sm:col-span-2' : ''}`}
      style={{
        border: '1px solid rgba(255,255,255,0.08)',
        borderLeft: isRightsHolder
          ? '3px solid #f59e0b'
          : '1px solid rgba(255,255,255,0.08)',
        backgroundColor: expanded ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.02)',
        width: expanded ? '100%' : '260px',
        minWidth: '220px',
      }}
      onClick={onToggle}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <p
          className="text-sm font-semibold leading-snug"
          style={{ color: '#f5f5f5' }}
        >
          {name}
        </p>
        {onToggle && (
          <span
            className="text-[10px] mt-0.5 flex-shrink-0 transition-transform duration-150"
            style={{
              color: '#525252',
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

      {/* Expanded sections */}
      {expanded && (
        <div
          className="mt-2 space-y-4 border-t pt-4"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Track Record */}
          {appearances && appearances.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-600 mb-2">
                Track Record
              </p>
              <div className="space-y-2">
                {appearances.map((a) => (
                  <div
                    key={a.investigationId}
                    className="rounded-lg px-3 py-2"
                    style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
                  >
                    <p className="text-xs text-neutral-400 leading-snug">
                      {a.concern}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px] text-neutral-600">
                        {formatRole(a.role)}
                      </span>
                      {a.jurisdictionName && (
                        <span className="text-[10px] text-neutral-700">
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
              <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-600 mb-2">
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
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: rpStyles.color }}
                      />
                      <span className="text-xs text-neutral-400">{rp.name}</span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* External links */}
          {links.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-600 mb-2">
                External Records
              </p>
              <div className="flex flex-wrap gap-2">
                {links.map((link) => (
                  <a
                    key={link.label}
                    href={link.urlTemplate(name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-neutral-500 hover:text-neutral-300 underline underline-offset-2 transition-colors"
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
              <p className="text-xs text-neutral-700">
                No additional intelligence available for this entity.
              </p>
            )}
        </div>
      )}
    </div>
  )
}
