'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, Eye, MessageCircleQuestion, FileText, GitCompare, LogOut, Search } from 'lucide-react'
import { clsx } from 'clsx'

const arms = [
  {
    name: 'Scout',
    href: '/scout',
    icon: Compass,
    color: '#B088C8',
    description: 'Document discovery',
  },
  {
    name: 'Oracle',
    href: '/oracle',
    icon: Eye,
    color: '#89B4C8',
    description: 'Document analysis',
  },
  {
    name: 'Gadfly',
    href: '/gadfly',
    icon: MessageCircleQuestion,
    color: '#C8A84B',
    description: 'Socratic inquiry',
  },
  {
    name: 'Lever',
    href: '/lever',
    icon: FileText,
    color: '#C85B5B',
    description: 'Civic actions',
  },
  {
    name: 'Mirror',
    href: '/mirror',
    icon: GitCompare,
    color: '#5BC88A',
    description: 'Policy comparison',
  },
]

interface SidebarProps {
  userEmail?: string
}

export function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname()
  const briefingActive = pathname.startsWith('/briefing')

  return (
    <nav className="flex h-full w-56 flex-col border-r border-white/[0.06] bg-black/40 backdrop-blur-xl">
      {/* Wordmark */}
      <div className="px-5 py-6">
        <Link href="/" className="block">
          <span
            className="text-base font-bold tracking-tight text-neutral-100"
            style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
          >
            The Republic
          </span>
        </Link>
        <p className="mt-0.5 text-[11px] tracking-wider text-neutral-500 uppercase">
          Civic AI Framework
        </p>
      </div>

      <div className="flex-1 px-3 space-y-5">
        {/* Briefing — primary entry point */}
        <div>
          <Link
            href="/briefing"
            className={clsx(
              'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150',
              briefingActive
                ? 'bg-white/[0.09] text-neutral-100'
                : 'text-neutral-300 hover:bg-white/[0.05] hover:text-neutral-100'
            )}
          >
            <span
              className={clsx(
                'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md transition-all duration-150 border',
                briefingActive
                  ? 'bg-white/[0.10] border-white/[0.15]'
                  : 'border-white/[0.08] group-hover:bg-white/[0.06] group-hover:border-white/[0.12]'
              )}
            >
              <Search
                size={14}
                strokeWidth={1.75}
                className={clsx(
                  briefingActive ? 'text-neutral-100' : 'text-neutral-400 group-hover:text-neutral-200'
                )}
              />
            </span>
            <span className="flex flex-col">
              <span className="font-semibold leading-tight">Briefing</span>
              <span className="text-[10px] text-neutral-600 leading-tight">Civic briefing</span>
            </span>
            {briefingActive && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full flex-shrink-0 bg-neutral-300" />
            )}
          </Link>
        </div>

        {/* Expert tools section */}
        <div>
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-600">
            Expert Tools
          </p>
          <ul className="space-y-0.5">
            {arms.map((arm) => {
              const isActive = pathname.startsWith(arm.href)
              const Icon = arm.icon
              return (
                <li key={arm.name}>
                  <Link
                    href={arm.href}
                    className={clsx(
                      'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150',
                      isActive
                        ? 'bg-white/[0.07] text-neutral-100'
                        : 'text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200'
                    )}
                  >
                    <span
                      className={clsx(
                        'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md transition-all duration-150',
                        isActive ? 'bg-white/[0.08]' : 'group-hover:bg-white/[0.05]'
                      )}
                    >
                      <Icon
                        size={15}
                        style={{ color: isActive ? arm.color : undefined }}
                        className={clsx(!isActive && 'text-neutral-500 group-hover:text-neutral-300')}
                        strokeWidth={1.75}
                      />
                    </span>
                    <span className="flex flex-col">
                      <span className="font-medium leading-tight">{arm.name}</span>
                      <span className="text-[10px] text-neutral-600 leading-tight">
                        {arm.description}
                      </span>
                    </span>
                    {isActive && (
                      <span
                        className="ml-auto h-1.5 w-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: arm.color }}
                      />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {/* User / sign out */}
      <div className="border-t border-white/[0.06] px-3 py-4">
        {userEmail && (
          <p className="mb-2 truncate px-3 text-[11px] text-neutral-500">
            {userEmail}
          </p>
        )}
        <form action="/api/auth/signout" method="POST">
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-neutral-500 transition-colors hover:bg-white/[0.04] hover:text-neutral-300"
          >
            <LogOut size={14} strokeWidth={1.75} />
            Sign out
          </button>
        </form>
      </div>
    </nav>
  )
}
