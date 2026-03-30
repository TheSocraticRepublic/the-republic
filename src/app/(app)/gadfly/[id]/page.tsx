import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import { gadflySessions, gadflyTurns, insightMarkers } from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { GadflySession } from '@/components/gadfly/gadfly-session'

export const metadata = {
  title: 'Gadfly — The Republic',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function GadflySessionPage({ params }: PageProps) {
  const { id } = await params
  const headersList = await headers()
  const userId = headersList.get('x-user-id')!

  const db = getDb()

  const [session] = await db
    .select()
    .from(gadflySessions)
    .where(and(eq(gadflySessions.id, id), eq(gadflySessions.userId, userId)))
    .limit(1)

  if (!session) {
    notFound()
  }

  const turns = await db
    .select()
    .from(gadflyTurns)
    .where(eq(gadflyTurns.sessionId, id))
    .orderBy(asc(gadflyTurns.turnIndex))

  const insights = await db
    .select()
    .from(insightMarkers)
    .where(eq(insightMarkers.sessionId, id))
    .orderBy(asc(insightMarkers.createdAt))

  const insightsByTurn: Record<string, typeof insights> = {}
  for (const ins of insights) {
    if (!insightsByTurn[ins.turnId]) {
      insightsByTurn[ins.turnId] = []
    }
    insightsByTurn[ins.turnId].push(ins)
  }

  // Build question type counts for stats panel
  const questionTypeCounts: Record<string, number> = {}
  for (const turn of turns) {
    if (turn.role === 'gadfly' && turn.questionType) {
      questionTypeCounts[turn.questionType] = (questionTypeCounts[turn.questionType] ?? 0) + 1
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <GadflySession
        session={session}
        initialTurns={turns}
        initialInsightsByTurn={insightsByTurn}
        questionTypeCounts={questionTypeCounts}
      />
    </div>
  )
}
