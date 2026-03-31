import Link from 'next/link'
import { Compass, Eye, MessageCircleQuestion, FileText, GitCompare } from 'lucide-react'

const arms = [
  {
    name: 'Scout',
    icon: Compass,
    color: '#B088C8',
    borderColor: 'rgba(176, 136, 200, 0.3)',
    description:
      'Start with a concern, not a document. The Scout identifies which government documents matter to your issue and how to get them.',
    href: '/scout',
  },
  {
    name: 'Oracle',
    icon: Eye,
    color: '#89B4C8',
    borderColor: 'rgba(137, 180, 200, 0.3)',
    description:
      'Upload government documents. Get plain-language analysis, power maps, and the questions no one is asking.',
    href: '/oracle',
  },
  {
    name: 'Gadfly',
    icon: MessageCircleQuestion,
    color: '#C8A84B',
    borderColor: 'rgba(200, 168, 75, 0.3)',
    description:
      'Explore any document through structured Socratic inquiry. The Gadfly never gives you answers — it builds your capacity to find them.',
    href: '/gadfly',
  },
  {
    name: 'Lever',
    icon: FileText,
    color: '#C85B5B',
    borderColor: 'rgba(200, 91, 91, 0.3)',
    description:
      'Generate ready-to-file civic actions: FOI requests, public comments, policy briefs, and legal templates.',
    href: '/lever',
  },
  {
    name: 'Mirror',
    icon: GitCompare,
    color: '#5BC88A',
    borderColor: 'rgba(91, 200, 138, 0.3)',
    description:
      'Compare policies across jurisdictions. See what has actually worked, where, and why.',
    href: '/mirror',
  },
]

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6">
        <span
          className="text-sm font-semibold tracking-tight text-neutral-400"
          style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
        >
          The Republic
        </span>
        <Link
          href="/login"
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-neutral-400 transition-colors hover:border-white/20 hover:text-neutral-200"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <div className="mb-6 inline-block rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5">
          <span className="text-xs font-medium tracking-wider text-neutral-400 uppercase">
            Open Source Civic AI
          </span>
        </div>

        <h1
          className="mb-4 max-w-2xl text-5xl font-bold tracking-tight text-neutral-50 md:text-6xl"
          style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
        >
          The Republic
        </h1>

        <p className="mb-3 text-xl font-medium text-neutral-400 tracking-wide">
          The examined institution.
        </p>

        <p className="mb-14 max-w-lg text-base leading-relaxed text-neutral-500">
          Government documents are long. Power is obscured. Accountability is
          slow. The Republic makes institutional power legible — then helps
          you act on what you learn.
        </p>

        {/* CTA */}
        <Link
          href="/login"
          className="mb-20 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-8 py-3.5 text-sm font-semibold text-neutral-100 transition-all duration-200 hover:bg-white/[0.1] hover:border-white/20"
        >
          Get Started
        </Link>

        {/* Arm cards */}
        <div className="w-full max-w-4xl grid grid-cols-1 gap-4 sm:grid-cols-2">
          {arms.map((arm) => {
            const Icon = arm.icon
            return (
              <Link
                key={arm.name}
                href={arm.href}
                className="group block rounded-xl border bg-black/60 p-6 text-left backdrop-blur-md transition-all duration-200 hover:bg-black/80"
                style={{ borderColor: arm.borderColor }}
              >
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-lg border"
                    style={{
                      borderColor: arm.borderColor,
                      backgroundColor: `${arm.color}14`,
                    }}
                  >
                    <Icon
                      size={18}
                      strokeWidth={1.75}
                      style={{ color: arm.color }}
                    />
                  </span>
                  <span
                    className="text-base font-semibold"
                    style={{
                      color: arm.color,
                      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
                    }}
                  >
                    {arm.name}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-neutral-400 group-hover:text-neutral-300 transition-colors">
                  {arm.description}
                </p>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] px-8 py-6 text-center">
        <p className="text-xs text-neutral-600">
          Open source. Commons-governed. No single owner.
        </p>
      </footer>
    </div>
  )
}
