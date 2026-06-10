/**
 * Single source of truth for the model used by all AI routes.
 * The AI SDK provider abstraction keeps the model replaceable —
 * change it here, never in individual routes.
 */
export const MODEL = 'claude-sonnet-4-20250514'
