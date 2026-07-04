---
status: current
current: "Design program (July 2026) — D1 The Grammar SHIPPED (2026-07-04); D2 The Ascent flagship now unblocked (light-rendering mechanism proven + handover contract written). Production grade C (0 FAIL, ~21 WARN)."
next: "D2 The Ascent (flagship landing redesign — design direction approved 'documents are the light', Stage 0 spec locked, D1 handover contract ready; go straight to /relay on .claude/plans/republic-d2-ascent.md) + P1 True North (ops with Lee: :5432→:6543 pooler switch per republic-p1-pooler-runbook.md, branch protection, DATABASE_URL GHA secret + sync-parliament cron; plus the deferred engineering tail). Charters: .claude/plans/opencave-design-program.md."
testing: null
pinned: true
shipped:
  - date: 2026-07-04
    item: "D1 'The Grammar' — design-system foundation, first phase of the July 2026 design program. Relayed (Ted → Razor PASS → Jen PASS) and merged to main. Core: converted `@theme {}` → `@theme inline {}` in globals.css so nested scopes can override tokens at the point of use (Razor verified byte-identical dark rendering by compiling the CSS through the Tailwind v4 PostCSS pipeline, not just trusting the build); shipped an inert `.light-scope` class + the `.claude/plans/republic-d1-handover.md` contract that unblocks D2's dark→light landing (mechanism proven on a throwaway spike, no route-group split needed). Plus: three shared UI primitives (EmptyState, StatusPill, CTAButton) adopted across arm pages (Jen: pixel-faithful, foundation-worthy); theme doctrine 'dark where you work, light where you read' codified in globals.css + ARCHITECTURE.md + CLAUDE.md (and a Razor-caught doc error fixed: reading surfaces get light paper from briefing-view's LIGHT_PALETTE + .content-island, NOT `.dark-island` which is a dark Gadfly overlay); token-drift sweep (hardcoded arm-accent hex/rgba → CSS vars, ~14 files); debris removed (5 template SVGs, hero.tsx dev toggle, demo light-utility). Build + 652 tests + lint green; landing visual smoke byte-identical to prod. 35 files. Note: Ted's agent hit a stream-watchdog stall AFTER committing all work but before self-reporting — verification was reconstructed by the orchestrator. Follow-ups logged to the program backlog: primitive adoption sweep (many hand-rolled instances remain, → before/during D2) and provenance-chain token migration (→ D5)."
  - date: 2026-06-28
    item: "WARN-backlog cleanup + grade redesign + monitor fix → production F→C (0 FAIL). (1) DEPLOY RECOVERY: the 06-27 remediation relay's first push silently shipped only 5/30 files (a git-stash step unstaged the tracked files); a re-audit caught it; recovered (b79924e) + fixed 2 genuine a11y FAILs it surfaced (post-composer role=alert, discovery-form labels) + a privacy factual error (5020bdb). Migration 0006 applied to prod via MCP + verified (feedback FORCE-RLS, FK CASCADE). (2) BACKLOG-CLEANUP relay (relay/opencave-backlog → db62b5e + 593aadb), 14 items: AP signatures require `date` in signed-headers; getClientIp() helper across 6 routes; migration 0007 NULL-safe CHECK constraints (satisfaction 1–5, quorum 0–1) applied to prod + verified; magic_codes send-path wrapped in a transaction + expired-code purge added to the reaper (confirmed firing — table now empty); N+1 ballot queries batched (inArray+Map) in letter + investigate/votes; html-to-image lazy-loaded; arm-hex token-drift → CSS vars; in-app /privacy synced to PRIVACY.md (+ Your Rights, retention); safeRoute on the 4 hot AI routes; CI audit gate critical→high (HIGHs cleared); GHA action versions aligned to v6; rollback runbook in DR.md. Razor PASS; a re-audit caught 3 cleanup-introduced issues (magic-code rate-limit window regression, verifyMagicCode double-redeem race, doc drift) — ALL fixed + Razor-re-verified before grading. Build + 652 tests green; deploys file-count-verified (no stash — lesson logged). (3) MARVIN-SIDE (not in this repo): production grade rubric redesigned FAIL-driven (0 FAIL ⇒ floor C; WARNs shade A/B/C) + monitor production-tab join hardened to key off the structured audit id (was mis-bucketing the-republic by display name → showing a stale grade). Net: 0 FAIL; remaining ~21 WARN are all ops (Lee) or named deferrals. Reports: ~/marvin/state/production-audits/the-republic-2026-06-28-cleanup.md."
  - date: 2026-06-28
    item: "Post-audit remediation relay (relay/opencave-remediation) — full /production audit (06-27, 7 specialists: 76 PASS / 40 WARN / 9 FAIL; report at ~/marvin/state/production-audits/the-republic-2026-06-27.md; all 5 prior FAILs verified fixed; the 0/F is the scoring floor, not a regression) → critic-reviewed, probe-verified remediation plan → relay (Ted→Razor PASS→fix→Razor re-review PASS→Jen). Closes all 9 FAILs + coupled WARNs: WS1 feedback-table RLS — new idempotent migration 0006 (ENABLE+FORCE RLS, select/insert-own policies on auth.uid(), FK SET NULL→CASCADE keeping the column nullable), schema.ts onDelete→cascade, account-delete wrapped in a transaction (closes orphan-on-crash); WS2 migration coherence — `scripts/apply-custom-migrations.ts` idempotent runner (per-file `_custom_migrations` tracking, atomic DDL+tracking, ALTER-TYPE-autocommit detection) + `db:migrate-custom` script + `drizzle/DR.md` documenting the two-layer DR model (drizzle journal intentionally tracks only 0000; custom RLS/HNSW/policy layer via the runner; Supabase-flavored substrate required), 0001 hardened idempotent; WS3 accessibility — 5 FAILs fixed (2 unlabelled selects→useId-paired, post-composer textarea aria-label, 2 toggle groups role=group+aria-pressed, scout discovery-form error state+role=alert) + dark-mode contrast remediation per Jen spec (--text-faint→#83838c, --accent-lever→#DA6E6E both .dark/.dark-island, focus ring→75% oracle, freshness-badge + review-section→--text-muted, 3 surface-3 MP-avatar fallbacks escalated to --text-muted) + arm-hex→CSS-var token-drift cleanup; WS4 landing perf — removed `unoptimized` so Netlify serves WebP/AVIF+srcset (637KB raw-JPEG LCP); WS5 PRIVACY.md — postal-code disclosure, feedback in deletion scope, Data Retention section; WS6 security — AP inbox isNaN(Date)→401 (replay-window bypass, extracted to a tested pure helper + 9 unit tests) + `npm audit fix`/`overrides:{ws}` clearing both HIGH vulns (audit --audit-level=high now clean). Verified: build green, 651 unit tests (+10), Razor PASS (0 critical, audit clean), Jen PASS, prod boundary respected. REMAINING (Lee-gated): apply ONLY migration 0006 to prod directly via Supabase MCP (NOT the runner — prod was push-applied so the runner would re-apply 0001–0005); probe confirmed prod at 0005-equiv, feedback FK=feedback_user_id_fkey, app role `postgres` has BYPASSRLS (FORCE RLS is a no-op for app writes — 6 investigations exist under FORCE-RLS proves it), feedback 0 rows (cascade change lossless today). Plan+critic+probe at .claude/plans/opencave-remediation-2026-06-27{,-critic,-probe}.md. DEFERRED to next pass (named in the audit): safeRoute sweep (41 routes), CSP nonce, middleware→proxy rename, reap-investigations auth (scheduled-fn — secret check would kill the cron), N+1 ballot batching, CHECK constraints, actor_keys envelope encryption, magic_codes purge job, PIPEDA access/export endpoint. OPS (Lee/dashboard): :5432→:6543 pooler, DATABASE_URL GHA secret + sync-parliament cron, branch protection on main, confirm Supabase Pro tier."
  - date: 2026-06-27
    item: "Foundations — navigable table of contents on all five papers. Roman-numeral TOC inserted after each abstract; IDs added to every h2/h3 for anchor linking; Sources entry omits a numeral. Styled to the existing dark/gold longread aesthetic (Cormorant Garamond labels, Crimson Pro entries, gold hover). Pushed to main (prod)."
  - date: 2026-06-26
    item: "\"The Examined Record\" design elevation — multi-phase editorial redesign, relayed (Ted→Razor→fix) and pushed to main (prod). PHASE A (three-register font system): replaced Plus Jakarta Sans + Inter with Fraunces (display), Instrument Sans (UI body), Source Serif 4 (editorial), Geist Mono; new @theme tokens + .section-heading utility + font-optical-sizing; zero remaining Plus Jakarta Sans refs across 57 files (web inline fontFamily removed, PDF templates + print routes + DISPLAY_FONT constants all migrated to Instrument Sans). PHASE B (Oracle): SectionShell card-per-section → editorial border-top section-heading rule across AnalysisView (Plain Summary, Key Findings, Power Map, Hidden Assumptions, Questions); numbered mono indices, Source Serif 4 prose, border-l accent quotes; all hardcoded #89B4C8 → var(--accent-oracle). PHASE C (Gadfly): chat-bubbles → editorial Socratic format (questions full-width font-serif italic with 3px accent border, type annotation as right-aligned marginalia, citizen responses font-serif on subtle surface); .investigation-thread vertical thread line connecting Briefing→Lens→Campaign→Civic Context; epigraph moved above ConcernForm. PHASE D + token cleanup: MP card heading → Fraunces; briefing ProseSection → Source Serif 4 throughout; new --accent-votes (#D4764E) token; all hardcoded arm accent hex replaced with CSS vars + color-mix() across 49 files. V2 PASS: per-arm environment tints (4% color-mix on all 13 arm pages), shared ArmHeader component replacing icon badges, sidebar active state arm-tinted, section headings returned to Instrument Sans to reduce font switching, document-card rendering fixed (splitDocumentBlocks regex now recognizes bullet-prefixed document names). LOGIN: Fraunces wordmark + Source Serif 4 italic tagline/footer. Supporting render fixes folded in: votes pages now parse AI markdown via shared MarkdownProse/SectionedMarkdown (06-24; ## headings/**bold**/bullets were rendering raw), Key Players parser filters AI-emitted `---` separators (was rendering empty cards), Razor Phase-A findings (Instrument Sans capped at 700 — no ExtraBold; dead DISPLAY_FONT constants removed; briefing-view indentation). Build clean, 612 tests green at Phase A. NOTE: the 06-24 markdown-parse fix likely covers the prior ROADMAP backlog item flagging the MP voting-patterns readout as needing formatting — worth a visual confirmation before striking it from the backlog."
  - date: 2026-06-23
    item: "Briefing redesign v0.3.0 (renderer + prompt) — shipped to prod after Lee's V1 review. Jen design spec (state/relay/briefing-redesign-jen-spec.md) → relay (Ted→Razor→fix). PROMPT (briefing-system.ts v0.3.0): dropped the duplicate `## Your Concern` for a `# Title` + `## Context`; reordered sections (Context→What Governs This→Key Players→Public Record→What You Can Do→Other Places→Questions→Limitations); two-tier `What Governs This` (Primary Authority + compact supporting docs); anti-repetition rules; stopped emitting `---` separators + markdown links (plain-text URLs). RENDERER (briefing-view.tsx): parse `# Title`; extended renderInline (`*italic*`, `[text](url)`→text, no more `#`-stripping that ate civic refs like `s. #4`, graceful bold/italic nesting); block preprocessor (`###`→subheading `<h4>`, standalone `---`→`<hr aria-hidden>`); two-tier DocumentCard; gap/insight callouts; ExecutiveCard became a nav+action hub (no concern restatement); Source Serif 4 pulled from analysis prose; dark-mode bg fixes; a11y (h4 subheadings, h1 margin reset). Razor WARNING (no CRITICAL) — 4 warnings + notes all fixed in 2.5. 641 unit tests green (19 new for renderInline/preprocessBlocks), next build green, prompt structure verified live (Granby regenerated: `# Title`+`## Context`+Primary Authority). Visual confirmation: Lee. Kept: Key Players cards, Questions, FIPPA card, Limitations, GoDeeper."
  - date: 2026-06-23
    item: "Investigation-timeout DURABLE FIX — shipped to prod (opencave.ca) + verified end-to-end. Root cause: briefing generation ran synchronously in the request and died in Netlify's ~26s pre-stream window (a hard timeout-kill bypassed onError/onFinish, leaving the row zombie until the render-reaper). Rebuilt as: POST /api/investigate inserts the row + awaits a 202 trigger to a Netlify Background Function (15-min budget) + returns; client redirects to /investigate/[id] which polls GET /api/investigate/[id]/status (3s, 5-min hard stop) via a GeneratingPoller; generation extracted into the shared framework-agnostic src/lib/investigation/run-briefing.ts (non-streaming generateText + 240s AbortSignal + real failureReason capture; post-completion shadow/vote isolated); a scheduled cron reaper (*/5) + the render reaper key on a new generation_started_at column (migration 0005) at a shared 12-min threshold (also fixed a latent bug that reaped freshly-retried rows). Relay pipeline (Ted→Razor→fix, plan+16-dim critic at .claude/plans/bubbly-percolating-newt.md). Razor caught + fixed 2 CRITICALs pre-deploy: server-only crash in the plain-Node function bundle (de-guarded db/env/scout-search), invalid INTERVAL-$1 reaper SQL (→ ::interval). LIVE debugging (Netlify) then resolved, in order: middleware was 403/307-ing the internal trigger (excluded /.netlify/ from the matcher); Netlify background functions REQUIRE the `-background` filename suffix to actually execute the handler (config.background alone only 202-registers it — renamed generate-briefing.mts → generate-briefing-background.mts + updated trigger path); and the real blocker — INTERNAL_TRIGGER_SECRET was never persisted (an is_secret+context=all upsert silently no-op'd) so the fn 401'd every trigger. Set the secret (functions scope), applied migration 0005 to prod, confirmed NEXT_PUBLIC_APP_URL=https://opencave.ca serves 200 (no apex→www POST-body drop). Verified: the Granby investigation that failed at session start now completes (status=complete, 17,838 chars, ~99s). Build/lint/622 tests green; both fn bundles server-only/next-free; reaper SQL ::interval via PgDialect. FOLLOW-UPS: INTERNAL_TRIGGER_SECRET is currently is_secret:false (dashboard-visible, not browser-exposed) — can be hardened to a per-context secret; sibling AI routes (oracle/gadfly/lever) share the original synchronous-timeout exposure (deferred)."
  - date: 2026-06-21
    item: "Pre-launch hardening sprint W1–W5 — shipped to prod deploy-as-you-go (each wave: Ted-built → independent-subagent-verified → pushed to main as TheSocraticRepublic → live-smoke-tested across the build window, rollback-pinned; CI green every push). W1 — federal vote tracker made whole: background sync (scripts/sync-parliament-full.ts + GHA workflow; per-entity idempotency, ballot-based resume cursor, --dry-run, parliament_sync_log every run) backfilled DIRECTLY to prod = 173 votes / 59,092 ballots / 343 MPs live (Razor PASS ×2 + go/no-go verifier). W2 durable DB: CA-pinned TLS (real Supabase Root 2021 CA, verified against the live pooler on :5432 AND :6543 with rejectUnauthorized:true — closes the MITM FAIL without breaking the pooler), HNSW cosine ANN indexes on document_chunks + jurisdiction_policies (was seq-scan), tracked extension/index migration (0002) + drizzle baseline (0000). W3 audit FAILs: IDOR in investigate/[id]/threads owner-scoped (was readable by any authed user via UUID guess), 11 a11y fixes (role=alert on 4 civic forms + login, aria-label on icon closes, htmlFor/id label pairs), magic_codes PII purged on account deletion + delete rate-limited, CI Node→20 parity. W4 — fix for a LIVE-broken core feature (every new investigation was silently zombie-ing): status state machine (generating/complete/failed/cancelled) + onError/onFinish terminal guards + 5-min reaper + cancel/retry/delete endpoints + status-aware UI + browser-local-tz date fix; migration (0003) reclassified existing rows; verification caught a cancel-race-double-credential bug pre-deploy. Lee's 3 stuck investigations cleared at his request; 2 completed ones intact. W5 — bug/suggestion feedback channel: feedback table (0004, timestamptz) + auth+rate-limited POST /api/feedback + a11y-clean sidebar dialog. Plan + critic at .claude/plans/staged-puzzling-whisper.md."
  - date: 2026-06-19
    item: "Pre-launch hardening — login outage diagnosed + fixed (free-tier Supabase auto-paused → DNS dropped → all DB routes 500'd; restored, hand-off doc at state/production-audits/the-republic-2026-06-18-login-outage.md), DB-aware /api/health (SELECT 1 → 503) + monitor production-tab beacon repointed + twice-weekly keep-alive workflow so it can't silently recur; full 7-specialist production audit (grade F, report at state/production-audits/the-republic-2026-06-18.md); P0 remediation shipped — privacy/PIPEDA (in-app /privacy page linked from landing/footer/login, Anthropic/Voyage/Resend/Sentry + US-residency disclosure in PRIVACY.md, untracked analytics removed, Sentry PII-scrubbed via beforeSend, self-service account deletion at DELETE /api/account), rate limiting now FAILS CLOSED in production — this shipped before Upstash was actually provisioned, so every rate-limited route (incl. login) 429'd until Upstash was provisioned + its analytics disabled + disclosed as a sub-processor and re-verified enforcing (commit 1ea8ce2, 06-19 eve), Sentry error alerting + keep-alive failure email; CI green for the first time (lint cleanup, audit gate → critical for gated @irys ws highs). 5 Netlify secrets re-secured; 06-19 re-audit done (state/production-audits/the-republic-2026-06-19.md — still F, but dominated by untouched accessibility + DB-infra FAILs, not the sprint's work); the fail-closed-without-Upstash login outage was caught by that re-audit and fixed the same day"
  - date: 2026-06-18
    item: "Foundations — the Republic's five foundational papers published as public immersive HTML longreads at /foundations (Examined Institution, Participatory Universe, Convergent Methods, New Republic, Mixed Constitution), each transcribed verbatim from the corpus and fidelity-checked, bylined with the ToastedandTripping pseudonym; /foundations index with the Open Cave / The Republic / Plato lineage preface (mirrors the (public)/archive patterns); self-hosted Cormorant Garamond / Crimson Pro / Space Mono (no external font calls, no CSP change); middleware allows /foundations (index + static papers) without auth; entry links in the landing footer and dashboard sidebar"
  - date: 2026-06-11
    item: "First Light — AI model upgraded ahead of June 15 retirement (Gadfly drift-gated 3 runs, 59/60 Socratic compliance), Voyage AI semantic search (embedding client with graceful-off, ingest wiring with deadline budget, user-scoped pgvector retrieval injected into briefings, backfill + falsifiable verification scripts), shadow detection finally wired (persist-gated trigger on briefing completion, dismissal-aware dedup), consumeStream fix so briefing persistence survives client disconnect, PRIVACY.md Voyage disclosure, 31 new unit tests (612 total), 14 files"
  - date: 2026-05-22
    item: "Responsive mobile navigation — hamburger + Radix drawer for mobile nav (sidebar was hidden <768px with no alternative), touch-target sizing in drawer variant, Gadfly sheet full-width on mobile, dialog responsive sizing (action type grid 1-col on mobile), 5 files"
  - date: 2026-05-18
    item: "Production audit remediation — archive auth bypass fixed, RLS migration applied (45 tables, 90+ policies), fonts migrated to next/font/google, N+1 query fixed (inArray), CI pipeline (lint+test+audit), Sentry error monitoring, CSP hardened, HSTS preload, error leakage fixed, rate-limit production warning, magicCodes email index, unused deps removed, 12 files"
  - date: 2026-05-01
    item: "Campaign Export CE-A–CE-F — outcome tracking (Illich loop), vote tracker→investigation bridge (postal code→MP→relevant votes→letter), multi-jurisdiction lever (BC/ON/AB), cross-arm Campaign↔Lever integration, action status workflow (draft→final→filed + credentials), Markdown/HTML exports (6 campaign types + 3 lever types + social copy), PDF export pipeline (@react-pdf/renderer, 7 templates: fact sheet, talking points, timeline, comparison, FIPPA request, public comment, policy brief), 42 files, ~9,470 lines"
  - date: 2026-04-29
    item: "ON/AB jurisdiction modules verified — FOI citations corrected (ON s.10(1), AB 30 calendar days), public body addresses verified, defunct URLs replaced, verified: true"
  - date: 2026-04-29
    item: "Vote Tracker VT-A–VT-H — federal parliament schema (7 tables), openparliament.ca + Represent API clients, postal code → MP lookup, vote/bill detail pages, AI bill summaries + vote explanations, voting pattern analysis, said-X-but-voted-Y contradiction detection, investigation integration (postal code on concern form, relevant votes panel), MP letter generator (Lever integration), sync infrastructure with freshness badge"
  - date: 2026-04-29
    item: "Lens Deepening L-A–L-F — persistence + return-user continuity, dynamic Gadfly seeding, Lens→Campaign bridge, evidence confidence markers, issue timeline activation, player intelligence deepening"
  - date: 2026-04-23
    item: Phase 2F — privacy hardening + agora scaffolding
  - date: 2026-04-23
    item: Phase 2E — Archive UI + public browse
  - date: 2026-04-22
    item: Phase 2D — diff tracking + shadow detection
