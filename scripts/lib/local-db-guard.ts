/**
 * Local-only database guards for the QA harness.
 *
 * Two rules live here, both about refusing to touch anything that is not the
 * disposable local QA database:
 *
 * 1. The local-only TLS rule (`isLoopbackDatabaseUrl`), shared with
 *    scripts/lib/supabase-ssl.ts. TLS may be switched off ONLY when
 *    QA_LOCAL_DB=1 AND the URL's host is 127.0.0.1 or localhost.
 *    src/lib/db/index.ts carries its own copy of the host parsing for the app
 *    runtime (scripts and app have different module roots, the same reason the
 *    Supabase CA is duplicated).
 *
 * 2. The writer guard (`assertLocalQaDatabaseUrl` and friends). Before every
 *    database writer the harness launches, it validates the EFFECTIVE URL that
 *    tool will use:
 *      - `assertLocalMigrationTarget()` validates the URL
 *        resolveMigrationDatabaseUrl() returns, which PREFERS
 *        DIRECT_DATABASE_URL over DATABASE_URL. Every script that resolves its
 *        URL through that helper dials it: drizzle-kit (drizzle.config.ts),
 *        scripts/apply-custom-migrations.ts, AND scripts/seed-jurisdictions.ts.
 *        Checking DATABASE_URL alone would wave through a remote
 *        DIRECT_DATABASE_URL, so this check calls the resolver itself.
 *      - `assertLocalAppTarget()` validates DATABASE_URL only. That is what the
 *        app runtime (src/lib/db/index.ts) dials, and nothing else. It is NOT a
 *        sufficient guard for any script that resolves its URL through
 *        resolveMigrationDatabaseUrl(), the seed included: those must be guarded
 *        with `assertLocalMigrationTarget()` or `assertLocalQaTargets()`.
 *      - `assertLocalQaTargets()` runs both. It is the default for ANY harness
 *        writer; reach for a narrower helper only when the writer's URL source
 *        has been read and is known to be the one that helper validates.
 *    A URL passes only with a loopback host, port 55432 written explicitly, and
 *    a database name ending `_qa` with no `%` in it.
 *
 * Host parsing mirrors postgres.js 3.4 (`parseUrl`/`parseOptions`): an empty
 * host, port or database in the URL makes postgres.js fall back to PGHOST,
 * PGPORT and PGDATABASE, and a comma in the authority is a multi-host list. All
 * of those are refused rather than interpreted, because the guard must judge the
 * address postgres.js will actually dial, not a guess at it. The database name
 * is the RAW (undecoded) path, as postgres.js 3.4.8 takes it
 * (`url.pathname.slice(1)`); any `%` in it is refused, so no percent-escape can
 * make the guard and the driver read different names.
 */

import { resolveMigrationDatabaseUrl } from './migration-database-url'

export const QA_DB_PORT = '55432'
export const QA_DB_NAME_SUFFIX = '_qa'
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost'])

export interface ParsedDatabaseUrl {
  host: string
  port: string
  database: string
}

/**
 * Parse a postgres connection URL into the host, port and database postgres.js
 * will use. Throws on anything the guard cannot judge with certainty: an
 * unparseable URL, a multi-host list, or a non-postgres scheme.
 */
export function parseDatabaseUrl(url: string): ParsedDatabaseUrl {
  if (!url) throw new Error('database URL is empty')

  const schemeEnd = url.indexOf('://')
  if (schemeEnd === -1) throw new Error('database URL has no scheme')
  const scheme = url.slice(0, schemeEnd).toLowerCase()
  if (scheme !== 'postgres' && scheme !== 'postgresql') {
    throw new Error(`database URL scheme "${scheme}" is not postgres`)
  }

  // Same authority extraction postgres.js performs before handing the URL to
  // WHATWG URL (first '@', not last), so a multi-host list cannot hide behind
  // a second '@' that WHATWG URL would treat as the userinfo separator.
  const authority = url.slice(schemeEnd + 3).split(/[?/]/)[0]
  const hostPart = decodeURIComponent(authority.slice(authority.indexOf('@') + 1))
  if (hostPart.includes(',')) {
    throw new Error('database URL lists several hosts; refusing to guess which one is dialled')
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('database URL could not be parsed')
  }

  return {
    host: parsed.hostname.toLowerCase(),
    port: parsed.port,
    // Raw, not decoded: postgres.js dials `url.pathname.slice(1)` verbatim.
    database: parsed.pathname.replace(/^\//, ''),
  }
}

/** True only when the URL's host is 127.0.0.1 or localhost. */
export function isLoopbackDatabaseUrl(url: string): boolean {
  return LOOPBACK_HOSTS.has(parseDatabaseUrl(url).host)
}

/**
 * Throw unless `url` points at the local QA database: loopback host, port
 * 55432, database name ending `_qa`. `label` names the variable in the error.
 */
export function assertLocalQaDatabaseUrl(url: string | undefined, label: string): void {
  if (!url) throw new Error(`${label} is not set; refusing to run a database writer`)

  let parsed: ParsedDatabaseUrl
  try {
    parsed = parseDatabaseUrl(url)
  } catch (err) {
    throw new Error(`${label} rejected: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (!LOOPBACK_HOSTS.has(parsed.host)) {
    throw new Error(
      `${label} rejected: host "${parsed.host || '(empty)'}" is not 127.0.0.1 or localhost`
    )
  }
  if (parsed.port !== QA_DB_PORT) {
    throw new Error(
      `${label} rejected: port "${parsed.port || '(unset)'}" is not ${QA_DB_PORT}`
    )
  }
  if (parsed.database.includes('%')) {
    throw new Error(
      `${label} rejected: database "${parsed.database}" contains a percent-escape; write the name literally`
    )
  }
  if (!parsed.database.endsWith(QA_DB_NAME_SUFFIX) || parsed.database === QA_DB_NAME_SUFFIX) {
    throw new Error(
      `${label} rejected: database "${parsed.database || '(unset)'}" does not end in ${QA_DB_NAME_SUFFIX}`
    )
  }
}

/**
 * Guard for drizzle-kit and the custom migration runner: validates the URL
 * resolveMigrationDatabaseUrl() returns, which is what those tools dial.
 */
export function assertLocalMigrationTarget(): void {
  let effective: string
  try {
    effective = resolveMigrationDatabaseUrl()
  } catch (err) {
    throw new Error(
      `migration database URL rejected: ${err instanceof Error ? err.message : String(err)}`
    )
  }
  const label = process.env.DIRECT_DATABASE_URL !== undefined ? 'DIRECT_DATABASE_URL' : 'DATABASE_URL'
  assertLocalQaDatabaseUrl(effective, `${label} (effective migration URL)`)
}

/**
 * Guard for the app server only: validates DATABASE_URL, which is what
 * src/lib/db/index.ts dials. NOT sufficient on its own for any script that
 * resolves its URL through resolveMigrationDatabaseUrl() (drizzle-kit, the
 * custom runner, scripts/seed-jurisdictions.ts): those prefer
 * DIRECT_DATABASE_URL, so guard them with assertLocalMigrationTarget() or
 * assertLocalQaTargets().
 */
export function assertLocalAppTarget(): void {
  assertLocalQaDatabaseUrl(process.env.DATABASE_URL, 'DATABASE_URL')
}

/**
 * Both guards. The DEFAULT for every harness writer, and what the harness runs
 * before any writer starts.
 */
export function assertLocalQaTargets(): void {
  assertLocalMigrationTarget()
  assertLocalAppTarget()
}
