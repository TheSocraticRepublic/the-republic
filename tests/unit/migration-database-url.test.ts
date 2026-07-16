import { describe, it, expect, afterEach } from 'vitest'
import { resolveMigrationDatabaseUrl } from '../../scripts/lib/migration-database-url'

const ORIGINAL_DIRECT = process.env.DIRECT_DATABASE_URL
const ORIGINAL_DATABASE = process.env.DATABASE_URL

afterEach(() => {
  if (ORIGINAL_DIRECT === undefined) delete process.env.DIRECT_DATABASE_URL
  else process.env.DIRECT_DATABASE_URL = ORIGINAL_DIRECT

  if (ORIGINAL_DATABASE === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = ORIGINAL_DATABASE
})

describe('resolveMigrationDatabaseUrl', () => {
  it('returns DIRECT_DATABASE_URL when set, even if DATABASE_URL is also set', () => {
    process.env.DIRECT_DATABASE_URL = 'postgres://session-pooler:5432/db'
    process.env.DATABASE_URL = 'postgres://transaction-pooler:6543/db'
    expect(resolveMigrationDatabaseUrl()).toBe('postgres://session-pooler:5432/db')
  })

  it('falls back to DATABASE_URL when DIRECT_DATABASE_URL is unset', () => {
    delete process.env.DIRECT_DATABASE_URL
    process.env.DATABASE_URL = 'postgres://transaction-pooler:6543/db'
    expect(resolveMigrationDatabaseUrl()).toBe('postgres://transaction-pooler:6543/db')
  })

  it('throws a clear error when both are unset', () => {
    delete process.env.DIRECT_DATABASE_URL
    delete process.env.DATABASE_URL
    expect(() => resolveMigrationDatabaseUrl()).toThrow(
      /DIRECT_DATABASE_URL or DATABASE_URL environment variable is required/
    )
  })
})
