import { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { safeRoute } from '@/lib/api/safe-route'

/**
 * GET /api/governance/scores
 *
 * Requires authentication. When governance activates (Phase 3), it will
 * return credential-weighted scores for Snapshot API strategy integration.
 * Currently returns 503 — governance is not yet active.
 */
export const GET = safeRoute(async (request: NextRequest) => {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { success } = await checkRateLimit(`governance-scores:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return Response.json(
    {
      error: 'Governance not yet active',
      message:
        'This endpoint will return credential-weighted scores when governance activates.',
    },
    { status: 503 }
  )
})
