'use client'

import Link from 'next/link'
import { FileText } from 'lucide-react'
import { leverActionTypeEnum } from '@/lib/db/schema'

type LeverActionType = (typeof leverActionTypeEnum.enumValues)[number]

interface ActionCardProps {
  id: string
  title: string
  actionType: LeverActionType
  status: 'draft' | 'final' | 'filed'
  createdAt: Date | string
}

const TYPE_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  fippa_request: { label: 'FIPPA Request', color: '#C85B5B', bg: 'rgba(200, 91, 91, 0.12)' },
  public_comment: { label: 'Public Comment', color: '#C87B3A', bg: 'rgba(200, 123, 58, 0.12)' },
  policy_brief: { label: 'Policy Brief', color: '#89B4C8', bg: 'rgba(137, 180, 200, 0.12)' },
  legal_template: { label: 'Legal Template', color: '#a3a3a3', bg: 'rgba(163, 163, 163, 0.12)' },
  // Campaign-layer action types — muted teal to signal distinct layer
  media_spec: { label: 'Media Specification', color: '#5BBCB4', bg: 'rgba(91, 188, 180, 0.12)' },
  talking_points: { label: 'Talking Points', color: '#5BBCB4', bg: 'rgba(91, 188, 180, 0.12)' },
  coalition_template: { label: 'Coalition Template', color: '#5BBCB4', bg: 'rgba(91, 188, 180, 0.12)' },
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#C8A84B', bg: 'rgba(200, 168, 75, 0.12)' },
  final: { label: 'Final', color: '#5BC88A', bg: 'rgba(91, 200, 138, 0.12)' },
  filed: { label: 'Filed', color: '#89B4C8', bg: 'rgba(137, 180, 200, 0.12)' },
}

function formatDate(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ActionCard({ id, title, actionType, status, createdAt }: ActionCardProps) {
  const typeStyle = TYPE_STYLES[actionType] ?? TYPE_STYLES.fippa_request
  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.draft

  return (
    <Link
      href={`/lever/${id}`}
      className="block rounded-xl border border-white/[0.08] bg-black/60 backdrop-blur-md p-4 transition-all duration-150 hover:border-white/[0.15] hover:bg-black/70"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <span
          className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border"
          style={{
            borderColor: 'rgba(200, 91, 91, 0.2)',
            backgroundColor: 'rgba(200, 91, 91, 0.07)',
          }}
        >
          <FileText size={14} strokeWidth={1.75} style={{ color: '#C85B5B' }} />
        </span>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <p
            className="truncate text-sm font-medium text-neutral-200 leading-snug"
            style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
          >
            {title}
          </p>

          {/* Badges */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium"
              style={{ color: typeStyle.color, backgroundColor: typeStyle.bg }}
            >
              {typeStyle.label}
            </span>
            <span
              className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium"
              style={{ color: statusStyle.color, backgroundColor: statusStyle.bg }}
            >
              {statusStyle.label}
            </span>
          </div>

          {/* Date */}
          <div className="mt-2.5 flex items-center text-[11px] text-neutral-500">
            <span className="ml-auto">{formatDate(createdAt)}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
