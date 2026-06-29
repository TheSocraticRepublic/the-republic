# Open Cave — Disaster Recovery (Schema Reproduction)

This document describes how to reproduce the full Open Cave database schema on a
fresh PostgreSQL instance. It is the authoritative runbook for DB-level DR.

## Why two steps?

The schema has two distinct layers:

1. **Structure layer** — tables, enums, foreign keys, indexes that drizzle-kit
   can generate and manage. Tracked in `drizzle/_journal.json` (entry: `0000`).

2. **Policy/index layer** — RLS policies, HNSW vector indexes, `ALTER TYPE ADD VALUE`,
   custom constraints. drizzle-kit's `generate` command cannot emit these constructs,
   so they live as hand-authored SQL in `drizzle/migrations/000N_*.sql`.

drizzle-kit's migration journal intentionally tracks **only** `0000` (the baseline
schema snapshot). This is not drift or an accident — it reflects the honest boundary
of what drizzle-kit can represent. The `000N` files are living idempotent scripts,
not immutable history entries.

## Two-step DR procedure

### Step 1 — Structure (drizzle-kit)

```bash
# Apply the baseline schema (creates all tables, enums, FKs)
DATABASE_URL=<direct-connection-url> npx drizzle-kit push
```

`drizzle-kit push` compares `src/lib/db/schema.ts` against the target database and
applies any missing structure. On a fresh database it applies everything; on an existing
database it is additive (will not drop columns or tables).

**Requirement:** The target must be a Supabase-flavored PostgreSQL (or compatible):
- `auth.uid()` function must exist (Supabase Auth extension)
- `service_role` role must exist (Supabase service role)
- `vector` extension must be available (pgvector, installable via `CREATE EXTENSION IF NOT EXISTS vector`)

Plain stock PostgreSQL is **not sufficient** for step 2 — the RLS policies reference
`auth.uid()` and the GRANT statements reference `service_role`. A local `psql` setup
will error on those. Use a real Supabase project (or a Supabase branch via `supabase branches create`).

### Step 2 — Policies, indexes, constraints (custom runner)

```bash
# Apply all hand-authored SQL migrations in order
DATABASE_URL=<direct-connection-url> npm run db:migrate-custom
```

This runs `scripts/apply-custom-migrations.ts`, which:
- Reads `drizzle/migrations/000N_*.sql` in sorted order
- Applies each in a transaction (files containing `ALTER TYPE ... ADD VALUE` run
  outside a transaction, as required by PostgreSQL)
- Tracks applied files in `_custom_migrations` so re-runs are safe (idempotent)
- Exits non-zero on the first error

The runner is idempotent: running it twice is safe. All migration files use
`IF NOT EXISTS` / `DROP ... IF EXISTS` guards. The `_custom_migrations` tracking
table prevents double-application.

### Verify

After both steps, verify the schema matches production:

```sql
-- Should return relrowsecurity=true for all user-owned tables
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname IN (
  'investigations', 'documents', 'feedback', 'lever_actions',
  'gadfly_sessions', 'forum_threads', 'forum_posts', 'users'
)
ORDER BY relname;

-- Should return 2 HNSW indexes
SELECT indexname FROM pg_indexes
WHERE indexname IN (
  'document_chunks_embedding_hnsw_idx',
  'jurisdiction_policies_embedding_hnsw_idx'
);

-- Should return policy count > 100
SELECT count(*) FROM pg_policies WHERE schemaname = 'public';
```

## Migration file inventory

| File | Contents | Transactional? |
|------|----------|----------------|
| `0001_enable_rls.sql` | RLS ENABLE/FORCE on all tables, GRANT service_role, 104 RLS policies | Yes |
| `0002_vector_extension_hnsw_indexes.sql` | pgvector extension, 2 HNSW indexes | Yes |
| `0003_investigation_status_resilience.sql` | `ALTER TYPE ADD VALUE` (non-transactional), add columns, backfill rows | No (ALTER TYPE ADD VALUE) |
| `0004_add_feedback_table.sql` | feedback enum, feedback table, indexes | Yes |
| `0005_investigation_generation_started.sql` | Add `generation_started_at` column, backfill | Yes |
| `0006_feedback_rls_and_cascade.sql` | feedback RLS + FK cascade | Yes |
| `0007_check_constraints.sql` | CHECK: investigation_outcomes.satisfaction (1–5), governance_proposals.quorum_threshold (0–1) | Yes |

All files are **idempotent living scripts** — not immutable history. They can be
updated (e.g., to add new policies) and re-applied safely. The `_custom_migrations`
tracking table records the first successful application per filename; if a file is
updated after its first run, delete its row from `_custom_migrations` to re-apply:

```sql
DELETE FROM _custom_migrations WHERE filename = '0001_enable_rls.sql';
-- then re-run: npm run db:migrate-custom
```

## Connection note

`DATABASE_URL` must point at the **direct** Supabase endpoint (`db.<ref>.supabase.co:5432`)
for migration work. The transaction pooler (`:6543`) does not support all DDL operations
(e.g., `CREATE EXTENSION`, multi-statement transactions). The CA cert in
`scripts/apply-custom-migrations.ts` and `src/lib/db/index.ts` covers both endpoints.

## Running `db:migrate-custom` against live infrastructure

Two prerequisites apply when running the custom migration runner against a real Supabase
project (staging or production):

**1. Set `NODE_ENV=production`.**
The runner (`scripts/apply-custom-migrations.ts`) branches on `NODE_ENV`:

- `production` → TLS with `rejectUnauthorized: true` and the pinned Supabase Root 2021 CA
- anything else → `rejectUnauthorized: false` (safe for local dev, NOT acceptable for live infra)

Always prefix the command:
```bash
NODE_ENV=production DATABASE_URL=<direct-url> npm run db:migrate-custom
```

**2. Install devDependencies first.**
The runner is executed via `tsx`, which is a devDependency. A production-only install
(`npm ci --omit=dev`) will not include `tsx` and the script will fail to run. Before
executing on a fresh CI or DR environment, run a full install:
```bash
npm install   # or: npm ci  (without --omit=dev)
```

## Deploy rollback

If a production deploy introduces a regression, roll back as follows:

### 1. Identify the last good SHA

In the Netlify dashboard: **Deploys → [the prior successful deploy] → Options → Publish deploy**.
This redeploys from the previously built artifact without a new git push.

Alternatively, identify the git SHA of the prior release and push it as a new commit to `main`.

### 2. Snapshot environment variables before any change

Before modifying or rotating secrets, export the current env state:
```
Netlify dashboard → Site settings → Environment variables → Export
```
Keep the snapshot for the duration of the rollback window. If a deploy included an env change
that must also be reverted, re-enter the prior values before the rollback deploy finishes.

### 3. Database migration rollback

Application code and database schema must stay in sync. Each migration file in
`drizzle/migrations/` includes inline rollback SQL in a comment at the top of the file.

**Current migrations with inline rollback:**
- `0006_feedback_rls_and_cascade.sql` — rollback SQL at top of file
- `0007_check_constraints.sql` — rollback SQL at top of file (DROP CONSTRAINT IF EXISTS)

To run a rollback migration:
```bash
# Use the direct endpoint, not the pooler
NODE_ENV=production DATABASE_URL=<direct-url> psql "$DATABASE_URL" -f <rollback.sql>
```

Rollbacks to schema structure (table drops, column removals) are irreversible and must be
planned separately. None of the current migrations require structural rollback.

### 4. Verify

After rollback, confirm:
- The Netlify deploy shows the prior SHA in the deploy details
- The app responds to `/` and a key authenticated route
- No new error spikes in Sentry
