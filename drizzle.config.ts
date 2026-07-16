import { defineConfig } from 'drizzle-kit'
import { resolveMigrationDatabaseUrl } from './scripts/lib/migration-database-url'

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Migrations/DDL run against the :5432 SESSION-mode pooler
    // (DIRECT_DATABASE_URL), not the :6543 transaction pooler the app
    // runtime uses. See scripts/lib/migration-database-url.ts.
    url: resolveMigrationDatabaseUrl(),
  },
})
