import { headers } from 'next/headers'
import { getDb } from '@/lib/db'
import { investigations } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import Link from 'next/link'
import { Search } from 'lucide-react'

export const metadata = {
  title: 'Investigations — The Republic',
}

function truncate(text: string, max = 120): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export default async function InvestigationsPage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')!

  const db = getDb()
  const records = await db
    .select({
      id: investigations.id,
      concern: investigations.concern,
      jurisdictionName: investigations.jurisdictionName,
      status: investigations.status,
      briefingText: investigations.briefingText,
      createdAt: investigations.createdAt,
    })
    .from(investigations)
    .where(eq(investigations.userId, userId))
    .orderBy(desc(investigations.createdAt))

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* Header */}
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1
            className="text-xl font-bold tracking-tight text-neutral-100"
            style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
          >
            Investigations
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            Your civic inquiries
          </p>
        </div>
        <Link
          href="/investigate"
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 hover:opacity-90"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            color: '#f4f4f5',
            border: '1px solid rgba(255, 255, 255, 0.15)',
          }}
        >
          <Search size={13} strokeWidth={2} />
          New Investigation
        </Link>
      </div>

      {/* List */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Your investigations
          {records.length > 0 && (
            <span className="ml-2 font-normal normal-case tracking-normal text-neutral-600">
              {records.length} {records.length === 1 ? 'investigation' : 'investigations'}
            </span>
          )}
        </h2>

        {records.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-black/40 px-6 py-10 text-center">
            <p className="text-sm text-neutral-500">No investigations yet. Start one.</p>
            <p className="mt-1 text-xs text-neutral-600">
              <Link href="/investigate" className="text-neutral-400 underline underline-offset-2 hover:text-neutral-200 transition-colors">
                Start your first investigation
              </Link>
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((inv) => (
              <Link
                key={inv.id}
                href={`/investigate/${inv.id}`}
                className="group block rounded-xl border border-white/[0.06] bg-black/40 px-5 py-4 transition-all duration-150 hover:bg-white/[0.04] hover:border-white/[0.10]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed text-neutral-200 group-hover:text-neutral-100 transition-colors">
                      {truncate(inv.concern)}
                    </p>
                    {inv.jurisdictionName && (
                      <p className="mt-1 text-xs text-neutral-600">
                        {inv.jurisdictionName}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={
                        inv.briefingText
                          ? { backgroundColor: 'rgba(91, 200, 138, 0.10)', color: '#5BC88A' }
                          : { backgroundColor: 'rgba(200, 168, 75, 0.10)', color: '#C8A84B' }
                      }
                    >
                      {inv.briefingText ? 'Complete' : 'In progress'}
                    </span>
                    <span className="text-[10px] text-neutral-600">
                      {formatDate(inv.createdAt)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
