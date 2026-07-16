/**
 * Resolves the database URL used by migration/DDL tooling (drizzle-kit via
 * drizzle.config.ts, scripts/apply-custom-migrations.ts).
 *
 * Migrations, DDL, and long transactions cannot run against the :6543
 * transaction-mode pooler — it doesn't support prepared statements or session
 * state. They must run against the :5432 SESSION-mode pooler, via
 * DIRECT_DATABASE_URL. The truly-direct host (db.<ref>.supabase.co) is
 * IPv6-only and unreachable from this stack (Netlify) — it is NOT a fallback.
 *
 * The app RUNTIME does not use this helper or DIRECT_DATABASE_URL — it always
 * reads DATABASE_URL (src/lib/db/index.ts), which points at the :6543
 * transaction pooler.
 *
 * DIRECT_DATABASE_URL falls back to DATABASE_URL when unset, so nothing
 * breaks before the env var is provisioned.
 */
export function resolveMigrationDatabaseUrl(): string {
  const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DIRECT_DATABASE_URL or DATABASE_URL environment variable is required for migration tooling.'
    )
  }
  return url
}