---

# The Republic — Roadmap

A civic AI framework to challenge institutional power through structured,
legible information. Three-layer architecture (approved Apr 2026):

- **Investigation Engine** — ingest documents, classify, detect contradictions
- **Lens** — render findings against stated positions and constituency preferences
- **Campaign** — action surface (letters, calls, next-vote pressure points)

This is Lee's primary mission project, not a side project. Pinned in the
sidebar so it always surfaces regardless of activity cadence.

**This file is canonical for program and status state.** The reference corpus
(`~/marvin/content/reference/the-republic/`) holds the narrative/philosophy
documents (full-phase ROADMAP, ARCHITECTURE v2.1, papers); program sequencing and
shipped state live here.

## Design Program — July 2026 (active)

Two tracks, seven phases, approved 2026-07-02 and reconciled same day against the
June 21–28 waves that shipped while planning ran (Examined Record design elevation,
WARN-backlog cleanup, timeout fix — see shipped log). Full charters (mission,
scope in/out, verified findings, risks, verification per phase):
`.claude/plans/opencave-design-program.md` (local, not committed). Each phase gets
its own critic-gated plan before its relay; design phases carry layout-level specs
and are verified visually; every phase verification includes the standing
accessibility item (contrast, keyboard, reduced-motion).

**Theme doctrine:** "dark where you work, light where you read" — dark app chrome,
light paper reading surfaces, landing journey dark → light. No user theme toggle.

