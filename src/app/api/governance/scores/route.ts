/**
 * GET /api/governance/scores
 *
 * This endpoint requires authentication for now. When governance activates
 * (Phase 3), it will be added to middleware public exemptions.
 *
 * Returns credential-weighted governance scores for Snapshot API strategy
 * integration. This is a placeholder — governance is not yet active. The
 * endpoint exists so external integrations can discover and test against the
 * route before the full implementation lands.
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
