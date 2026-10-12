# Architecture

The Republic has two systems: the Cave (civic inquiry) and the Forum (civic deliberation). This document maps both to the actual source tree.

## System Overview

```
The Cave                          The Forum
├── Investigation Engine          ├── Threads + Posts
│   ├── Scout (gather)            ├── Peer Review
│   ├── Oracle (analyze)          ├── Credentials
│   └── Mirror (compare)          ├── Moderation
├── The Lens                      └── Federation (ActivityPub)
│   ├── Gadfly (question)
│   ├── Players (map)
│   └── Context (track)
└── The Campaign
    ├── Lever (file)
    ├── Media specs
    └── Talking points
```

The Cave is where investigations happen. The Forum is where citizens discuss and review them. Federation makes the Forum discoverable by the broader Fediverse.

## Directory Map

```
src/
├── app/
│   ├── (app)/                  # Authenticated app routes
│   │   ├── investigations/     # Investigation list + detail
│   │   ├── investigate/        # Active investigation workspace
│   │   ├── oracle/             # Document analysis (legacy arm route)
│   │   ├── gadfly/             # Socratic inquiry (legacy arm route)
│   │   ├── lever/              # Civic action generation (legacy arm route)
│   │   ├── mirror/             # Cross-jurisdiction comparison (legacy arm route)
│   │   ├── scout/              # Document search and ingestion
│   │   ├── briefing/           # Investigation briefing view
│   │   ├── forum/              # Forum threads and posts
│   │   ├── votes/              # Vote tracker (recent votes, MPs, bills, vote detail)
│   │   ├── profile/            # User profile + credentials
│   │   └── u/                  # Public user profile (ActivityPub actor page)
│   ├── ap/                     # ActivityPub federation endpoints (actors, inbox, outbox, followers, content)
│   ├── (auth)/                 # Login page (magic code auth)
│   ├── (public)/               # Public archive browse (no auth)
│   ├── .well-known/            # WebFinger discovery
│   └── api/
│       ├── auth/               # Magic code auth flow
│       ├── investigate/        # Investigation engine API
│       ├── oracle/             # Document analysis API (legacy)
│       ├── gadfly/             # Socratic session API (legacy)
│       ├── lever/              # Civic action API (legacy)
│       ├── mirror/             # Comparison API (legacy)
│       ├── parliament/         # Vote tracker: MP/vote/bill data, AI analysis, sync
│       ├── campaign/           # Campaign material export (PDF, print)
│       ├── archive/            # Archive bundles + permanence
│       ├── documents/          # Document re-ingestion
│       ├── governance/         # Governance scores
│       ├── scout/              # Document search API
│       ├── briefing/           # Briefing generation API
│       ├── forum/              # Forum CRUD + moderation
│       ├── credentials/        # Credential calculation API
│       ├── profile/            # Profile management API
│       ├── users/              # User lookup (for AP)
│       └── health/             # Health check
├── components/
│   ├── investigation/          # Investigation workspace UI
│   ├── scout/                  # Document search UI
│   ├── oracle/                 # Document analysis UI
│   ├── gadfly/                 # Socratic session UI
│   ├── lever/                  # Civic action UI
│   ├── mirror/                 # Comparison UI
│   ├── briefing/               # Briefing view
│   ├── lens/                   # Lens layer components
│   ├── campaign/               # Campaign layer components
│   ├── forum/                  # Forum UI
│   ├── votes/                  # Vote tracker UI (MP profiles, ballots, letters)
│   ├── archive/                # Archive browse UI
│   ├── landing/                # Landing page narrative scenes
│   ├── credentials/            # Credential display
│   ├── review/                 # Peer review UI
│   ├── profile/                # Profile UI
│   ├── layout/                 # Shared layout components (nav, chrome)
│   └── ui/                     # Radix-based primitives
└── lib/
    ├── db/
    │   ├── schema.ts           # All tables (Drizzle ORM)
    │   └── index.ts            # DB client + query helpers
    ├── auth/
    │   ├── jwt.ts              # Token sign/verify (jose)
    │   ├── magic-code.ts       # Six-digit code generation + validation
    │   └── middleware.ts       # JWT validation, x-user-id injection
    ├── ai/
    │   ├── prompts/            # Composable prompt functions
    │   ├── embeddings.ts       # pgvector embedding generation
    │   └── search-context.ts   # Semantic search over document chunks
    ├── activitypub/
    │   ├── actor.ts            # AP actor JSON-LD generation
    │   ├── activity.ts         # Activity types (Follow, Accept, Announce)
    │   ├── context.ts          # AP context constants
    │   ├── delivery.ts         # HTTP Signature-signed delivery (fire-and-forget)
    │   ├── keys.ts             # RSA key pair generation and storage
    │   ├── signatures.ts       # HTTP Signature sign and verify
    │   ├── url-validation.ts   # Actor URI validation
    │   └── webfinger.ts        # WebFinger JRD generation
    ├── jurisdictions/
    │   ├── bc/                 # British Columbia (verified: true)
    │   ├── ab/                 # Alberta (verified: false — surfaces a caution)
    │   ├── on/                 # Ontario (verified: false — surfaces a caution)
    │   ├── index.ts            # Registry, lookup, resolveJurisdictionModuleId
    │   ├── match.ts            # Concern→document-type matching (module-parameterized)
    │   ├── types.ts            # Shared jurisdiction interfaces
    │   └── CONTRIBUTING.md     # Module authoring guide
    ├── credentials/
    │   ├── index.ts            # Credential calculation and aggregation
    │   └── check-moderator.ts  # Credential-weighted moderator check
    ├── review/                 # Peer review business logic
    ├── forum/                  # Forum business logic
    ├── campaign/               # Campaign layer logic
    ├── activity/               # Recent-activity merge for the Investigate landing
    ├── investigation/          # Briefing generation (run-briefing, constants)
    ├── parliament/             # OpenParliament + Represent API clients, sync
    ├── pdf/                    # @react-pdf/renderer templates + primitives
    ├── archive/                # Archive bundles, hashing, diff, shadow detection
    ├── governance/             # Governance scoring
    ├── privacy/                # Logging policy
    ├── landing/                # Landing page hooks and data
    ├── timeline/               # Event timeline merge logic
    ├── api/safe-route.ts       # safeRoute wrapper (uncaught errors → Sentry + generic 500); wraps every API route except /api/health
    ├── ai/model.ts             # Single source of truth for the AI model ID
    ├── ai/voyage.ts            # Voyage embeddings client (graceful-off, script-safe)
    ├── ai/search-chunks.ts     # Per-user semantic retrieval over document chunks
    ├── scout/                  # Document ingestion and search
    ├── profile/                # User profile logic
    ├── documents/              # Document parsing and chunking
    ├── api/csrf.ts             # Origin check for the matcher-excluded auth routes
    └── rate-limit.ts           # Upstash limiter (guarded build + call, health probe)
```

