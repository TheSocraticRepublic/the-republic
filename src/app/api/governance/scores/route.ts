/**
 * GET /api/governance/scores
 *
 * Public endpoint — no auth required. Returns credential-weighted governance
 * scores for Snapshot API strategy integration (Phase 3).
 *
 * This is a placeholder. Governance is not yet active. The endpoint exists so
 * that external integrations can discover and test against the route before
 * the full implementation lands.
 */
export async function GET() {
  return Response.json(
    {
      error: 'Governance not yet active',
      message:
        'This endpoint will return credential-weighted scores when governance activates.',
    },
    { status: 503 }
  )
}
