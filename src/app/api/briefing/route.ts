import { NextRequest } from 'next/server'
import { POST as investigatePost } from '@/app/api/investigate/route'

/**
 * POST /api/briefing
 *
 * Thin delegate to the investigation endpoint.
 * All briefing generation is now handled by /api/investigate, which
 * creates an investigation record, streams the briefing, and persists the result.
 * This route is kept for backward compatibility.
 */
export async function POST(request: NextRequest) {
  return investigatePost(request)
}