Cave-layer components are not co-located in a single directory. They are distributed across `components/investigation/`, `components/briefing/`, `components/lens/`, and `components/campaign/` — each directory owns the components for its layer.

## The Cave

### Investigation Engine

An investigation is the top-level container for a citizen's inquiry. It holds documents, players, events, and outcomes.

**Scout** (`src/lib/scout/`) — Gathers source material. Web search via DuckDuckGo (`duck-duck-scrape`), document ingestion via PDF parsing (`pdf-parse`). Documents are chunked into `document_chunks` with pgvector `vector(1024)` embeddings generated at ingest via Voyage AI (`voyage-4-lite`, 1024 dims — `src/lib/ai/voyage.ts` behind the `src/lib/ai/embeddings.ts` server-only wrapper). Embedding is graceful-off: without `VOYAGE_API_KEY`, chunks store null embeddings and semantic retrieval silently disables. Retrieval (`src/lib/ai/search-chunks.ts`) is strictly per-user (chunks join `documents` on owner), similarity-cutoff 0.5, and feeds a delimited untrusted-excerpts block into briefing generation. `scripts/backfill-embeddings.ts` embeds chunks ingested while no key was configured.

**Oracle** (`src/lib/ai/prompts/`) — Analyzes documents. Streaming responses via AI SDK. Produces: plain-language summaries, power maps (beneficiaries / decision-makers / affected / funding sources / oversight gaps), missing information, hidden assumptions, and questions to ask. The Oracle is a lens, not an advocate — it surfaces structure, not conclusions.

