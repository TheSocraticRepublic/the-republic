import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-0 px-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface-1 p-8 shadow-sm">
        <h1 className="font-display text-xl font-semibold text-text-primary">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="rounded-lg bg-text-primary px-4 py-2 text-sm font-medium text-surface-0 transition-opacity hover:opacity-90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
