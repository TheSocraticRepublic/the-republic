# Contributing to The Republic

The Republic is open source under AGPLv3. Contributions are welcome.

Before anything else: read [PHILOSOPHY.md](PHILOSOPHY.md). The design decisions are not arbitrary — they follow from philosophical commitments that go back twenty-five centuries. A pull request that adds a popularity signal, removes the Gadfly's Socratic constraints, or creates institutional dependency will not be merged regardless of code quality.

## Getting Started

### Prerequisites

- Node.js 22 or later (`node --version`)
- PostgreSQL 16 or later — or a Supabase project (free tier works)
- Git

### Setup

```bash
# 1. Fork and clone
git clone https://github.com/your-fork/the-republic.git
cd the-republic

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
```

Edit `.env.local`:

```
# Database — use your Supabase connection string or local Postgres URL
DATABASE_URL=postgresql://...

# If using Supabase directly
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# AI — get your key at console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-...

# Search (optional, enables Scout web search)
TAVILY_API_KEY=tvly-...

# Auth — any random 32+ character string
JWT_SECRET=change-this-to-something-random-and-long

# Rate limiting — get free credentials at upstash.com
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# App URL (keep as-is for local development)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ActivityPub federation — IMMUTABLE once set
# Leave blank for local development unless you're testing federation
AP_DOMAIN=
```

```bash
# 4. Push schema to database
npx drizzle-kit push

# 5. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The magic code auth will print codes to the terminal in development (email delivery requires the Google Workspace integration).

### Development Commands

```bash
npm run dev          # Start development server
npm run build        # Production build (run before submitting a PR)
npm test             # Run unit tests
npm run test:watch   # Run tests in watch mode
npm run lint         # Lint check
```

## Architecture Overview

The Republic has two major systems that compose:

### The Cave

The civic inquiry layer. Three nested layers:

**Investigation Engine** — `src/app/(app)/investigations/`, `src/app/api/investigate/`, `src/lib/scout/`, `src/lib/ai/`
- Investigations are the top-level container
- Scout handles document search and ingestion (`src/lib/scout/`)
- Oracle handles analysis via composable streaming prompts (`src/lib/ai/prompts/`)
- Mirror handles cross-jurisdiction comparison (`src/lib/mirror/`)

**The Lens** — `src/app/(app)/gadfly/`, `src/app/(app)/lever/`, `src/app/(app)/mirror/`, `src/components/lens/`
- Gadfly runs Socratic sessions: questions only, never answers
- Players and Context visualize investigation data

**The Campaign** — `src/lib/campaign/`, `src/components/campaign/`
- Lever generates fileable documents via template-based citation (never AI-generated citations)
- Media specs, talking points, coalition templates

### The Forum

The deliberation layer. `src/app/(app)/forum/`, `src/app/api/forum/`, `src/lib/forum/`
- Threads link to investigations (`investigation_id` FK, nullable)
- Posts support threaded replies
- Peer review: five structured dimensions per investigation (`src/lib/review/`)
- Credentials: earned through actions, decay with inactivity (`src/lib/credentials/`)
- Moderation: credential-weighted, no single administrator (`src/lib/credentials/check-moderator.ts`)

### Federation

ActivityPub integration. `src/lib/activitypub/`
- WebFinger discovery (`webfinger.ts`)
- Actor profiles with RSA key pairs (`actor.ts`, `keys.ts`)
- HTTP Signature signing and verification (`signatures.ts`)
- Fire-and-forget delivery to remote followers (`delivery.ts`)

### Auth

Magic code flow — no passwords.
1. User submits email → `/api/auth/send-code`
2. Six-digit code sent via email
3. User submits code → `/api/auth/verify-code`
4. Server issues JWT; stored in httpOnly cookie
5. Middleware (`src/lib/auth/middleware.ts`) validates JWT and sets `x-user-id` header
6. All API routes read user identity from `x-user-id` — never from client-supplied values

### Jurisdiction Modules

`src/lib/jurisdictions/` — one directory per province. BC is the reference implementation.

```
src/lib/jurisdictions/{id}/
├── index.ts                # Re-exports
├── foi-framework.ts        # Legislation, sections, letter template
├── concern-categories.ts   # Categories with keywords
├── public-bodies.ts        # FOI coordinators and addresses
├── portals.ts              # Public document portals
└── assessment-framework.ts # Environmental assessment process
```

See `src/lib/jurisdictions/CONTRIBUTING.md` for the complete module authoring guide.

### Data Model

All tables are in `src/lib/db/schema.ts`. Key groupings:

**Cave tables:** `users`, `documents`, `document_chunks`, `analyses`, `investigations`, `investigation_players`, `investigation_contexts`, `gadfly_sessions`, `gadfly_turns`, `lever_actions`, `mirror_comparisons`, `jurisdictions`

**Forum tables:** `user_profiles`, `forum_threads`, `forum_posts`, `peer_reviews`

**Credential tables:** `credential_events`

**Moderation tables:** `content_reports`, `moderation_actions`

**Federation tables:** `actor_keys`, `remote_followers`

### Legacy Routes

The codebase contains routes from an earlier four-arm architecture: `/oracle`, `/gadfly`, `/lever`, `/mirror`. These coexist with the current investigation flow and share underlying library code. New contributions should use the investigation-first flow; the old arm routes are not deprecated but are not the primary surface.

## Contribution Paths

### Jurisdiction Modules (primary path)

The highest-value contribution this project accepts. A verified BC module took one week of research. A verified Alberta or Ontario module would make this tool genuinely useful for millions more citizens.

Requirements for a verified module:
- FOI citations verified against current consolidated statute (not summaries)
- Response time limits confirmed against the legislation itself
- At least three confirmed FOI coordinator contacts with current addresses
- One contributor with legal or paralegal familiarity with the jurisdiction, or explicit acknowledgment that the module is unverified

See `src/lib/jurisdictions/CONTRIBUTING.md` for the complete guide.

### Forum Features

The Forum is newer and has more room to grow. Candidate features:
- Thread subscriptions (email digest of new posts on followed threads)
- Investigation-to-thread cross-linking improvements
- Post editing with audit trail
- Thread archiving workflow

Follow the existing API route pattern:
```
src/app/api/forum/{feature}/route.ts   # API endpoint
src/lib/forum/{feature}.ts             # Business logic
src/components/forum/{Feature}.tsx     # UI component
```

### Peer Review Dimensions

The peer review system (`src/lib/review/`) currently evaluates five dimensions. If a dimension is systematically missing from civic analysis in your domain, open a philosophical discussion issue before writing code. Adding a dimension touches the data model, the UI, and the credential weighting system.

### Credential Types

`src/lib/credentials/` and the `credentialTypeEnum` in `src/lib/db/schema.ts`. New credential types must correspond to real civic actions — not engagement metrics. Open a philosophical discussion issue first.

### Bug Fixes

1. Open an issue describing the bug and how to reproduce it
2. Confirm someone isn't already working on it
3. Fix, test, submit PR

### Translations

The UI is not yet internationalized. If you want to lead i18n work, open an issue to discuss approach before building.

## Code Patterns

### API Routes

```typescript
// src/app/api/forum/example/route.ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

