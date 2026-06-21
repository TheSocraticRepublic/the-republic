/**
 * Out-of-band parliament sync: bills → votes → ballots for session 45-1.
 *
 * Why this exists: the in-app POST /api/parliament/sync is credential-gated,
 * has no UI trigger, and a full backfill (343 MPs × N ballots/vote) exceeds the
 * serverless function timeout. This script runs in a GitHub Actions job with no
 * timeout pressure, no credential gate, and a plain DATABASE_URL.
 *
 * Self-contained (own postgres client, max:1) — mirrors sync-parliament-mps.ts.
 * Imports only client.ts and types.ts helpers, which are import-safe (no
 * server-only, no getDb, no env-schema).
 *
 * Usage:
 *   DATABASE_URL='postgresql://...' npx tsx scripts/sync-parliament-full.ts
 *   DATABASE_URL='postgresql://...' npx tsx scripts/sync-parliament-full.ts --max-votes=5
 *
 * Resume cursor:
 *   Ballot-based, not time-based. On startup the script loads the set of vote IDs
 *   that already have rows in federal_mp_ballots. Votes in that set skip the API
 *   ballot fetch (the expensive per-vote operation) but still have their vote row
 *   upserted (status can change). This is immune to wall-clock artifacts (all votes
 *   in 45-1 are from 2025 — completedAt would always be > all vote dates). On full
 *   backfill the set is empty and all votes are processed.
 *
 * Idempotency:
 *   federal_bills        → onConflictDoUpdate on (session, number)
 *   federal_votes        → onConflictDoUpdate on (session, number)
 *   federal_mp_ballots   → onConflictDoNothing on (voteId, mpId)
 *                          Cast ballots don't change; explicit DoNothing signals intent
 *                          clearly (unlike the bare insert + swallow-23505 in sync.ts).
 */

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq, and, desc, sql } from 'drizzle-orm'
import {
  federalMps,
  federalBills,
  federalVotes,
  federalMpBallots,
  parliamentSyncLog,
} from '../src/lib/db/schema'
import {
  fetchVotes,
  fetchBills,
  fetchBallotsForVote,
} from '../src/lib/parliament/client'
import {
  extractSlug,
  normalizeBallot,
  normalizeVoteResult,
} from '../src/lib/parliament/types'
import type { OparlBill } from '../src/lib/parliament/types'

// ── Config ────────────────────────────────────────────────────────────────────

const CURRENT_SESSION = '45-1'
const BALLOT_FETCH_DELAY_MS = 250        // polite to the API; sequential fetches
const DEADLINE_MS = 50 * 60 * 1000      // 50-minute wall-clock safety limit

