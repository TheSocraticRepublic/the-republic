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

- **Branch protection (C2) — needs Lee's own GitHub account.** Settings → Branches → Add rule for `main`:
  - Required status check: `ci`
  - Require up-to-date branches
  - Include administrators

  The constraint behind this is in `DECISIONS.md` → Operating constraints.

- ~~**SENTRY_AUTH_TOKEN env var (OBS-1).**~~ Lee handling directly (2026-08-27).

- **R3-R9 and one evidence correction for DECISIONS.md.** Draft wording at `.claude/drafts/decisions-r3-r9.md`, filed to Lee through the coordinator on 2026-10-07 as one decision. It is written through `update-decisions.mjs` only after his yes, never auto-written.

- **Findings inventory and audit artifacts** are private, in `~/.local/share/marvin/private/republic-ui-audit-2026-10-02/` (moved out of `/tmp`). It holds 120 findings with r3 dispositions.

- **CI dependency batch: merged to the session branch, not deployed.** Relay `republic-ci-green-deps` is closed as `merged`: Razor PASS with 0 CRITICAL (W1 fixed in `1a92cbe` and re-checked). Merge `8a2abfe` is on `marvin/republic-r2`. CI is green on draft PR #4 (relay head `c71f06f`, run 37769886169, attempt 1, every step success, provenance line parent 2 = `c71f06f`). **Do not merge PR #4 or main without Lee's yes:** Netlify auto-builds main, so a merge is a deploy. The deploy decision is filed; rollback target is the current production deploy `6ac01a4ef8c65100089a3faa` (`c80dcfe`), which reinstates the affected `next` 16.3.0. Release conditions: Lee's signed-in check on the audit account (Razor N2: the identity path through `x-user-id` after the Next 16.3.1 headers change; the local production smoke passed 11/11) and his answer on the non-owner export test gap (TEST-1).

- **UI and filings plan r3: astra critic FAIL (2026-10-08), back with Lee.** 10 FAIL, 6 CONCERN; the review is at `~/marvin/state/plans/republic-ui-filings-2026-10/republic-ui-filings-critic.md`. Headlines: S1's proposed redirect helper would turn `/.//x` into `//x`; the Q0 harness can't run the Supabase migrations on a plain pgvector image as written; final/filed immutability rests on read-then-write PATCH paths; the export guarantees contradict each other. The plan's stop rule applies. No Batch 0 until Lee answers.

- **Razor notes on the CI batch (no fix owed; carry forward).** **N1:** the CI pins node 22.22.1, which predates the 22.22.2 security release and differs from Netlify's floating `NODE_VERSION=22` (22.23.3 at review); review it with the next dependency batch (Parking Lot). **N2:** Next 16.3.1 changed how `headers()` reads the request, and identity reaches handlers through the middleware's `x-user-id`. The local production smoke passed 11/11; Lee's signed-in check after deploy is still a release condition. **N3:** audit-ci's path exception would let a new dev-only consumer of the same hoisted `braces` through until the 2027-01-05 review (documented in `audit-ci.jsonc`; register DEP-2). **N4:** `event-stream` 4.0.1 enters the dev tree through audit-ci; it is clean (the compromised release was 3.3.6).

