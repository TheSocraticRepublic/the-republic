import { PartyBadge, PARTY_COLORS } from './party-badge'

interface MpProfileCardProps {
  name: string
  party: string
  ridingName: string
  ridingProvince: string
  email: string | null
  photoUrl: string | null
}

export function MpProfileCard({
  name,
  party,
  ridingName,
  ridingProvince,
  email,
  photoUrl,
}: MpProfileCardProps) {
  const partyColor = PARTY_COLORS[party] ?? PARTY_COLORS.Independent

  return (
    <div
      className="rounded-xl border px-6 py-6"
      style={{
        borderColor: 'rgba(255,255,255,0.08)',
        borderLeftWidth: '3px',
        borderLeftColor: partyColor,
        backgroundColor: 'rgba(255,255,255,0.02)',
      }}
    >
      <div className="flex items-start gap-5">
        {/* Photo */}
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={name}
            className="h-16 w-16 rounded-full object-cover flex-shrink-0"
            style={{ border: '2px solid rgba(255,255,255,0.08)' }}
          />
        ) : (
          <div
            className="h-16 w-16 rounded-full flex-shrink-0 flex items-center justify-center text-xl font-bold"
            style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              color: '#525252',
            }}
          >
            {name.charAt(0)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h2
            className="text-lg font-bold text-neutral-100 leading-tight"
            style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
          >
            {name}
          </h2>

          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <PartyBadge party={party} />
            <span className="text-xs text-neutral-500">
              {ridingName}, {ridingProvince}
            </span>
          </div>

          {email && (
            <a
              href={`mailto:${email}`}
              className="mt-2 inline-block text-xs text-neutral-500 hover:text-neutral-300 underline underline-offset-2 transition-colors"
            >
              {email}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
