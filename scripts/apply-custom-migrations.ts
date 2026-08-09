/**
 * Custom migration runner for the Open Cave RLS/HNSW/policy layer.
 *
 * Reads drizzle/migrations/000N_*.sql in sorted order and applies each file
 * to the database. Idempotent: a _custom_migrations tracking table records
 * which files have been applied; re-running skips already-applied migrations.
 *
 * Usage:
 *   npx tsx scripts/apply-custom-migrations.ts
 *
 * Prerequisites:
 *   DIRECT_DATABASE_URL must be set (the :5432 SESSION-mode Supabase pooler
 *   endpoint) — or DATABASE_URL as a fallback. DDL and long transactions
 *   cannot run against the :6543 transaction-mode pooler (no prepared
 *   statements, no session state). The truly-direct host
 *   (db.<ref>.supabase.co) is IPv6-only and unreachable from this stack — it
 *   is NOT used as a fallback. See scripts/lib/migration-database-url.ts.
 *   The schema structure must already exist (either from drizzle-kit push or 0000 baseline).
 *   See drizzle/DR.md for the full two-step disaster-recovery procedure.
 *
 * Why this exists:
 *   drizzle-kit generate/migrate cannot emit RLS policies, HNSW indexes, or
 *   ALTER TYPE statements. These require hand-authored SQL. drizzle-kit's journal
 *   intentionally tracks only 0000 (the baseline schema snapshot). This runner
 *   handles the policy/index layer that drizzle-kit cannot.
 */

import postgres from 'postgres'
import * as fs from 'fs'
import * as path from 'path'
import * as url from 'url'
import { resolveMigrationDatabaseUrl } from './lib/migration-database-url'
import { supabaseSslConfig } from './lib/supabase-ssl'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

async function main() {
  let databaseUrl: string
  try {
    databaseUrl = resolveMigrationDatabaseUrl()
  } catch (err) {
    console.error(`ERROR: ${err instanceof Error ? err.message : err}`)
    console.error('See drizzle/DR.md for setup instructions.')
    process.exit(1)
  }

  const sql = postgres(databaseUrl, {
    max: 1,
    ssl: supabaseSslConfig(),
  })

  try {
    // Ensure tracking table exists
    await sql`
      CREATE TABLE IF NOT EXISTS _custom_migrations (
        id          serial      PRIMARY KEY,
        filename    text        NOT NULL UNIQUE,
        applied_at  timestamptz NOT NULL DEFAULT now()
      )
    `

    // Discover migration files
    const migrationsDir = path.join(__dirname, '..', 'drizzle', 'migrations')
    const allFiles = fs.readdirSync(migrationsDir)
    const migrationFiles = allFiles
      .filter((f) => /^0+\d+_.+\.sql$/.test(f))
      .sort()

    if (migrationFiles.length === 0) {
      console.log('No migration files found in drizzle/migrations/.')
      return
    }

    console.log(`Found ${migrationFiles.length} migration file(s).`)

    // Fetch already-applied filenames
    const applied = await sql<{ filename: string }[]>`
      SELECT filename FROM _custom_migrations ORDER BY filename
    `
    const appliedSet = new Set(applied.map((r) => r.filename))

    let appliedCount = 0
    let skippedCount = 0

    for (const filename of migrationFiles) {
      if (appliedSet.has(filename)) {
        console.log(`  SKIP   ${filename} (already applied)`)
        skippedCount++
        continue
      }

      const filePath = path.join(migrationsDir, filename)
      const sqlContent = fs.readFileSync(filePath, 'utf-8')

      // 0003 contains ALTER TYPE ... ADD VALUE. PostgreSQL 15+ (which Supabase runs)
      // allows ALTER TYPE ADD VALUE inside a transaction, but we retain the autocommit
      // path conservatively — in case the migration is ever replayed against an older
      // PG instance or tested locally with a stock PG 14 image.
      const needsAutocommit = /ALTER\s+TYPE\s+\S+\s+ADD\s+VALUE/i.test(sqlContent)

      // IMPORTANT: Migrations that run in the autocommit path (needsAutocommit = true)
      // MUST use IF NOT EXISTS / DROP ... IF EXISTS guards on ALL DDL statements.
      // The autocommit path does not wrap DDL in a transaction, so a partial failure
      // leaves the database in an intermediate state. IF NOT EXISTS guards ensure the
      // migration can be safely re-run to completion after a failure.
      // This also applies to migrations applied via MCP (which bypass the tracking
      // table entirely): make every DDL statement idempotent, not just the autocommit ones.

      console.log(`  APPLY  ${filename}${needsAutocommit ? ' (autocommit — ALTER TYPE ADD VALUE)' : ''}`)

      try {
        if (needsAutocommit) {
          // Run as individual statements without an explicit transaction.
          // The migration file uses IF NOT EXISTS guards for idempotency.
          // Tracking INSERT is outside the txn here — there is no txn to join.
          await sql.unsafe(sqlContent)
          await sql`
            INSERT INTO _custom_migrations (filename) VALUES (${filename})
          `
        } else {
          // Wrap both the DDL and the tracking INSERT in a single transaction
          // so a partial failure never leaves an untracked or partially-applied migration.
          // Note: txSql is TransactionSql<{}> which via Omit<Sql<{}>, ...> loses the
          // tagged-template call signatures in TypeScript (a known TS limitation with Omit).
          // txSql.unsafe() with positional parameters is the correct workaround.
          await sql.begin(async (txSql) => {
            await txSql.unsafe(sqlContent)
            await txSql.unsafe(
              'INSERT INTO _custom_migrations (filename) VALUES ($1)',
              [filename]
            )
          })
        }
        appliedCount++
      } catch (err) {
        console.error(`  ERROR  ${filename}:`, err instanceof Error ? err.message : err)
        console.error('Aborting — fix the failing migration and re-run.')
        process.exit(1)
      }
    }

    console.log(`\nDone. Applied: ${appliedCount}, Skipped: ${skippedCount}`)
  } finally {
    await sql.end()
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
