import 'server-only'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { env } from '@/lib/env'

let db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  if (!db) {
    const client = postgres(env.DATABASE_URL, {
      max: 20,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      ssl: { rejectUnauthorized: false },
    })
    db = drizzle(client, { schema })
  }
  return db
}
