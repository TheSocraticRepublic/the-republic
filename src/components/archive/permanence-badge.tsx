type ArchiveStatus = 'pending' | 'ipfs_pinned' | 'arweave_permanent' | 'failed'

interface PermanenceBadgeProps {
  status: ArchiveStatus
}

export function PermanenceBadge({ status }: PermanenceBadgeProps) {
  const variants: Record<ArchiveStatus, { label: string; className: string }> = {
    pending: {
      label: 'Not preserved',
      className: 'bg-white/[0.04] border border-white/[0.08] text-neutral-500',
    },
    ipfs_pinned: {
      label: 'IPFS Preserved',
      className: 'bg-sky-950/60 border border-sky-700/40 text-sky-400',
    },
    arweave_permanent: {
      label: 'Permanently Archived',
      className: 'bg-emerald-950/60 border border-emerald-700/40 text-emerald-400',
    },
    failed: {
      label: 'Failed',
      className: 'bg-red-950/60 border border-red-700/40 text-red-400',
    },
  }

  const { label, className } = variants[status]

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
