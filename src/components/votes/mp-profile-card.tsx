import Image from 'next/image'
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
      className="rounded-xl border shadow-sm px-6 py-6"
      style={{
        borderColor: 'var(--border)',
        borderLeftWidth: '3px',
        borderLeftColor: partyColor,
        backgroundColor: 'var(--surface-1)',
      }}
    >
      <div className="flex items-start gap-5">
        {/* Photo: decorative, the page's h1 names the MP (Jen E1 C1) */}
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt=""
            aria-hidden="true"
            width={64}
            height={64}
            className="h-16 w-16 rounded-full object-cover flex-shrink-0"
            style={{ border: '2px solid var(--border)' }}
          />
        ) : (
          <div
            aria-hidden="true"
            className="h-16 w-16 rounded-full flex-shrink-0 flex items-center justify-center text-xl font-bold"
            style={{
              backgroundColor: 'var(--surface-3)',
              color: 'var(--text-muted)',
            }}
          >
            {name.charAt(0)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <PartyBadge party={party} />
            <span className="text-xs text-text-muted">
              {ridingName}, {ridingProvince}
            </span>
          </div>

          {email && (
            <a
              href={`mailto:${email}`}
              className="mt-2 inline-block text-xs text-text-muted hover:text-text-secondary underline underline-offset-2 transition-colors"
            >
              {email}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
