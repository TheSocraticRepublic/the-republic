import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getDb } from '@/lib/db'
import { federalBills, federalVotes, federalMps } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { PartyBadge } from '@/components/votes/party-badge'
import { BillSummary } from '@/components/votes/bill-summary'

export const metadata = {
  title: 'Bill Detail',
}

interface PageProps {
  params: Promise<{ billId: string }>
}

export default async function BillDetailPage({ params }: PageProps) {
  const { billId } = await params
  const db = getDb()

  const [bill] = await db
    .select({
      id: federalBills.id,
      number: federalBills.number,
      titleEn: federalBills.titleEn,
      titleFr: federalBills.titleFr,
      shortTitleEn: federalBills.shortTitleEn,
      session: federalBills.session,
      statusCode: federalBills.statusCode,
      introduced: federalBills.introduced,
      isLaw: federalBills.isLaw,
      legisInfoUrl: federalBills.legisInfoUrl,
      aiSummary: federalBills.aiSummary,
      sponsorName: federalMps.name,
      sponsorParty: federalMps.party,
      sponsorMpId: federalMps.id,
    })
    .from(federalBills)
    .leftJoin(federalMps, eq(federalBills.sponsorMpId, federalMps.id))
    .where(eq(federalBills.id, billId))
    .limit(1)

  if (!bill) {
    notFound()
  }

  const votes = await db
    .select({
      id: federalVotes.id,
      session: federalVotes.session,
      number: federalVotes.number,
      date: federalVotes.date,
      descriptionEn: federalVotes.descriptionEn,
      result: federalVotes.result,
      yeaTotal: federalVotes.yeaTotal,
      nayTotal: federalVotes.nayTotal,
    })
    .from(federalVotes)
    .where(eq(federalVotes.billId, billId))
    .orderBy(desc(federalVotes.date))

  return (
    <div data-arm="votes" className="mx-auto max-w-2xl px-6 py-10 space-y-10">
      {/* Bill header */}
      <div
        className="rounded-xl border px-6 py-6"
        style={{
          borderColor: 'var(--border)',
          borderLeftWidth: '3px',
          borderLeftColor: 'var(--accent-votes)',
          backgroundColor: 'var(--surface-1)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span
            className="text-sm font-bold"
            style={{ color: 'var(--accent-votes)' }}
          >
            {bill.number}
          </span>
          <span className="text-[10px] text-text-faint">{bill.session}</span>
          {bill.isLaw && (
            <span className="rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-400/10">
              Law
            </span>
          )}
        </div>

        <h1
          className="text-base font-semibold text-text-primary leading-relaxed mb-4"
        >
          {bill.titleEn}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          {bill.introduced && (
            <span className="text-text-muted">Introduced {bill.introduced}</span>
          )}
          {bill.sponsorName && (
            <span className="flex items-center gap-1.5">
              <span className="text-text-faint">Sponsor:</span>
              <Link
                href={`/votes/mp/${bill.sponsorMpId}`}
                className="text-text-secondary hover:text-text-primary underline underline-offset-2 transition-colors"
              >
                {bill.sponsorName}
              </Link>
              {bill.sponsorParty && <PartyBadge party={bill.sponsorParty} />}
            </span>
          )}
          {bill.statusCode && (
            <span className="text-text-faint">{bill.statusCode}</span>
          )}
        </div>

        {bill.legisInfoUrl && (
          <a
            href={bill.legisInfoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-xs text-text-muted hover:text-text-secondary underline underline-offset-2 transition-colors"
          >
            View on LEGISinfo
          </a>
        )}
      </div>

      {/* AI Summary */}
      <section>
        <BillSummary billId={billId} existingSummary={bill.aiSummary} />
      </section>

      {/* Linked votes */}
      {votes.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div
              className="h-px flex-1"
              style={{ backgroundColor: 'var(--surface-3)' }}
            />
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: 'var(--accent-votes)' }}
            >
              Recorded Votes
            </span>
            <div
              className="h-px flex-1"
              style={{ backgroundColor: 'var(--surface-3)' }}
            />
          </div>

          <div className="space-y-2">
            {votes.map((vote) => (
              <Link
                key={vote.id}
                href={`/votes/vote/${vote.id}`}
                className="group block rounded-xl border px-4 py-3 transition-all duration-150 hover:bg-surface-3 hover:border-border-strong"
                style={{
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--surface-1)',
                }}
              >
                <p className="text-xs text-text-secondary leading-snug mb-1.5">
                  {vote.descriptionEn}
                </p>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-text-faint">{vote.date}</span>
                  <span
                    style={{
                      color: vote.result === 'passed' ? '#4ade80' : '#ef4444',
                    }}
                  >
                    {vote.result}
                  </span>
                  <span className="text-text-faint">
                    {vote.yeaTotal}Y / {vote.nayTotal}N
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
