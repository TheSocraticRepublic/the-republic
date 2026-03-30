# The Republic — Civic AI Framework

## What This Is

An open-source civic AI tool that makes institutional power legible to ordinary citizens. Upload a government document, get plain-language analysis, explore it through Socratic inquiry, generate real civic actions (FOI requests, public comments), and compare policies across jurisdictions.

## Tech Stack

- Next.js 16, React 19, TypeScript 5
- Drizzle ORM + PostgreSQL (Supabase) with pgvector for embeddings
- Claude SDK + Vercel AI SDK for streaming
- Tailwind CSS 4, Radix UI
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
    (auth)/login/    # Magic code auth
    api/             # API routes per arm
  components/
    layout/          # App shell, sidebar, nav
    oracle/          # Document cards, analysis panels
    gadfly/          # Socratic thread, insight tracker
    lever/           # FIPPA builder, comment editor
    mirror/          # Comparison cards, outcome timelines
    ui/              # Shared primitives
  lib/
    ai/prompts/      # System prompts per arm (THE critical files)
    ai/              # RAG, embeddings, cache, briefing
    auth/            # JWT, magic codes
    db/              # Drizzle schema + singleton
    documents/       # Parser, chunker, classifier, cross-ref
    lever/           # FIPPA, public comment, policy brief, PDF
    mirror/          # Jurisdiction matching, outcome evaluation
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
- Typography: Plus Jakarta Sans (display), Inter (body), SF Mono (data)
- Component language: bg-black/60 backdrop-blur-md border border-white/10 rounded-xl

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
