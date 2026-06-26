import Link from 'next/link'
import { PostalCodeForm } from '@/components/votes/postal-code-form'
import { DataFreshnessBadge } from '@/components/votes/data-freshness-badge'

export const metadata = {
  title: 'Vote Tracker',
}

export default function VoteTrackerPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-12">
        <h1
          className="mb-3 text-3xl font-bold tracking-tight text-text-primary"
        >
          Who represents you?
        </h1>
        <p className="text-base leading-relaxed text-text-secondary">
          Enter your postal code to find your Member of Parliament and see how they vote on the issues that matter to you.
        </p>
      </div>

      <div
        className="rounded-xl border px-6 py-8"
        style={{
          borderColor: 'var(--border)',
          backgroundColor: 'var(--surface-1)',
        }}
      >
        <PostalCodeForm />
      </div>

      <div className="mt-8 flex items-center gap-6">
        <div
          className="h-px flex-1"
          style={{ backgroundColor: 'var(--surface-3)' }}
        />
        <span className="text-[10px] text-text-faint uppercase tracking-widest">or</span>
        <div
          className="h-px flex-1"
          style={{ backgroundColor: 'var(--surface-3)' }}
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-4">
        <Link
          href="/votes/mp"
          className="rounded-xl border px-5 py-3 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-3 hover:border-border-strong transition-all duration-150"
          style={{ borderColor: 'var(--border)' }}
        >
          Browse all MPs
        </Link>
        <Link
          href="/votes/recent"
          className="rounded-xl border px-5 py-3 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-3 hover:border-border-strong transition-all duration-150"
          style={{ borderColor: 'var(--border)' }}
        >
          Recent votes
        </Link>
      </div>

      {/* Data freshness indicator */}
      <div className="mt-8">
        <DataFreshnessBadge />
      </div>
    </div>
  )
}
