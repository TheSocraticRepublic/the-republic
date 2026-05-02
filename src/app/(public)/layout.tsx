import Link from 'next/link'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-surface-1 shadow-sm">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-text-primary hover:text-text-secondary transition-colors"
          >
            The Republic
          </Link>
          <Link
            href="/investigate"
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
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
      <footer className="border-t border-border">
        <div className="mx-auto max-w-4xl px-6 py-6 flex items-center justify-between">
          <p className="text-xs text-text-faint">
            The Republic — making institutional power legible
          </p>
          <Link
            href="/"
            className="text-xs text-text-faint hover:text-text-muted transition-colors"
          >
            therepublic.ca
          </Link>
        </div>
      </footer>
    </div>
  )
}
