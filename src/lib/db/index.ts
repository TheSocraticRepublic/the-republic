import 'server-only'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { env } from '@/lib/env'

let db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  if (!db) {
    const client = postgres(env.DATABASE_URL, {
      // Serverless: every warm Lambda holds its own pool, and Supabase's
      // session-mode pooler caps TOTAL clients (pool_size 15). max:20 per
      // instance exhausted it — EMAXCONNSESSION took down DB-heavy pages on
      // 2026-06-19. Keep this small; the real fix is pointing DATABASE_URL at
      // the :6543 transaction pooler, which multiplexes and releases per-txn.
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      ssl: { rejectUnauthorized: false },
    })
    db = drizzle(client, { schema })
  }
  return db
}
