import Link from 'next/link'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-neutral-950/80 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-neutral-200 hover:text-white transition-colors"
          >
            The Republic
          </Link>
          <Link
            href="/investigate"
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Start an investigation
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-6 py-10">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto max-w-4xl px-6 py-6 flex items-center justify-between">
          <p className="text-xs text-neutral-600">
            The Republic — making institutional power legible
          </p>
          <Link
            href="/"
            className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
          >
            therepublic.ca
          </Link>
        </div>
      </footer>
    </div>
  )
}
