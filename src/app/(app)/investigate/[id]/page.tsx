import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import { investigations, archiveRecords } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { InvestigationPage } from '@/components/investigation/investigation-page'

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
      lensContextText: investigations.lensContextText,
      gadflySeededQuestion: investigations.gadflySeededQuestion,
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
        <div className="rounded-xl border border-border bg-surface-1 shadow-sm px-6 py-10 text-center">
          <p className="text-sm text-text-secondary">Briefing in progress...</p>
          <p className="mt-1.5 text-xs text-text-faint">
            Your investigation is being prepared. Refresh in a moment.
          </p>
        </div>
      </div>
    )
  }

  return (
    <InvestigationPage
      id={investigation.id}
      concern={investigation.concern}
      jurisdictionName={investigation.jurisdictionName ?? null}
      briefingText={investigation.briefingText}
      initialLensOpen={!!investigation.lensOpenedAt}
      lensContextText={investigation.lensContextText ?? null}
      gadflySeededQuestion={investigation.gadflySeededQuestion ?? null}
      initialCampaignOpen={!!investigation.campaignOpenedAt}
      isAuthor={isAuthor}
      archiveStatus={archiveRow?.archiveStatus ?? null}
    />
  )
}