**Mirror** (`src/app/api/mirror/` + `src/lib/ai/prompts/mirror-system.ts`) — Cross-jurisdiction comparison. Finds what other provinces or municipalities have done with the same policy problem. Only cites real jurisdictions with real data — enforced by seeding the prompt with a DB-verified jurisdiction reference block; the streamed output itself is not post-validated (a known gap: model compliance, not code, keeps fabricated jurisdictions out).

**Briefing generation lifecycle.** Generation runs server-side
(`src/lib/investigation/run-briefing.ts`) and is fenced by a per-run
`generation_nonce` (migration 0012): a run whose nonce no longer matches the
row stops early and cannot overwrite a newer run. A reaper marks a run stuck
after `STUCK_GENERATION_THRESHOLD_MINUTES` (12, `src/lib/investigation/constants.ts`).
On the page, `GeneratingPoller` polls `/api/investigate/[id]/status`; on a
terminal status it calls `router.refresh()` and, if it is still mounted 5
seconds later, forces a full reload (the 2026-08-29 fix for a blank page on
completion). Its hard stop is derived from the same 12-minute threshold, so
client and reaper agree on when a run has failed.

### The Lens

**Gadfly** (`src/lib/ai/`, `src/app/(app)/gadfly/`) — Socratic sessions over documents. The Gadfly asks questions and never answers them. This is enforced at the prompt level: the system prompt instructs the model to respond with a question in every turn, and to refuse to answer its own questions. The constraint is a feature, not a limitation.

**Players** — Visual map of actors in an investigation. Types: `company`, `official`, `agency`, `organization`, `rights_holder`. Roles: `beneficiary`, `decision_maker`, `affected`, `proponent`, `regulator`, `rights_holder`, `title_holder`.

**Lens panel** (`src/components/lens/lens-panel.tsx`) — opened from the
briefing's Go Deeper section beside Gadfly and Lever (R-A7, 2026-08-28). The
entry renders only when `investigation-page.tsx` passes `onOpenLens`, which it
does for the investigation's author; non-authors see the Go Deeper grid
without it.

**Context** — Event timeline tracking for an investigation. Stores events with dates, sources, and relevance to the investigation.

### The Campaign

**Lever** (`src/app/api/lever/{actions,generate,export}` + `src/lib/ai/prompts/lever-system.ts` + `src/lib/jurisdictions/`) — Generates fileable civic documents. Statutory citations live in jurisdiction modules and the system prompt, never invented by the model — a request that cites the wrong section number fails, which is why template-based citation is non-negotiable. UPDATED (JURIS-1, shipped 2026-08-07): the prompt is no longer BC-hardcoded. `buildLeverPrompt(module)` interpolates the *resolved* jurisdiction's FOI framework (statute name, full citation, every section reference), so an Alberta request now carries FOIP rather than BC FIPPA. The guarantee remains *prompt-level* — the model transcribes citations supplied to it rather than the module's `letterTemplate` being spliced in code, and that splice mechanism is still unwired. What changed is which jurisdiction's citations reach the prompt, not the mechanism carrying them. AB and ON now ship `verified: false`, which appends a practitioner-verification caution to the generated output; before this batch the flag had zero consumers. Verifying the AB/ON citation content itself is JURIS-2 and needs a practitioner, not a model.

Action types: `fippa_request`, `public_comment`, `policy_brief`, `legal_template`, `media_spec`, `talking_points`, `coalition_template`.

## Jurisdiction Resolution

Added by JURIS-1 (2026-08-07). Before it, the briefing pipeline, Scout, the
Lever, `match.ts` and the Lever's public-body picker all called
`loadJurisdictionModule('bc')` directly — so an Alberta citizen received BC
FIPPA citations, BC public bodies, and BC document-type vocabulary regardless of
the jurisdiction attached to their investigation.

`resolveJurisdictionModuleId({ province, jurisdictionName, concern })` in
`src/lib/jurisdictions/index.ts` is now the single entry point. Resolution
order: the DB jurisdiction row's `province` (authoritative), then
`detectJurisdiction()` keyword matching, then `'bc'` with a `console.warn`. The
fallback is deliberate and temporary-but-honest — it matches the pre-JURIS-1
behaviour rather than silently failing, and the warn makes an unmatched
jurisdiction (Quebec, the Maritimes) observable rather than invisible.

