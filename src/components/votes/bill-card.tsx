import Link from 'next/link'

interface BillCardProps {
  id: string
  number: string
  titleEn: string
  session: string
  statusCode: string | null
  sponsorName: string | null
}

export function BillCard({
  id,
  number,
  titleEn,
  session,
  statusCode,
  sponsorName,
}: BillCardProps) {
  return (
    <Link
      href={`/votes/bill/${id}`}
      className="card-lift group block rounded-xl border px-4 py-3 shadow-sm transition-all duration-150 hover:bg-surface-3 hover:border-border-strong"
      style={{
        borderColor: 'var(--border)',
        backgroundColor: 'var(--surface-1)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-xs font-semibold"
              style={{ color: '#D4764E' }}
            >
              {number}
            </span>
            <span className="text-[10px] text-text-faint">{session}</span>
          </div>
          <p className="text-xs text-text-secondary leading-snug line-clamp-2">
            {titleEn}
          </p>
          {sponsorName && (
            <p className="mt-1 text-[10px] text-text-faint">
              Sponsored by {sponsorName}
            </p>
          )}
        </div>
        {statusCode && (
          <span
            className="flex-shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-text-muted"
            style={{ backgroundColor: 'var(--surface-1)' }}
          >
            {statusCode.replace(/([A-Z])/g, ' $1').trim()}
          </span>
        )}
      </div>
    </Link>
  )
}
