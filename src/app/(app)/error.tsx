'use client'

import Link from 'next/link'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface-1 p-8 shadow-sm">
        <h1 className="font-display text-xl font-semibold text-text-primary">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          An unexpected error occurred. If this persists, the issue has been
          logged.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-text-muted">
            Reference: {error.digest}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-text-primary px-4 py-2 text-sm font-medium text-surface-0 transition-opacity hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/investigate"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-0"
          >
            Back to investigations
          </Link>
        </div>
      </div>
    </div>
  )
}
