import Image from 'next/image'
import { headers } from 'next/headers'
import { getDb } from '@/lib/db'
import { investigations, gadflySessions, leverActions } from '@/lib/db/schema'
import { eq, desc, and, isNotNull } from 'drizzle-orm'
import Link from 'next/link'
import { ConcernForm } from '@/components/investigation/concern-form'
import { formatRelativeTime } from '@/lib/format-relative-time'
import { StatusPill } from '@/components/ui/status-pill'
import {
  mergeRecentActivity,
  type ActivityItem,
  type ActivityType,
} from '@/lib/activity/merge-recent-activity'

export const metadata = {
  title: 'New Investigation',
}

const ACTIVITY_LIMIT = 8

// Type label shown next to each Recent Activity row — plain text, not a pill.
const TYPE_LABELS: Record<ActivityType, string> = {
  investigation: 'Investigation',
  inquiry: 'Inquiry',
  action: 'Action',
}

// Status → StatusPill color/label maps, mirrored verbatim from each arm's own
// existing mapping so this cross-type list doesn't invent new token pairings:
//   - investigation: src/app/(app)/investigations/page.tsx STATUS_CONFIG
//   - inquiry (gadfly): src/components/gadfly/session-card.tsx STATUS_LABELS
//   - action (lever): src/components/lever/action-card.tsx STATUS_STYLES
const INVESTIGATION_STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  generating: { label: 'Generating…', color: 'var(--accent-gadfly)', bg: 'color-mix(in srgb, var(--accent-gadfly) 10%, transparent)' },
  complete: { label: 'Complete', color: 'var(--accent-mirror)', bg: 'color-mix(in srgb, var(--accent-mirror) 10%, transparent)' },
  failed: { label: 'Failed', color: 'var(--accent-lever)', bg: 'color-mix(in srgb, var(--accent-lever) 10%, transparent)' },
  cancelled: { label: 'Cancelled', color: 'var(--accent-oracle)', bg: 'color-mix(in srgb, var(--accent-oracle) 10%, transparent)' },
  // Rows fetched here are always status='active' WITH a completed briefing
  // (see the query's isNotNull(briefingText) filter) — that combination
  // resolves to 'complete' everywhere else in the app, so resolve it here too.
  active: { label: 'Complete', color: 'var(--accent-mirror)', bg: 'color-mix(in srgb, var(--accent-mirror) 10%, transparent)' },
  archived: { label: 'Archived', color: 'var(--accent-oracle)', bg: 'color-mix(in srgb, var(--accent-oracle) 10%, transparent)' },
}

const INQUIRY_STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: 'var(--accent-mirror)', bg: 'color-mix(in srgb, var(--accent-mirror) 12%, transparent)' },
  completed: { label: 'Completed', color: '#a3a3a3', bg: 'rgba(163, 163, 163, 0.12)' },
  abandoned: { label: 'Abandoned', color: 'var(--accent-lever)', bg: 'color-mix(in srgb, var(--accent-lever) 12%, transparent)' },
}

const ACTION_STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'var(--accent-gadfly)', bg: 'color-mix(in srgb, var(--accent-gadfly) 12%, transparent)' },
  final: { label: 'Final', color: 'var(--accent-mirror)', bg: 'color-mix(in srgb, var(--accent-mirror) 12%, transparent)' },
  filed: { label: 'Filed', color: 'var(--accent-oracle)', bg: 'color-mix(in srgb, var(--accent-oracle) 12%, transparent)' },
}

function getActivityStatusStyle(item: ActivityItem): { label: string; color: string; bg: string } {
  const stylesByType: Record<ActivityType, Record<string, { label: string; color: string; bg: string }>> = {
    investigation: INVESTIGATION_STATUS_STYLES,
    inquiry: INQUIRY_STATUS_STYLES,
    action: ACTION_STATUS_STYLES,
  }
  const styles = stylesByType[item.type]
  return styles[item.status] ?? Object.values(styles)[0]
}

