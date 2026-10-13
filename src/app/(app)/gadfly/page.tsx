import { headers } from 'next/headers'
import { getDb } from '@/lib/db'
import { gadflySessions } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { ArmHeader } from '@/components/layout/arm-header'
import { EmptyState } from '@/components/ui/empty-state'
import { SessionCard } from '@/components/gadfly/session-card'
import { NewSessionDialog } from '@/components/gadfly/new-session-dialog'

export const metadata = {
  title: 'Gadfly',
}

/** Aphoristic (CLAUDE.md copy register): Gadfly speaks this way everywhere. */
const GADFLY_INTRO =
  'Questions that sharpen your thinking. The Gadfly asks; it never answers for you.'

interface GadflyPageProps {
  searchParams: Promise<{ documentId?: string; title?: string; new?: string }>
}

export default async function GadflyPage({ searchParams }: GadflyPageProps) {
  const { documentId: initialDocumentId, title: initialTitle, new: openNew } = await searchParams
  const headersList = await headers()
  const userId = headersList.get('x-user-id')!

  const db = getDb()
  const sessions = await db
    .select({
      id: gadflySessions.id,
      title: gadflySessions.title,
      documentId: gadflySessions.documentId,
      mode: gadflySessions.mode,
      status: gadflySessions.status,
      questionCount: gadflySessions.questionCount,
      insightCount: gadflySessions.insightCount,
      createdAt: gadflySessions.createdAt,
      updatedAt: gadflySessions.updatedAt,
    })
    .from(gadflySessions)
    .where(eq(gadflySessions.userId, userId))
    .orderBy(desc(gadflySessions.updatedAt))

  return (
    <div data-arm="gadfly">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <ArmHeader
          arm="gadfly"
          title="Gadfly"
          subtitle="Socratic inquiry"
          intro={GADFLY_INTRO}
          action={
            <NewSessionDialog
              initialDocumentId={initialDocumentId}
              initialTitle={initialTitle ? decodeURIComponent(initialTitle) : undefined}
              initialOpen={openNew === '1'}
              // Remount on the flag: a client navigation from the empty state
              // to ?new=1 keeps this component, and useState reads its prop once.
              key={openNew === '1' ? 'new' : 'list'}
            />
          }
        />

        {/* Session list */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">
            Your inquiries
            {sessions.length > 0 && (
              <span className="ml-2 font-normal normal-case tracking-normal text-text-faint">
                {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
              </span>
            )}
          </h2>

          {sessions.length === 0 ? (
            <EmptyState
              serif
              message="No inquiries yet. The unexamined assumption is the dangerous one."
              action={{ label: 'Begin your first inquiry', href: '/gadfly?new=1' }}
            />
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  id={session.id}
                  title={session.title}
                  mode={session.mode}
                  status={session.status}
                  questionCount={session.questionCount}
                  insightCount={session.insightCount}
                  updatedAt={session.updatedAt}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
