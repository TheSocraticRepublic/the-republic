# The Republic — Civic AI Framework

## What This Is

An open-source civic AI tool that makes institutional power legible to ordinary citizens. Upload a government document, get plain-language analysis, explore it through Socratic inquiry, generate real civic actions (FOI requests, public comments), and compare policies across jurisdictions.

## Tech Stack

- Next.js 16, React 19, TypeScript 5
- Drizzle ORM + PostgreSQL (Supabase) with pgvector for embeddings
- Claude SDK + Vercel AI SDK for streaming
- Tailwind CSS 4, Radix UI
- @react-pdf/renderer for server-side PDF generation
- Upstash Redis for rate limiting
- Netlify deployment

## Project Structure

```
src/
  app/
    (app)/           # Authenticated routes
      oracle/        # Document analysis
      gadfly/        # Socratic inquiry sessions
      lever/         # Action generation (FOI, comments, briefs)
      mirror/        # Cross-jurisdiction comparison
      votes/         # Vote tracker (MP lookup, voting records, letters)
      investigate/   # Investigation hub (briefing, lens, campaign)
      forum/         # Threads, posts, moderation
      scout/         # Document search and ingestion
    (auth)/login/    # Magic code auth
    (public)/        # Public archive browse (no auth)
    ap/              # ActivityPub federation endpoints
    api/             # API routes per arm
      campaign/      # Campaign material export (PDF, print)
      investigate/   # Investigation CRUD, outcomes, media, votes
      lever/         # Action CRUD, generation, export (txt/md/pdf)
      parliament/    # MP data, votes, sync, letters
      forum/         # Forum CRUD, reports, moderation
      archive/       # Archive bundles + permanence
  components/
    layout/          # App shell, sidebar, nav
    oracle/          # Document cards, analysis panels
    gadfly/          # Socratic thread, insight tracker
    lever/           # FIPPA builder, comment editor, action viewer
    mirror/          # Comparison cards, outcome timelines
    campaign/        # Campaign panel, outcome tracker, reasoning card
    votes/           # MP profiles, vote lists, letter generator
    investigation/   # Concern form, investigation page
    forum/           # Thread list, post composer, moderation
    landing/         # Landing page narrative scenes
    ui/              # Shared primitives (EmptyState, StatusPill, CTAButton, cross-arm actions, markdown prose)
  lib/
    ai/prompts/      # System prompts per arm (THE critical files)
    ai/              # RAG, Voyage embeddings, semantic retrieval, model ID
    activitypub/     # AP actors, HTTP signatures, delivery, WebFinger
    auth/            # JWT, magic codes
    campaign/        # Export utilities (Markdown, print HTML, schemas)
    db/              # Drizzle schema + singleton
    documents/       # Parser, chunker, classifier, cross-ref
    jurisdictions/   # BC/AB/ON modules: FOI citations, public bodies
    lever/           # FIPPA, public comment, policy brief
    mirror/          # Jurisdiction matching, outcome evaluation
    parliament/      # OpenParliament API client, Represent API, sync
    pdf/             # @react-pdf/renderer templates, primitives, fonts
    archive/         # Bundles, hashing, diff, shadow detection
    credentials/     # Credential weights, decay, moderator checks
  types/
```

## Design Principles

1. Socratic -- Ask questions, don't give answers
2. Convivial -- Build capacity, don't create dependency
3. Counter-hegemonic -- Make invisible power visible, honestly
4. Transparent -- Every analysis auditable, every source cited
5. Attentive -- Train attention, don't capture it
6. Action-oriented -- Output is filings, not content
7. Commons-governed -- Open source, no single owner
8. Honest -- Acknowledge limitations, surface what's missing

## Design System

- Theme doctrine: dark where you work, light where you read. Dark app chrome by
  default, no user toggle. Light "paper" reading surfaces via `.dark-island`
  (briefing, legal/FOI text). The landing page travels dark → light on scroll
  via `.light-scope`. See `globals.css`'s header comment for the full doctrine.
- Token mechanism: `@theme inline` in `globals.css` (required — non-inline
  `@theme` resolves at `:root` and can't be overridden by a nested scope).
  Always reference `var(--accent-{arm})` / `bg-{arm}` tokens, never a
  hardcoded hex — hex bypasses theme scoping entirely.
- Arm accents (current dark values — see `globals.css` for the source of
  truth and the `.light-scope` equivalents): Scout `#B088C8`, Oracle
  `#89B4C8`, Gadfly `#C8A84B`, Lever `#DA6E6E`, Mirror `#5BC88A`, Votes
  `#D4764E`.
- Apple-esque: generous whitespace, subtle shadows, rounded corners
- Typography: Fraunces (display), Instrument Sans (UI/body), Source Serif 4
  (editorial and legal/FOI docs), Geist Mono (monospace)
- Component language: token-based surfaces/borders, e.g. `bg-surface-1
  border border-border rounded-xl` (or `bg-surface-0/60 backdrop-blur-md` for
  overlays) — not raw `bg-black`/`border-white` opacity stacks
- Shared primitives: `src/components/ui/` (EmptyState, StatusPill, CTAButton,
  CrossArmActions, MarkdownProse) and `src/components/layout/arm-header.tsx`
  (per-arm page header) — reach for these before hand-rolling
- PDF exports: light mode (`#fafaf9` bg), print-optimized, Instrument Sans +
  Inter + Source Serif 4 (registered independently in `src/lib/pdf/fonts.ts`
  — `@react-pdf/renderer` can't consume the app's `next/font` variables)

## Critical Rules

- The Gadfly NEVER answers its own questions
- The Lever uses template-based legal citations (never AI-generated)
- The Oracle is a lens, not an advocate
- The Mirror only cites real jurisdictions with real data
- No machine output carries governance weight: no AI votes, holds credentials, moderates autonomously, or decides
- Every feature must pass the Illich test: does it make the citizen more capable WITHOUT the tool?

## Philosophical Foundation

Full sourcebook at ~/marvin/content/reference/the-republic/
Architecture doc at ~/marvin/content/reference/the-republic/ARCHITECTURE.md
Roadmap at ~/marvin/content/reference/the-republic/ROADMAP.md
