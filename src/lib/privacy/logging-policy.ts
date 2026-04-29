export const LOGGABLE_EVENTS = [
  'auth_failure',
  'rate_limit_violation',
  'moderation_action',
  'credential_award',
  'archive_creation',
  'permanence_promotion',
] as const

export const PROHIBITED_LOGGING = [
  'investigation_read',
  'document_download',
  'search_query',
  'gadfly_session_content',
  'briefing_content',
  'forum_post_draft',
] as const

export type LoggableEvent = (typeof LOGGABLE_EVENTS)[number]
export type ProhibitedEvent = (typeof PROHIBITED_LOGGING)[number]

const LOGGABLE_SET = new Set<string>(LOGGABLE_EVENTS)
const PROHIBITED_SET = new Set<string>(PROHIBITED_LOGGING)

export function isLoggable(event: string): boolean {
  return LOGGABLE_SET.has(event)
}

export function isProhibited(event: string): boolean {
  return PROHIBITED_SET.has(event)
}
