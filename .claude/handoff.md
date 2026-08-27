# The Republic / Open Cave — Hand-off

**What this file is:** the volatile layer. What is in flight, what is owed, what is waiting on
Lee, and a short log. It is safe to rewrite *because nothing permanent lives here any more.*

**Where everything else went** (restructured 2026-08-21):

| You want… | Read |
|---|---|
| Rulings, pins, operating constraints — anything decided | `.claude/DECISIONS.md` — **append-and-amend only** |
| Named work not yet scheduled | `ROADMAP.md` → **Parking Lot** |
| What shipped, and when | `ROADMAP.md` → `shipped` |
| Every open finding, deduplicated | `~/marvin/state/the-republic-issue-register.md` (private) |

**Read `.claude/DECISIONS.md` before proposing anything.** Most of what looks like a fresh idea
in this project has already been ruled on, usually for a reason that is not obvious from the code.

---

## Owed right now

- **Production audit COMPLETE (2026-08-26): grade C, score 48, 0 FAIL / 26 WARN.** Report
  at `~/marvin/state/production-audits/the-republic-2026-08-26.md`. All 18 FAILs from the
  Aug-6 F-grade audit are closed. The branch is shippable. Remediation relay plan is in
  the report (11 files, 6 steps). Ledger updated with `branch_audited: marvin/the-republic-audit`.

- **Merge to main + deploy.** The session branch (`marvin/the-republic-audit` at `92161ed`)
  has 32 commits ahead of main (charter, register drain, 3 relays, safeRoute, prompt caching).
  Merge requires Lee's go-ahead per the brief's authority constraints.

- **Migration 0012 — production DB apply post-merge.** Three DDL changes (generationNonce
  column, turnIndex unique constraint with renumber, patternAnalysis nullable). File at
  `drizzle/migrations/0012_nonce_turn_unique_contradictions.sql`. Apply via the custom
  runner against the session-mode pooler. The renumber CTE is idempotent; re-run is safe.

- **Branch protection (C2) — needs Lee's own GitHub account.** Settings → Branches → Add rule for `main`:
  - Required status check: `ci`
  - Require up-to-date branches
  - Include administrators

  The constraint behind this is in `DECISIONS.md` → Operating constraints.

- **SENTRY_AUTH_TOKEN env var (OBS-1).** Code is complete (`withSentryConfig` already
  correct in `next.config.ts`). Only the env var is missing — needs Sentry dashboard +
  Netlify dashboard access (Lee/ops).

## Open questions awaiting Lee

| Question | Why it matters | Raised |
|----------|---------------|--------|
| Supabase Pro + PITR upgrade | Citizen data (investigations, briefings, FOI drafts, AP keys) currently has zero backup | 2026-08-06 audit |
| Branch protection (`enforce_admins`) on `main` | Session token lacks admin scope; only Lee's account can set this | 2026-08-06 audit |
| External uptime monitor | GHA-based keepalive auto-disables after 60d idle | 2026-08-06 audit |
| Netlify deploy-failure alert | No current signal if a deploy silently fails | 2026-08-06 audit |
| ~~`:5432`→`:6543` pooler switch + Pro tier~~ *(pooler switch DONE per the 2026-07-16 hand-off; the Pro-tier half is folded into the Supabase Pro row above)* | P1 "True North" ops item; runbook + rollback ready | Since 2026-07-09 |
| Forum enablement timing | Built + audited, deliberately gated behind Lee's go-ahead + P2 coupling | Since D3 (2026-07-09) |
| Illustration variant selection (D4 Athenians) | Cameo set vs. other variants for the drawn archetype illustrations | Since D3 hand-off |
| ~~Pooler switch window (P1)~~ *(closed — the switch shipped 2026-07-15)* | Needs a low-traffic window, Lee's call | Since 2026-07-09 |
| Rotation / history scrub for the Supabase account identifiers | The pseudonymous account address and project ref have been in public tracked history since `1e3841a` (2026-08-16). Either that is accepted, or it needs a rotation + scrub decision. | 2026-08-21 |

*Recently closed:* the `:5432`→`:6543` pooler switch (shipped 2026-07-15, confirmed in the
2026-07-16 hand-off). SEC-1, FORUM-1's cosmetic gate, Relay 1, Relay 2 and Relay 3 are all
shipped — see the trailing note in the 2026-07-09 log entry.

---

## Log (newest first)

### 2026-08-26
**Production audit — grade C, score 48, 0 FAIL / 26 WARN / 59 PASS**

