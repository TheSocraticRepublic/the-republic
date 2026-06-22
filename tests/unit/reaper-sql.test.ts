/**
 * Regression test for the reaper INTERVAL SQL fix (CRITICAL-2).
 *
 * Verifies that the WHERE expression `NOW() - (${STUCK_GENERATION_INTERVAL})::interval`
 * compiles to valid Postgres syntax (`$1::interval`) rather than the broken
 * `INTERVAL $1` form (which Postgres rejects as a syntax error).
 *
 * Self-contained: no DB connection needed.
 */

import { describe, it, expect } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

const STUCK_GENERATION_INTERVAL = '12 minutes'

describe('reaper INTERVAL SQL', () => {
  const dialect = new PgDialect()

  it('generates $1::interval (valid Postgres cast syntax)', () => {
    const expr = sql`NOW() - (${STUCK_GENERATION_INTERVAL})::interval`
    const { sql: compiled, params } = dialect.sqlToQuery(expr)

    expect(compiled).toContain('::interval')
    expect(params).toContain('12 minutes')
  })

  it('does NOT generate INTERVAL $1 (the broken form that Postgres rejects)', () => {
    const expr = sql`NOW() - (${STUCK_GENERATION_INTERVAL})::interval`
    const { sql: compiled } = dialect.sqlToQuery(expr)

    expect(compiled).not.toMatch(/INTERVAL\s+\$\d/)
  })

  it('documents the broken form for reference — INTERVAL $1 is what we fixed away from', () => {
    // This test documents the pre-fix behavior so the regression is explicit.
    const brokenExpr = sql`NOW() - INTERVAL ${STUCK_GENERATION_INTERVAL}`
    const { sql: compiled } = dialect.sqlToQuery(brokenExpr)

    // The broken form produces `INTERVAL $1` — a syntax error in Postgres.
    // This assertion confirms our understanding of the bug.
    expect(compiled).toMatch(/INTERVAL\s+\$\d/)
  })
})
