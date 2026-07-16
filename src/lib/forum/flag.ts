/**
 * Server-side forum feature flag (FORUM-1).
 *
 * The Forum is intentionally UNSHIPPED — the routes exist, are wired up, and
 * federate over ActivityPub, but there's no moderation capacity yet. Before
 * this flag, the only "lock" was a cosmetic disabled-looking sidebar entry
 * (`src/components/layout/sidebar.tsx`) — every page and API route was
 * actually live. This is the real, server-enforced gate.
 *
 * Fail-closed by design: returns false unless FORUM_ENABLED is the literal
 * string 'true'. An unset var, empty string, '1', 'yes', etc. all resolve to
 * disabled. Mirrors the isArweaveEnabled() pattern in
 * src/lib/archive/arweave.ts — read directly from process.env rather than
 * the strict-parse `env` proxy in src/lib/env.ts, so a missing/malformed
 * value degrades to "off" instead of throwing at boot.
 */
export function isForumEnabled(): boolean {
  return process.env.FORUM_ENABLED === 'true'
}

/**
 * Standard deny response for every /api/forum/* handler and AP forum-object
 * endpoint when the flag is off. 404 (not 403) — the surface is unshipped,
 * so the goal is to hide its existence, not announce a locked door.
 */
export function forumDisabledResponse(): Response {
  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  })
}
