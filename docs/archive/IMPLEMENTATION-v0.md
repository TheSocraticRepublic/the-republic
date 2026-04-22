# Phase 0.1 Implementation Plan — Foundation

**Project:** /home/leesalo/Projects/the-republic/
**Plan source:** ~/marvin/state/plans/the-republic-phase0.md
**Architecture:** ~/marvin/content/reference/the-republic/ARCHITECTURE.md

---

## Overview

Set up the foundation: database schema, auth, rate limiting, app shell with dark mode, arm-switcher sidebar, landing page, and Netlify deploy pipeline.

## Task Breakdown

### Task 1: Dependencies

Install all Phase 0 dependencies:

```
npm install drizzle-orm @neondatabase/serverless postgres
npm install @anthropic-ai/sdk @ai-sdk/anthropic @ai-sdk/react ai
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tabs @radix-ui/react-tooltip @radix-ui/react-slot
npm install jose
npm install @upstash/redis @upstash/ratelimit
npm install lucide-react
npm install clsx tailwind-merge
npm install server-only
npm install -D drizzle-kit @types/node
npm install -D vitest @vitest/coverage-v8
```

### Task 2: Database Schema

Create `src/lib/db/schema.ts` with Drizzle ORM. Core tables:

**users** — id (uuid pk), email, createdAt, lastLoginAt

**documents** — id (uuid pk), userId (fk), title, sourceUrl, documentType (enum: zoning_bylaw, budget, council_minutes, environmental_assessment, policy, foi_response, lobbyist_registration, campaign_finance, other), rawText, pageCount, wordCount, extractionQuality (float 0-1), status (enum: processing, ready, failed), createdAt, updatedAt

**document_chunks** — id (uuid pk), documentId (fk), content (text), chunkIndex (int), sectionHeading, embedding (vector(1024)), tokenCount, createdAt

**analyses** — id (uuid pk), documentId (fk), summary (text), keyFindings (jsonb), powerMap (jsonb — beneficiaries, affected, decisionMakers, fundingSources, oversightGaps), missingInfo (jsonb), hiddenAssumptions (jsonb), questionsToAsk (jsonb), model (text), promptVersion (text), createdAt

**cross_references** — id (uuid pk), sourceDocId (fk), targetDocId (fk), relationshipType (enum: cites, contradicts, amends, supersedes, references), description (text), confidence (float), createdAt

**gadfly_sessions** — id (uuid pk), userId (fk), documentId (fk nullable), title, complexityLevel (int 1-5 default 1), questionCount (int default 0), insightCount (int default 0), mode (enum: socratic, direct), status (enum: active, completed, abandoned), createdAt, updatedAt

**gadfly_turns** — id (uuid pk), sessionId (fk), role (enum: gadfly, citizen), content (text), questionType (enum: clarifying, probing, challenging, connecting, action — nullable, gadfly turns only), turnIndex (int), createdAt

**insight_markers** — id (uuid pk), turnId (fk), sessionId (fk), insight (text), category (text), createdAt

**lever_actions** — id (uuid pk), userId (fk), sessionId (fk nullable), documentId (fk nullable), actionType (enum: fippa_request, public_comment, policy_brief, legal_template), title, content (text), metadata (jsonb), pdfUrl (text nullable), status (enum: draft, final, filed), createdAt, updatedAt

**jurisdictions** — id (uuid pk), name, country, province, municipalType (enum: city, district, regional_district, township, village, province, federal), population (int nullable), annualBudget (numeric nullable), dataPortalUrl (text nullable), fippaBody (text nullable), createdAt

**jurisdiction_policies** — id (uuid pk), jurisdictionId (fk), policyArea (enum: zoning, housing, transit, budget_transparency, environment, foi_transparency, procurement, other), title, description (text), embedding (vector(1024)), sourceUrl, implementedDate (date nullable), lastVerifiedAt (timestamp), createdAt

**policy_outcomes** — id (uuid pk), policyId (fk), metric, value (text), measureDate (date), sourceUrl, notes (text nullable), createdAt

All tables use uuid default gen_random_uuid(). All have appropriate indexes. Vector columns use ivfflat index with lists = 100.

### Task 3: Database Client