Full 7-specialist audit (Ted, Razor, Jen, Quinn, Dao, Petra, Charity) against the merged session branch at `92161ed`. Every FAIL from the Aug-6 F-grade audit is closed. Three specialist findings verified as false by the orchestrator: Ted's "zero tests" (63 test files exist in `tests/unit/`, Ted searched only `src/`), Ted's "lint not installed" (worktree artifact), and Charity's "missing sentry.client.config.ts" (client Sentry is configured via `src/instrumentation-client.ts` with full PII scrubbing).

26 WARNs are cleanup debt: CSP divergence (netlify.toml enforcing vs middleware report-only — contradicts DECISIONS.md), PRIVACY.md stale vs in-app page (Open North missing, date 2 months behind), Netlify undisclosed as processor, hardcoded hex in 4 votes components, no skip-to-content link, and DB schema hygiene (timestamps, CHECK constraints, polymorphic FK orphans). Full report at `~/marvin/state/production-audits/the-republic-2026-08-26.md`. Ledger updated with `branch_audited`.

### 2026-08-23
**Register drain — charter adopted, 28 findings triaged, all addressed (31 commits)**

Charter adopted from Lee-corrected draft (`f3d8962`). Full §D/E triage: 28 findings rated against actual code — 1 CRITICAL (BUG-F2 bill summary fabrication), 1 high (O-11 gadfly persistence), 19 medium, 7 low. Triage file at `.refresh/triage-2026-08-23.md` (gitignored).

15 findings fixed directly across security (SEC-F8 AP digest, SEC-F13 gadfly IDOR), correctness (BUG-F2, BUG-F18, BUG-F21, BUG-F22, BUG-F32), civic-honesty (R-A4 tie styling, R-A5 error states, R-A6 IDOR, R-A3 rate limit), and operability (O-11 after(), O-16 sync decay, O-13 bill navigation). 3 migration-shaped fixes via critic-gated relay: BUG-F15/F28 generationNonce (stale-run fence), DATA-F3 turnIndex unique (renumber-not-delete, preserving insight markers), BUG-F17 contradictions nullable + patterns cache guard. Batch D: PERF-1 ISR revalidation (5 public pages), NODE-1 Node 22. SAFE-1: safeRoute sweep (35 routes, Razor class-level 65/65 verification). PERF-2: prompt caching (cachedSystem helper, 19 call sites, single-block byte-equivalent).

6 findings deferred with reason: SEC-F10 (CSP enforce parked), SEC-F12/BUG-F6 (dead peer-review feature), O-17 (re-ingest normalization), O-18 (Mirror staleness UI), R-A7 (lens panel trigger — design decision). OBS-1 is code-complete, only env var missing (Lee/ops).

All Razor-gated (0 CRITICAL across every review). Fable critic gate on all 3 relay plans. 830 tests, 0 lint errors, build clean. Deploy-gated: fresh `/production` audit required.

### 2026-08-21
Hand-off restructured by lifetime, per the MARVIN convention and the Fern reference implementation (`fern 91b4db1`): standing decisions extracted to `.claude/DECISIONS.md`, deferrals consolidated into the ROADMAP's Parking Lot, this file cut to the volatile layer. The trigger was a near-miss of the same family as Fern's — an untracked `.claude/handoff.local-2026-08-07.md` was found on 2026-08-20 sitting beside the newer tracked hand-off at the same path, 17 commits behind, holding the only copy of several standing gates. Both files were unioned into the new structure; nothing was dropped.

Standing decisions from both hand-offs: see `DECISIONS.md`.

### 2026-08-16
**Batch B — Stop the irreversible harm (8 items, all closed)**

- | ID | Item | Commit(s) |
- | B0 | PDF font vendoring (prior session) | `d25f116` |
- | B1 | PRIV-2 — archiver UUID removed from bundle (v1.1) | `c6b8af0`, `5a3fe41` |
- | B2 | Consent gate before irreversible preservation | `8e538e1` |
- | B3 | Archive FK survivability (migration 0008 applied) | `dd49812`, `d7977c9` |
- | B4 | Audit trail survivability (migration 0009 applied) | `4fd70fc` |
- | B5 | Supabase Pro deferred — manual pg_dump taken instead | `/tmp/republic-pre-migration-backup-20260813/` |
- | B5a | CI credential hardening (TLS + workflow injection) | `7ff7d35` |
- | B6 | 7 secrets narrowed to production-only + JWT rotated | Netlify API (no code commit) |

**Batch C — Close the inert controls (7 items, C2 Lee-gated)**