Two functions were added to the `JurisdictionModule` surface —
`getDocumentStructureContext()` and `getJurisdictionPortalContext(name)` — so
consumers reach them through the resolved module rather than importing from
`jurisdictions/bc/*`. No `from '@/lib/jurisdictions/bc'` import remains in the
pipeline; the only survivors are two explicit fallback paths in
`new-action-dialog.tsx`.

The three system prompts (`briefing-system`, `lever-system`, `scout-system`) are
builders rather than constants, interpolating the resolved module's FOI
framework. Each keeps a backward-compatible BC-bound export for tests, and Razor
verified the BC output is byte-identical to the pre-JURIS-1 prompt — AB/ON
changing is the point; BC changing would have been a regression.

`foiFramework.verified` finally has a consumer: `false` appends a
practitioner-verification caution to generated output. Verifying the AB/ON
citation *content* remains open (JURIS-2) and requires a practitioner.

## Health and Liveness

`/api/health` probes **Postgres and Redis** and returns 503 when either is down.
Both are hard dependencies: the rate limiter fails closed in production, so an
unreachable Redis turns every auth route into a 429 — login is down either way,
and the endpoint must be able to say so.

`probeRateLimiter()` (`src/lib/rate-limit.ts`) deliberately exercises the same
path the routes use — `buildLimiter()` construction plus a real Redis
round-trip on a dedicated key — so health goes red exactly when auth would
break, rather than merely when Redis is unreachable by some other measure.

This shape is a direct product of the 2026-08-06 outage, where the endpoint
probed Postgres alone and returned 200 with `database: ok` while every
rate-limited route returned 500. A probe that cannot detect the outage is worse
than no probe, because it manufactures confidence.

The probe doubles as the Redis keep-alive. `.github/workflows/keepalive.yml`
runs every 10 minutes, so Redis receives ~144 round-trips a day and Upstash's
14-day idle-deletion timer can never start — the original cause, since the old
keepalive ran `SELECT 1` against Postgres and never touched Redis. The residual
dependency is GitHub's scheduler, which disables workflows after 60 days of repo
inactivity; an external uptime monitor would sever that coupling.

`email_configured` checks only that `RESEND_API_KEY` is present. It is
deliberately *not* a live API call — a per-ping third-party request would spend
quota and make our own liveness signal depend on someone else's uptime. The name
is chosen so it cannot be misread as proof that delivery works.

## Continuous Integration

`.github/workflows/ci.yml` runs on every push to `main` and every pull request
into it. Its order: provenance, `npm ci`, lint, typecheck, tests, the design
token lint, then two dependency audits. It does not run `next build`, so a build
break reaches Netlify's deploy step before anything else sees it. The build and a
runtime smoke are parked under "Release mechanics for dependency deploys".

The workflow holds read-only repository permissions, and checkout does not
persist credentials. The **provenance** step prints the tested sha, its parents,
and the node, npm and event in use. It fails unless npm is exactly 10.9.4, the
version that generated the lock. On a pull request it also requires the two-parent
merge commit, so the run demonstrably tested the PR head merged onto `main`. The
parents are read from `git cat-file -p HEAD`, because a depth-1 checkout has
none to walk.

Node is pinned to `22.22.1` in CI while `netlify.toml` floats `NODE_VERSION = "22"`.
CI and production can therefore run different Node patch releases. The gap is
known (Parking Lot) and is reviewed with the next dependency batch.

**Two audits, deliberately split.**

- `npm audit --omit=dev --audit-level=high` covers everything that ships and has
  no allow-list.
- `audit-ci --config audit-ci.jsonc` covers the whole tree at high and critical.
  It carries one path-scoped exception: the `braces` advisory reached only through
  ESLint's file globbing. The reason, owner and review date are in the file.

The exception is keyed to the npm-reported path. A new consumer of the same
hoisted package is therefore not a new path to audit-ci, which is why the
production audit stays a separate step with no exceptions.

When the registry is unreachable, both steps exit 1 with a tool-failure message
rather than an advisory. Read the log before treating a red audit as a new
advisory.

## The Vote Tracker

