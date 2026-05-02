import Link from 'next/link'
import { Compass, Eye, MessageCircleQuestion, FileText, GitCompare, Search } from 'lucide-react'

const arms = [
  {
    name: 'Scout',
    icon: Compass,
    description:
      'Start with a concern, not a document. The Scout identifies which government documents matter to your issue and how to get them.',
    href: '/scout',
  },
  {
    name: 'Oracle',
    icon: Eye,
    description:
      'Upload government documents. Get plain-language analysis, power maps, and the questions no one is asking.',
    href: '/oracle',
  },
  {
    name: 'Gadfly',
    icon: MessageCircleQuestion,
    description:
      'Explore any document through structured Socratic inquiry. The Gadfly never gives you answers — it builds your capacity to find them.',
    href: '/gadfly',
  },
  {
    name: 'Lever',
    icon: FileText,
    description:
      'Generate ready-to-file civic actions: FOI requests, public comments, policy briefs, and legal templates.',
    href: '/lever',
  },
  {
    name: 'Mirror',
    icon: GitCompare,
    description:
      'Compare policies across jurisdictions. See what has actually worked, where, and why.',
    href: '/mirror',
  },
]

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-0 text-text-primary">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6">
        <span
          className="text-sm font-semibold tracking-tight text-text-muted"
          style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
        >
          The Republic
        </span>
        <Link
          href="/login"
          className="rounded-lg border border-border-strong px-4 py-2 text-sm text-text-secondary transition-colors hover:border-text-faint hover:text-text-primary"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <div className="mb-6 inline-block rounded-full border border-border-strong bg-surface-1 px-4 py-1.5 shadow-sm">
          <span className="text-xs font-medium tracking-wider text-text-muted uppercase">
            Open Source Civic AI
          </span>
        </div>

        <h1
          className="mb-4 max-w-2xl text-5xl font-bold tracking-tight text-text-primary md:text-6xl"
          style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
        >
          The Republic
        </h1>

        <p className="mb-3 text-xl font-medium text-text-secondary tracking-wide">
          The examined institution.
        </p>

        <p className="mb-14 max-w-lg text-base leading-relaxed text-text-muted">
          Government documents are long. Power is obscured. Accountability is
          slow. The Republic makes institutional power legible — then helps
          you act on what you learn.
        </p>

        {/* Primary CTA — The Briefing */}
        <Link
          href="/briefing"
          className="mb-5 w-full max-w-lg rounded-2xl border border-border-strong bg-surface-1 p-7 text-left shadow-md transition-all duration-200 hover:shadow-lg hover:border-text-faint block"
        >
          <div className="mb-3 flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-strong bg-surface-3"
            >
              <Search size={18} strokeWidth={1.75} className="text-text-secondary" />
            </span>
            <div>
              <span
                className="block text-lg font-bold text-text-primary"
                style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
              >
                What concerns you?
              </span>
              <span className="text-xs text-text-muted">The Briefing — start here</span>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-text-secondary">
            Describe a civic issue and The Republic investigates it for you — documents, analysis, actions, and comparisons in one complete briefing.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-surface-3 px-3 py-1.5 text-xs font-semibold text-text-primary transition-all duration-200"
            >
              <Search size={11} strokeWidth={2} />
              Get Started
            </span>
          </div>
        </Link>

        {/* Expert tools label */}
        <p className="mb-4 mt-10 text-xs font-semibold uppercase tracking-widest text-text-faint">
          Or go direct to our specialized tools:
        </p>

        {/* Arm cards */}
        <div className="w-full max-w-4xl grid grid-cols-1 gap-4 sm:grid-cols-2">
          {arms.map((arm) => {
            const Icon = arm.icon
            const accentVar = `var(--accent-${arm.name.toLowerCase()})`
            return (
              <Link
                key={arm.name}
                href={arm.href}
                className="group block rounded-xl border border-border-strong bg-surface-1 p-6 text-left shadow-sm transition-all duration-200 hover:shadow-md"
              >
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-strong bg-surface-3"
                  >
                    <Icon
                      size={18}
                      strokeWidth={1.75}
                      style={{ color: accentVar }}
                    />
                  </span>
                  <span
                    className="text-base font-semibold"
                    style={{
                      color: accentVar,
                      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
                    }}
                  >
                    {arm.name}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-text-secondary group-hover:text-text-primary transition-colors">
                  {arm.description}
                </p>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-8 py-6 text-center">
        <p className="text-xs text-text-faint">
          Open source. Commons-governed. No single owner.
        </p>
      </footer>
    </div>
  )
}
