import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getDb } from '@/lib/db'
import { investigations, archiveRecords } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { InvestigationPage } from '@/components/investigation/investigation-page'
import { PermanenceBadge } from '@/components/archive/permanence-badge'
import { PreserveButton } from '@/components/archive/preserve-button'

export const metadata = {
  title: 'Investigation — The Republic',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function InvestigationDetailPage({ params }: PageProps) {
  const { id } = await params
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  if (!userId) redirect('/login')

  const db = getDb()

  const [investigation] = await db
    .select({
      id: investigations.id,
      userId: investigations.userId,
      concern: investigations.concern,
      jurisdictionName: investigations.jurisdictionName,
      briefingText: investigations.briefingText,
      status: investigations.status,
      createdAt: investigations.createdAt,
      lensOpenedAt: investigations.lensOpenedAt,
      campaignOpenedAt: investigations.campaignOpenedAt,
    })
    .from(investigations)
    .where(and(eq(investigations.id, id), eq(investigations.status, 'active')))
    .limit(1)

  if (!investigation) {
    notFound()
  }

  const isAuthor = investigation.userId === userId

  // Fetch archive record for this investigation (if one exists)
  const [archiveRow] = await db
    .select({
      archiveStatus: archiveRecords.archiveStatus,
    })
    .from(archiveRecords)
    .where(eq(archiveRecords.investigationId, id))
    .limit(1)

  // If the briefing hasn't finished streaming yet (edge case: user navigated
  // before stream completed), show a waiting state rather than an empty view.
  if (!investigation.briefingText) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-xl border border-white/[0.06] bg-black/40 px-6 py-10 text-center">
          <p className="text-sm text-neutral-400">Briefing in progress...</p>
          <p className="mt-1.5 text-xs text-neutral-600">
            Your investigation is being prepared. Refresh in a moment.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <InvestigationPage
        id={investigation.id}
        concern={investigation.concern}
        jurisdictionName={investigation.jurisdictionName ?? null}
        briefingText={investigation.briefingText}
        initialLensOpen={!!investigation.lensOpenedAt}
        initialCampaignOpen={!!investigation.campaignOpenedAt}
        isAuthor={isAuthor}
      />

      {/* Archive status section */}
      <div className="mx-auto max-w-3xl px-6 pb-10">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Archive
              </p>
              {archiveRow ? (
                <div className="mt-1.5 flex items-center gap-2">
                  <PermanenceBadge status={archiveRow.archiveStatus} />
                  <Link
                    href={`/archive/${investigation.id}`}
                    className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors underline underline-offset-2"
                  >
                    View archived record
                  </Link>
                </div>
              ) : (
                <p className="mt-1 text-xs text-neutral-600">
                  This investigation has not been preserved.
                </p>
              )}
            </div>

            {/* Preserve to Archive — only shown to investigation author when not yet archived */}
            {isAuthor && !archiveRow && (
              <PreserveButton investigationId={investigation.id} />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
