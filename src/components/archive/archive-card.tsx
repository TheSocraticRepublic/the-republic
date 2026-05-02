import Link from 'next/link'
import { PermanenceBadge } from './permanence-badge'

type ArchiveStatus = 'pending' | 'ipfs_pinned' | 'arweave_permanent' | 'failed'

interface ArchiveCardProps {
  investigationId: string
  concern: string
  jurisdictionName: string | null
  preservedAt: Date
  archiveStatus: ArchiveStatus
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
  archivedBy,
}: ArchiveCardProps) {
  return (
    <Link
      href={`/archive/${investigationId}`}
      className="card-lift group block rounded-xl border border-border bg-surface-1 shadow-sm px-5 py-4 transition-all duration-150 hover:bg-surface-3 hover:border-border-strong"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: concern + jurisdiction */}
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-text-primary group-hover:text-text-primary transition-colors">
            {truncate(concern)}
          </p>
          {jurisdictionName && (
            <p className="mt-1 text-xs text-text-faint">
              {jurisdictionName}
            </p>
          )}
          <p className="mt-1.5 text-xs text-text-faint">
            Archived by{' '}
            <span className="text-text-muted">{archivedBy}</span>
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
