import Image from 'next/image'
import { headers } from 'next/headers'
import { getDb } from '@/lib/db'
import { investigations } from '@/lib/db/schema'
import { eq, desc, and, isNotNull } from 'drizzle-orm'
import Link from 'next/link'
import { ConcernForm } from '@/components/investigation/concern-form'
import { formatRelativeTime } from '@/lib/format-relative-time'

export const metadata = {
  title: 'New Investigation — The Republic',
}

export default async function InvestigatePage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')

  let recentInvestigations: Array<{
    id: string
    concern: string
    jurisdictionName: string | null
    createdAt: Date
  }> = []

  if (userId) {
    const db = getDb()
    recentInvestigations = await db
      .select({
        id: investigations.id,
        concern: investigations.concern,
        jurisdictionName: investigations.jurisdictionName,
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
      .limit(5)
  }

  const hasRecent = recentInvestigations.length > 0

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
          unoptimized
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
        className={`relative mx-auto px-6 py-12 ${hasRecent ? 'max-w-5xl' : 'max-w-3xl'}`}
      >
        <div
          className={
            hasRecent
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

            <ConcernForm />
          </div>

          {/* Right column: recent investigations */}
          {hasRecent && (
            <div>
              <h2
                className="mb-6 text-sm font-semibold uppercase tracking-wider text-text-muted"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Recent Investigations
              </h2>
              <div className="space-y-3">
                {recentInvestigations.map((inv) => (
                  <Link
                    key={inv.id}
                    href={`/investigate/${inv.id}`}
                    className="card-lift block rounded-xl border border-border px-4 py-3 transition-colors duration-150 hover:border-border-strong"
                    style={{ backgroundColor: 'var(--surface-1)' }}
                  >
                    <p className="line-clamp-2 text-sm text-text-secondary">
                      {inv.concern}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      {inv.jurisdictionName && (
                        <span className="text-xs text-text-muted">
                          {inv.jurisdictionName}
                        </span>
                      )}
                      <span className="text-xs text-text-faint">
                        {formatRelativeTime(inv.createdAt)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Contextual anchor — full width, outside the grid */}
        <p
          className="mt-16 text-center text-sm italic text-text-faint"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          Every investigation begins with a question you didn't know how to ask.
        </p>
      </div>
    </div>
  )
}
