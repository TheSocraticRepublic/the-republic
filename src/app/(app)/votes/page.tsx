import Link from 'next/link'
import { PostalCodeForm } from '@/components/votes/postal-code-form'

export const metadata = {
  title: 'Vote Tracker — The Republic',
}

export default function VoteTrackerPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-12">
        <h1
          className="mb-3 text-3xl font-bold tracking-tight text-neutral-100"
          style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
        >
          Who represents you?
        </h1>
        <p className="text-base leading-relaxed text-neutral-400">
          Enter your postal code to find your Member of Parliament and see how they vote on the issues that matter to you.
        </p>
      </div>

      <div
        className="rounded-xl border px-6 py-8"
        style={{
          borderColor: 'rgba(255,255,255,0.08)',
          backgroundColor: 'rgba(255,255,255,0.02)',
        }}
      >
        <PostalCodeForm />
      </div>

      <div className="mt-8 flex items-center gap-6">
        <div
          className="h-px flex-1"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        />
        <span className="text-[10px] text-neutral-600 uppercase tracking-widest">or</span>
        <div
          className="h-px flex-1"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-4">
        <Link
          href="/votes/mp"
          className="rounded-xl border px-5 py-3 text-sm text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04] hover:border-white/[0.10] transition-all duration-150"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          Browse all MPs
        </Link>
        <Link
          href="/votes/recent"
          className="rounded-xl border px-5 py-3 text-sm text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04] hover:border-white/[0.10] transition-all duration-150"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          Recent votes
        </Link>
      </div>
    </div>
  )
}