### Design track (serialized)

| Phase | Mission | Size |
|-------|---------|------|
| **D1 — The Grammar** | Residual design-system foundation (the Examined Record elevation already shipped fonts, token sweep, ArmHeader): theme doctrine codified, route-scoped light proof-spike (D2's premise — `<html class="dark">` is still hardcoded), remaining primitives (EmptyState, StatusPill, CTA), token-drift stragglers, debris cleanup. | S/M |
| **D2 — The Ascent** (flagship) | Landing redesign: Cave allegory with the dark→light ascent actually rendering (currently dead code), all-civic copy broadening (horizon Tier 1 rides along), Mirror joins the narrative, five arms told, re-specced for the Fraunces-era type system. **Design direction APPROVED (2026-07-04): "the documents are the light" — every artifact of power renders as glowing paper against the dark; the page ascends from cave-black to daylight and inverts to ink-on-paper at the resolution. Full visual spec authored + locked (`.claude/plans/republic-d2-ascent-spec.md`, local); Jen reviews for execution fidelity at relay, not direction.** | L |
| **D3 — The Threshold** | In-app wayfinding: arms surfaced from the collapsed "Expert Tools" accordion, Forum enabled (built + audited, behind abuse-readiness gate), Scout/Mirror orientation, cross-arm links everywhere, plain-language pass, recent-activity strip on home. | L |
| **D4 — The Athenians** | Integrate the drawn-but-never-shipped archetype illustrations (`designs/`) across briefing, arm headers, landing, empty states; favicon/OG. Default variant: cameo set; validate against the new visual language. | S/M |
| **D5 — The Agora Steps** | Public surface elevation: archive, foundations index, privacy raised to landing standard; unified public chrome; OG/JSON-LD/SEO. | M |

### Production track (interleaves)

| Phase | Mission | Size |
|-------|---------|------|
| **P1 — True North** | The C→B push. Ops (Lee/dashboard): :5432→:6543 pooler switch (runbook + rollback first — prior 06-19 outage attached), branch protection, DATABASE_URL GHA secret + sync-parliament cron, Upstash/secrets/Sentry-routing/PITR confirms. Deferred engineering tail (06-28-cleanup audit): safeRoute sweep (~37 routes), middleware→proxy rename, auth-route tests, reap-investigations auth, CSP nonce, actor_keys envelope encryption (before AP federation goes live), PIPEDA export endpoint, migration-runner branch dry-run + `_custom_migrations` bootstrap, briefing double-safeRoute extraction, token-drift stragglers. | S/M |
| **P2 — First Light in Production** | The first real civic outcome: verify Voyage/semantic retrieval + shadow-trigger on prod, then one real investigation end-to-end: concern → briefing → Gadfly → FOI filed → outcome tracked → credential awarded. | S |

### Sequence

```
Slot 1:  D1 (Grammar residual)  P1 (True North) starts
Slot 2:  D2 (Ascent)            P1 completes
Slot 3:  D3 (Threshold)         P2 (First Light e2e)
Slot 4:  D4 (Athenians) → D5 (Agora Steps)
```

Slots are ordinal, not calendar weeks. Plan-banking is mandatory: D2/D3 plans are
authored and critic-gated during slot 1.

**Decision points reserved for Lee:** Forum enablement timing (D3), illustration
variant selection (D4), pooler switch window (P1).

## Other work areas

- **Governance phases** (Phase 1a–1h, Phase 2a–2f shipped) — forum, peer review,
  credentials, moderation, jurisdictions, ActivityPub federation, archive. The
  Agora (Phase 3) remains community-triggered: 50+ active credentialed users,
  3+ jurisdiction communities, proven credentials via real civic outcomes.
- **Docs reconciliation** (rolling) — repo ARCHITECTURE theme/typography sections
  (D1), reference INDEX missing-file fix, canonical paper version, stale PDF exports.
- **Philosophical body** — 5 papers, published at /foundations; corpus at
  `~/marvin/content/reference/the-republic/`

## Horizon — scope expansion (thesis, June 2026)

The current "BC/AB/ON environmental" framing is narrower than the architecture.
Expansion path, in tiers of increasing cost and decreasing safety:

1. **All civic issues, current three provinces — mostly already built.** The concern
   taxonomy is already general-civic (parking, towing, rezoning, development), not
   environmental-only. The env framing is landing copy + two prompts
   (`briefing-system`, `mp-analysis-system`) + the *optional* `assessmentFramework`.
   Opening this up is surfacing + prompt/classifier broadening, not redesign.
   *(Tier 1 is now scheduled: it rides along with D2 — The Ascent.)*
2. **More jurisdictions (QC, Maritimes, federal, eventually US) — designed for it.**
   `JurisdictionModule` is a documented plugin (registry + `CONTRIBUTING.md`); the
   type system already names `canada-federal`/`us-federal`; the FOI framework holds
   FIPPA/ATIA/FOIA. Cost is legal research, not code — every module ships
   `verified: false` until a legal professional checks the citations. Scales
   linearly with real-world labor, deliberately.
3. **General broad-based issues — the real boundary, and it is the mission, not the
   code.** The whole tool orbits one lever: access-to-information. It generalizes
   superbly across geography and government-transparency domains, less naturally to
   civic issues whose lever isn't "get the document" (labor, consumer, mutual aid,
   pure advocacy). Some are already covered by other levers (Vote Tracker =
   electoral; public comment = consultation). New domains need a *new honest lever*
   (additive — the action system already holds several), never AI-generated advice.

**Guardrail:** let the mission gate generality, not the architecture. Over-generalizing
risks dissolving the counter-hegemonic edge into a generic civic-engagement app — the
exact dependency-creating thing the project defines itself against (Illich test). Enter
a new civic domain only when an honest lever for it can be named.

## Reference

- `.claude/plans/opencave-design-program.md` — active program charters (July 2026, local)
- `~/marvin/state/plans/archive/republic-roadmap-v2.md` — strategic roadmap (Apr 2026)
- `~/marvin/state/plans/archive/republic-three-layer-refactor.md` — architectural plan
- `~/marvin/content/reference/the-republic/` — narrative ROADMAP, ARCHITECTURE v2.1, papers
- `~/marvin/state/production-audits/` — audit reports (latest: the-republic-2026-06-28-cleanup.md)
- Repo: github.com/TheSocraticRepublic/the-republic
