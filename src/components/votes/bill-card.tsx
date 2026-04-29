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
      className="group block rounded-xl border px-4 py-3 transition-all duration-150 hover:bg-white/[0.04] hover:border-white/[0.10]"
      style={{
        borderColor: 'rgba(255,255,255,0.06)',
        backgroundColor: 'rgba(255,255,255,0.015)',
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
            <span className="text-[10px] text-neutral-700">{session}</span>
          </div>
          <p className="text-xs text-neutral-300 leading-snug line-clamp-2">
            {titleEn}
          </p>
          {sponsorName && (
            <p className="mt-1 text-[10px] text-neutral-600">
              Sponsored by {sponsorName}
            </p>
          )}
        </div>
        {statusCode && (
          <span
            className="flex-shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-neutral-500"
            style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
          >
            {statusCode.replace(/([A-Z])/g, ' $1').trim()}
          </span>
        )}
      </div>
    </Link>
  )
}
