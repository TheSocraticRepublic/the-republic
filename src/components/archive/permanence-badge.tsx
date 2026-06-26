type ArchiveStatus = 'pending' | 'ipfs_pinned' | 'arweave_permanent' | 'failed'

interface PermanenceBadgeProps {
  status: ArchiveStatus
}

export function PermanenceBadge({ status }: PermanenceBadgeProps) {
  const variants: Record<ArchiveStatus, { label: string; className: string }> = {
    pending: {
      label: 'Not preserved',
      className: 'bg-surface-1 border border-border text-text-muted',
    },
    ipfs_pinned: {
      label: 'IPFS Preserved',
      className: 'bg-sky-950/60 border border-sky-700/40 text-sky-400',
    },
    arweave_permanent: {
      label: 'Permanently Archived',
      className: 'bg-[var(--accent-mirror)]/10 border border-[var(--accent-mirror)]/30 text-[var(--accent-mirror)]',
    },
    failed: {
      label: 'Failed',
      className: 'bg-[var(--accent-lever)]/10 border border-[var(--accent-lever)]/30 text-[var(--accent-lever)]',
    },
  }

  const { label, className } = variants[status]

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
