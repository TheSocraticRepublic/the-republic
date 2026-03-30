import 'server-only'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { Pool } from '@neondatabase/serverless'
import * as schema from './schema'

let db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  if (!db) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
    db = drizzle(pool, { schema })
  }
  return db
}
