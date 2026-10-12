import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  assertLocalQaDatabaseUrl,
  assertLocalMigrationTarget,
  assertLocalAppTarget,
  assertLocalQaTargets,
  isLoopbackDatabaseUrl,
  parseDatabaseUrl,
} from '../../scripts/lib/local-db-guard'

// The writer guard (plan: "Isolation from production credentials"). Every
// database writer the harness launches is checked against the URL that tool
// will actually dial: loopback host, port 55432, database name ending `_qa`.

const LOCAL = 'postgres://qa_app:pw@127.0.0.1:55432/republic_qa'
const LOCAL_NAME = 'postgresql://qa_app:pw@localhost:55432/republic_qa'
const REMOTE = 'postgres://app:pw@aws-1-us-east-2.pooler.supabase.com:5432/postgres'

describe('assertLocalQaDatabaseUrl', () => {
  it('accepts the harness database on 127.0.0.1 and on localhost', () => {
    expect(() => assertLocalQaDatabaseUrl(LOCAL, 'DATABASE_URL')).not.toThrow()
    expect(() => assertLocalQaDatabaseUrl(LOCAL_NAME, 'DATABASE_URL')).not.toThrow()
  })

  it('refuses a non-loopback host', () => {
    expect(() => assertLocalQaDatabaseUrl(REMOTE, 'DATABASE_URL')).toThrow(
      /DATABASE_URL rejected: host "aws-1-us-east-2\.pooler\.supabase\.com"/
    )
    expect(() =>
      assertLocalQaDatabaseUrl('postgres://u:p@10.0.0.5:55432/republic_qa', 'DATABASE_URL')
    ).toThrow(/is not 127\.0\.0\.1 or localhost/)
  })

  it('refuses a loopback lookalike host', () => {
    expect(() =>
      assertLocalQaDatabaseUrl(
        'postgres://u:p@127.0.0.1.evil.example.com:55432/republic_qa',
        'DATABASE_URL'
      )
    ).toThrow(/is not 127\.0\.0\.1 or localhost/)
  })

  it('refuses the wrong port, and a port left to the PGPORT/5432 default', () => {
    expect(() =>
      assertLocalQaDatabaseUrl('postgres://u:p@127.0.0.1:5432/republic_qa', 'DATABASE_URL')
    ).toThrow(/port "5432" is not 55432/)
    expect(() =>
      assertLocalQaDatabaseUrl('postgres://u:p@127.0.0.1/republic_qa', 'DATABASE_URL')
    ).toThrow(/port "\(unset\)" is not 55432/)
  })

  it('refuses a database name that does not end in _qa', () => {
    expect(() =>
      assertLocalQaDatabaseUrl('postgres://u:p@127.0.0.1:55432/postgres', 'DATABASE_URL')
    ).toThrow(/database "postgres" does not end in _qa/)
    expect(() =>
      assertLocalQaDatabaseUrl('postgres://u:p@127.0.0.1:55432/republic_qa_old', 'DATABASE_URL')
    ).toThrow(/does not end in _qa/)
    expect(() =>
      assertLocalQaDatabaseUrl('postgres://u:p@127.0.0.1:55432/_qa', 'DATABASE_URL')
    ).toThrow(/does not end in _qa/)
  })

  it('refuses a database left to the PGDATABASE default', () => {
    expect(() =>
      assertLocalQaDatabaseUrl('postgres://u:p@127.0.0.1:55432', 'DATABASE_URL')
    ).toThrow(/database "\(unset\)"/)
  })

  it('refuses an empty host (postgres.js would fall back to PGHOST)', () => {
    expect(() =>
      assertLocalQaDatabaseUrl('postgres://:55432/republic_qa', 'DATABASE_URL')
    ).toThrow(/rejected/)
  })

  it('refuses a multi-host list even when a loopback host comes second', () => {
    expect(() =>
      assertLocalQaDatabaseUrl(
        'postgres://u:p@evil.example.com:5432,127.0.0.1:55432/republic_qa',
        'DATABASE_URL'
      )
    ).toThrow(/several hosts/)
    expect(() =>
      assertLocalQaDatabaseUrl('postgres://u:p@x,evil@127.0.0.1:55432/republic_qa', 'DATABASE_URL')
    ).toThrow(/several hosts/)
  })

  it('refuses a non-postgres scheme and an unset value', () => {
    expect(() =>
      assertLocalQaDatabaseUrl('mysql://u:p@127.0.0.1:55432/republic_qa', 'DATABASE_URL')
    ).toThrow(/not postgres/)
    expect(() => assertLocalQaDatabaseUrl(undefined, 'DATABASE_URL')).toThrow(
      /DATABASE_URL is not set/
    )
    expect(() => assertLocalQaDatabaseUrl('', 'DATABASE_URL')).toThrow(/DATABASE_URL is not set/)
  })
})

