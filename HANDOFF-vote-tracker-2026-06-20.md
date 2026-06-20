# Hand-off: Open Cave Vote Tracker (+ session context) — 2026-06-20

A fresh session can pick up from this with no prior context. The federal vote
tracker was fully broken; **two of three root issues are fixed & deployed**, the
third (find-my-MP) is **fully diagnosed with a confirmed fix that is NOT yet
applied**.

---

## How to reach production (read this first)

- **Supabase MCP** (`mcp__supabase__*` — NOT `supabase-personal`) is wired
  directly to Open Cave's **prod** database (project `gtctqrniggcbmyyrsrnk`,
  `https://gtctqrniggcbmyyrsrnk.supabase.co`). You have `execute_sql`,
  `apply_migration`, `get_logs`, `list_tables` against prod — **no connection
  string needed.**
  - Writes (INSERT/UPDATE/DELETE/DDL) trip a destructive-SQL gate → require Lee's
    explicit approval, then `touch /tmp/cc-confirm-db-<token-from-error>` and retry.
  - ⚠️ `supabase-personal` MCP points at a *different* project ("Seedling", a
    baby-tracker). **Not Open Cave. Don't confuse them.**
- **Netlify** project `opencave` (id `18d54011-a988-4aa8-b855-fadda43c2437`),
  plan Pro, `opencave.ca`. Auto-deploys on push to `main`. Netlify CLI is not
  installed; env-var *values* are not readable via MCP.
- **No `.env`** in the worktree — prod secrets live only in Netlify.
- OpenParliament (`api.openparliament.ca`) and Represent (`represent.opennorth.ca`)
  are both public, keyless, and currently up.

---

## The incident chain — three issues, each masked the next

### 1. DB connection-pool exhaustion — ✅ FIXED & DEPLOYED
- **Symptom:** vote-tracker pages 500/502; Sentry showed
  `(EMAXCONNSESSION) max clients reached in session mode - pool_size: 15`.
