import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import { federalMps } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { MpProfileCard } from '@/components/votes/mp-profile-card'
import { VotingPatterns } from '@/components/votes/voting-patterns'
import { ContradictionList } from '@/components/votes/contradiction-list'
import { MpVoteList } from '@/components/votes/mp-vote-list'

export const metadata = {
  title: 'MP Profile — The Republic',
}

interface PageProps {
  params: Promise<{ mpId: string }>
}

export default async function MpProfilePage({ params }: PageProps) {
  const { mpId } = await params
  const db = getDb()

  const [mp] = await db
    .select()
    .from(federalMps)
    .where(eq(federalMps.id, mpId))
    .limit(1)

  if (!mp) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 space-y-10">
      {/* MP Profile */}
      <MpProfileCard
        name={mp.name}
        party={mp.party}
        ridingName={mp.ridingName}
        ridingProvince={mp.ridingProvince}
        email={mp.email}
        photoUrl={mp.photoUrl}
      />

      {/* Voting Patterns */}
      <section>
        <VotingPatterns mpId={mpId} />
      </section>

      {/* Contradiction Detection */}
      <section>
        <ContradictionList mpId={mpId} />
      </section>

      {/* Voting Record */}
      <section>
        <div
          className="mb-6 h-px w-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        />
        <div className="flex items-center gap-3 mb-6">
          <div
            className="h-px flex-1"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
          />
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: '#D4764E' }}
          >
            Voting Record
          </span>
          <div
            className="h-px flex-1"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
          />
        </div>

        <MpVoteList mpId={mpId} />
      </section>
    </div>
  )
}