Federal legislator accountability (`src/lib/parliament/`, `/votes` routes, `/api/parliament`). Data comes from openparliament.ca (MPs, votes, bills, ballots) and the Represent API (postal code → riding → MP). Vote, bill, and MP data is synced into local tables via `/api/parliament/sync`; postal-code lookups call the Represent API at request time. AI features (bill summaries, vote explanations, voting-pattern analysis, said-X-voted-Y contradiction detection) are versioned by prompt and cached in the database. Letter generation routes through the Lever. Investigations can attach relevant votes via postal code on the concern form.

## The Forum

**Feature gate:** the entire Forum surface ships DISABLED. `isForumEnabled()`
(`src/lib/forum/flag.ts`) requires the literal string `'true'` in
`FORUM_ENABLED` — fail-closed — and gates the forum pages, all `/api/forum/*`
handlers, the AP object endpoints (`/ap/threads`, `/ap/posts`), outbox forum
items, and forum-content federation delivery. The sections below describe the
built system behind that gate. One deliberate nuance: actor/inbox/webfinger/
followers stay live while the forum is off, so remote followers can accumulate
during the closed period and receive fan-out the moment the flag flips.

### Threads and Posts

Forum threads can be linked to investigations (`investigation_id` FK, nullable). This grounds discussion in analysis rather than speculation. A thread about a rezoning decision can link to the investigation that produced the Oracle analysis.

Posts support threaded replies via `parent_id` self-reference. Deleted posts set `parent_id` to null on child posts (cascade: set null) — replies survive the deletion of their parent.

### Peer Review

Five structured dimensions:

| Dimension | What it measures |
|---|---|
| `factual_accuracy` | Are the facts cited in the investigation verifiable? |
| `source_quality` | Are sources primary (legislation, minutes, filings) or secondary? |
| `missing_context` | What has the investigation left out that matters? |
| `strategic_effectiveness` | Would the proposed actions actually move the needle? |
| `jurisdictional_accuracy` | Are the FOI citations and process descriptions correct for this province? |

Each scored 1-5. One review per reviewer per investigation (enforced by unique index on `investigation_id, reviewer_id`).

### Credentials

Credentials are earned through civic action, decay with inactivity, and cannot be transferred. They are soulbound.

The `credential_events` table records each event with a weight. Credential types correspond to real actions: completing an investigation, submitting a peer review, filing a Lever action that reaches `filed` status, writing forum posts that receive positive peer reviews, reporting content that results in moderation action.

No follower counts. No post counts as credentials. No likes. The credential system measures civic participation, not social performance.

`check-moderator.ts` computes whether a user has sufficient credential weight to take moderation actions. The threshold is a function of the community's aggregate credential distribution — it adjusts as the community grows.

### Moderation

Credential-weighted. A user with high civic credentials carries more weight in moderation decisions than a new account. Reports feed into `content_reports`. Moderators act via `moderation_actions`. No single administrator has unilateral power — the system is designed so that institutional capture requires capturing the credential distribution of an active civic community.

## Federation

ActivityPub 1.0 over HTTPS. HTTP Signatures implement the draft-cavage-http-signatures-12 profile (the Mastodon-compatible one — deliberately NOT RFC 9421, whose wire format the Fediverse does not yet speak), via `jose`.

**Actor model:** Each `user_profile` with an `ap_handle` is an AP Actor. Actor URIs are keyed on `AP_DOMAIN` — this value is immutable. The actor JSON-LD is served at `/u/{handle}`. The public key is embedded in the actor document.

**WebFinger:** `/.well-known/webfinger?resource=acct:{handle}@{AP_DOMAIN}` returns the JRD linking to the actor URI.

**RSA key pairs:** Generated on profile creation, stored in `actor_keys`. The private key is used only for HTTP Signature signing — never returned by any API endpoint.

**Delivery:** Fire-and-forget. The delivery function signs the activity, sends to remote actor inboxes, and does not retry on failure. This is a known limitation. See [SECURITY.md](SECURITY.md).

**Remote followers:** Stored in `remote_followers` with `actorUri`, `actorInbox`, and `sharedInbox`. When a Republic user publishes content, the delivery function fans out to all remote followers.

## Auth Flow

