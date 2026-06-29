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
 *   DATABASE_URL must be set (direct Supabase endpoint, not the pgBouncer pooler).
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

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

// Supabase Root 2021 CA — same cert as src/lib/db/index.ts.
// Required for verified TLS against both the direct endpoint (:5432) and
// the transaction pooler (:6543). See src/lib/db/index.ts for renewal notes.
const SUPABASE_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----`

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is required.')
    console.error('See drizzle/DR.md for setup instructions.')
    process.exit(1)
  }

  const isProduction = process.env.NODE_ENV === 'production'
  const sslConfig = isProduction
    ? { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true }
    : { rejectUnauthorized: false }

  const sql = postgres(databaseUrl, {
    max: 1,
    ssl: sslConfig,
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
