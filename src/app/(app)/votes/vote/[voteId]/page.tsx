import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import { federalVotes } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { VoteDetailCard } from '@/components/votes/vote-detail-card'
import { PartyBreakdown, parsePartyVotes } from '@/components/votes/party-breakdown'
import { BallotList } from '@/components/votes/ballot-list'
import { VoteExplanation } from '@/components/votes/vote-explanation'

export const metadata = {
  title: 'Vote Detail — The Republic',
}

interface PageProps {
  params: Promise<{ voteId: string }>
}

export default async function VoteDetailPage({ params }: PageProps) {
  const { voteId } = await params
  const db = getDb()

  const [vote] = await db
    .select()
    .from(federalVotes)
    .where(eq(federalVotes.id, voteId))
    .limit(1)

  if (!vote) {
    notFound()
  }

  const partyVoteData = parsePartyVotes(vote.partyVotes)

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 space-y-10">
      <VoteDetailCard
        date={vote.date}
        descriptionEn={vote.descriptionEn}
        result={vote.result}
        yeaTotal={vote.yeaTotal}
        nayTotal={vote.nayTotal}
        pairedTotal={vote.pairedTotal}
        session={vote.session}
        number={vote.number}
      />

      {/* AI Explanation */}
      <section>
        <VoteExplanation voteId={voteId} existingExplanation={vote.aiExplanation} />
      </section>

      {partyVoteData.length > 0 && (
        <section
          className="rounded-xl border px-6 py-6"
          style={{
            borderColor: 'rgba(255,255,255,0.08)',
            backgroundColor: 'rgba(255,255,255,0.02)',
          }}
        >
          <PartyBreakdown partyVotes={partyVoteData} />
        </section>
      )}

      <section>
        <div
          className="mb-6 h-px w-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        />
        <BallotList voteId={voteId} />
      </section>
    </div>
  )
}