// Parse optional --max-votes=N from argv (for smoke tests)
const maxVotesArg = process.argv.find((a) => a.startsWith('--max-votes='))
const MAX_VOTES = maxVotesArg ? parseInt(maxVotesArg.split('=')[1], 10) : Infinity

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildBillMetadata(bill: OparlBill): Record<string, unknown> {
  return {
    homeChamber: bill.home_chamber,
    privateMemberBill: bill.private_member_bill,
    voteUrls: bill.vote_urls,
    legisInfoId: bill.legisinfo_id,
    statusText: bill.status?.en,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error(
      'DATABASE_URL is required.\n' +
        "  DATABASE_URL='postgresql://...' npx tsx scripts/sync-parliament-full.ts"
    )
    process.exit(1)
  }

  const pg = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    ssl: { rejectUnauthorized: false },
  })
  const db = drizzle(pg)

  const session = CURRENT_SESSION
  const startedAt = new Date()
  const deadline = Date.now() + DEADLINE_MS

  const counts = {
    billsFetched: 0,
    billsUpserted: 0,
    votesFetched: 0,
    votesUpserted: 0,
    ballotsFetched: 0,
    ballotsInserted: 0,
    votesSkipped: 0,
  }
  const errors: string[] = []
  let deadlineHit = false

  console.log(`\n[parliament-sync] Session ${session} — starting ${startedAt.toISOString()}`)
  console.log(`[parliament-sync] MAX_VOTES=${MAX_VOTES === Infinity ? 'unlimited' : MAX_VOTES}`)
  console.log(`[parliament-sync] Deadline: ${DEADLINE_MS / 60000}m`)

  // ── 0. Pre-load MP slug→id map ──────────────────────────────────────────────
  // 343 MPs fit easily in memory. One query at startup, reused for every ballot.
  // This avoids N×M per-ballot lookups and keeps API courtesy delays as the
  // only per-vote latency.
  const mpSlugToId = new Map<string, string>()
  try {
    const allMps = await db
      .select({ id: federalMps.id, oparlSlug: federalMps.oparlSlug })
      .from(federalMps)
    for (const mp of allMps) {
      mpSlugToId.set(mp.oparlSlug, mp.id)
    }
    console.log(`[parliament-sync] Loaded ${mpSlugToId.size} MPs into lookup map`)
  } catch (err) {
    const msg = `MP map load failed: ${err instanceof Error ? err.message : String(err)}`
    console.error(`[parliament-sync] ERROR: ${msg}`)
    // Fatal: ballots are meaningless without MP IDs
    await pg.end()
    console.error('[parliament-sync] Cannot continue without MP map. Exiting.')
    process.exit(1)
  }

  // ── 1. Determine resume cursor ──────────────────────────────────────────────
  // Build a set of vote IDs that already have ballot rows. If a vote has ballots,
  // it was fully processed on a prior run — skip the ballot fetch for it (the
  // most expensive per-vote operation). The vote upsert still runs (it's cheap
  // and keeps status current), but ballot fetch is skipped.
  //
  // This is more accurate than a time-based watermark because:
  //   1. Vote dates are all in the past (2025) so completedAt > all vote dates.
  //   2. It handles partial runs (deadline hit mid-backfill) correctly.
  //   3. It's immune to smoke-test artifacts that would corrupt a time cursor.
  const voteIdsWithBallots = new Set<string>()
  try {
    const rows = await db
      .select({ voteId: federalMpBallots.voteId })
      .from(federalMpBallots)
      .innerJoin(federalVotes, eq(federalMpBallots.voteId, federalVotes.id))
      .where(eq(federalVotes.session, session))
      // Distinct: GROUP BY in SQL would be cleaner but Drizzle makes DISTINCT easier here
      .groupBy(federalMpBallots.voteId)

    for (const row of rows) {
      voteIdsWithBallots.add(row.voteId)
    }

    if (voteIdsWithBallots.size > 0) {
      console.log(`[parliament-sync] Cursor: ${voteIdsWithBallots.size} votes already have ballots — will skip their ballot fetch`)
    } else {
      console.log('[parliament-sync] No prior ballot rows — full backfill')
    }
  } catch (err) {
    const msg = `Cursor lookup failed: ${err instanceof Error ? err.message : String(err)}`
    console.error(`[parliament-sync] WARN: ${msg} — proceeding with full backfill`)
    errors.push(msg)
  }

  // ── 2. Sync bills ───────────────────────────────────────────────────────────
  // Bills are few (~100) and fast — always sync all of them regardless of cursor.
  // Status evolves as bills progress, so re-running updates changed rows.
  const billUrlToId = new Map<string, string>()

  console.log('\n[parliament-sync] Phase 1: bills')
  try {
    const rawBills = await fetchBills(session)
    counts.billsFetched = rawBills.length
    console.log(`[parliament-sync]   Fetched ${rawBills.length} bills`)

    for (const bill of rawBills) {
      if (Date.now() > deadline) {
        deadlineHit = true
        errors.push('Deadline hit during bill sync')
        break
      }

      const billNumber = bill.number
      const titleEn = bill.name?.en ?? billNumber

      // Resolve sponsor MP from the pre-loaded map
      let sponsorMpId: string | null = null
      if (bill.sponsor_politician_url) {
        const sponsorSlug = extractSlug(bill.sponsor_politician_url)
        sponsorMpId = mpSlugToId.get(sponsorSlug) ?? null
      }

      const [upserted] = await db
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
        .onConflictDoUpdate({
          target: [federalBills.session, federalBills.number],
          set: {
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
          },
        })
        .returning({ id: federalBills.id })

      if (upserted) {
        billUrlToId.set(bill.url, upserted.id)
        counts.billsUpserted++
      }
    }
    console.log(`[parliament-sync]   Upserted ${counts.billsUpserted}/${counts.billsFetched} bills`)
  } catch (err) {
    const msg = `Bill sync failed: ${err instanceof Error ? err.message : String(err)}`
    console.error(`[parliament-sync]   ERROR: ${msg}`)
    errors.push(msg)
  }

  // ── 3. Sync votes + ballots ─────────────────────────────────────────────────
  console.log('\n[parliament-sync] Phase 2: votes + ballots')
  try {
    const rawVotes = await fetchVotes(session)
    counts.votesFetched = rawVotes.length
    console.log(`[parliament-sync]   Fetched ${rawVotes.length} votes`)

    let votesProcessed = 0

    for (const vote of rawVotes) {
      if (Date.now() > deadline) {
        deadlineHit = true
        errors.push('Deadline hit during vote/ballot sync')
        break
      }

      // Bounded mode for smoke tests (check before expensive work)
      if (votesProcessed >= MAX_VOTES) {
        console.log(`[parliament-sync]   --max-votes=${MAX_VOTES} reached, stopping`)
        break
      }
      votesProcessed++

      const descriptionEn = vote.description?.en ?? `Vote ${vote.number}`

      // Resolve bill FK from already-fetched map; fall back to DB lookup
      let billId: string | null = null
      if (vote.bill_url) {
        billId = billUrlToId.get(vote.bill_url) ?? null
        if (!billId) {
          // Bill may exist in DB from a prior run even if not in this run's billUrlToId map
          // (e.g., bill sync was skipped or bill is from a different session batch)
          const billNumber = vote.bill_url.replace(/\/$/, '').split('/').pop() ?? null
          if (billNumber) {
            const [found] = await db
              .select({ id: federalBills.id })
              .from(federalBills)
              .where(and(eq(federalBills.session, session), eq(federalBills.number, billNumber)))
              .limit(1)
            billId = found?.id ?? null
          }
        }
      }

      // Upsert vote by natural key (session, number); vote results can be corrected
      const [upsertedVote] = await db
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
        .onConflictDoUpdate({
          target: [federalVotes.session, federalVotes.number],
          set: {
            descriptionEn,
            descriptionFr: vote.description?.fr ?? null,
            result: normalizeVoteResult(vote.result),
            yeaTotal: vote.yea_total,
            nayTotal: vote.nay_total,
            pairedTotal: vote.paired_total,
            partyVotes: vote.party_votes ?? null,
            billId,
            lastSyncedAt: new Date(),
          },
        })
        .returning({ id: federalVotes.id })

      if (!upsertedVote) {
        errors.push(`Vote upsert returned no row: ${vote.session}/${vote.number}`)
        continue
      }

      counts.votesUpserted++
      const voteId = upsertedVote.id

      // Skip ballot fetch if this vote already has ballots (resume cursor).
      // The vote upsert above already ran to keep status current.
      if (voteIdsWithBallots.has(voteId)) {
        counts.votesSkipped++
        continue
      }

      // Fetch and sync ballots for this vote
      try {
        await sleep(BALLOT_FETCH_DELAY_MS)
        const ballots = await fetchBallotsForVote(vote.session, vote.number)
        counts.ballotsFetched += ballots.length

        if (ballots.length > 0) {
          // Build ballot values using the pre-loaded MP map (no per-ballot DB query)
          const ballotValues = ballots
            .map((b) => {
              const mpId = mpSlugToId.get(extractSlug(b.politician_url))
              if (!mpId) return null
              return {
                voteId,
                mpId,
                ballot: normalizeBallot(b.ballot),
              } as const
            })
            .filter((v): v is { voteId: string; mpId: string; ballot: 'yes' | 'no' | 'paired' | 'didnt_vote' } =>
              v !== null
            )

          if (ballotValues.length > 0) {
            // onConflictDoNothing: cast ballots are immutable. A re-run no-ops all existing rows.
            // This is explicit intent, unlike the bare insert + swallow-23505 pattern in sync.ts.
            await db
              .insert(federalMpBallots)
              .values(ballotValues)
              .onConflictDoNothing()
            counts.ballotsInserted += ballotValues.length
          }
        }
      } catch (err) {
        const msg = `Ballot sync for vote ${vote.session}/${vote.number} failed: ${
          err instanceof Error ? err.message : String(err)
        }`
        console.error(`[parliament-sync]   WARN: ${msg}`)
        errors.push(msg)
        // Continue: one ballot failure doesn't abort the whole run
      }

      if (votesProcessed % 10 === 0) {
        console.log(
          `[parliament-sync]   …${votesProcessed}/${rawVotes.length} votes processed, ` +
            `${counts.ballotsInserted} ballots queued so far`
        )
      }
    }

    console.log(
      `[parliament-sync]   Done: ${counts.votesUpserted} votes upserted, ` +
        `${counts.ballotsInserted} ballots inserted (${counts.votesSkipped} ballot-fetches skipped — already synced)`
    )
  } catch (err) {
    const msg = `Vote sync failed: ${err instanceof Error ? err.message : String(err)}`
    console.error(`[parliament-sync]   ERROR: ${msg}`)
    errors.push(msg)
  }

  // ── 4. Write sync log ───────────────────────────────────────────────────────
  const completedAt = new Date()
  const durationMs = completedAt.getTime() - startedAt.getTime()
  // Bounded runs (--max-votes) are smoke tests; don't advance the cursor.
  const boundedRun = MAX_VOTES < Infinity
  const success = errors.length === 0 && !deadlineHit && !boundedRun

  try {
    await db.insert(parliamentSyncLog).values({
      syncType: 'bg-ballots',
      session,
      recordsFetched: counts.billsFetched + counts.votesFetched + counts.ballotsFetched,
      recordsUpserted: counts.billsUpserted + counts.votesUpserted + counts.ballotsInserted,
      errors: errors.length > 0 ? errors : null,
      durationMs,
      startedAt,
      // completedAt is NULL on failure/deadline-hit; the cursor only advances on success.
      completedAt: success ? completedAt : null,
    })
    console.log('[parliament-sync] Sync log written')
  } catch (logErr) {
    console.error('[parliament-sync] WARN: failed to write sync log:', logErr)
  }

  // ── 5. Final summary ────────────────────────────────────────────────────────
  const resultLabel = boundedRun
    ? `SMOKE TEST (--max-votes=${MAX_VOTES}) — cursor NOT advanced`
    : success
      ? 'SUCCESS'
      : deadlineHit
        ? 'DEADLINE HIT (partial — re-run to continue from cursor)'
        : 'COMPLETED WITH ERRORS'

  console.log('\n[parliament-sync] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`[parliament-sync] RESULT: ${resultLabel}`)
  console.log(`[parliament-sync] Bills:   fetched=${counts.billsFetched}  upserted=${counts.billsUpserted}`)
  console.log(`[parliament-sync] Votes:   fetched=${counts.votesFetched}  upserted=${counts.votesUpserted}  ballot-fetch-skipped=${counts.votesSkipped}`)
  console.log(`[parliament-sync] MPs in map: ${mpSlugToId.size}`)
  console.log(`[parliament-sync] Ballots: fetched=${counts.ballotsFetched}  inserted=${counts.ballotsInserted}`)
  console.log(`[parliament-sync] Duration: ${(durationMs / 1000).toFixed(1)}s`)
  if (errors.length > 0) {
    console.log(`[parliament-sync] Errors (${errors.length}):`)
    errors.slice(0, 10).forEach((e) => console.log(`  - ${e}`))
    if (errors.length > 10) console.log(`  …and ${errors.length - 10} more`)
  }
  console.log('[parliament-sync] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  await pg.end()

  // Exit non-zero on failure so GitHub Actions marks the run as failed
  if (!success) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('[parliament-sync] Fatal error:', err)
  process.exit(1)
})
