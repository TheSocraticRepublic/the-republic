'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, Eye, MessageCircleQuestion, FileText, GitCompare, LogOut, Search, List, ChevronDown, User, MessageSquare, Shield, Vote, Heart, ScrollText } from 'lucide-react'
import { clsx } from 'clsx'
import { useState } from 'react'
import { ProfileBadge } from '@/components/profile/profile-badge'

const arms = [
  {
    name: 'Scout',
    href: '/scout',
    icon: Compass,
    description: 'Document discovery',
  },
  {
    name: 'Oracle',
    href: '/oracle',
    icon: Eye,
    description: 'Document analysis',
  },
  {
    name: 'Gadfly',
    href: '/gadfly',
    icon: MessageCircleQuestion,
    description: 'Socratic inquiry',
  },
  {
    name: 'Lever',
    href: '/lever',
    icon: FileText,
    description: 'Civic actions',
  },
  {
    name: 'Mirror',
    href: '/mirror',
    icon: GitCompare,
    description: 'Policy comparison',
  },
]

interface SidebarProps {
  userEmail?: string
  displayName?: string
  effectiveWeight?: number
  variant?: 'sidebar' | 'drawer'
  onNavigate?: () => void
}

export function Sidebar({ userEmail, displayName, effectiveWeight = 0, variant = 'sidebar', onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const [expertToolsOpen, setExpertToolsOpen] = useState(false)

  const isDrawer = variant === 'drawer'
  const linkPy = isDrawer ? 'py-3' : 'py-2.5'

  const investigateActive = pathname === '/investigate'
  const investigationsActive = pathname === '/investigations' || (pathname.startsWith('/investigate/') && pathname !== '/investigate')
  const forumActive = pathname === '/forum' || pathname.startsWith('/forum/')
  const votesActive = pathname === '/votes' || pathname.startsWith('/votes/')
  const profileActive = pathname === '/profile' || pathname.startsWith('/profile/')
  const moderationActive = pathname === '/forum/moderation' || pathname.startsWith('/forum/moderation/')
  const isModerator = effectiveWeight >= 10

  return (
    <nav className={clsx(
      'flex h-full flex-col bg-surface-2',
      variant === 'sidebar' && 'w-56 border-r border-border',
    )}>
      {/* Wordmark */}
      <div className="px-5 py-6">
        <Link href="/" className="block" onClick={onNavigate}>
          <span
            className="text-base font-bold tracking-tight text-text-primary"
            style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
          >
            Open Cave
          </span>
        </Link>
        <p className="mt-0.5 text-[11px] tracking-wider text-text-muted uppercase">
          Civic AI
        </p>
      </div>

      <div className="flex-1 px-3 space-y-1 overflow-y-auto">
        {/* New Investigation — primary entry point */}
        <Link
          href="/investigate"
          onClick={onNavigate}
          className={clsx(
            `group flex items-center gap-3 rounded-lg px-3 ${linkPy} text-sm transition-all duration-150`,
            investigateActive
              ? 'bg-surface-3 text-text-primary'
              : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
          )}
        >
          <span
            className={clsx(
              'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md transition-all duration-150 border',
              investigateActive
                ? 'bg-surface-1 border-border-strong shadow-sm'
                : 'border-border group-hover:bg-surface-1 group-hover:border-border-strong'
            )}
          >
            <Search
              size={14}
              strokeWidth={1.75}
              className={clsx(
                investigateActive ? 'text-text-primary' : 'text-text-muted group-hover:text-text-secondary'
              )}
            />
          </span>
          <span className="flex flex-col">
            <span className="font-semibold leading-tight">New Investigation</span>
            <span className="text-[10px] text-text-faint leading-tight">Start here</span>
          </span>
          {investigateActive && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full flex-shrink-0 bg-text-secondary" />
          )}
        </Link>

        {/* Investigations list */}
        <Link
          href="/investigations"
          onClick={onNavigate}
          className={clsx(
            `group flex items-center gap-3 rounded-lg px-3 ${linkPy} text-sm transition-all duration-150`,
            investigationsActive
              ? 'bg-surface-3 text-text-primary'
              : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
          )}
        >
          <span
            className={clsx(
              'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md transition-all duration-150 border',
              investigationsActive
                ? 'bg-surface-1 border-border-strong shadow-sm'
                : 'border-border group-hover:bg-surface-1 group-hover:border-border-strong'
            )}
          >
            <List
              size={14}
              strokeWidth={1.75}
              className={clsx(
                investigationsActive ? 'text-text-primary' : 'text-text-muted group-hover:text-text-secondary'
              )}
            />
          </span>
          <span className="flex flex-col">
            <span className="font-semibold leading-tight">Investigations</span>
            <span className="text-[10px] text-text-faint leading-tight">Your history</span>
          </span>
          {investigationsActive && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full flex-shrink-0 bg-text-secondary" />
          )}
        </Link>

        {/* Forum — coming soon */}
        <span
          className={`group flex items-center gap-3 rounded-lg px-3 ${linkPy} text-sm opacity-40 cursor-not-allowed`}
          title="Forum — coming soon"
        >
          <span
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-border"
          >
            <MessageSquare
              size={14}
              strokeWidth={1.75}
              className="text-text-muted"
            />
          </span>
          <span className="flex flex-col">
            <span className="font-semibold leading-tight text-text-muted">Forum</span>
            <span className="text-[10px] text-text-faint leading-tight">Coming soon</span>
          </span>
        </span>

        {/* Vote Tracker */}
        <Link
          href="/votes"
          onClick={onNavigate}
          className={clsx(
            `group flex items-center gap-3 rounded-lg px-3 ${linkPy} text-sm transition-all duration-150`,
            votesActive
              ? 'bg-surface-3 text-text-primary'
              : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
          )}
        >
          <span
            className={clsx(
              'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md transition-all duration-150 border',
              votesActive
                ? 'bg-surface-1 border-border-strong shadow-sm'
                : 'border-border group-hover:bg-surface-1 group-hover:border-border-strong'
            )}
          >
            <Vote
              size={14}
              strokeWidth={1.75}
              style={votesActive ? { color: '#D4764E' } : undefined}
              className={clsx(
                !votesActive && 'text-text-muted group-hover:text-text-secondary'
              )}
            />
          </span>
          <span className="flex flex-col">
            <span className="font-semibold leading-tight">Vote Tracker</span>
            <span className="text-[10px] text-text-faint leading-tight">MP voting records</span>
          </span>
          {votesActive && (
            <span
              className="ml-auto h-1.5 w-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: '#D4764E' }}
            />
          )}
        </Link>

        {/* Moderation — conditional on credential weight */}
        {isModerator && (
          <Link
            href="/forum/moderation"
            onClick={onNavigate}
            className={clsx(
              `group flex items-center gap-3 rounded-lg px-3 ${linkPy} text-sm transition-all duration-150`,
              moderationActive
                ? 'bg-surface-3 text-text-primary'
                : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
            )}
          >
            <span
              className={clsx(
                'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md transition-all duration-150 border',
                moderationActive
                  ? 'bg-surface-1 border-border-strong shadow-sm'
                  : 'border-border group-hover:bg-surface-1 group-hover:border-border-strong'
              )}
            >
              <Shield
                size={14}
                strokeWidth={1.75}
                className={clsx(
                  moderationActive ? 'text-text-primary' : 'text-text-muted group-hover:text-text-secondary'
                )}
              />
            </span>
            <span className="flex flex-col">
              <span className="font-semibold leading-tight">Moderation</span>
              <span className="text-[10px] text-text-faint leading-tight">Review reports</span>
            </span>
            {moderationActive && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full flex-shrink-0 bg-text-secondary" />
            )}
          </Link>
        )}

        {/* Profile */}
        <Link
          href="/profile"
          onClick={onNavigate}
          className={clsx(
            `group flex items-center gap-3 rounded-lg px-3 ${linkPy} text-sm transition-all duration-150`,
            profileActive
              ? 'bg-surface-3 text-text-primary'
              : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
          )}
        >
          <span
            className={clsx(
              'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md transition-all duration-150 border',
              profileActive
                ? 'bg-surface-1 border-border-strong shadow-sm'
                : 'border-border group-hover:bg-surface-1 group-hover:border-border-strong'
            )}
          >
            <User
              size={14}
              strokeWidth={1.75}
              className={clsx(
                profileActive ? 'text-text-primary' : 'text-text-muted group-hover:text-text-secondary'
              )}
            />
          </span>
          <span className="flex flex-col">
            <span className="font-semibold leading-tight">Profile</span>
            <span className="text-[10px] text-text-faint leading-tight">Your identity</span>
          </span>
          {profileActive && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full flex-shrink-0 bg-text-secondary" />
          )}
        </Link>

        {/* Divider */}
        <div className="mx-3 my-3 h-px bg-border" />

        {/* Expert Tools — collapsible section */}
        <div>
          <button
            onClick={() => setExpertToolsOpen((v) => !v)}
            className="flex w-full items-center justify-between px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-faint hover:text-text-muted transition-colors"
          >
            <span>Expert Tools</span>
            <ChevronDown
              size={11}
              strokeWidth={2}
              className={clsx(
                'transition-transform duration-200',
                expertToolsOpen ? 'rotate-0' : '-rotate-90'
              )}
            />
          </button>

          {expertToolsOpen && (
            <ul className="mt-0.5 space-y-0.5">
              {arms.map((arm) => {
                const isActive = pathname.startsWith(arm.href)
                const Icon = arm.icon
                return (
                  <li key={arm.name}>
                    <Link
                      href={arm.href}
                      onClick={onNavigate}
                      className={clsx(
                        `group flex items-center gap-3 rounded-lg px-3 ${linkPy} text-sm transition-all duration-150`,
                        isActive
                          ? 'bg-surface-3 text-text-primary'
                          : 'text-text-muted hover:bg-surface-3 hover:text-text-secondary'
                      )}
                    >
                      <span
                        className={clsx(
                          'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md transition-all duration-150',
                          isActive ? 'bg-surface-1 shadow-sm' : 'group-hover:bg-surface-1'
                        )}
                      >
                        <Icon
                          size={15}
                          className={clsx(!isActive && 'text-text-muted group-hover:text-text-secondary')}
                          style={isActive ? { color: `var(--accent-${arm.name.toLowerCase()})` } : undefined}
                          strokeWidth={1.75}
                        />
                      </span>
                      <span className="flex flex-col">
                        <span className="font-medium leading-tight">{arm.name}</span>
                        <span className="text-[10px] text-text-faint leading-tight">
                          {arm.description}
                        </span>
                      </span>
                      {isActive && (
                        <span
                          className="ml-auto h-1.5 w-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: `var(--accent-${arm.name.toLowerCase()})` }}
                        />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Foundations — the philosophical groundwork */}
        <Link
          href="/foundations"
          onClick={onNavigate}
          className={`group flex items-center gap-3 rounded-lg px-3 ${linkPy} text-sm text-text-muted transition-all duration-150 hover:bg-surface-3 hover:text-text-secondary`}
        >
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-border transition-all duration-150 group-hover:bg-surface-1 group-hover:border-border-strong">
            <ScrollText
              size={14}
              strokeWidth={1.75}
              className="text-text-muted group-hover:text-text-secondary"
            />
          </span>
          <span className="flex flex-col">
            <span className="font-medium leading-tight">Foundations</span>
            <span className="text-[10px] text-text-faint leading-tight">The groundwork</span>
          </span>
        </Link>
      </div>

      {/* Beta + support */}
      <div className="mx-3 rounded-lg border border-border bg-surface-3/50 px-3 py-3">
        <p className="text-[10px] font-medium uppercase tracking-widest text-text-faint">
          Beta
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
          Testing for environmental issues in BC, Alberta, and Ontario.
        </p>
        <a
          href="https://ko-fi.com/opencave"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center gap-1.5 text-[11px] text-text-muted transition-colors hover:text-text-secondary"
        >
          <Heart size={11} strokeWidth={1.75} />
          Support this project
        </a>
      </div>

      {/* User / sign out */}
      <div className="border-t border-border px-3 py-4">
        {(displayName || userEmail) && (
          <div className="mb-2 px-3">
            {displayName ? (
              <ProfileBadge displayName={displayName} size="sm" />
            ) : null}
            {userEmail && (
              <p className="truncate text-[11px] text-text-muted mt-1">
                {userEmail}
              </p>
            )}
          </div>
        )}
        <button
          onClick={async () => {
            await fetch('/api/auth/signout', { method: 'POST' })
            window.location.href = '/login'
          }}
          className={`flex w-full items-center gap-2.5 rounded-lg px-3 ${isDrawer ? 'py-3' : 'py-2'} text-sm text-text-muted transition-colors hover:bg-surface-3 hover:text-text-secondary`}
        >
          <LogOut size={14} strokeWidth={1.75} />
          Sign out
        </button>
      </div>
    </nav>
  )
}
