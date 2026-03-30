import { headers } from 'next/headers'
import { getDb } from '@/lib/db'
import { gadflySessions } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { MessageCircleQuestion } from 'lucide-react'
import { SessionCard } from '@/components/gadfly/session-card'
import { NewSessionDialog } from '@/components/gadfly/new-session-dialog'

export const metadata = {
  title: 'Gadfly — The Republic',
}

interface GadflyPageProps {
  searchParams: Promise<{ documentId?: string; title?: string }>
}

export default async function GadflyPage({ searchParams }: GadflyPageProps) {
  const { documentId: initialDocumentId, title: initialTitle } = await searchParams
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
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* Header */}
      <div className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl border"
            style={{
              borderColor: 'rgba(200, 168, 75, 0.25)',
              backgroundColor: 'rgba(200, 168, 75, 0.08)',
            }}
          >
            <MessageCircleQuestion size={18} strokeWidth={1.75} style={{ color: '#C8A84B' }} />
          </span>
          <div>
            <h1
              className="text-xl font-bold tracking-tight text-neutral-100"
              style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
            >
              Gadfly
            </h1>
            <p className="text-xs text-neutral-500">Socratic inquiry</p>
          </div>
        </div>

        <NewSessionDialog
          initialDocumentId={initialDocumentId}
          initialTitle={initialTitle ? decodeURIComponent(initialTitle) : undefined}
        />
      </div>

      {/* Session list */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Your inquiries
          {sessions.length > 0 && (
            <span className="ml-2 font-normal normal-case tracking-normal text-neutral-600">
              {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
            </span>
          )}
        </h2>

        {sessions.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-black/40 px-6 py-10 text-center">
            <p className="text-sm text-neutral-500">No inquiries yet.</p>
            <p className="mt-1 text-xs text-neutral-600">
              Begin an inquiry to start the Socratic process.
            </p>
          </div>
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
                createdAt={session.createdAt}
                updatedAt={session.updatedAt}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