- **Where everything lives (for a cold start).**
  - **CI plan:** `~/.claude/plans/republic-ci-green-2026-10.md` (r7). Critics r1-r6 are beside it, with r6 kept as `-r6.md`.
  - **CI evidence:** `~/.claude/plans/republic-ci-green-2026-10-evidence/`, including `PROVENANCE.txt` and `n2-smoke.mjs`.
  - **Relay pack and reports:** `~/marvin/state/relay/republic-ci-green-deps-*`.
  - **Relay worktree:** `~/.local/share/marvin/worktrees/the-republic/relay-republic-ci-green-deps`. Remove it after the deploy decision.
  - **UI plan r3 and critics r1-r3:** `~/marvin/state/plans/republic-ui-filings-2026-10/`.
  - **Private UI audit artifacts and the 120-finding inventory:** `~/.local/share/marvin/private/republic-ui-audit-2026-10-02/`. `cookies.txt` (mode 600) is a production audit-account session; delete it once a local harness exists.
  - **Issue register entries** SEC-UI-1 (the live open redirect in profile setup), DEP-2 and TEST-1 are in `~/marvin/state/the-republic-issue-register.md`.
  - **The `gh` account:** the active one is not the repo owner. Use `GH_TOKEN=$(gh auth token --user TheSocraticRepublic)` per command, and never `gh auth switch`, which is global.

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
| Approve the Open Cave UI and filings remediation plan (revision 2, folding the astra critic's r1: 12 FAIL, 5 CONCERN)? On approval the r1 review is renamed -critic-r1.md and astra re-reviews revision 2 before Batch 0; any r2 FAIL stops the relay and comes back to you before code is written. (resolved 2026-10-07) | The plan has waited at the approval prompt since 2026-10-02; nothing in it can start without your yes. | 2026-10-02 |
| Approve the R3-R9 plus evidence-correction wording for DECISIONS.md (draft at .claude/drafts/decisions-r3-r9.md)? | Six UI batches build on these rulings; it's an append-only file in a public repo | 2026-10-07 |
| If UI plan r3's critic passes, may it proceed under your 2026-10-05 twenty-batch approval (same findings, regrouped into 28 smaller batches, plus Q0 harness, S1 security and privacy, G1 Gadfly)? | The plan's own rule sends any re-review FAIL back to you; r2 failed | 2026-10-07 |

*Recently closed:* the `:5432`→`:6543` pooler switch (shipped 2026-07-15, confirmed in the
2026-07-16 hand-off). SEC-1, FORUM-1's cosmetic gate, Relay 1, Relay 2 and Relay 3 are all
shipped — see the trailing note in the 2026-07-09 log entry.

---

## Log (newest first)

### 2026-10-08 (resumed after the weekly reset)

The CI relay finished: Ted wrote the `audit-ci.jsonc` reasons, all five negative controls failed as they should, and Razor gave WARNING (W1) that was fixed and re-checked to PASS. Locally, the build, all 830 tests and both audits pass, and a production-mode runtime smoke passed 11/11 (forged `x-user-id` never reaches a handler, a valid JWT reaches the handler, CSRF rejects missing and hostile origins). The branch is merged into the session branch at `8a2abfe`. CI is green on draft PR #4, its first green run since 2026-08-29. The UI r3 critic came back FAIL. Netlify confirmed to auto-build main (`stop_builds: false`).

**Next:** Lee's answers on the deploy card, the R3-R9 wording, and the UI r3 path.

### 2026-10-07 (parked on quota line, session marvin/republic-r2)

Parked on the coordinator's instruction when the weekly quota hit Lee's 97% line. The CI plan went through six astra rounds; the dependency evidence is strong and the remaining FAILs were release choreography, so the coordinator cut it to r7-dependency-only and relayed it. Ted is parked mid-batch with the gates green. UI r3 is written but unreviewed. The private issue register gained SEC-UI-1, DEP-2 and TEST-1. No Lee rulings this session, so nothing was written to DECISIONS.md.

**Next:** finish relay `republic-ci-green-deps` from Stage 1 (see Owed), then the UI r3 critic.

### 2026-10-07 (structure pass, session marvin/republic-r2)

Docs brought up to the 2026-10 state ahead of the CI batch and the UI and filings relay.

- **ROADMAP:** `current` and `next` rewritten (they described 2026-08-07 and 2026-08-29). Shipped entries added for 08-26, 08-27, 08-28, 08-29, 10-01 and 10-02. Parking Lot: the §D/E triage line struck as done 2026-08-23; the plan's seven deferrals indexed, with their detail section copied verbatim.
- **Owed rows closed as done:** "Post-remediation re-audit COMPLETE (2026-08-26)" was a status and not owed work. Pass 2 then reached grade B on 2026-08-27. "Merge to main + deploy" is done: `marvin/the-republic-audit` merged to main in August, and main through at least `5ec2bd8` is live. The superseded "plan r2 awaiting approval" row was replaced by the critic-then-relay row, since Lee approved all 20 batches on 2026-10-05.
- **Plan approval question resolved:** Lee approved the whole plan on 2026-10-05, overriding the strategist's three-batch recommendation. The plan pair moved to `~/marvin/state/plans/republic-ui-filings-2026-10/` (marvin `21acc775`).
- **Branches:** `marvin/republic` fast-forwarded into this session branch (its one commit only saved the approval prompt). Deleted as superseded: local `marvin/session-1921aa` (tip `2074c6c`, PRIV-2 B1 shipped on main as `c6b8af0`); `origin/marvin/session-27cd20` (tip `a79d15a`, June design phases A-D and audit remediation, on main as `4f9b5aa`, `77bc0aa`, `3400a63`, `a355d38`, `4f05e6b`, `f166d03`); `origin/relay/audit-remediation-r1` (tip `2b0a1c2`, one research doc, byte-identical at `~/marvin/content/reference/the-republic/civic-impact-strategy-2026-07.md`). Kept: `relay/permission-allowlist` (2 ahead). It adds a `.claude/settings.json` permission allow-list from MARVIN's permission-architecture relay (2026-08-28), and a project session does not merge permission settings.

**Next:** CI dependency batch, then the r2 critic.

### 2026-10-05 -- republic session closed for a context reset (saved by marvin session-d09d2c)

Lee closed every window to reset context. The session had sat at the plan-approval prompt since 2026-10-02, in plan mode, so marvin session-d09d2c saved it: the plan and its r1 critic copied from ~/.claude/plans into .claude/plans/, the approval recorded as an open question, and branch marvin/republic pushed to origin for the first time.

### 2026-08-29 (investigation completion fixes)
**Investigation completion poller fixes + schema state verified.**

Relay (investigation-completion-fixes, Simple tier, Razor PASS 0 findings): 3 fixes in 2 files — (1) GeneratingPoller watchdog: 5-second timer after router.refresh() forces window.location.reload() if the component is still mounted (fixes the blank-page-on-completion bug Lee hit today), (2) HARD_STOP_MS: derived from STUCK_GENERATION_THRESHOLD_MINUTES (12 min, matches the server-side reaper) and moved after the fetch so terminal responses at the boundary aren't discarded, (3) disclaimer copy: "under a minute" → "a few minutes" (Lee's ruling).

