import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import { investigations } from '@/lib/db/schema'
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
  const userId = headersList.get('x-user-id')!

  const db = getDb()

  const [investigation] = await db
    .select({
      id: investigations.id,
      concern: investigations.concern,
      jurisdictionName: investigations.jurisdictionName,
      briefingText: investigations.briefingText,
      status: investigations.status,
      createdAt: investigations.createdAt,
    })
    .from(investigations)
    .where(and(eq(investigations.id, id), eq(investigations.userId, userId)))
    .limit(1)

  if (!investigation) {
    notFound()
  }

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
    <InvestigationPage
      id={investigation.id}
      concern={investigation.concern}
      jurisdictionName={investigation.jurisdictionName ?? null}
      briefingText={investigation.briefingText}
    />
  )
}
