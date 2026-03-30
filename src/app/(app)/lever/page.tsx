import { headers } from 'next/headers'
import { getDb } from '@/lib/db'
import { leverActions } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { FileText } from 'lucide-react'
import { ActionCard } from '@/components/lever/action-card'
import { NewActionDialog } from '@/components/lever/new-action-dialog'

export const metadata = {
  title: 'Lever — The Republic',
}

interface LeverPageProps {
  searchParams: Promise<{ documentId?: string; sessionId?: string }>
}

export default async function LeverPage({ searchParams }: LeverPageProps) {
  const { documentId: initialDocumentId, sessionId: initialSessionId } = await searchParams
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
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* Header */}
      <div className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl border"
            style={{
              borderColor: 'rgba(200, 91, 91, 0.25)',
              backgroundColor: 'rgba(200, 91, 91, 0.08)',
            }}
          >
            <FileText size={18} strokeWidth={1.75} style={{ color: '#C85B5B' }} />
          </span>
          <div>
            <h1
              className="text-xl font-bold tracking-tight text-neutral-100"
              style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
            >
              Lever
            </h1>
            <p className="text-xs text-neutral-500">Civic action documents</p>
          </div>
        </div>

        <NewActionDialog
          initialDocumentId={initialDocumentId}
          initialSessionId={initialSessionId}
        />
      </div>

      {/* Action list */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Your actions
          {actions.length > 0 && (
            <span className="ml-2 font-normal normal-case tracking-normal text-neutral-600">
              {actions.length} {actions.length === 1 ? 'document' : 'documents'}
            </span>
          )}
        </h2>

        {actions.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-black/40 px-6 py-10 text-center">
            <p className="text-sm text-neutral-500">No actions yet.</p>
            <p className="mt-1 text-xs text-neutral-600">
              Generate a FIPPA request, public comment, or policy brief to begin.
            </p>
          </div>
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
  )
}
