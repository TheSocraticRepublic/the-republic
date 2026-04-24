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
      className: 'bg-[#5bc88a]/10 border border-[#5bc88a]/30 text-[#5bc88a]',
    },
    failed: {
      label: 'Failed',
      className: 'bg-[#c85b5b]/10 border border-[#c85b5b]/30 text-[#c85b5b]',
    },
  }

  const { label, className } = variants[status]

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
