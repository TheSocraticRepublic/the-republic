/**
 * Seed script: inserts jurisdictions from data/seeds/jurisdictions.json
 * Run with: npx tsx scripts/seed-jurisdictions.ts
 */
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import { jurisdictions } from '../src/lib/db/schema'
import * as fs from 'fs'
import * as path from 'path'
import * as url from 'url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

interface JurisdictionSeed {
  name: string
  country: string
  province: string | null
  municipalType: 'city' | 'district' | 'regional_district' | 'township' | 'village' | 'province' | 'federal'
  population?: number
  dataPortalUrl?: string
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required')
    process.exit(1)
  }

  const client = postgres(databaseUrl, { max: 1 })
  const db = drizzle(client)

  const seedPath = path.join(__dirname, '..', 'data', 'seeds', 'jurisdictions.json')
  const raw = fs.readFileSync(seedPath, 'utf-8')
  const seeds: JurisdictionSeed[] = JSON.parse(raw)

  console.log(`Seeding ${seeds.length} jurisdictions...`)

  let inserted = 0
  let skipped = 0

  for (const seed of seeds) {
    // Check if jurisdiction with same name already exists
    const [existing] = await db
      .select({ id: jurisdictions.id })
      .from(jurisdictions)
      .where(eq(jurisdictions.name, seed.name))
      .limit(1)

    if (existing) {
      console.log(`  skip: ${seed.name} (already exists)`)
      skipped++
      continue
    }

    await db.insert(jurisdictions).values({
      name: seed.name,
      country: seed.country,
      province: seed.province ?? undefined,
      municipalType: seed.municipalType,
      population: seed.population ?? undefined,
      dataPortalUrl: seed.dataPortalUrl ?? undefined,
    })

    console.log(`  inserted: ${seed.name}`)
    inserted++
  }

  console.log(`\nDone. ${inserted} inserted, ${skipped} skipped.`)
  await client.end()
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
