import { NextRequest } from 'next/server'

/**
 * GET /api/governance/scores
 *
 * Requires authentication. When governance activates (Phase 3), it will
 * return credential-weighted scores for Snapshot API strategy integration.
 * Currently returns 503 — governance is not yet active.
 */
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return Response.json(
    {
      error: 'Governance not yet active',
      message:
        'This endpoint will return credential-weighted scores when governance activates.',
    },
    { status: 503 }
  )
}
