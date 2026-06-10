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
    ui/              # Shared primitives (cross-arm actions)
  lib/
    ai/prompts/      # System prompts per arm (THE critical files)
    ai/              # RAG, embeddings (stubbed), search context, model ID
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

- Dark mode always
- Arm accents: Oracle #89B4C8, Gadfly #C8A84B, Lever #C85B5B, Mirror #5BC88A
- Apple-esque: generous whitespace, subtle shadows, rounded corners
- Typography: Plus Jakarta Sans (display), Inter (body), Source Serif 4 (legal/FOI docs)
- Component language: bg-black/60 backdrop-blur-md border border-white/10 rounded-xl
- PDF exports: light mode (#fafaf9 bg), print-optimized, Plus Jakarta Sans + Inter + Source Serif 4

## Critical Rules

- The Gadfly NEVER answers its own questions
- The Lever uses template-based legal citations (never AI-generated)
- The Oracle is a lens, not an advocate
- The Mirror only cites real jurisdictions with real data
- Every feature must pass the Illich test: does it make the citizen more capable WITHOUT the tool?

## Philosophical Foundation

Full sourcebook at ~/marvin/content/reference/the-republic/
Architecture doc at ~/marvin/content/reference/the-republic/ARCHITECTURE.md
Roadmap at ~/marvin/content/reference/the-republic/ROADMAP.md
