import Link from 'next/link'
import { PermanenceBadge } from './permanence-badge'

type ArchiveStatus = 'pending' | 'ipfs_pinned' | 'arweave_permanent' | 'failed'

interface ArchiveCardProps {
  investigationId: string
  concern: string
  jurisdictionName: string | null
  preservedAt: Date
  archiveStatus: ArchiveStatus
  ipfsCid: string | null
  archivedBy: string
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function truncate(text: string, max = 160): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

export function ArchiveCard({
  investigationId,
  concern,
  jurisdictionName,
  preservedAt,
  archiveStatus,
  ipfsCid: _ipfsCid,
  archivedBy,
}: ArchiveCardProps) {
  return (
    <Link
      href={`/archive/${investigationId}`}
      className="group block rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 transition-all duration-150 hover:bg-white/[0.04] hover:border-white/[0.10]"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: concern + jurisdiction */}
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-neutral-200 group-hover:text-neutral-100 transition-colors">
            {truncate(concern)}
          </p>
          {jurisdictionName && (
            <p className="mt-1 text-xs text-neutral-600">
              {jurisdictionName}
            </p>
          )}
          <p className="mt-1.5 text-xs text-neutral-600">
            Archived by{' '}
            <span className="text-neutral-500">{archivedBy}</span>
            {' · '}
            {formatDate(preservedAt)}
          </p>
        </div>

        {/* Right: badge */}
        <div className="flex-shrink-0 pt-0.5">
          <PermanenceBadge status={archiveStatus} />
        </div>
      </div>
    </Link>
  )
}
