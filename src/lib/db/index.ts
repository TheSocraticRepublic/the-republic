import 'server-only'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

let db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  if (!db) {
    const client = postgres(process.env.DATABASE_URL!)
    db = drizzle(client, { schema })
  }
  return db
}
