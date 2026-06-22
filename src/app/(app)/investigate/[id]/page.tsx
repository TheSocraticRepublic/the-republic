import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import { investigations, archiveRecords } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { InvestigationPage } from '@/components/investigation/investigation-page'
import { InvestigationControls } from '@/components/investigation/investigation-controls'
import { GeneratingPoller } from '@/components/investigation/generating-poller'

export const metadata = {
  title: 'Investigation',
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

  // Fetch the investigation — owner scoped, but do NOT filter by status here.
  // The old filter (status = 'active') would reject completed investigations now
  // that the state machine has 'complete', 'generating', 'failed', 'cancelled'.
  const [investigation] = await db
    .select({
      id: investigations.id,
      userId: investigations.userId,
      concern: investigations.concern,
      jurisdictionName: investigations.jurisdictionName,
      briefingText: investigations.briefingText,
      status: investigations.status,
      failureReason: investigations.failureReason,
      createdAt: investigations.createdAt,
      lensOpenedAt: investigations.lensOpenedAt,
      lensContextText: investigations.lensContextText,
      gadflySeededQuestion: investigations.gadflySeededQuestion,
      campaignOpenedAt: investigations.campaignOpenedAt,
    })
    .from(investigations)
    .where(and(eq(investigations.id, id), eq(investigations.userId, userId)))
    .limit(1)

  if (!investigation) {
    notFound()
  }

  // Archived investigations are accessible (they just carry a preserved badge).
  // 'generating', 'failed', 'cancelled' get their own states below.

  const isAuthor = investigation.userId === userId

  // Fetch archive record for this investigation (if one exists)
  const [archiveRow] = await db
    .select({
      archiveStatus: archiveRecords.archiveStatus,
    })
    .from(archiveRecords)
    .where(eq(archiveRecords.investigationId, id))
    .limit(1)

  // --- Generating state ---
  if (investigation.status === 'generating') {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-xl border border-border bg-surface-1 shadow-sm px-6 py-10">
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className="h-2.5 w-2.5 rounded-full bg-yellow-400 animate-pulse"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-text-primary">Generating your investigation…</p>
            <p className="mt-0.5 text-xs text-text-faint max-w-sm">
              Your briefing is being prepared. This usually takes under a minute.
              The page will update automatically when it&apos;s ready.
            </p>
            <GeneratingPoller investigationId={id} />
            <div className="mt-2">
              <InvestigationControls id={id} status="generating" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- Failed or cancelled state ---
  if (investigation.status === 'failed' || investigation.status === 'cancelled') {
    const isCancelled = investigation.status === 'cancelled'
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-xl border border-border bg-surface-1 shadow-sm px-6 py-10">
          <div className="flex flex-col items-center gap-3 text-center" role="alert">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: isCancelled ? '#89B4C8' : '#C85B5B' }}
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-text-primary">
              {isCancelled ? 'Investigation cancelled' : 'Generation failed'}
            </p>
            {investigation.failureReason && (
              <p className="text-xs text-text-faint italic max-w-sm">
                {investigation.failureReason}
              </p>
            )}
            <p className="text-xs text-text-faint max-w-sm">
              Your concern has been saved. You can retry generation or delete this investigation.
            </p>
            <div className="mt-1">
              <InvestigationControls
                id={id}
                status={investigation.status as 'failed' | 'cancelled'}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- No briefing yet (edge case: stale 'active' row or race between write and read) ---
  if (!investigation.briefingText) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-xl border border-border bg-surface-1 shadow-sm px-6 py-10 text-center">
          <p className="text-sm text-text-secondary">Briefing in progress…</p>
          <p className="mt-1.5 text-xs text-text-faint">
            Your investigation is being prepared. The page will update automatically.
          </p>
          {/* Poller hard-stop prevents infinite polling on legacy 'active' rows */}
          <GeneratingPoller investigationId={id} />
          <div className="mt-3">
            <InvestigationControls id={id} status="generating" />
          </div>
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