1. User submits email to `POST /api/auth/send-code`
2. Server generates an eight-digit code, hashes it (SHA-256) and stores it in the `magic_codes` Postgres table with a 10-minute expiry (`expires_at` column, checked at verification time — not a Redis TTL)
3. Code sent to email
4. User submits code to `POST /api/auth/verify-code`
5. Server validates code, creates user record if new, issues JWT
6. JWT stored in httpOnly cookie (no JavaScript access)
7. All subsequent requests pass through `src/lib/auth/middleware.ts`, which validates the JWT and injects `x-user-id` as a request header
8. All API routes read `x-user-id` from headers — never from client-supplied request body or query params

No OAuth. No passwords. No session tokens stored server-side beyond the short-lived magic code.

**CSRF on the auth routes.** The middleware matcher excludes `api/auth/`, which
removes not just JWT-gating (intended — these routes run pre-authentication) but
also the Origin check every other state-changing route gets. That left
`send-code`, `verify-code` and `signout` open to login CSRF: a cross-site form
POST could redeem an attacker's code in the victim's browser, silently landing
the victim's subsequent investigations and uploads in the attacker's account.
`checkCsrfOrigin()` (`src/lib/api/csrf.ts`) is a faithful extraction of the
middleware check and is called at the top of all three handlers, before rate
limiting, so a forged request cannot even consume budget. The matcher is
deliberately left alone — routing auth routes through `withAuth` would redirect
them to `/login`.

## Schema and Migrations

Drizzle's journal tracks only `0000_baseline_schema.sql`; every later change
is hand-authored SQL in `drizzle/migrations/000N_*.sql`, applied in order by
`scripts/apply-custom-migrations.ts` and recorded in `_custom_migrations`, so a
re-run is idempotent. All fourteen (0001-0014) are applied in production,
verified 2026-08-29. The three added since 2026-08-16:

- **0012** `nonce_turn_unique_contradictions`: `generation_nonce` on
  investigations (the stale-run fence above), a unique gadfly turn index
  (turns renumbered, not deleted), contradictions nullable.
- **0013** `timestamps_withtz`: timestamps moved to `timestamptz`.
- **0014** `peer_review_checks`: CHECK constraints on peer reviews, in a
  transaction with idempotency guards.

Migration tooling reads `DIRECT_DATABASE_URL` (the `:5432` session pooler);
the app reads the `:6543` transaction pooler. Backup and restore:
`drizzle/DR.md`.

## AI Integration

All AI calls go through Vercel AI SDK (`ai`, `@ai-sdk/anthropic`). Responses stream to the client via the AI SDK's streaming utilities.

Prompts are pure functions in `src/lib/ai/prompts/`. Each returns a string. Prompt composition is additive — base prompts are extended with jurisdiction-specific context, document excerpts, and investigation state.

The AI SDK provider abstraction means the underlying model is replaceable. Currently: Anthropic Claude. The prompts assume reasoning capability, not a specific model.

No AI-generated legal citations anywhere in the codebase. The Lever is the only component that produces citations, and it reads them from jurisdiction module template strings.

## Design Tokens

Tailwind CSS 4 with CSS custom properties (`src/app/globals.css`). Theme doctrine:
**dark where you work, light where you read.** The app chrome (nav, panels,
forms, cards) is dark by default, with no user toggle. Long-form reading
surfaces (the briefing document, legal/FOI text) get a light "paper"
treatment from the island tokens plus the `.content-island` grain — not a
theme class (`.dark-island` is a separate dark overlay, used by the Gadfly
sheet). Sustained reading is more legible on light backgrounds even
inside a dark app. The landing page is the one
surface that travels dark → light as you scroll, via `.light-scope` — it
opens in the cave (dark) and ends in daylight (light), matching its own
narrative arc.

The token block uses `@theme inline` (not plain `@theme`), which matters:
Tailwind v4 resolves non-inline `@theme` variables at `:root`, so a nested
scope redeclaring the underlying CSS variables can't flip already-resolved
utility classes (`bg-surface-0`, `text-text-primary`, etc.). `inline` carries
the `var()` reference into the generated utility itself, so it resolves at
the point of use — which is what makes `.dark-island` and `.light-scope`
work as *nested* overrides rather than only affecting inline `style=` usage.

