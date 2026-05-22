---
status: current
current: Production deployment + first real civic outcomes
next: null
testing: null
pinned: true
shipped:
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
  - date: 2026-04-21
    item: Phase 2C — archive ingestion pipeline
  - date: 2026-04-15
    item: Phase 2B — governance scaffolding
  - date: 2026-04-08
    item: Phase 0 — investigation engine, scout, briefing (25 routes, 49 tests, ~20k lines)
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

## Reference

- `state/plans/republic-roadmap-v2.md` — strategic roadmap
- `state/plans/republic-three-layer-refactor.md` — architectural plan
- Repo: github.com/TheSocraticRepublic/the-republic
