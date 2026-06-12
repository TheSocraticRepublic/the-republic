/**
 * Single source of truth for the model used by all AI routes.
 * The AI SDK provider abstraction keeps the model replaceable —
 * change it here, never in individual routes.
 *
 * Cross-reference: scripts/gadfly-drift-test.mjs must match this value.
 */
export const MODEL = 'claude-sonnet-4-6'
