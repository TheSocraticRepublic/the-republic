import Link from 'next/link'
import { ArmHeader } from '@/components/layout/arm-header'
import { PostalCodeForm } from '@/components/votes/postal-code-form'
import { DataFreshnessBadge } from '@/components/votes/data-freshness-badge'


export const metadata = {
  title: 'Vote Tracker',
}

/** Plain-instructional (CLAUDE.md copy register): the action, then the result. */
const VOTES_INTRO =
  'Enter your postal code to find your Member of Parliament and see how they have voted in the House of Commons.'

export default function VoteTrackerPage() {
  return (
    <div data-arm="votes">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <ArmHeader
          arm="votes"
          title="Vote Tracker"
          subtitle="Parliamentary voting records"
          intro={VOTES_INTRO}
        />

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
          <span className="text-3xs font-semibold uppercase text-text-faint">or</span>
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
    </div>
  )
}
