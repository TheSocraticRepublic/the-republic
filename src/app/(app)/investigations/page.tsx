import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import { investigations } from '@/lib/db/schema'
import { eq, desc, and, isNull, sql } from 'drizzle-orm'
import { STUCK_GENERATION_INTERVAL } from '@/lib/investigation/constants'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { InvestigationControls } from '@/components/investigation/investigation-controls'
import { LocalDate } from '@/components/investigation/local-date'

export const metadata = {
  title: 'Investigations',
}

function truncate(text: string, max = 120): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

type InvestigationStatus = 'generating' | 'complete' | 'failed' | 'cancelled' | 'active' | 'archived'

function StatusBadge({ status, hasBriefing }: { status: InvestigationStatus; hasBriefing: boolean }) {
  // Legacy 'active' rows: treat as 'complete' if they have a briefing (pre-migration fallback)
  const resolved: InvestigationStatus =
    status === 'active' && hasBriefing ? 'complete' : status

  const config: Record<InvestigationStatus, { label: string; bg: string; color: string }> = {
    generating: {
      label: 'Generating…',
      bg: 'rgba(200, 168, 75, 0.10)',
      color: '#C8A84B',
    },
    complete: {
      label: 'Complete',
      bg: 'rgba(91, 200, 138, 0.10)',
      color: '#5BC88A',
    },
    failed: {
      label: 'Failed',
      bg: 'rgba(200, 91, 91, 0.10)',
      color: '#C85B5B',
    },
    cancelled: {
      label: 'Cancelled',
      bg: 'rgba(137, 180, 200, 0.10)',
      color: '#89B4C8',
    },
    active: {
      // legacy fallback — no briefing, treat like failed
      label: 'In progress',
      bg: 'rgba(200, 168, 75, 0.10)',
      color: '#C8A84B',
    },
    archived: {
      label: 'Archived',
      bg: 'rgba(137, 180, 200, 0.10)',
      color: '#89B4C8',
    },
  }

  const { label, bg, color } = config[resolved]

  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: bg, color }}
      aria-label={`Status: ${label}`}
    >
      {resolved === 'generating' ? (
        <span className="inline-flex items-center gap-1">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse"
            aria-hidden="true"
          />
          {label}
        </span>
      ) : (
        label
      )}
    </span>
  )
}

export default async function InvestigationsPage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  if (!userId) redirect('/login')

  const db = getDb()

  // Render-time reaper: mark stale 'generating' investigations as failed.
  // Belt-and-suspenders alongside the scheduled reap-investigations.mts function.
  // Keyed on generation_started_at (not createdAt) so retried rows — which have
  // an old createdAt but a fresh generation_started_at — are not reaped instantly.
  // Uses the shared STUCK_GENERATION_INTERVAL (12 min) constant so both reapers
  // always agree on the threshold.
  await db
    .update(investigations)
    .set({
      status: 'failed',
      failureReason: 'Generation timed out',
      updatedAt: sql`NOW()`,
    })
    .where(
      and(
        eq(investigations.userId, userId),
        sql`${investigations.status} = 'generating'`,
        isNull(investigations.briefingCompletedAt),
        sql`${investigations.generationStartedAt} < NOW() - INTERVAL ${STUCK_GENERATION_INTERVAL}`
      )
    )

  const records = await db
    .select({
      id: investigations.id,
      concern: investigations.concern,
      jurisdictionName: investigations.jurisdictionName,
      status: investigations.status,
      briefingText: investigations.briefingText,
      failureReason: investigations.failureReason,
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
            className="text-xl font-bold tracking-tight text-text-primary"
            style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
          >
            Investigations
            {records.length > 0 && (
              <span className="ml-2.5 text-sm font-normal text-text-muted">
                {records.length}
              </span>
            )}
          </h1>
          <p className="mt-0.5 text-xs text-text-muted">
            Your civic inquiries
          </p>
        </div>
        <Link
          href="/investigate"
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 hover:opacity-90"
          style={{
            backgroundColor: 'var(--surface-3)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-strong)',
          }}
        >
          <Search size={13} strokeWidth={2} />
          New Investigation
        </Link>
      </div>

      {/* List */}
      <section aria-label="Your investigations">
        {records.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-1 shadow-sm px-6 py-10 text-center">
            <p className="text-sm text-text-muted">No investigations yet. Start one.</p>
            <p className="mt-1 text-xs text-text-faint">
              <Link href="/investigate" className="text-text-secondary underline underline-offset-2 hover:text-text-primary transition-colors">
                Start your first investigation
              </Link>
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((inv) => {
              const isClickable = inv.status === 'complete' ||
                (inv.status === 'active' && !!inv.briefingText)
              return (
                <div
                  key={inv.id}
                  className="card-lift group block rounded-xl border border-border bg-surface-1 shadow-sm px-5 py-4 transition-all duration-150 hover:bg-surface-3 hover:border-border-strong"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      {isClickable ? (
                        <Link href={`/investigate/${inv.id}`} className="block">
                          <p className="text-sm leading-relaxed text-text-primary group-hover:text-text-primary transition-colors">
                            {truncate(inv.concern)}
                          </p>
                        </Link>
                      ) : (
                        <p className="text-sm leading-relaxed text-text-primary">
                          {truncate(inv.concern)}
                        </p>
                      )}
                      {inv.jurisdictionName && (
                        <p className="mt-1 text-xs text-text-faint">
                          {inv.jurisdictionName}
                        </p>
                      )}
                      {(inv.status === 'failed' || inv.status === 'cancelled') && inv.failureReason && (
                        <p className="mt-1 text-[11px] text-text-faint italic" role="status">
                          {inv.failureReason}
                        </p>
                      )}
                      <InvestigationControls
                        id={inv.id}
                        status={inv.status as 'generating' | 'complete' | 'failed' | 'cancelled' | 'active' | 'archived'}
                      />
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                      <StatusBadge
                        status={inv.status as 'generating' | 'complete' | 'failed' | 'cancelled' | 'active' | 'archived'}
                        hasBriefing={!!inv.briefingText}
                      />
                      <span className="text-[10px] text-text-faint">
                        <LocalDate iso={inv.createdAt.toISOString()} />
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