describe('parseDatabaseUrl / isLoopbackDatabaseUrl', () => {
  it('reports the host, port and database postgres.js will use', () => {
    expect(parseDatabaseUrl(LOCAL)).toEqual({
      host: '127.0.0.1',
      port: '55432',
      database: 'republic_qa',
    })
  })

  it('is loopback only for 127.0.0.1 and localhost', () => {
    expect(isLoopbackDatabaseUrl(LOCAL)).toBe(true)
    expect(isLoopbackDatabaseUrl(LOCAL_NAME)).toBe(true)
    expect(isLoopbackDatabaseUrl(REMOTE)).toBe(false)
  })
})

describe('effective-URL guards', () => {
  let saved: { DATABASE_URL?: string; DIRECT_DATABASE_URL?: string }

  beforeEach(() => {
    saved = {
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL,
    }
    delete process.env.DATABASE_URL
    delete process.env.DIRECT_DATABASE_URL
  })

  afterEach(() => {
    for (const key of ['DATABASE_URL', 'DIRECT_DATABASE_URL'] as const) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  })

  it('REGRESSION: local DATABASE_URL with a remote DIRECT_DATABASE_URL is refused', () => {
    // The migration tools prefer DIRECT_DATABASE_URL, so this pair would
    // migrate the remote database while DATABASE_URL looked local.
    process.env.DATABASE_URL = LOCAL
    process.env.DIRECT_DATABASE_URL = REMOTE
    expect(() => assertLocalMigrationTarget()).toThrow(
      /DIRECT_DATABASE_URL \(effective migration URL\) rejected/
    )
    expect(() => assertLocalQaTargets()).toThrow(/DIRECT_DATABASE_URL/)
    // The app guard alone reads DATABASE_URL, which is local.
    expect(() => assertLocalAppTarget()).not.toThrow()
  })

  it('accepts a local DATABASE_URL when DIRECT_DATABASE_URL is unset (resolver falls back)', () => {
    process.env.DATABASE_URL = LOCAL
    expect(() => assertLocalMigrationTarget()).not.toThrow()
    expect(() => assertLocalQaTargets()).not.toThrow()
  })

  it('accepts both URLs when both are local', () => {
    process.env.DATABASE_URL = LOCAL
    process.env.DIRECT_DATABASE_URL = LOCAL_NAME
    expect(() => assertLocalQaTargets()).not.toThrow()
  })

  it('refuses a remote DATABASE_URL in the app guard and the combined guard', () => {
    process.env.DATABASE_URL = REMOTE
    process.env.DIRECT_DATABASE_URL = LOCAL
    expect(() => assertLocalMigrationTarget()).not.toThrow()
    expect(() => assertLocalAppTarget()).toThrow(/DATABASE_URL rejected/)
    expect(() => assertLocalQaTargets()).toThrow(/DATABASE_URL rejected/)
  })

  it('refuses when neither URL is set', () => {
    expect(() => assertLocalMigrationTarget()).toThrow(/migration database URL rejected/)
    expect(() => assertLocalAppTarget()).toThrow(/DATABASE_URL is not set/)
  })
})
