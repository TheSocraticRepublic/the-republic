import { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getDb } from '@/lib/db'
import { postalCodeCache, federalMps } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import {
  normalizePostalCode,
  isValidCanadianPostalCode,
  lookupPostalCode,
  extractFederalMP,
} from '@/lib/parliament/represent'

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { success } = await checkRateLimit(`parliament-lookup:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const rawCode = request.nextUrl.searchParams.get('postalCode')
  if (!rawCode) {
    return new Response(JSON.stringify({ error: 'postalCode is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const postalCode = normalizePostalCode(rawCode)
  if (!isValidCanadianPostalCode(postalCode)) {
    return new Response(
      JSON.stringify({ error: 'Invalid Canadian postal code' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const db = getDb()

  // Check cache
  const [cached] = await db
    .select()
    .from(postalCodeCache)
    .where(eq(postalCodeCache.postalCode, postalCode))
    .limit(1)

  if (cached && cached.mpId) {
    const age = Date.now() - cached.cachedAt.getTime()
    if (age < CACHE_TTL_MS) {
      const [mp] = await db
        .select({
          id: federalMps.id,
          name: federalMps.name,
          party: federalMps.party,
          ridingName: federalMps.ridingName,
          ridingProvince: federalMps.ridingProvince,
        })
        .from(federalMps)
        .where(eq(federalMps.id, cached.mpId))
        .limit(1)

      if (mp) {
        return new Response(
          JSON.stringify({
            mpId: mp.id,
            name: mp.name,
            party: mp.party,
            ridingName: cached.ridingName ?? mp.ridingName,
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      }
    }
  }

  // Cache miss — call Represent API
  try {
    const response = await lookupPostalCode(postalCode)
    const federalMp = extractFederalMP(response)

    if (!federalMp) {
      return new Response(
        JSON.stringify({ error: 'No federal MP found for this postal code' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Match to our local MP by name
    const nameParts = federalMp.name.trim().split(/\s+/)
    const lastName = nameParts[nameParts.length - 1]

    const candidates = await db
      .select({ id: federalMps.id, name: federalMps.name })
      .from(federalMps)
      .where(eq(federalMps.active, true))

    const match = candidates.find((c) => {
      const cLast = c.name.trim().split(/\s+/).pop()?.toLowerCase()
      return (
        cLast === lastName.toLowerCase() &&
        c.name.toLowerCase().includes(nameParts[0].toLowerCase())
      )
    })

    const mpId = match?.id ?? null
    const ridingName = federalMp.district_name

    // Upsert cache
    if (cached) {
      await db
        .update(postalCodeCache)
        .set({
          mpId,
          ridingName,
          metadata: {
            party: federalMp.party_name,
            representSource: federalMp.source_url,
          },
          cachedAt: new Date(),
        })
        .where(eq(postalCodeCache.id, cached.id))
    } else {
      await db.insert(postalCodeCache).values({
        postalCode,
        mpId,
        ridingName,
        metadata: {
          party: federalMp.party_name,
          representSource: federalMp.source_url,
        },
        cachedAt: new Date(),
      })
    }

    if (!mpId) {
      return new Response(
        JSON.stringify({
          error: 'MP found but not yet in our database. Please run a data sync first.',
          mpName: federalMp.name,
          ridingName,
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        mpId,
        name: match!.name,
        party: federalMp.party_name,
        ridingName,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[parliament/lookup] Represent API error:', err)
    return new Response(
      JSON.stringify({ error: 'Lookup failed' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
