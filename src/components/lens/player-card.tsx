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

// Island tokens consumed via CSS custom properties (globals.css).

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
    color: 'var(--island-role-company)',
    bg: 'color-mix(in srgb, var(--island-role-company) 8%, transparent)',
    border: 'color-mix(in srgb, var(--island-role-company) 18%, transparent)',
  },
  official: {
    color: 'var(--island-role-official)',
    bg: 'color-mix(in srgb, var(--island-role-official) 8%, transparent)',
    border: 'color-mix(in srgb, var(--island-role-official) 18%, transparent)',
  },
  agency: {
    color: 'var(--island-role-agency)',
    bg: 'color-mix(in srgb, var(--island-role-agency) 8%, transparent)',
    border: 'color-mix(in srgb, var(--island-role-agency) 18%, transparent)',
  },
  organization: {
    color: 'var(--island-role-organization)',
    bg: 'color-mix(in srgb, var(--island-role-organization) 8%, transparent)',
    border: 'color-mix(in srgb, var(--island-role-organization) 18%, transparent)',
  },
  rights_holder: {
    color: 'var(--island-role-rights-holder)',
    bg: 'color-mix(in srgb, var(--island-role-rights-holder) 8%, transparent)',
    border: 'color-mix(in srgb, var(--island-role-rights-holder) 18%, transparent)',
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

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl p-5 flex-shrink-0 transition-all duration-150 ${
        onToggle ? 'cursor-pointer' : ''
      } ${expanded ? 'sm:col-span-2' : ''}${darkMode ? ' dark-island' : ''}`}
      style={{
        border: `1px solid var(--color-island-border)`,
        borderLeft: isRightsHolder
          ? '3px solid var(--island-role-rights-holder)'
          : `1px solid var(--color-island-border)`,
        backgroundColor: expanded ? 'var(--color-island-hover)' : 'var(--color-island-bg)',
        width: expanded ? '100%' : '260px',
        minWidth: '220px',
      }}
      onMouseEnter={(e) => {
        if (onToggle && !expanded) e.currentTarget.style.backgroundColor = 'var(--color-island-hover)'
      }}
      onMouseLeave={(e) => {
        if (onToggle) e.currentTarget.style.backgroundColor = expanded ? 'var(--color-island-hover)' : 'var(--color-island-bg)'
      }}
      onClick={onToggle}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <p
          className="text-sm font-semibold leading-snug"
          style={{ color: 'var(--color-island-text)' }}
        >
          {name}
        </p>
        {onToggle && (
          <span
            className="text-2xs font-medium mt-0.5 flex-shrink-0 transition-transform duration-150"
            style={{
              color: 'var(--color-island-muted)',
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
          className="rounded-md px-2 py-0.5 text-3xs font-semibold uppercase"
          style={{
            color: styles.color,
            backgroundColor: styles.bg,
            border: `1px solid ${styles.border}`,
          }}
        >
          {formatPlayerType(playerType)}
        </span>
        <span
          className="rounded-md px-2 py-0.5 text-2xs font-medium"
          style={{
            color: 'var(--color-island-muted)',
            backgroundColor: 'var(--color-island-white)',
            border: `1px solid var(--color-island-card-border)`,
          }}
        >
          {formatRole(role)}
        </span>
      </div>

      {/* Context text */}
      {(context || description) && (
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-island-secondary)' }}>
          {context || description}
        </p>
      )}

      {/* Expanded sections */}
      {expanded && (
        <div
          className="mt-2 space-y-4 border-t pt-4"
          style={{ borderColor: 'var(--color-island-veil)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Track Record */}
          {appearances && appearances.length > 0 && (
            <div>
              <p className="text-3xs font-semibold uppercase mb-2" style={{ color: 'var(--color-island-faint)' }}>
                Track Record
              </p>
              <div className="space-y-2">
                {appearances.map((a) => (
                  <div
                    key={a.investigationId}
                    className="rounded-lg px-3 py-2"
                    style={{ backgroundColor: 'var(--color-island-card)' }}
                  >
                    <p className="text-xs leading-snug" style={{ color: 'var(--color-island-secondary)' }}>
                      {a.concern}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-2xs font-medium" style={{ color: 'var(--color-island-faint)' }}>
                        {formatRole(a.role)}
                      </span>
                      {a.jurisdictionName && (
                        <span className="text-2xs font-medium" style={{ color: 'var(--color-island-faint)' }}>
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
              <p className="text-3xs font-semibold uppercase mb-2" style={{ color: 'var(--color-island-faint)' }}>
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
                        backgroundColor: 'var(--color-island-card)',
                        border: `1px solid var(--color-island-card-border)`,
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: rpStyles.color }}
                      />
                      <span className="text-xs" style={{ color: 'var(--color-island-secondary)' }}>{rp.name}</span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* External links */}
          {links.length > 0 && (
            <div>
              <p className="text-3xs font-semibold uppercase mb-2" style={{ color: 'var(--color-island-faint)' }}>
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
                    style={{ color: 'var(--color-island-muted)' }}
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
              <p className="text-xs" style={{ color: 'var(--color-island-faint)' }}>
                No additional intelligence available for this entity.
              </p>
            )}
        </div>
      )}
    </div>
  )
}
