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
│   │   ├── profile/            # User profile + credentials
│   │   └── u/                  # Public user profile (ActivityPub actor page)
│   ├── ap/                     # ActivityPub federation endpoints (actors, inbox, outbox, followers, content)
│   ├── (auth)/                 # Login page (magic code auth)
│   ├── .well-known/            # WebFinger discovery
│   └── api/
│       ├── auth/               # Magic code auth flow
│       ├── investigate/        # Investigation engine API
│       ├── oracle/             # Document analysis API (legacy)
│       ├── gadfly/             # Socratic session API (legacy)
│       ├── lever/              # Civic action API (legacy)
│       ├── mirror/             # Comparison API (legacy)
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
    │   ├── bc/                 # British Columbia (verified)
    │   ├── ab/                 # Alberta (unverified)
    │   ├── on/                 # Ontario (unverified)
    │   ├── index.ts            # Registry and lookup
    │   ├── match.ts            # Jurisdiction detection from text
    │   ├── types.ts            # Shared jurisdiction interfaces
    │   └── CONTRIBUTING.md     # Module authoring guide
    ├── credentials/
    │   ├── index.ts            # Credential calculation and aggregation
    │   └── check-moderator.ts  # Credential-weighted moderator check
    ├── review/                 # Peer review business logic
    ├── forum/                  # Forum business logic
    ├── campaign/               # Campaign layer logic
    ├── lever/                  # Civic action generation
    ├── mirror/                 # Cross-jurisdiction comparison
    ├── scout/                  # Document ingestion and search
    ├── profile/                # User profile logic
    ├── documents/              # Document parsing and chunking
    └── rate-limit.ts           # Upstash rate limiter
```

Cave-layer components are not co-located in a single directory. They are distributed across `components/investigation/`, `components/briefing/`, `components/lens/`, and `components/campaign/` — each directory owns the components for its layer.

## The Cave

### Investigation Engine

An investigation is the top-level container for a citizen's inquiry. It holds documents, players, events, and outcomes.

**Scout** (`src/lib/scout/`) — Gathers source material. Web search via Tavily, document ingestion via PDF parsing (`pdf-parse`), and embedding generation for semantic search. Documents are chunked into `document_chunks` with `vector(1024)` embeddings stored in PostgreSQL via pgvector.

**Oracle** (`src/lib/ai/prompts/`) — Analyzes documents. Streaming responses via AI SDK. Produces: plain-language summaries, power maps (beneficiaries / decision-makers / affected / funding sources / oversight gaps), missing information, hidden assumptions, and questions to ask. The Oracle is a lens, not an advocate — it surfaces structure, not conclusions.

**Mirror** (`src/lib/mirror/`) — Cross-jurisdiction comparison. Finds what other provinces or municipalities have done with the same policy problem. Only cites real jurisdictions with real data.

### The Lens

**Gadfly** (`src/lib/ai/`, `src/app/(app)/gadfly/`) — Socratic sessions over documents. The Gadfly asks questions and never answers them. This is enforced at the prompt level: the system prompt instructs the model to respond with a question in every turn, and to refuse to answer its own questions. The constraint is a feature, not a limitation.

**Players** — Visual map of actors in an investigation. Types: `company`, `official`, `agency`, `organization`, `rights_holder`. Roles: `beneficiary`, `decision_maker`, `affected`, `proponent`, `regulator`, `rights_holder`, `title_holder`.

**Context** — Event timeline tracking for an investigation. Stores events with dates, sources, and relevance to the investigation.

### The Campaign

**Lever** (`src/lib/lever/`) — Generates fileable civic documents. FOI requests use template-based citation — never AI-generated statutory citations. The Lever knows the actual section numbers because jurisdiction modules contain them. A request that cites the wrong section number fails. This constraint is why template-based citation is non-negotiable.

Action types: `fippa_request`, `public_comment`, `policy_brief`, `legal_template`, `media_spec`, `talking_points`, `coalition_template`.

## The Forum

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

ActivityPub 1.0 over HTTPS. HTTP Signatures (RFC 9421 profile, via `jose`).

**Actor model:** Each `user_profile` with an `ap_handle` is an AP Actor. Actor URIs are keyed on `AP_DOMAIN` — this value is immutable. The actor JSON-LD is served at `/u/{handle}`. The public key is embedded in the actor document.

**WebFinger:** `/.well-known/webfinger?resource=acct:{handle}@{AP_DOMAIN}` returns the JRD linking to the actor URI.

**RSA key pairs:** Generated on profile creation, stored in `actor_keys`. The private key is used only for HTTP Signature signing — never returned by any API endpoint.

**Delivery:** Fire-and-forget. The delivery function signs the activity, sends to remote actor inboxes, and does not retry on failure. This is a known limitation. See [SECURITY.md](SECURITY.md).

**Remote followers:** Stored in `remote_followers` with `actorUri`, `actorInbox`, and `sharedInbox`. When a Republic user publishes content, the delivery function fans out to all remote followers.

## Auth Flow

1. User submits email to `POST /api/auth/send-code`
2. Server generates a six-digit code, stores it (hashed) in Redis with a 10-minute TTL
3. Code sent to email
4. User submits code to `POST /api/auth/verify-code`
5. Server validates code, creates user record if new, issues JWT
6. JWT stored in httpOnly cookie (no JavaScript access)
7. All subsequent requests pass through `src/lib/auth/middleware.ts`, which validates the JWT and injects `x-user-id` as a request header
8. All API routes read `x-user-id` from headers — never from client-supplied request body or query params

No OAuth. No passwords. No session tokens stored server-side beyond the short-lived magic code.

## AI Integration

All AI calls go through Vercel AI SDK (`ai`, `@ai-sdk/anthropic`). Responses stream to the client via the AI SDK's streaming utilities.

Prompts are pure functions in `src/lib/ai/prompts/`. Each returns a string. Prompt composition is additive — base prompts are extended with jurisdiction-specific context, document excerpts, and investigation state.

The AI SDK provider abstraction means the underlying model is replaceable. Currently: Anthropic Claude. The prompts assume reasoning capability, not a specific model.

No AI-generated legal citations anywhere in the codebase. The Lever is the only component that produces citations, and it reads them from jurisdiction module template strings.

## Design Tokens

Dark mode by default. Tailwind CSS 4 with CSS custom properties.

Cave arm colors are defined as semantic tokens — each arm has a distinct accent used in navigation, headings, and action buttons. These are not decorative; they provide spatial orientation in the investigation workspace.

No light mode toggle in the current UI. The briefing view uses a light content island within the dark chrome (document reading surface on paper, not on screen).

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

**Why template-based FOI citations?** AI models hallucinate statutory section numbers. A wrong section number produces a letter that the FOI coordinator can legally ignore. The templates are verified by practitioners. The constraint is not an engineering choice — it's a legal requirement for the tool to be useful.

**Why credentials decay?** A credential earned five years ago and never refreshed by continued participation should not carry the same weight as one maintained through active engagement. The decay function is not punitive — it reflects the reality that civic participation is ongoing, not a one-time achievement.

**Why fire-and-forget AP delivery?** Reliable delivery would require a retry queue, which requires infrastructure. The current implementation is intentionally simple: if a remote inbox is down, the activity is lost. This is documented in SECURITY.md. The tradeoff is simplicity over reliability — acceptable at current scale, revisable as federation grows.
