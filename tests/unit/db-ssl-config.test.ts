import { describe, it, expect } from 'vitest'
import { buildSslConfig } from '@/lib/db'
import { migrationSslConfig, supabaseSslConfig } from '../../scripts/lib/supabase-ssl'

// The local-only QA TLS rule (plan: "Database TLS, local only, production
// verification unchanged"). TLS is off only with QA_LOCAL_DB=1 AND a loopback
// host; the flag with any other host throws; everything else is unchanged.

const REMOTE = 'postgres://app:pw@aws-1-us-east-2.pooler.supabase.com:6543/postgres'
const REMOTE_DIRECT = 'postgres://app:pw@aws-1-us-east-2.pooler.supabase.com:5432/postgres'
const LOOPBACK_IP = 'postgres://qa_app:pw@127.0.0.1:55432/republic_qa'
const LOOPBACK_NAME = 'postgres://qa_app:pw@localhost:55432/republic_qa'
// postgres.js dials the first host of a comma list; WHATWG URL would report
// 127.0.0.1 here, so a naive hostname check would wave it through.
const MULTIHOST = 'postgres://u:p@evil.example.com:5432,127.0.0.1:55432/republic_qa'
// A second '@': postgres.js takes the host after the FIRST '@'
// ("x,evil@127.0.0.1:55432", a multi-host list), WHATWG URL after the last.
const DOUBLE_AT = 'postgres://u:p@x,evil@127.0.0.1:55432/republic_qa'

const PINNED = {
  ca: expect.stringContaining('-----BEGIN CERTIFICATE-----'),
  rejectUnauthorized: true,
}

describe('buildSslConfig (app runtime, src/lib/db/index.ts)', () => {
  it('production without the flag pins the Supabase CA', () => {
    const cfg = buildSslConfig({ nodeEnv: 'production', databaseUrl: REMOTE, qaLocalDb: undefined })
    expect(cfg).toEqual(PINNED)
    expect(cfg && 'ca' in cfg ? cfg.ca : '').toBe(supabaseSslConfig().ca)
  })

  it('production without the flag pins the CA even for a loopback host', () => {
    expect(
      buildSslConfig({ nodeEnv: 'production', databaseUrl: LOOPBACK_IP, qaLocalDb: undefined })
    ).toEqual(PINNED)
  })

  it('a flag value other than "1" does not switch TLS off', () => {
    expect(
      buildSslConfig({ nodeEnv: 'production', databaseUrl: LOOPBACK_IP, qaLocalDb: 'true' })
    ).toEqual(PINNED)
  })

  it('development without the flag keeps today\'s relaxed config', () => {
    expect(
      buildSslConfig({ nodeEnv: 'development', databaseUrl: REMOTE, qaLocalDb: undefined })
    ).toEqual({ rejectUnauthorized: false })
  })

  it('the flag with a loopback IP disables TLS', () => {
    expect(
      buildSslConfig({ nodeEnv: 'production', databaseUrl: LOOPBACK_IP, qaLocalDb: '1' })
    ).toBe(false)
  })

  it('the flag with localhost disables TLS', () => {
    expect(
      buildSslConfig({ nodeEnv: 'production', databaseUrl: LOOPBACK_NAME, qaLocalDb: '1' })
    ).toBe(false)
  })

  it('the flag with a remote host throws in production', () => {
    expect(() =>
      buildSslConfig({ nodeEnv: 'production', databaseUrl: REMOTE, qaLocalDb: '1' })
    ).toThrow(/QA_LOCAL_DB=1.*not 127\.0\.0\.1 or localhost/)
  })

  it('the flag with a remote host is equally refused in development', () => {
    expect(() =>
      buildSslConfig({ nodeEnv: 'development', databaseUrl: REMOTE, qaLocalDb: '1' })
    ).toThrow(/refusing to connect/)
  })

  it('the flag with a multi-host list is refused even when a loopback host is listed', () => {
    expect(() =>
      buildSslConfig({ nodeEnv: 'production', databaseUrl: MULTIHOST, qaLocalDb: '1' })
    ).toThrow(/refusing to connect/)
    expect(() =>
      buildSslConfig({ nodeEnv: 'production', databaseUrl: DOUBLE_AT, qaLocalDb: '1' })
    ).toThrow(/refusing to connect/)
  })

  it('the flag with a loopback lookalike host is refused', () => {
    expect(() =>
      buildSslConfig({
        nodeEnv: 'production',
        databaseUrl: 'postgres://u:p@127.0.0.1.evil.example.com:55432/republic_qa',
        qaLocalDb: '1',
      })
    ).toThrow(/refusing to connect/)
  })
})

describe('migrationSslConfig (custom migration runner, scripts/lib/supabase-ssl.ts)', () => {
  it('without the flag pins the Supabase CA for a remote host', () => {
    expect(migrationSslConfig(REMOTE_DIRECT, undefined)).toEqual(PINNED)
  })

  it('without the flag pins the CA even for a loopback host (the runner always pinned)', () => {
    expect(migrationSslConfig(LOOPBACK_IP, undefined)).toEqual(PINNED)
  })

  it('a flag value other than "1" keeps the pinned CA', () => {
    expect(migrationSslConfig(LOOPBACK_IP, 'yes')).toEqual(PINNED)
  })

  it('the flag with a loopback host disables TLS', () => {
    expect(migrationSslConfig(LOOPBACK_IP, '1')).toBe(false)
    expect(migrationSslConfig(LOOPBACK_NAME, '1')).toBe(false)
  })

  it('the flag with a remote host throws', () => {
    expect(() => migrationSslConfig(REMOTE_DIRECT, '1')).toThrow(
      /QA_LOCAL_DB=1.*not 127\.0\.0\.1 or localhost/
    )
  })

  it('the flag with a multi-host list throws', () => {
    expect(() => migrationSslConfig(MULTIHOST, '1')).toThrow()
    expect(() => migrationSslConfig(DOUBLE_AT, '1')).toThrow()
  })

  it('reads QA_LOCAL_DB from the environment by default', () => {
    const before = process.env.QA_LOCAL_DB
    try {
      process.env.QA_LOCAL_DB = '1'
      expect(migrationSslConfig(LOOPBACK_IP)).toBe(false)
      expect(() => migrationSslConfig(REMOTE_DIRECT)).toThrow(/refusing to connect/)
      delete process.env.QA_LOCAL_DB
      expect(migrationSslConfig(LOOPBACK_IP)).toEqual(PINNED)
    } finally {
      if (before === undefined) delete process.env.QA_LOCAL_DB
      else process.env.QA_LOCAL_DB = before
    }
  })
})