export default async function InvestigatePage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')

  let recentInvestigations: Array<{
    id: string
    concern: string
    status: string
    createdAt: Date
  }> = []
  let recentInquiries: Array<{
    id: string
    title: string
    status: string
    createdAt: Date
  }> = []
  let recentActions: Array<{
    id: string
    title: string
    status: string
    createdAt: Date
  }> = []

  if (userId) {
    const db = getDb()
    // Fetch limit bumped from 5 to ACTIVITY_LIMIT (8): once merged with the
    // other two types and sliced to the top 8 overall, under-fetching from
    // any one source could wrongly exclude its most recent rows.
    recentInvestigations = await db
      .select({
        id: investigations.id,
        concern: investigations.concern,
        status: investigations.status,
        createdAt: investigations.createdAt,
      })
      .from(investigations)
      .where(
        and(
          eq(investigations.userId, userId),
          eq(investigations.status, 'active'),
          isNotNull(investigations.briefingText)
        )
      )
      .orderBy(desc(investigations.createdAt))
      .limit(ACTIVITY_LIMIT)

    recentInquiries = await db
      .select({
        id: gadflySessions.id,
        title: gadflySessions.title,
        status: gadflySessions.status,
        createdAt: gadflySessions.createdAt,
      })
      .from(gadflySessions)
      .where(eq(gadflySessions.userId, userId))
      .orderBy(desc(gadflySessions.createdAt))
      .limit(ACTIVITY_LIMIT)

    recentActions = await db
      .select({
        id: leverActions.id,
        title: leverActions.title,
        status: leverActions.status,
        createdAt: leverActions.createdAt,
      })
      .from(leverActions)
      .where(eq(leverActions.userId, userId))
      .orderBy(desc(leverActions.createdAt))
      .limit(ACTIVITY_LIMIT)
  }

  const activityItems = mergeRecentActivity(
    recentInvestigations,
    recentInquiries,
    recentActions,
    ACTIVITY_LIMIT
  )
  const hasActivity = activityItems.length > 0

  return (
    <div className="relative min-h-[calc(100vh-4rem)]">
      {/* Faint landscape backdrop */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <Image
          src="/landing/hero.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          style={{ opacity: 0.06, objectPosition: 'center 60%' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, var(--surface-0) 0%, transparent 30%, transparent 70%, var(--surface-0) 100%)',
          }}
        />
      </div>

      <div
        className={`relative mx-auto px-6 py-12 ${hasActivity ? 'max-w-5xl' : 'max-w-3xl'}`}
      >
        <div
          className={
            hasActivity
              ? 'grid grid-cols-1 gap-12 md:grid-cols-2'
              : ''
          }
        >
          {/* Left column: form */}
          <div>
            {/* Header */}
            <div className="mb-12">
              <h1
                className="mb-3 text-3xl font-bold tracking-tight text-text-primary"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                What concerns you?
              </h1>
              <p className="text-base leading-relaxed text-text-secondary">
                Describe a civic issue and we will investigate it for you —
                documents, analysis, actions, and context in one briefing.
              </p>
            </div>

            {/* Epigraph — above the form */}
            <p
              className="mb-8 text-lg italic text-text-faint"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              Every investigation begins with a question you didn&apos;t know how to ask.
            </p>

            <ConcernForm />
          </div>

          {/* Right column: cross-type recent activity (investigations,
              inquiries, actions) — "pick up where you left off", not a
              dashboard. Title / type / status / relative-time only. */}
          {hasActivity && (
            <div>
              <h2
                className="mb-6 text-sm font-semibold uppercase tracking-wider text-text-muted"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Recent Activity
              </h2>
              <div className="space-y-3">
                {activityItems.map((item) => {
                  const statusStyle = getActivityStatusStyle(item)
                  return (
                    <Link
                      key={`${item.type}-${item.id}`}
                      href={item.href}
                      className="card-lift block rounded-xl border border-border px-4 py-3 transition-colors duration-150 hover:border-border-strong"
                      style={{ backgroundColor: 'var(--surface-1)' }}
                    >
                      <p className="line-clamp-2 text-sm text-text-secondary">
                        {item.title}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-text-muted">
                          {TYPE_LABELS[item.type]}
                        </span>
                        <StatusPill
                          label={statusStyle.label}
                          color={statusStyle.color}
                          bg={statusStyle.bg}
                        />
                        <span className="ml-auto text-xs text-text-muted">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
