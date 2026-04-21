import Link from 'next/link'
import { Pin, Lock } from 'lucide-react'
import { ProfileBadge } from '@/components/profile/profile-badge'
import { formatRelativeTime } from '@/lib/format-relative-time'

interface ThreadCardProps {
  id: string
  title: string
  authorDisplayName: string
  postCount: number
  lastPostAt: Date | string | null
  jurisdictionName?: string | null
  concernCategory?: string | null
  pinned: boolean
  status: 'open' | 'locked' | 'archived'
}

export function ThreadCard({
  id,
  title,
  authorDisplayName,
  postCount,
  lastPostAt,
  jurisdictionName,
  concernCategory,
  pinned,
  status,
}: ThreadCardProps) {
  return (
    <Link
      href={`/forum/${id}`}
      className="group block rounded-xl border border-white/[0.06] bg-black/40 px-5 py-4 transition-all duration-150 hover:bg-white/[0.04] hover:border-white/[0.10]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            {pinned && (
              <Pin size={12} className="text-neutral-500 flex-shrink-0" strokeWidth={1.75} />
            )}
            {status === 'locked' && (
              <Lock size={12} className="text-neutral-500 flex-shrink-0" strokeWidth={1.75} />
            )}
            <p className="text-sm font-semibold text-neutral-200 group-hover:text-neutral-100 transition-colors truncate">
              {title}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ProfileBadge displayName={authorDisplayName} size="sm" />
            {(jurisdictionName || concernCategory) && (
              <div className="flex items-center gap-1.5 ml-1">
                {jurisdictionName && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: 'rgba(137, 180, 200, 0.10)',
                      color: '#89B4C8',
                    }}
                  >
                    {jurisdictionName}
                  </span>
                )}
                {concernCategory && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: 'rgba(200, 168, 75, 0.10)',
                      color: '#C8A84B',
                    }}
                  >
                    {concernCategory}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-1 text-right">
          <span className="text-xs text-neutral-400">
            {postCount} {postCount === 1 ? 'post' : 'posts'}
          </span>
          {lastPostAt && (
            <span className="text-[10px] text-neutral-600">
              {formatRelativeTime(lastPostAt)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