Create `src/lib/db/index.ts` — lazy singleton pattern (same as Fern):

```typescript
import { drizzle } from 'drizzle-orm/neon-serverless'
import { Pool } from '@neondatabase/serverless'
import * as schema from './schema'

let db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  if (!db) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
    db = drizzle(pool, { schema })
  }
  return db
}
```

Create `drizzle.config.ts`:
```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!
  }
})
```

### Task 4: Rate Limiting

Create `src/lib/rate-limit.ts` using Upstash pattern from Aspect:

```typescript
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(30, '60 s'),
  analytics: true,
  prefix: 'republic',
})
```

### Task 5: Auth (Magic Code)

Create `src/lib/auth/`:
- `magic-code.ts` — generate 6-digit code, store in DB with expiry (10 min), verify
- `jwt.ts` — sign/verify JWT using jose, 7-day expiry
- `middleware.ts` — check JWT on (app) routes, redirect to login if missing

### Task 6: App Shell & Dark Mode

Create `src/app/globals.css` — dark mode base styles:
- bg-neutral-950 as base background
- text-neutral-100 as base text
- Import Plus Jakarta Sans, Inter, SF Mono from Google Fonts / system

Create `src/app/layout.tsx` — root layout with dark class, fonts, metadata:
- Title: "The Republic"
- Description: "Making institutional power legible"
- Dark mode forced (class="dark" on html)

Create `src/app/(app)/layout.tsx` — authenticated layout with sidebar:
- Left sidebar with arm navigation (Oracle, Gadfly, Lever, Mirror)
- Each arm has its accent color icon
- Current arm highlighted
- Main content area with proper padding
- Responsive: sidebar collapses on mobile

Create `src/components/layout/sidebar.tsx`:
- Arm links with Lucide icons:
  - Oracle: Eye icon, color #89B4C8
  - Gadfly: MessageCircleQuestion icon, color #C8A84B
  - Lever: FileText icon, color #C85B5B
  - Mirror: GitCompare icon, color #5BC88A
- Active state styling
- Bottom: user email, sign out

Create `src/components/layout/app-shell.tsx` — wrapper component

### Task 7: Landing Page

Create `src/app/page.tsx` — public landing page:
- Dark background (neutral-950)
- Centered content, generous whitespace
- Title: "The Republic" in Plus Jakarta Sans, large
- Subtitle: "The examined institution"
- Four arm cards in a grid, each with:
  - Arm name and accent color border
  - One-line description
  - Lucide icon
- "Get Started" CTA button
- No emojis, no gradients, minimal animation
- Component style: bg-black/60 backdrop-blur-md border border-white/10 rounded-xl

### Task 8: Login Page

Create `src/app/(auth)/login/page.tsx`:
- Email input, "Send Code" button
- After code sent: 6-digit code input
- Minimal dark design, centered
- Error states for invalid code / expired code

### Task 9: Health Check API

Create `src/app/api/health/route.ts`:
- GET returns { status: 'ok', timestamp, version }
- No auth required

### Task 10: Netlify Config

Create `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[build.environment]
  NODE_VERSION = "22"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

### Task 11: Environment Template

Create `.env.example`:
```
DATABASE_URL=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
ANTHROPIC_API_KEY=
JWT_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Task 12: Verify

- `npm run build` succeeds
- Landing page renders in dark mode
- Login page renders
- Health check returns 200
- Schema generates migration without errors

---

## Relay Instructions

This plan can be split across multiple relay sessions to avoid context size issues:

**Relay A (schema + infra):** Tasks 1-4, 9-11
**Relay B (auth + shell):** Tasks 5-8
**Relay C (verify):** Task 12

Each relay reads CLAUDE.md for design principles and this file for specs. No philosophical context needed.

## Design Reference

- Dark mode: bg-neutral-950, text-neutral-100
- Accents: Oracle #89B4C8, Gadfly #C8A84B, Lever #C85B5B, Mirror #5BC88A
- Components: bg-black/60 backdrop-blur-md border border-white/10 rounded-xl
- Fonts: Plus Jakarta Sans (display), Inter (body), SF Mono (data)
- Apple-esque: generous whitespace, subtle shadows, rounded corners
- NO emojis, NO gradients, NO excessive animation
