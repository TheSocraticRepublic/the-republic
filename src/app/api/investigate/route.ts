import { NextRequest } from 'next/server'
import { checkTightRateLimit, checkDailyAiLimit } from '@/lib/rate-limit'
import { safeRoute } from '@/lib/api/safe-route'
import { getDb } from '@/lib/db'
import { investigations } from '@/lib/db/schema'
import {
  normalizePostalCode,
  isValidCanadianPostalCode,
  lookupPostalCode,
  extractFederalMP,
} from '@/lib/parliament/represent'
import { eq, sql } from 'drizzle-orm'
import { triggerBriefingGeneration } from '@/lib/investigation/trigger-generation'
import { postalCodeCache, federalMps } from '@/lib/db/schema'

// Conservation keywords used for concern detection
const CONSERVATION_KEYWORDS = [
  'mine',
  'mining',
  'extraction',
  'pipeline',
  'lng',
  'coal',
  'fracking',
  'park',
  'protected area',
  'conservation',
  'old growth',
  'wildlife',
  'habitat',
  'species at risk',
  'salmon',
  'watershed',
  'wetland',
  'environmental assessment',
  'impact assessment',
  'EIS',
  'EIA',
  'EAO',
  'EPIC',
]

function isConservationConcern(concern: string): boolean {
  const lower = concern.toLowerCase()
  return CONSERVATION_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))
}

function detectConcernCategory(concern: string): string | null {
  if (isConservationConcern(concern)) return 'conservation'
  return null
}

export const POST = safeRoute(async function handler(request: NextRequest) {
  // Auth check
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { success } = await checkTightRateLimit(`investigate:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const daily = await checkDailyAiLimit(userId)
  if (!daily.success) {
    return new Response(JSON.stringify({
      error: 'Daily investigation limit reached (5 per day). Please try again tomorrow.',
      remaining: 0,
      reset: daily.reset,
    }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Parse body
  let body: { concern: string; jurisdictionId?: string; postalCode?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { concern, jurisdictionId, postalCode: rawPostalCode } = body
  if (!concern?.trim()) {
    return new Response(JSON.stringify({ error: 'concern is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (concern.trim().length > 2000) {
    return new Response(JSON.stringify({ error: 'concern must be 2000 characters or fewer' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = getDb()

  // Normalize postal code if provided
  const postalCode = rawPostalCode ? normalizePostalCode(rawPostalCode) : null
  const validPostalCode = postalCode && isValidCanadianPostalCode(postalCode) ? postalCode : null

  const concernCategory = detectConcernCategory(concern)

  // --- Insert investigation record ---
  let investigation: { id: string; federalMpId: string | null }
  try {
    const [inserted] = await db
      .insert(investigations)
      .values({
        userId,
        concern: concern.trim(),
        jurisdictionId: jurisdictionId || null,
        postalCode: validPostalCode,
        concernCategory,
        environmentalReviewType:
          concernCategory === 'conservation' ? 'bc_eao' : null,
        status: 'generating',
        generationStartedAt: new Date(),
      })
      .returning({ id: investigations.id, federalMpId: investigations.federalMpId })
    investigation = inserted
  } catch (err) {
    console.error('Failed to create investigation record', err)
    return new Response(JSON.stringify({ error: 'Failed to create investigation' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // --- Resolve postalCode to federal MP (fast/cached, non-fatal) ---
  if (validPostalCode) {
    try {
      const resolvedMpId = await resolvePostalCodeToMp(db, validPostalCode)
      if (resolvedMpId) {
        await db
          .update(investigations)
          .set({ federalMpId: resolvedMpId })
          .where(eq(investigations.id, investigation.id))
        investigation = { ...investigation, federalMpId: resolvedMpId }
      }
    } catch (err) {
      // Non-fatal — MP resolution failing should not block the investigation
      console.error('[investigate] postalCode → MP resolution failed:', err)
    }
  }

  // --- Trigger background function ---
  const { ok } = await triggerBriefingGeneration(investigation.id)

  if (!ok) {
    // Background function didn't accept — mark failed immediately for fast user feedback
    try {
      await db
        .update(investigations)
        .set({
          status: 'failed',
          failureReason: 'Failed to start generation — please retry',
          updatedAt: sql`NOW()`,
        })
        .where(eq(investigations.id, investigation.id))
    } catch (dbErr) {
      console.error('[investigate] failed to mark investigation as failed after trigger failure', dbErr)
    }
    return new Response(JSON.stringify({
      error: 'Failed to start investigation generation. Please try again.',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Return 202 — generation is running in the background
  return new Response(JSON.stringify({ id: investigation.id }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' },
  })
})

// ---------------------------------------------------------------------------
// Postal code → MP resolution (unchanged from previous implementation)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

async function resolvePostalCodeToMp(
  db: ReturnType<typeof getDb>,
  postalCode: string
): Promise<string | null> {
  // 1. Check cache
  const [cached] = await db
    .select()
    .from(postalCodeCache)
    .where(eq(postalCodeCache.postalCode, postalCode))
    .limit(1)

  if (cached && cached.mpId) {
    const age = Date.now() - cached.cachedAt.getTime()
    if (age < CACHE_TTL_MS) {
      return cached.mpId
    }
  }

  // 2. Call Represent API
  const response = await lookupPostalCode(postalCode)
  const federalMp = extractFederalMP(response)
  if (!federalMp) return null

  // 3. Match to local MP by name
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

  // 4. Upsert cache
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
    await db
      .insert(postalCodeCache)
      .values({
        postalCode,
        mpId,
        ridingName,
        metadata: {
          party: federalMp.party_name,
          representSource: federalMp.source_url,
        },
        cachedAt: new Date(),
      })
      .onConflictDoNothing()
  }

  return mpId
}
