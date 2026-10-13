import { headers } from 'next/headers'
import { getDb } from '@/lib/db'
import { leverActions } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { ArmHeader } from '@/components/layout/arm-header'
import { EmptyState } from '@/components/ui/empty-state'
import { ActionCard } from '@/components/lever/action-card'
import { NewActionDialog } from '@/components/lever/new-action-dialog'

export const metadata = {
  title: 'Lever',
}

/**
 * Aphoristic (CLAUDE.md copy register: Lever's landing only), and it still says
 * what Lever makes (app-arms P1-5). Template citations are true of FOI
 * requests only (lever-system.ts), so the sentence claims them for those alone.
 */
const LEVER_INTRO =
  'What you have learned, put on the record. Lever drafts FOI requests, public comments and policy briefs from your findings; every FOI request cites the law from fixed templates, never invented.'

interface LeverPageProps {
  searchParams: Promise<{
    documentId?: string
    sessionId?: string
    investigationId?: string
    actionType?: string
    new?: string
  }>
}

export default async function LeverPage({ searchParams }: LeverPageProps) {
  const {
    documentId: initialDocumentId,
    sessionId: initialSessionId,
    investigationId: initialInvestigationId,
    actionType: initialActionType,
    new: openNew,
  } = await searchParams
  const headersList = await headers()
  const userId = headersList.get('x-user-id')!

  const db = getDb()
  const actions = await db
    .select({
      id: leverActions.id,
      title: leverActions.title,
      actionType: leverActions.actionType,
      status: leverActions.status,
      createdAt: leverActions.createdAt,
    })
    .from(leverActions)
    .where(eq(leverActions.userId, userId))
    .orderBy(desc(leverActions.createdAt))

  return (
    <div data-arm="lever">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <ArmHeader
          arm="lever"
          title="Lever"
          subtitle="Civic action documents"
          intro={LEVER_INTRO}
          action={
            <NewActionDialog
              initialDocumentId={initialDocumentId}
              initialSessionId={initialSessionId}
              initialInvestigationId={initialInvestigationId}
              initialActionType={initialActionType}
              initialOpen={openNew === '1'}
            />
          }
        />

        {/* Action list */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">
            Your actions
            {actions.length > 0 && (
              <span className="ml-2 font-normal normal-case tracking-normal text-text-faint">
                {actions.length} {actions.length === 1 ? 'document' : 'documents'}
              </span>
            )}
          </h2>

          {actions.length === 0 ? (
            <EmptyState
              serif
              message="No civic actions yet. Knowledge without action is incomplete."
              action={{ label: 'Draft your first civic action', href: '/lever?new=1' }}
            />
          ) : (
            <div className="space-y-3">
              {actions.map((action) => (
                <ActionCard
                  key={action.id}
                  id={action.id}
                  title={action.title}
                  actionType={action.actionType}
                  status={action.status}
                  createdAt={action.createdAt}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
