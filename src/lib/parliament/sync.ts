import { getDb } from '@/lib/db'
import {
  federalMps,
  federalVotes,
  federalMpBallots,
  federalBills,
} from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import {
  fetchCurrentMPs,
  fetchVotes,
  fetchBills,
  fetchBallotsForVote,
} from './client'
import {
  extractSlug,
  normalizeBallot,
  normalizeVoteResult,
} from './types'
import type { OparlBill } from './types'

const CURRENT_SESSION = '45-1'

export interface SyncResult {
  mps: { fetched: number; upserted: number }
  bills: { fetched: number; upserted: number }
  votes: { fetched: number; upserted: number }
  ballots: { fetched: number; upserted: number }
  errors: string[]
}

export async function syncParliamentData(
  session = CURRENT_SESSION
): Promise<SyncResult> {
  const db = getDb()
  const result: SyncResult = {
    mps: { fetched: 0, upserted: 0 },
    bills: { fetched: 0, upserted: 0 },
    votes: { fetched: 0, upserted: 0 },
    ballots: { fetched: 0, upserted: 0 },
    errors: [],
  }

  // 1. Sync MPs
  try {
    const rawMps = await fetchCurrentMPs()
    result.mps.fetched = rawMps.length

    for (const mp of rawMps) {
      const slug = extractSlug(mp.url)
      const party = mp.current_party?.short_name?.en ?? 'Unknown'
      const ridingName = mp.current_riding?.name?.en ?? 'Unknown'
      const ridingProvince = mp.current_riding?.province ?? 'Unknown'

      const existing = await db
        .select({ id: federalMps.id })
        .from(federalMps)
        .where(eq(federalMps.oparlSlug, slug))
        .limit(1)

      if (existing.length > 0) {
        await db
          .update(federalMps)
          .set({
            name: mp.name,
            party,
            ridingName,
            ridingProvince,
            email: mp.email ?? null,
            photoUrl: mp.image
              ? `https://openparliament.ca${mp.image}`
              : null,
            active: true,
            metadata: {
              memberships: mp.memberships,
              otherInfo: mp.other_info,
              links: mp.links,
            },
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(federalMps.id, existing[0].id))
        result.mps.upserted++
      } else {
        await db.insert(federalMps).values({
          oparlSlug: slug,
          name: mp.name,
          party,
          ridingName,
          ridingProvince,
          email: mp.email ?? null,
          photoUrl: mp.image
            ? `https://openparliament.ca${mp.image}`
            : null,
          active: true,
          metadata: {
            memberships: mp.memberships,
            otherInfo: mp.other_info,
            links: mp.links,
          },
          lastSyncedAt: new Date(),
        })
        result.mps.upserted++
      }
    }
  } catch (err) {
    result.errors.push(`MP sync failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  // 2. Sync bills (before votes, since votes reference bills)
  const billUrlToId = new Map<string, string>()

  try {
    const rawBills = await fetchBills(session)
    result.bills.fetched = rawBills.length

    for (const bill of rawBills) {
      const billNumber = bill.number
      const titleEn = bill.name?.en ?? billNumber

      // Resolve sponsor MP
      let sponsorMpId: string | null = null
      if (bill.sponsor_politician_url) {
        const sponsorSlug = extractSlug(bill.sponsor_politician_url)
        const [sponsor] = await db
          .select({ id: federalMps.id })
          .from(federalMps)
          .where(eq(federalMps.oparlSlug, sponsorSlug))
          .limit(1)
        sponsorMpId = sponsor?.id ?? null
      }

      const existing = await db
        .select({ id: federalBills.id })
        .from(federalBills)
        .where(eq(federalBills.number, billNumber))
        .limit(1)

      if (existing.length > 0) {
        await db
          .update(federalBills)
          .set({
            titleEn,
            titleFr: bill.name?.fr ?? null,
            shortTitleEn: bill.short_title?.en ?? null,
            sponsorMpId,
            statusCode: bill.status_code ?? null,
            introduced: bill.introduced ?? null,
            isLaw: bill.law ?? null,
            legisInfoUrl: bill.legisinfo_url ?? null,
            metadata: buildBillMetadata(bill),
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(federalBills.id, existing[0].id))
        billUrlToId.set(bill.url, existing[0].id)
        result.bills.upserted++
      } else {
        const [inserted] = await db
          .insert(federalBills)
          .values({
            number: billNumber,
            titleEn,
            titleFr: bill.name?.fr ?? null,
            shortTitleEn: bill.short_title?.en ?? null,
            sponsorMpId,
            session,
            statusCode: bill.status_code ?? null,
            introduced: bill.introduced ?? null,
            isLaw: bill.law ?? null,
            legisInfoUrl: bill.legisinfo_url ?? null,
            metadata: buildBillMetadata(bill),
            lastSyncedAt: new Date(),
          })
          .returning({ id: federalBills.id })
        billUrlToId.set(bill.url, inserted.id)
        result.bills.upserted++
      }
    }
  } catch (err) {
    result.errors.push(`Bill sync failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  // 3. Sync votes + ballots
  try {
    const rawVotes = await fetchVotes(session)
    result.votes.fetched = rawVotes.length

    for (const vote of rawVotes) {
      const descriptionEn = vote.description?.en ?? `Vote ${vote.number}`

      // Resolve bill FK
      let billId: string | null = null
      if (vote.bill_url) {
        billId = billUrlToId.get(vote.bill_url) ?? null
      }

      const existing = await db
        .select({ id: federalVotes.id })
        .from(federalVotes)
        .where(eq(federalVotes.session, vote.session))
        .limit(1)

      // Use session+number for lookup
      const [existingVote] = await db
        .select({ id: federalVotes.id })
        .from(federalVotes)
        .where(eq(federalVotes.number, vote.number))
        .limit(1)

      let voteId: string

      if (existingVote) {
        await db
          .update(federalVotes)
          .set({
            descriptionEn,
            descriptionFr: vote.description?.fr ?? null,
            result: normalizeVoteResult(vote.result),
            yeaTotal: vote.yea_total,
            nayTotal: vote.nay_total,
            pairedTotal: vote.paired_total,
            partyVotes: vote.party_votes ?? null,
            billId,
            lastSyncedAt: new Date(),
          })
          .where(eq(federalVotes.id, existingVote.id))
        voteId = existingVote.id
        result.votes.upserted++
      } else {
        const [inserted] = await db
          .insert(federalVotes)
          .values({
            session: vote.session,
            number: vote.number,
            date: vote.date,
            descriptionEn,
            descriptionFr: vote.description?.fr ?? null,
            result: normalizeVoteResult(vote.result),
            yeaTotal: vote.yea_total,
            nayTotal: vote.nay_total,
            pairedTotal: vote.paired_total,
            partyVotes: vote.party_votes ?? null,
            billId,
            lastSyncedAt: new Date(),
          })
          .returning({ id: federalVotes.id })
        voteId = inserted.id
        result.votes.upserted++
      }

      // Fetch and sync ballots for this vote
      try {
        const ballots = await fetchBallotsForVote(vote.session, vote.number)
        result.ballots.fetched += ballots.length

        for (const ballot of ballots) {
          const mpSlug = extractSlug(ballot.politician_url)
          const [mp] = await db
            .select({ id: federalMps.id })
            .from(federalMps)
            .where(eq(federalMps.oparlSlug, mpSlug))
            .limit(1)

          if (!mp) continue

          try {
            await db.insert(federalMpBallots).values({
              voteId,
              mpId: mp.id,
              ballot: normalizeBallot(ballot.ballot),
            })
            result.ballots.upserted++
          } catch (err: any) {
            if (err?.code !== '23505') {
              result.errors.push(`Ballot insert failed: ${err?.message}`)
            }
          }
        }
      } catch (err) {
        result.errors.push(
          `Ballot sync for vote ${vote.session}/${vote.number} failed: ${
            err instanceof Error ? err.message : String(err)
          }`
        )
      }
    }
  } catch (err) {
    result.errors.push(`Vote sync failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  return result
}

function buildBillMetadata(bill: OparlBill): Record<string, unknown> {
  return {
    homeChamber: bill.home_chamber,
    privateMemberBill: bill.private_member_bill,
    voteUrls: bill.vote_urls,
    legisInfoId: bill.legisinfo_id,
    statusText: bill.status?.en,
  }
}
