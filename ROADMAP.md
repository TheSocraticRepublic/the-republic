---
status: current
current: Production deployment + first real civic outcomes
next: "First real investigation end-to-end on production (Voyage key provisioning, verify-retrieval + backfill run, shadow trigger prod verification)"
testing: null
pinned: true
shipped:
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

## Major work areas

- **Governance phases** (Phase 1a–1h, Phase 2a–2f) — forum, peer review,
  credentials, moderation, jurisdictions, ActivityPub federation, archive
- **Vote tracker** (planned, not yet active) — legislator accountability via
  voting records. See `~/.claude/projects/-home-leesalo-marvin/memory/project_republic_vote_tracker.md`
  for the architecture mapping and prior-art landscape.
- **Philosophical body** — 4 papers (~25,500 words) at
  `content/reference/the-republic/`

## Horizon — scope expansion (thesis, June 2026)

The current "BC/AB/ON environmental" framing is narrower than the architecture.
Expansion path, in tiers of increasing cost and decreasing safety:

1. **All civic issues, current three provinces — mostly already built.** The concern
   taxonomy is already general-civic (parking, towing, rezoning, development), not
   environmental-only. The env framing is landing copy + two prompts
   (`briefing-system`, `mp-analysis-system`) + the *optional* `assessmentFramework`.
   Opening this up is surfacing + prompt/classifier broadening, not redesign.
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

- `state/plans/republic-roadmap-v2.md` — strategic roadmap
- `state/plans/republic-three-layer-refactor.md` — architectural plan
- Repo: github.com/TheSocraticRepublic/the-republic
