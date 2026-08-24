import type { SystemModelMessage } from 'ai'

/**
 * Wrap a system prompt string with Anthropic prompt cache breakpoints.
 * The returned object is a valid `system` value for streamText/generateText.
 */
export function cachedSystem(content: string): SystemModelMessage {
  return {
    role: 'system' as const,
    content,
    providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
  }
}
