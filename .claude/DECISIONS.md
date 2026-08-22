# The Republic — Standing Decisions

**Write rule: APPEND AND AMEND. Never rewrite, never delete.**

A decision leaves this file only by being explicitly reversed, and a reversal is written
*into* the entry it reverses — struck through, dated, with the reason. Nothing here is
removed because it looks stale, because a rewrite felt cleaner, or because the reader
doesn't recognise it. If an entry seems wrong, that is a reason to investigate it, not to
delete it.

**Why this file exists.** It was extracted on 2026-08-21 from two hand-offs that had
collided at the same path. An untracked local hand-off (`.claude/handoff.local-2026-08-07.md`)
sat beside a newer tracked upstream one written 2026-08-16; the local copy was 17 commits
behind and was found only on 2026-08-20. A routine `git checkout -f` or `git clean` would
have erased it without a trace, and with it the standing gates it was the only copy of. The
same diagnosis as the Fern near-miss applies: a hand-off that is mostly permanent content
cannot be safely rewritten, so the permanent content now lives here, where rewriting is not
a thing anyone does.

**Public repo.** This repository is public. Anything that names an unfixed weakness in
concrete, exploitable detail, or that carries an account identifier or credential, is
recorded in the private issue register instead and pointed at from here.

**Scope.** Decisions and permanent operating constraints. Not work-in-flight (that is
`.claude/handoff.md`), not scheduled-or-parked work (that is `ROADMAP.md`).

---

## Product rulings

### Forum stays Lee-gated + P2-coupled.
*2026-08-07*

URL-reachable and federating (cosmetic-lock issue from the July audit was closed with a real server-side flag in D3), but Lee has not authorized flipping it on. Tied to P2 First Light.

> Status — whether the forum has since been enabled — is tracked in `ROADMAP.md`, not here.
> This entry records only what was decided.

---

## Engineering pins

### PRIV-2 is unfixable retroactively.
*2026-08-07, amended 2026-08-16*

Raw `userId` sits inside `computeContentHash` (`bundle.ts:275`) and gets pinned to IPFS -- each new archive pin bakes in the leak permanently ~~until the code path is fixed~~. High priority given it compounds with every PDF-export/archive request.

**Amended, B1 2026-08-16 (`c6b8af0`, `5a3fe41`):** "PRIV-2 — archiver UUID removed from bundle (v1.1)". The code path is fixed, so no *new* pin bakes in the leak. The retroactive unfixability of archives already pinned before v1.1 is unchanged and stands: those hashes cannot be altered without invalidating every existing archive's integrity proof.

### RLS is structurally inert.
*2026-08-07, amended 2026-08-16*

All 101 policies key on `auth.uid()`, but the app has no Supabase Auth (`users.id` is `defaultRandom()`, sessions are jose-signed, zero `supabase-js` in `src/`) -- `auth.uid()` is always NULL. The layer would deny everything if `BYPASSRLS` were ever removed from the app role; `DR.md` "verifies" it by counting policies, which can't detect this failure class.

**Amended, C3 2026-08-16 (`bebce26`):** `docs(db): retire false RLS claim, replace policy-count check with behavioral probe (C3)`. C3 corrected the **documentation** — the DR.md claim and the check behind it — not the layer. The finding above is unchanged: the layer is still keyed to an identity domain the app does not use. Do not read C3 as having closed this.

### Migrations 0010/0011 applied directly (not via the runner).
*2026-08-16*

If the runner is re-run, it will re-apply them idempotently (all use `IF NOT EXISTS` / `IF EXISTS` guards).

### Deploy previews are now static-only — all 7 secrets narrowed to production context.
*2026-08-16*

Fork PRs cannot exfiltrate credentials.

### Next 16 `next build` doesn't run ESLint — gates must run `npm run lint` explicitly.
*2026-07-16*

CI Lint is separate. A green build is not a green lint; a Razor CRITICAL was found this way (three raw apostrophes broke the CI Lint gate while `next build` stayed green).

