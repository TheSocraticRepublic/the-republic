/**
 * One-off MP seed for the federal vote tracker.
 *
 * Why this exists: the in-app sync (POST /api/parliament/sync) can't be run in
 * production — it's gated behind credential weight >= 10, has no UI trigger, and
 * a full MP+bill+vote+ballot sync exceeds the serverless function timeout. So a
 * freshly deployed prod has an empty federal_mps table and the vote tracker shows
 * "no MP data available." This script populates federal_mps directly: no timeout,
 * no credential gate, no auth.
 *
 * Self-contained (own pg client, max:1) so it needs ONLY a DATABASE_URL and does
 * not drag in `server-only` / the full env-schema validation. Mirrors the MP-sync
 * logic in src/lib/parliament/sync.ts.
 *
 * Run with the prod connection string (the :6543 transaction pooler is ideal but
 * any works — max:1 won't strain the pool):
 *
 *   DATABASE_URL='postgresql://...pooler.supabase.com:6543/postgres' \
 *     npx tsx scripts/sync-parliament-mps.ts
 *
 * Idempotent: re-running upserts by oparl_slug. Populates MPs only — bills/votes
 * are a separate, heavier sync (see ROADMAP: parliament sync needs a background job).
 */
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import { federalMps } from '../src/lib/db/schema'
import { fetchCurrentMPs } from '../src/lib/parliament/client'
import { extractSlug } from '../src/lib/parliament/types'

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error(
      'DATABASE_URL is required. Use the prod connection string, e.g.\n' +
        "  DATABASE_URL='postgresql://...pooler.supabase.com:6543/postgres' npx tsx scripts/sync-parliament-mps.ts"
    )
    process.exit(1)
  }

  const client = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    ssl: { rejectUnauthorized: false },
  })
  const db = drizzle(client)

  console.log('Fetching current MPs from OpenParliament…')
  const rawMps = await fetchCurrentMPs()
  console.log(`Fetched ${rawMps.length} MPs. Upserting into federal_mps…`)

  let upserted = 0
  for (const mp of rawMps) {
    const slug = extractSlug(mp.url)
    const party = mp.current_party?.short_name?.en ?? 'Unknown'
    const ridingName = mp.current_riding?.name?.en ?? 'Unknown'
    const ridingProvince = mp.current_riding?.province ?? 'Unknown'
    const photoUrl = mp.image ? `https://openparliament.ca${mp.image}` : null
    const metadata = {
      memberships: mp.memberships,
      otherInfo: mp.other_info,
      links: mp.links,
    }

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
          photoUrl,
          active: true,
          metadata,
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(federalMps.id, existing[0].id))
    } else {
      await db.insert(federalMps).values({
        oparlSlug: slug,
        name: mp.name,
        party,
        ridingName,
        ridingProvince,
        email: mp.email ?? null,
        photoUrl,
        active: true,
        metadata,
        lastSyncedAt: new Date(),
      })
    }

    upserted++
    if (upserted % 50 === 0) console.log(`  …${upserted}/${rawMps.length}`)
  }

  console.log(`\nDone. ${upserted} MPs upserted into federal_mps.`)
  await client.end()
}

main().catch((err) => {
  console.error('MP sync failed:', err)
  process.exit(1)
})
