import Link from 'next/link'
import { Search, Compass, Eye, MessageCircleQuestion, FileText, GitCompare } from 'lucide-react'

const armLinks = [
  { name: 'Scout', href: '/scout', icon: Compass, accent: '#9333EA' },
  { name: 'Oracle', href: '/oracle', icon: Eye, accent: '#0891B2' },
  { name: 'Gadfly', href: '/gadfly', icon: MessageCircleQuestion, accent: '#B45309' },
  { name: 'Lever', href: '/lever', icon: FileText, accent: '#DC2626' },
  { name: 'Mirror', href: '/mirror', icon: GitCompare, accent: '#059669' },
]

export function LandingCta() {
  return (
    <section className="px-6 py-24" data-scroll-section="cta">
      <div className="mx-auto max-w-lg" data-scroll-fade>
        <Link
          href="/briefing"
          className="block rounded-2xl border border-border-strong bg-surface-1 p-8 shadow-md transition-all duration-200 hover:shadow-lg hover:border-text-faint"
        >
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-strong bg-surface-3">
              <Search size={18} strokeWidth={1.75} className="text-text-secondary" />
            </span>
            <h2
              className="text-xl font-bold text-text-primary"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              What concerns you?
            </h2>
          </div>
          <p
            className="text-sm leading-relaxed text-text-secondary"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Describe a civic issue and The Republic investigates it — documents,
            analysis, actions, and comparisons in one complete briefing.
          </p>
          <div className="mt-5">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-text-primary px-4 py-2 text-sm font-medium text-surface-0 transition-opacity hover:opacity-90">
              <Search size={14} strokeWidth={2} />
              Get Started
            </span>
          </div>
        </Link>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
          {armLinks.map((arm) => {
            const Icon = arm.icon
            return (
              <Link
                key={arm.name}
                href={arm.href}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
              >
                <Icon size={12} strokeWidth={2} style={{ color: arm.accent }} />
                {arm.name}
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
