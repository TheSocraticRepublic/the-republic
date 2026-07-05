'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, Eye, MessageCircleQuestion, FileText, GitCompare, LogOut, Search, List, ChevronDown, User, MessageSquare, Shield, Vote, Heart, ScrollText } from 'lucide-react'
import { FeedbackDialog } from '@/components/layout/feedback-dialog'
import { clsx } from 'clsx'
import { useState, useEffect, useRef } from 'react'
import { ProfileBadge } from '@/components/profile/profile-badge'

// Jen: group label + arm microcopy pending copy review
const arms = [
  {
    name: 'Scout',
    href: '/scout',
    icon: Compass,
    description: 'Find the documents',
  },
  {
    name: 'Oracle',
    href: '/oracle',
    icon: Eye,
    description: 'See who a document serves',
  },
  {
    name: 'Gadfly',
    href: '/gadfly',
    icon: MessageCircleQuestion,
    description: 'Sharpen your own thinking',
  },
  {
    name: 'Lever',
    href: '/lever',
    icon: FileText,
    description: 'Turn findings into filings',
  },
  {
    name: 'Mirror',
    href: '/mirror',
    icon: GitCompare,
    description: 'Compare across governments',
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
  const [instrumentsOpen, setInstrumentsOpen] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollDown, setCanScrollDown] = useState(false)

  const isDrawer = variant === 'drawer'
  const linkPy = isDrawer ? 'py-3' : 'py-2.5'
  // Tighter rhythm for "The Instruments" rows only — claws back height so
  // more arms clear the scroll boundary without touching the rest of the nav.
  const armPy = isDrawer ? 'py-2' : 'py-1.5'

  const investigateActive = pathname === '/investigate'
  const investigationsActive = pathname === '/investigations' || (pathname.startsWith('/investigate/') && pathname !== '/investigate')
  const forumActive = pathname === '/forum' || pathname.startsWith('/forum/')
  const votesActive = pathname === '/votes' || pathname.startsWith('/votes/')
  const profileActive = pathname === '/profile' || pathname.startsWith('/profile/')
  const moderationActive = pathname === '/forum/moderation' || pathname.startsWith('/forum/moderation/')
  const isModerator = effectiveWeight >= 10

  // Scroll-fade affordance: the nav region can overflow at common viewport
  // heights (D3 made all five arms + Foundations visible by default). Only
  // show the "more below" cue when the content actually overflows, so it
  // never dims real content (e.g. Foundations) when everything already fits.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const checkOverflow = () => {
      setCanScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 1)
    }

    checkOverflow()
    el.addEventListener('scroll', checkOverflow, { passive: true })
    window.addEventListener('resize', checkOverflow)

    return () => {
      el.removeEventListener('scroll', checkOverflow)
      window.removeEventListener('resize', checkOverflow)
    }
  }, [instrumentsOpen, isModerator])

  return (
    <nav className={clsx(
      'flex h-full flex-col bg-surface-2',
      variant === 'sidebar' && 'w-56 border-r border-border',
    )}>
      {/* Wordmark */}
      <div className="px-5 py-6">
        <Link href="/" className="block" onClick={onNavigate}>
          <span
            className="text-xl font-bold tracking-tight text-text-primary"
          >
            Open Cave
          </span>
        </Link>
        <p className="mt-0.5 text-[11px] tracking-wider text-text-muted uppercase">
          Civic AI
        </p>
      </div>

      <div className="relative flex-1 min-h-0">
        <div ref={scrollRef} className="h-full px-3 space-y-1 overflow-y-auto">
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
                ? 'text-text-primary'
                : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
            )}
            style={votesActive ? { backgroundColor: 'color-mix(in srgb, var(--accent-votes) 8%, transparent)' } : undefined}
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
                style={votesActive ? { color: 'var(--accent-votes)' } : undefined}
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
                style={{ backgroundColor: 'var(--accent-votes)' }}
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

          {/* The Instruments — visible-by-default group (successor to the collapsed "Expert Tools" accordion) */}
          <div>
            {/* Jen: group label + arm microcopy pending copy review */}
            <button
              onClick={() => setInstrumentsOpen((v) => !v)}
              aria-expanded={instrumentsOpen}
              aria-controls="instruments-list"
              className="flex w-full items-center justify-between px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-faint hover:text-text-muted transition-colors"
            >
              <span>The Instruments</span>
              <ChevronDown
                size={11}
                strokeWidth={2}
                className={clsx(
                  'transition-transform duration-200',
                  instrumentsOpen ? 'rotate-0' : '-rotate-90'
                )}
              />
            </button>

            {instrumentsOpen && (
              <ul id="instruments-list" className="mt-0.5 space-y-0.5">
                {arms.map((arm) => {
                  const isActive = pathname.startsWith(arm.href)
                  const Icon = arm.icon
                  return (
                    <li key={arm.name}>
                      <Link
                        href={arm.href}
                        onClick={onNavigate}
                        className={clsx(
                          `group flex items-center gap-3 rounded-lg px-3 ${armPy} text-sm transition-all duration-150`,
                          isActive
                            ? 'text-text-primary'
                            : 'text-text-muted hover:bg-surface-3 hover:text-text-secondary'
                        )}
                        style={isActive ? { backgroundColor: `color-mix(in srgb, var(--accent-${arm.name.toLowerCase()}) 8%, transparent)` } : undefined}
                      >
                        <span
                          className={clsx(
                            'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md transition-all duration-150',
                            isActive ? 'bg-surface-1 shadow-sm' : 'group-hover:bg-surface-1'
                          )}
                        >
                          {/* Resting-state accent tint (was flat text-muted) so the five instruments read as color-coded at rest, not only when active. Jen: confirm treatment. */}
                          <Icon
                            size={15}
                            strokeWidth={1.75}
                            style={{
                              color: isActive
                                ? `var(--accent-${arm.name.toLowerCase()})`
                                : `color-mix(in srgb, var(--accent-${arm.name.toLowerCase()}) 62%, transparent)`,
                            }}
                          />
                        </span>
                        <span className="flex flex-col">
                          <span className="font-medium leading-tight">{arm.name}</span>
                          <span className="text-[10px] text-text-muted leading-none">
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
        {/* Scroll-fade "more below" cue — inert (and invisible) unless the
            nav region actually overflows, so it never dims real content. */}
        <div
          aria-hidden="true"
          className={clsx(
            'pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-surface-2 to-transparent transition-opacity duration-150',
            canScrollDown ? 'opacity-100' : 'opacity-0'
          )}
        />
      </div>

      {/* Beta + support */}
      <div className="mx-3 rounded-lg border border-border bg-surface-3/50 px-3 py-3">
        <p className="text-[10px] font-medium uppercase tracking-widest text-text-faint">
          Beta
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
          Testing civic issues in BC, Alberta, and Ontario, with an environmental focus.
        </p>
        <a
          href="https://ko-fi.com/toasted40013"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center gap-1.5 text-[11px] text-text-muted transition-colors hover:text-text-secondary"
        >
          <Heart size={11} strokeWidth={1.75} />
          Support this project
        </a>
        <div className="mt-2">
          <FeedbackDialog />
        </div>
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