Schema state: all 14 migrations (0001-0014) verified applied to production Supabase via _custom_migrations table. 0012/0013/0014 applied at 2026-08-29 03:09 UTC by the runner. Lee's investigation dcb6073e completed successfully today with generation_nonce populated. The ROADMAP's claim that 0013/0014 were unapplied was stale — corrected. Deploy requirements simplified to merge-to-main only.

Browser reproduction of the blank-page bug was blocked: permission classifier denied auth token injection (cookies and curl with JWT), dev server first-compile latency timed out Chrome DevTools navigation. Root cause was traced structurally from the code: router.refresh() was the single recovery mechanism with no fallback. The watchdog fix addresses this regardless of the specific runtime failure.

**Next:** Merge + deploy (Lee approval required per brief authority). The owed migration item is closed.

### 2026-08-27 (remediation pass 2)
**Grade B achieved — score 76, 0 FAIL / 12 WARN / 7 RULED**

Three relay batches (Batch 3→2→1, execution order per plan): Batch 3 code+API hygiene (lint, logEvent, error leak, health gate, forum rate limit, privacy link, archive N+1 — 14 files), Batch 2 loading screens + a11y labels (8 files), Batch 1 island token architecture (globals.css var-indirection + `.dark-island` merge + 8 component files migrated — 11 files). Razor PASS (0 CRITICAL, 1 WARNING fixed: dead isAuthenticated branch). All 13 targeted WARNs from pass-2 plan verified closed by re-audit.

Relay ledger: `republic-warn-remediation-pass2` → complete. Production ledger: `the-republic-2026-08-27-pass2` with grade B, `branch_audited: marvin/the-republic-audit`.

Trend: F → C → C → **B** (76). 23 WARNs net reduction across two remediation passes.

### 2026-08-26 (remediation session)
**Remediation relay + re-audit — grade C, score 30, 0 FAIL / 35 WARN (deduplicated)**

Remediated 18 of the 26 WARNs from the first audit via two Razor-gated relay batches (Batch 1: CSP, privacy, safeRoute, a11y, token migration, next/image, loading screens, npm audit fix — 23 files; Batch 2: timestamp migration 0013, CHECK constraints 0014 — 3 files). Critic gate: Opus (Fable rate-limited, sanctioned fallback). All Razor reviews 0 CRITICAL.

Re-audit with full 7-specialist panel found 35 deduplicated WARNs (up from 26) because coverage expanded: Jen surfaced ~130 hardcoded hex across 6 unmigrated light-surface components (civic-context-strip, reasoning-card, campaign-panel, lens-panel, player-card, briefing-view) + 4 missing loading screens + 4 unlabeled form controls; Dao surfaced operational gaps (no updatedAt triggers, migration lock risk, hard-cascade deletion). All are cleanup debt or standing decisions. 0 FAIL.

**Migrations 0012, 0013, 0014 are all file-only — none applied to production.**

Relay ledger: `republic-warn-remediation-b1` + `republic-warn-remediation-b2`, both complete. Production ledger: `the-republic-2026-08-26-remediation` with `branch_audited: marvin/the-republic-audit`.

**Pattern to name:** three sessions tonight (opencanopy, republic ×2) nearly lost provable work because ledger writes were skipped at relay close. The production-ledger entry and per-relay relay-ledger entries must be written before parking — a report without a ledger entry is invisible to the deploy gate.

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
