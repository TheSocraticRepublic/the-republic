import { NextRequest } from 'next/server'
import { POST as investigatePost } from '@/app/api/investigate/route'
import { safeRoute } from '@/lib/api/safe-route'

/**
 * POST /api/briefing
 *
 * Thin delegate to the investigation endpoint.
 * All briefing generation is now handled by /api/investigate, which
 * triggers investigation creation and returns 202 (briefing generated async).
 * This route is kept for backward compatibility.
 */
export const POST = safeRoute(async (request: NextRequest) => {
  // investigatePost is a RouteHandler (safeRoute-wrapped); context is unused by investigate.
  return investigatePost(request, { params: Promise.resolve({}) })
})