**Island tokens** (since 2026-08-27). Reading surfaces draw from one set of
`--island-*` variables (paper, ink, secondary/body/muted/faint text, borders,
cards, veils, the paper accent and player-role colours), exposed to Tailwind
as `--color-island-*` through `@theme inline`. `:root` declares the light
paper values; `.dark-island` redeclares the same names with dark values. A
component never chooses a palette in JS: the briefing's in-component dark
toggle adds `content-island--dark dark-island` to its root and the same
utilities resolve dark. Components on the island (briefing, Lens, campaign,
civic-context strip, the Votes reading panels) use `island-*` utilities, never
a literal hex. The earlier `LIGHT_PALETTE` / `DARK_PALETTE` objects in
`briefing-view.tsx` are gone.

Cave arm colors (`--accent-scout`, `--accent-oracle`, `--accent-gadfly`,
`--accent-lever`, `--accent-mirror`, `--accent-votes`) are semantic tokens —
each arm has a distinct accent used in navigation, headings, and action
buttons. They are not decorative; they provide spatial orientation in the
investigation workspace. Reference the CSS variable (`var(--accent-oracle)`
or a Tailwind utility like `bg-oracle`), never a hardcoded hex — the token is
theme-scope-aware (dark vs. `.light-scope`) and a literal hex is not.

**Typography:** Fraunces (display/headings), Instrument Sans (UI/body),
Source Serif 4 (editorial and legal/FOI document text), Geist Mono
(monospace). All loaded via `next/font/google` in `src/app/layout.tsx` as
CSS variables consumed by the `--font-*` theme tokens. PDF exports
(`src/lib/pdf/`) register their own font subset independently — Instrument
Sans, Inter, and Source Serif 4 — since `@react-pdf/renderer` can't consume
the app's `next/font` variables; PDFs are always light-mode/print-optimized
regardless of the app's dark chrome.

**Shared primitives** live in `src/components/ui/`: `EmptyState` (icon +
heading + body + optional CTA), `StatusPill` (token-consuming status/type
badges, `pill` or `tag` shape), `CTAButton` (the `surface-3` +
`border-strong` action pill, works as a link or a button), plus
`CrossArmActions` and `MarkdownProse`/`SectionedMarkdown`. `ArmHeader`
(`src/components/layout/arm-header.tsx`) is the shared per-arm page header
(accent bar, title, subtitle, optional action slot) — use it instead of
hand-rolling arm page headers.

## Legacy Architecture

The codebase contains routes from a prior four-arm architecture:

| Route | Arm | Status |
|---|---|---|
| `/oracle` | Document analysis | Legacy, functional |
| `/gadfly` | Socratic inquiry | Legacy, functional |
| `/lever` | Civic action | Legacy, functional |
| `/mirror` | Comparison | Legacy, functional |

These coexist with the current investigation-first flow (`/investigations`, `/investigate`). The arm routes are not deprecated — they share the same underlying library code. New feature development uses the investigation flow as the primary surface.

## Key Decisions

**Why AGPLv3?** Any institution that forks and deploys a modified version of The Republic must release their modifications. This prevents a government or corporation from taking the transparency tooling, stripping the transparency features, and deploying it as a surveillance or control mechanism.

**Why magic code auth?** No password database to breach. No OAuth dependency on a corporate identity provider. Citizens don't need a Google or Apple account to participate.

**Why template-based FOI citations?** AI models hallucinate statutory section numbers. A wrong section number produces a letter that the FOI coordinator can legally ignore. A `verified` flag alone does not make a citation correct: the BC module was marked verified while citing the wrong fee-waiver ground and day rule, corrected against bclaws on 2026-10-02 (`c80dcfe`). AB and ON citations are unverified until a practitioner reviews them (JURIS-2). The constraint is not an engineering choice — it's a legal requirement for the tool to be useful.

**Why credentials decay?** A credential earned five years ago and never refreshed by continued participation should not carry the same weight as one maintained through active engagement. The decay function is not punitive — it reflects the reality that civic participation is ongoing, not a one-time achievement.

**Why fire-and-forget AP delivery?** Reliable delivery would require a retry queue, which requires infrastructure. The current implementation is intentionally simple: if a remote inbox is down, the activity is lost. This is documented in SECURITY.md. The tradeoff is simplicity over reliability — acceptable at current scale, revisable as federation grows.
