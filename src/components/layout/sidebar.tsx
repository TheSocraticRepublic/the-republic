'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Compass, Eye, MessageCircleQuestion, FileText, GitCompare, LogOut, Search, List, ChevronDown, MessageSquare, Shield, Vote, Heart, ScrollText } from 'lucide-react'
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

// The active dot sits out of flow (app-arms P1-1, step 1), in the row's pr-5
// gutter, so a row never reflows or wraps when it becomes the current page.
// pr-5 with gap-2.5 keeps the text column at 130px, wide enough that
// "New Investigation" (127px in Instrument Sans 600 14px) stays on one line.
const ACTIVE_DOT = 'absolute right-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full'

interface SidebarProps {
  // No email prop: the shell shows the display name only (app-arms P2-16).
  // The email belongs on /profile, not on every screen share.
  displayName?: string
  effectiveWeight?: number
  variant?: 'sidebar' | 'drawer'
  onNavigate?: () => void
}

export function Sidebar({ displayName, effectiveWeight = 0, variant = 'sidebar', onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [instrumentsOpen, setInstrumentsOpen] = useState(true)
  const navRef = useRef<HTMLElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollDown, setCanScrollDown] = useState(false)

  const isDrawer = variant === 'drawer'
  const linkPy = isDrawer ? 'py-3' : 'py-2.5'
  // Tighter rhythm for "The Instruments" rows only — claws back height so
  // more arms clear the scroll boundary without touching the rest of the nav.
  const armPy = isDrawer ? 'py-2' : 'py-1.5'

  const investigateActive = pathname === '/investigate'
  const investigationsActive = pathname === '/investigations' || (pathname.startsWith('/investigate/') && pathname !== '/investigate')
  const votesActive = pathname === '/votes' || pathname.startsWith('/votes/')
  const profileActive = pathname === '/profile' || pathname.startsWith('/profile/')
  const moderationActive = pathname === '/forum/moderation' || pathname.startsWith('/forum/moderation/')
  const foundationsActive = pathname === '/foundations'
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

  // Keep the current page's row in view (app-arms P1-1, step 6). On mount and
  // on every route change. 'nearest' does nothing when the row is already
  // visible, so this never jumps a list the citizen has scrolled themselves
  // unless the route changed. jsdom has no scrollIntoView, hence the guard.
  useEffect(() => {
    const current = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]')
    current?.scrollIntoView?.({ block: 'nearest' })
  }, [pathname])

  return (
    <nav
      ref={navRef}
      aria-label="Main"
      className={clsx(
        'flex h-full flex-col bg-surface-2',
        variant === 'sidebar' && 'w-56 border-r border-border',
        // Drawer (mobile P1-2): ONE scroller, the whole nav. No nested
        // scroll region, no fixed blocks below it eating the phone's height.
        isDrawer && 'overflow-y-auto overscroll-contain',
      )}
    >
      {/* Wordmark (R6): Fraunces, no tagline. Same treatment as the landing. */}
      <div className={clsx('px-5', isDrawer ? 'py-4' : 'py-5')}>
        <Link href="/" className="inline-block" onClick={onNavigate}>
          <span className="font-display text-xl font-semibold tracking-[-0.01em] text-text-primary">
            Open Cave
          </span>
        </Link>
      </div>

      <div className={clsx('relative', !isDrawer && 'flex-1 min-h-0')}>
        {/* pt-1: the 2px-offset focus ring of the first row was clipped by
            this scroll box's top edge (app-arms P2-10). */}
        <div
          ref={scrollRef}
          className={clsx('px-3 pt-1 pb-3 space-y-1', !isDrawer && 'h-full overflow-y-auto')}
        >
          {/* New Investigation — primary entry point */}
          <Link
            href="/investigate"
            onClick={onNavigate}
            aria-current={investigateActive ? 'page' : undefined}
            className={clsx(
              `group relative flex items-center gap-2.5 rounded-lg pl-3 pr-5 ${linkPy} text-sm transition-all duration-150`,
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
              <span className="text-2xs font-medium text-text-faint leading-tight">Start here</span>
            </span>
            {investigateActive && (
              <span aria-hidden="true" className={clsx(ACTIVE_DOT, 'bg-text-secondary')} />
            )}
          </Link>

          {/* Investigations list */}
          <Link
            href="/investigations"
            onClick={onNavigate}
            aria-current={investigationsActive ? 'page' : undefined}
            className={clsx(
              `group relative flex items-center gap-2.5 rounded-lg pl-3 pr-5 ${linkPy} text-sm transition-all duration-150`,
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
              <span className="text-2xs font-medium text-text-faint leading-tight">Your history</span>
            </span>
            {investigationsActive && (
              <span aria-hidden="true" className={clsx(ACTIVE_DOT, 'bg-text-secondary')} />
            )}
          </Link>

          {/* Forum — coming soon (R9). Visible at readable contrast while the
              gate is off: no opacity dimming (it took the row below 2:1). The
              words "Coming soon" carry the disabled meaning, for every reader,
              not a mouse-only title. The gate itself lives in
              src/lib/forum/flag.ts and is untouched. */}
          <span
            data-nav="forum"
            className={`flex items-center gap-2.5 rounded-lg pl-3 pr-5 ${linkPy} text-sm cursor-not-allowed`}
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
              <span className="text-2xs font-medium text-text-faint leading-tight">Coming soon</span>
            </span>
          </span>

          {/* Vote Tracker */}
          <Link
            href="/votes"
            onClick={onNavigate}
            aria-current={votesActive ? 'page' : undefined}
            className={clsx(
              `group relative flex items-center gap-2.5 rounded-lg pl-3 pr-5 ${linkPy} text-sm transition-all duration-150`,
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
              {/* Tinted at rest like the instruments (app-arms Q2-a): its
                  active state already uses the accent. */}
              <Vote
                size={14}
                strokeWidth={1.75}
                style={{
                  color: votesActive
                    ? 'var(--accent-votes)'
                    : 'color-mix(in srgb, var(--accent-votes) 62%, transparent)',
                }}
              />
            </span>
            <span className="flex flex-col">
              <span className="font-semibold leading-tight">Vote Tracker</span>
              <span className="text-2xs font-medium text-text-faint leading-tight">MP voting records</span>
            </span>
            {votesActive && (
              <span
                aria-hidden="true"
                className={ACTIVE_DOT}
                style={{ backgroundColor: 'var(--accent-votes)' }}
              />
            )}
          </Link>

          {/* Moderation — conditional on credential weight */}
          {isModerator && (
            <Link
              href="/forum/moderation"
              onClick={onNavigate}
              aria-current={moderationActive ? 'page' : undefined}
              className={clsx(
                `group relative flex items-center gap-2.5 rounded-lg pl-3 pr-5 ${linkPy} text-sm transition-all duration-150`,
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
                <span className="text-2xs font-medium text-text-faint leading-tight">Review reports</span>
              </span>
              {moderationActive && (
                <span aria-hidden="true" className={clsx(ACTIVE_DOT, 'bg-text-secondary')} />
              )}
            </Link>
          )}

          {/* Divider */}
          <div className="mx-3 my-3 h-px bg-border" />

          {/* The Instruments — visible-by-default group (successor to the collapsed "Expert Tools" accordion) */}
          <div>
            {/* Jen: group label + arm microcopy pending copy review */}
            <button
              onClick={() => setInstrumentsOpen((v) => !v)}
              aria-expanded={instrumentsOpen}
              aria-controls="instruments-list"
              className="flex w-full items-center justify-between px-2 py-1.5 text-3xs font-semibold uppercase text-text-faint hover:text-text-muted transition-colors"
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

            {/* Collapsing hides the list; it stays mounted so the toggle's
                aria-controls always points at a real element (mobile P2-7). */}
            <ul id="instruments-list" hidden={!instrumentsOpen} className="mt-0.5 space-y-0.5">
              {arms.map((arm) => {
                const isActive = pathname.startsWith(arm.href)
                const Icon = arm.icon
                return (
                  <li key={arm.name}>
                    <Link
                      href={arm.href}
                      onClick={onNavigate}
                      aria-current={isActive ? 'page' : undefined}
                      className={clsx(
                        `group relative flex items-center gap-2.5 rounded-lg pl-3 pr-5 ${armPy} text-sm transition-all duration-150`,
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
                        <span className="text-2xs font-medium text-text-muted leading-tight">
                          {arm.description}
                        </span>
                      </span>
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className={ACTIVE_DOT}
                          style={{ backgroundColor: `var(--accent-${arm.name.toLowerCase()})` }}
                        />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Foundations — the philosophical groundwork */}
          <Link
            href="/foundations"
            onClick={onNavigate}
            aria-current={foundationsActive ? 'page' : undefined}
            className={clsx(
              `group relative flex items-center gap-2.5 rounded-lg pl-3 pr-5 ${linkPy} text-sm transition-all duration-150`,
              foundationsActive
                ? 'bg-surface-3 text-text-primary'
                : 'text-text-muted hover:bg-surface-3 hover:text-text-secondary'
            )}
          >
            <span className={clsx(
              'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border transition-all duration-150',
              foundationsActive
                ? 'bg-surface-1 border-border-strong shadow-sm'
                : 'border-border group-hover:bg-surface-1 group-hover:border-border-strong'
            )}>
              <ScrollText
                size={14}
                strokeWidth={1.75}
                className={clsx(
                  foundationsActive ? 'text-text-primary' : 'text-text-muted group-hover:text-text-secondary'
                )}
              />
            </span>
            <span className="flex flex-col">
              <span className="font-medium leading-tight">Foundations</span>
              <span className="text-2xs font-medium text-text-faint leading-tight">The groundwork</span>
            </span>
            {foundationsActive && (
              <span aria-hidden="true" className={clsx(ACTIVE_DOT, 'bg-text-secondary')} />
            )}
          </Link>

          {/* Beta + support: the last thing in the scroll region (app-arms
              P1-1 step 5, mobile P1-2), so the scope disclosure stays but no
              longer costs fixed height. Both links are 44px tall (mobile
              P2-16); the Report-a-bug trigger lives in FeedbackDialog, so its
              height is set from here. */}
          <div data-nav="beta" className="mt-3 rounded-lg border border-border bg-surface-3/50 px-3 pt-3 pb-1">
            <p className="text-3xs font-semibold uppercase text-text-faint">
              Beta
            </p>
            <p className="mt-1 text-2xs font-medium leading-relaxed text-text-muted">
              Testing civic issues in BC, Alberta, and Ontario, with an environmental focus.
            </p>
            <a
              href="https://ko-fi.com/toasted40013"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex min-h-11 items-center gap-1.5 text-2xs font-medium text-text-muted transition-colors hover:text-text-secondary"
            >
              <Heart size={11} strokeWidth={1.75} />
              Support this project
            </a>
            <div className="[&>button]:min-h-11 [&>button]:w-full">
              <FeedbackDialog />
            </div>
          </div>
        </div>
        {/* Scroll-fade "more below" cue — inert (and invisible) unless the
            nav region actually overflows, so it never dims real content.
            Sidebar only: the drawer has no inner scroller to fade. */}
        {!isDrawer && (
          <div
            aria-hidden="true"
            className={clsx(
              'pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-surface-2 to-transparent transition-opacity duration-150',
              canScrollDown ? 'opacity-100' : 'opacity-0'
            )}
          />
        )}
      </div>

      {/* Account. The identity is the way to /profile (the Profile row is
          gone: it duplicated this block), and it shows the display name only,
          never the email (app-arms P1-1 step 3, P2-16). In the drawer every
          row is 44px (mobile P2-16); it scrolls with the rest of the nav. */}
      <div className="border-t border-border px-3 py-3">
        <Link
          href="/profile"
          onClick={onNavigate}
          aria-current={profileActive ? 'page' : undefined}
          className={clsx(
            'flex items-center rounded-lg px-3 transition-colors hover:bg-surface-3',
            isDrawer ? 'min-h-11' : 'py-2',
            profileActive && 'bg-surface-3',
          )}
        >
          {displayName ? (
            <ProfileBadge displayName={displayName} size="sm" />
          ) : (
            <span className="text-sm font-medium text-text-secondary">Your profile</span>
          )}
        </Link>
        <button
          onClick={async () => {
            await fetch('/api/auth/signout', { method: 'POST' })
            // Full reload so server components clear the stale session
            router.push('/login')
            router.refresh()
          }}
          className={clsx(
            'flex w-full items-center gap-2.5 rounded-lg px-3 text-sm text-text-muted transition-colors hover:bg-surface-3 hover:text-text-secondary',
            isDrawer ? 'min-h-11' : 'py-2',
          )}
        >
          <LogOut size={14} strokeWidth={1.75} />
          Sign out
        </button>
        <Link
          href="/privacy"
          className={clsx(
            'flex items-center rounded-lg px-3 text-2xs text-text-faint transition-colors hover:text-text-muted',
            isDrawer ? 'min-h-11' : 'py-1.5',
          )}
          onClick={onNavigate}
        >
          Privacy
        </Link>
      </div>
    </nav>
  )
}