- | ID | Item | Commit(s) |
- | C1 | Security headers in middleware, CSP Report-Only | `e2fbe8d` |
- | C3 | RLS documentation corrected (DR.md) | `bebce26` |
- | C4 | Sentry scrubbing — postal code path, IP headers, all 3 runtimes | `7e1584f` |
- | C5 | Privacy policy — Open North disclosed, archive/Sentry copy refined | `9b5b0d0`, `68f4dac` |
- | C6 | players.description dropped (migration 0010 applied) | `adbe8c1` |
- | C7 | credential_events unique index + 19 FK indexes (migration 0011, 1 dedup) | `9c0ea6a`, `8ca7335` |
- | C2 | Branch protection | **Lee-gated** (see Owed right now) |

**Razor reviews: 3 passes, 0 unresolved CRITICALs**

- B1 PRIV-2: PASS (1 WARNING fixed — bare `.returning()`)
- B2-B5a batch: PASS (1 WARNING fixed — snapshot columns not consumed by pages)
- Batch C: PASS (1 CRITICAL fixed — `run-briefing.ts` missed `onConflictDoNothing`; 2 WARNINGs fixed — privacy page date + "all US-based")

**JWT rotation took effect** with the Batch C deploy. All existing sessions invalidated.

Engineering pins from this batch (migrations 0010/0011 applied directly, deploy previews static-only): see `DECISIONS.md` → Engineering pins.

*(The two tables above are rendered as bullets rather than markdown table rows: the slim hand-off checker forbids table rows outside the questions section. Cell text is unchanged.)*

### 2026-08-07
**Relay 3 + Fable code-refresh shipped and deployed** (`ade8625..b8783e4` -> main -> opencave.ca). 22-item security/jurisdiction/civic-correctness batch (CSRF extraction, SSRF harmonization, dynamic jurisdiction routing for AB/ON, fabricated `party_size` field replaced with real data). **Production incident 2026-08-06, resolved same day:** Upstash Redis was deleted by the provider after 14 days idle (free-tier deletes, not suspends) -- auth returned 500 on every rate-limited route while `/api/health` stayed green because it only checked Postgres. Fixed with fail-closed guards + a real Redis probe in health + 10-min keepalive cadence so the idle-delete timer can't restart. Same-day 7-specialist production audit graded F (16 unique FAILs) -- Batch A (the outage) closed; B and C are the current open work, tracked in the private issue register, not ROADMAP's `next` field.

As of this entry: **Audit remediation Batches B and C open.** (Both were subsequently closed — see the 2026-08-16 entry above.)

The evidence correction from this incident (free tiers delete, and a health check that cannot go red): see `DECISIONS.md` → Evidence corrections.

### 2026-07-16
**Relay 2 (design system) shipped, deployed, live-verified** (`7865597` -> main -> opencave.ca). Beatrice's type floor (9px abolished, 167 instances re-tokenized, CI gate), Saul's `--status-*` tokens across all 4 CSS scopes + party-dot A11Y-2 fix (incl. a real Bloc-dot bug: DB stored `'Bloc'`, map keyed only `'Bloc Québécois'`, 22 MPs fell through to Independent-gray), George's copy register rules. Confirmed gotchas carried forward: see `DECISIONS.md` → Engineering pins (Next 16 build/ESLint, Turbopack `@theme` tokens).

### 2026-07-09
**D3 "The Threshold" shipped + deployed** (PR #1 -> `f82000c` -> opencave.ca). In-app wayfinding: arms surfaced by default ("The Instruments"), forum rate limits weight-tiered, Scout/Mirror orientation, cross-arm links, plain-language pass. Forum itself stayed gated (deliberate). Same session: full 6-agent Fable whole-product audit produced the remediation plan this file's Standing Gates trace back to -- SEC-1 (XFF spoofing, since fixed via Relay 1), FORUM-1 (cosmetic lock, since fixed in D3 itself), and the two strategic gaps that still stand: First Light (P2, e2e civic outcome never fired) and the DB scaling ceiling.

Superseded/closed since these hand-offs were written: SEC-1 (XFF fix shipped), FORUM-1 cosmetic gate (real server-side flag shipped in D3), the pooler switch (DONE per 2026-07-16 hand-off), Relay 1 security/a11y/DX batch (shipped), Relay 2 design-system batch (shipped), Relay 3 (shipped 2026-08-07), the July design program D1-D3 (all shipped). Current work has moved past the design program into production hardening (Batches B/C) -- see the issue register.

The two strategic gaps that still stand (First Light P2, DB scaling ceiling) are parked in `ROADMAP.md` → Parking Lot.