### Turbopack `next dev` silently drops `@theme` status/type tokens — use `next dev --no-turbopack`.
*2026-07-16*

Dev-only bug, production build is correct -- use `next dev --no-turbopack` or a preview deploy for local design QA of these tokens.

---

## Operating constraints

### The issue register is the source of truth for open work, not this file or ROADMAP's `next` field.
*2026-08-07, restated 2026-08-16*

`~/marvin/state/the-republic-issue-register.md` (private -- names unfixed weaknesses in a public repo) dedupes the two Aug-5 code-refreshes, the Aug-6 production audit, and both batch plans. Read it before picking up any Republic work.

Restated verbatim in the 2026-08-16 hand-off: "every finding deduplicated across all sources. The ROADMAP `next` field points there."

### Citizen data has no backup.
*2026-08-07, amended 2026-08-16*

Supabase is confirmed on the free plan: no automated backups, no PITR, for investigations, briefings, FOI drafts, and ActivityPub private keys. Lee-owned (dashboard upgrade to Pro + PITR).

**Amended, B5 2026-08-16:** a manual `pg_dump` was taken for the migration work (`/tmp/republic-pre-migration-backup-20260813/`). That is a one-off snapshot, not a backup regime — the constraint above still stands. Pro (~$25/mo) is the right fix before real users. Account + project ref: see the private issue register.

### Branch protection on `main` still not enabled.
*2026-08-07*

CI is green (as of 85fafc9) but the session token has no admin scope -- `enforce_admins` needs to be set from Lee's own GitHub account. Direct pushes to main remain possible with no gate. The click-path and its trade-off are in `.claude/handoff.md` → Owed right now.

### CSP is Report-Only; the enforce flip requires a browser walk first.
*2026-08-16*

CSP is delivered from middleware as `Content-Security-Policy-Report-Only`. It is not flipped to enforce until every surface has been walked in Chrome DevTools with zero violations; the flip itself is one line, `src/middleware.ts:19`. The walk checklist and the known print-page wrinkle are parked in `ROADMAP.md` → Parking Lot.

### JURIS-2 (AB/ON FOI citation practitioner review) needs a human, not a model.
*2026-08-07*

Flagged explicitly in ROADMAP as non-delegable to Ted/Razor.

---

## Evidence corrections

### PDF export 500s on every request — all 9 font URLs 404'd since Google Fonts dropped its static dir.
*2026-08-07, resolved 2026-08-16*

~~Batch B0/B1 (PDF export 500s on every request -- all 9 font URLs 404'd since Google Fonts dropped its static dir; this compounds PRIV-2 since every archive is pinned)~~ **Resolved, B0 (`d25f116`):** fonts vendored. The durable lesson is the one the audit named: zero PDF test coverage is why a hard-broken export shipped, and an external asset host silently changing its layout is a failure mode this repo has now met once.

### GitHub Actions schedules auto-disable after 60 days of repo inactivity.
*2026-08-07*

The internal keepalive rides GitHub Actions, whose schedules auto-disable after 60 days of repo inactivity -- an external monitor severs that coupling. Named as residual risk after the Aug-6 incident fix.

### Upstash Redis free tier DELETES an idle database rather than suspending it — and a health check that only probed Postgres stayed green throughout.
*2026-08-06, logged 2026-08-07*

Upstash Redis was deleted by the provider after 14 days idle (free-tier deletes, not suspends) -- auth returned 500 on every rate-limited route while `/api/health` stayed green because it only checked Postgres. Fixed with fail-closed guards + a real Redis probe in health + 10-min keepalive cadence so the idle-delete timer can't restart.

Two corrections live here, not one: a free tier may *delete*, not merely pause; and a health check that does not exercise the dependency the routes use cannot go red for it. The keepalive now performs a real Redis round-trip so the idle-delete timer cannot start.
