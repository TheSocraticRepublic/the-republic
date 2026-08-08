/**
 * The parliamentary session all sync and AI-analysis caching is keyed on.
 *
 * When Parliament moves to a new session (e.g. 45-2), update this ONE value —
 * it drives the sync default, and the patterns/contradictions cache reads AND
 * writes. A stale copy in any one of those sites would silently keep serving
 * (or keying) analyses for the old session.
 */
export const CURRENT_PARLIAMENT_SESSION = '45-1'
