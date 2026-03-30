'use client'

import Link from 'next/link'
import { FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'

type DocumentStatus = 'processing' | 'ready' | 'failed'

interface DocumentCardProps {
  id: string
  title: string
  documentType: string
  pageCount: number | null
  wordCount: number | null
  status: DocumentStatus
  createdAt: string | Date
}

const STATUS_CONFIG: Record<DocumentStatus, { label: string; icon: typeof Clock; color: string }> = {
  processing: {
    label: 'Processing',
    icon: Clock,
    color: 'text-yellow-400',
  },
  ready: {
    label: 'Ready',
    icon: CheckCircle,
    color: 'text-emerald-400',
  },
  failed: {
    label: 'Failed',
    icon: AlertCircle,
    color: 'text-red-400',
  },
}

function formatDocType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function DocumentCard({
  id,
  title,
  documentType,
  pageCount,
  wordCount,
  status,
  createdAt,
}: DocumentCardProps) {
  const { label, icon: StatusIcon, color } = STATUS_CONFIG[status]

  const inner = (
    <div
      className={clsx(
        'group flex flex-col gap-4 rounded-xl border border-white/10 bg-black/60 p-5 backdrop-blur-md transition-all duration-150',
        status === 'ready' && 'hover:border-[#89B4C8]/30 hover:bg-black/80 cursor-pointer'
      )}
    >
      {/* Top row: icon + title */}
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border"
          style={{
            borderColor: 'rgba(137, 180, 200, 0.25)',
            backgroundColor: 'rgba(137, 180, 200, 0.08)',
          }}
        >
          <FileText size={16} strokeWidth={1.75} style={{ color: '#89B4C8' }} />
        </span>

        <div className="flex-1 min-w-0">
          <h3
            className="truncate text-sm font-semibold leading-snug text-neutral-100"
            style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
          >
            {title}
          </h3>
          <p className="mt-0.5 text-[11px] text-neutral-500">{formatDocType(documentType)}</p>
        </div>

        {/* Status badge */}
        <span className={clsx('flex items-center gap-1 text-[11px] font-medium', color)}>
          <StatusIcon size={12} strokeWidth={2} />
          {label}
        </span>
      </div>

      {/* Metadata row */}
      <div className="flex items-center gap-4 text-[11px] text-neutral-500">
        {pageCount != null && (
          <span>{pageCount} {pageCount === 1 ? 'page' : 'pages'}</span>
        )}
        {wordCount != null && (
          <span>{wordCount.toLocaleString()} words</span>
        )}
        <span className="ml-auto">{formatDate(createdAt)}</span>
      </div>
    </div>
  )

  if (status === 'ready') {
    return <Link href={`/oracle/${id}`}>{inner}</Link>
  }

  return inner
}