export async function POST(request: Request) {
  const h = await headers()
  const userId = h.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // business logic
  return NextResponse.json({ result })
}
```

Never read user identity from the request body or query params. Always from `x-user-id`.

### AI Prompts

Prompts live in `src/lib/ai/prompts/`. Each prompt is a function that returns a string. No prompt generates citations — the Lever uses templates for legal accuracy.

### Components

Follow existing component structure. Server components for data fetching, client components only when interactivity requires it. No client-side data fetching that can be done server-side.

## Testing

```bash
npm test
```

Tests live in `tests/`. Unit tests for business logic, jurisdiction module validation, and credential calculation. The test runner is Vitest.

What to test:
- Business logic in `src/lib/`
- Jurisdiction module structure (required fields present, no missing citations)
- Credential weight calculations
- Auth middleware behavior

What not to test:
- Next.js routing
- Drizzle query builders
- UI rendering

## Pull Request Guidelines

- One feature or fix per PR
- `npm run build` must pass before submission
- `npm test` must pass
- Follow existing code patterns (read the relevant files before writing)
- New jurisdiction modules: include source URLs for all FOI citations in the PR description
- New forum features: explain which civic capability they extend
- New credential types: explain what civic action they represent

## The Philosophy Gate

Before submitting a PR, ask: does this change pass the Illich test?

> Does this make the citizen more capable WITHOUT the tool?

A feature that makes the tool more useful but the citizen more dependent has failed the test. If you're unsure, open a philosophical discussion issue. That's what they're for.

The Gadfly never answers its own questions — that constraint is not a bug to fix.
The credential system has no transfer mechanism — that is not a missing feature.
The Forum has no follower counts or trending threads — that is a deliberate design decision.

These constraints follow from the philosophical commitments in PHILOSOPHY.md. Proposals to remove them will not be merged.

## Response Times

This is a one-maintainer project. Issues are reviewed weekly. PRs are reviewed within two weeks of submission. Jurisdiction modules from practitioners in their jurisdiction are prioritized.

If you're contributing something significant and want to coordinate, open an issue first.