- **Cause:** `src/lib/db/index.ts` set `max: 20` per warm Lambda; Supabase's
  session-mode pooler caps total clients at 15, so a couple of instances
  exhausted it. (This was one of the 2026-06-19 audit's DB FAILs.)
- **Fix:** `max: 20 → 3` (commit `3d47110`, deployed).
- **Durable fix still needed:** point `DATABASE_URL` (Netlify) at the **`:6543`
  transaction pooler** (Supabase dashboard → Database → Connection pooling →
  Transaction). `prepare: false` is already set, so it's compatible. This makes
  exhaustion impossible under load; `max:3` is only a stopgap for light traffic.

### 2. Empty `federal_mps` table — ✅ FIXED (seeded)
- **Symptom (after #1):** "no MP data available, run a sync."
- **Cause:** the in-app sync (`POST /api/parliament/sync`) is **unrunnable in
  prod** — gated at credential weight ≥ 10 (`MODERATION_THRESHOLD`), no UI
  trigger, and a full MP+bill+vote+ballot sync exceeds the serverless timeout. It
  had never successfully run (`parliament_sync_log` was empty).
- **Fix:** seeded **343 current MPs** directly via Supabase MCP `execute_sql`
  (fetched live from OpenParliament `/politicians/?limit=100`). Verified: 343
  rows, 13 provinces/territories, party split Lib 174 / Con 140 / Bloc 22 /
  NDP 5 / Ind 1 / Green 1, 0 malformed rows. Logged in `parliament_sync_log`
  (`sync_type='mps'`). Browse-MPs and the roster are now live.
- **Also committed** (not the path used, but useful): `scripts/sync-parliament-mps.ts`
  — a self-contained MP seed needing only `DATABASE_URL`.
- **Still empty:** `federal_bills`, `federal_votes`, `federal_mp_ballots` → MP
  *voting records* are blank. Needs a real background sync (see Remaining).

### 3. find-my-MP postal lookup — 🔴 DIAGNOSED, fix CONFIRMED, NOT applied
- **Symptom:** "find my MP" → "Lookup failed" (HTTP 502). Independent of the
  table — it never worked.
- **UI:** `src/components/votes/postal-code-form.tsx:34` →
  `GET /api/parliament/lookup?postalCode=...`. (There is no separate name-search
  component; the browse page filters client-side and works.)
- **Root cause — two bugs in `src/lib/parliament/represent.ts`:**
  1. **Line 24** — `lookupPostalCode` requests `?sets=federal-electoral-districts`,
     a *boundary* set, so Represent returns `boundaries_*` and **no
     `representatives_*`**. Verified empirically: with `?format=json` (no `sets`),
     `K2P1A1` returns MP **"Yasir Naqvi"** (House of Commons, Ottawa Centre,
     Liberal). `?sets=house-of-commons` returns 0 results — so the fix is to
     **omit `sets` entirely**, not change its value.
  2. **Lines 43–46** — `extractFederalMP` does
     `[...response.representatives_centroid, ...response.representatives_concordance]`.
     The correct (`?format=json`) response has a `representatives_centroid` array
     but **no `representatives_concordance` key**, so spreading `undefined` throws
     `TypeError: undefined is not iterable` → route catch → 502. Must guard both
     spreads with `?? []`.

#### The confirmed fix (apply BOTH — #1 alone still throws via #2)
`src/lib/parliament/represent.ts`:
```diff
- const url = `${BASE_URL}/postcodes/${normalized}/?sets=federal-electoral-districts&format=json`
+ const url = `${BASE_URL}/postcodes/${normalized}/?format=json`
```
```diff
  const allReps = [
-   ...response.representatives_centroid,
-   ...response.representatives_concordance,
+   ...(response.representatives_centroid ?? []),
+   ...(response.representatives_concordance ?? []),
  ]
```
Also consider marking those two arrays optional on the `RepresentPostcodeResponse`
type so TS reflects the real API.

#### Verify after applying
- Deploy, then test find-my-MP with several postal codes, **including a Québec
  one** (accent risk below).
- **Potential secondary bug to verify:** the route's name-match
  (`src/app/api/parliament/lookup/route.ts:99–113`) matches Represent's MP name to
  the DB roster by last-name equality **and** `c.name.toLowerCase().includes(firstToken)`.
  `includes()` is accent-*sensitive*. If Represent returns an accented first name
  (e.g. "François-Philippe Champagne") while the DB also has accents, it matches;
  but if either side differs in accents it will fail → 404 "MP found but not yet
  in our database." Test a QC postal code; if it 404s, normalize accents on both
  sides (`.normalize('NFD').replace(/\p{Diacritic}/gu,'')`) before comparing.
- A prior failed lookup may have cached `mpId=null` in `postal_code_cache`; the
  route re-tries when `mpId` is null, so it self-heals — but if a code misbehaves,
  delete its stale `postal_code_cache` row.

---

## Wider session context (2026-06-19 → 06-20)
- **Production audit** 2026-06-19 (`~/marvin/state/production-audits/the-republic-2026-06-19.md`):
  grade F, dominated by *untouched* accessibility (11 FAILs) + DB-infra (5 FAILs).
  The connection-pool issue above was one of those DB FAILs, now realized live.
- Also fixed this session: a rate-limit **fail-closed outage** (Upstash was never
  provisioned, so fail-closed 429'd every rate-limited route incl. login). Upstash
  now provisioned + confirmed live; set Upstash `analytics:false` and disclosed it
  as a sub-processor in the privacy policy (commit `1ea8ce2`).
- **Scope decision (Lee):** expand the beta from environmental-only to **all
  civic, municipal-first** (deepen "how cities operate"), legislative/lobbying
  vertical next; geographic depth: **complete Canada → then the US**.
  **Design-first** (plan before building). Stabilization (this DB/sync mess +
  tracked migrations + never-silently-fail) should be **Phase 0** of that design.
  Was about to enter plan mode for this when the vote-tracker fire started.
- **Staged but NOT committed** in the worktree:
  `src/components/layout/sidebar.tsx` (beta banner copy → "civic issues…"; held
  from deploy until the silent-hang fix so it doesn't over-promise) and
  `ROADMAP.md` (status updates).

---

## Remaining work (priority order)
1. **Apply the `represent.ts` find-my-MP fix** above → deploy → verify (incl. a QC
   postal code for the accent edge case).
2. **Switch `DATABASE_URL` → `:6543` transaction pooler** in Netlify.
3. **Build a real parliament background sync** (scheduled like the keep-alive,
   un-gated for ops, batched/resumable) to populate bills/votes/ballots and keep
   MPs fresh — replace or supplement the gated/timeout-bound in-app endpoint.
4. **Expansion design** (municipal-first civic; Canada→US) with **stabilization as
   Phase 0** — enter plan mode.
5. **Still open from the 06-19 audit:** IDOR in `investigate/[id]/threads`; 11
   accessibility FAILs (silent civic forms, unlabelled close buttons, unassociated
   labels); tracked migrations (the schema is `drizzle-kit push`-only); TLS
   verification on the DB connection (`rejectUnauthorized:false`); magic_codes
   purge on account deletion.
