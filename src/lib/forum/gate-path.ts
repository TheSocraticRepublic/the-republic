/**
 * The Forum's page gate (FORUM-1, R9). Every /forum URL, decoded and with
 * repeated slashes collapsed so an encoded or doubled path can't slip past,
 * plus the `/forum.<suffix>` forms Next uses for RSC and segment requests.
 * A URL that can't be decoded counts as Forum (fail closed).
 */
const FORUM_PATH = /^\/forum(?:[/.]|$)/i
export function isForumPath(pathname: string): boolean {
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return true
  }
  return FORUM_PATH.test(decoded.replace(/\/{2,}/g, '/'))
}

/** Where a gated Forum URL is served from: a route OUTSIDE the forum segment. */
export const FORUM_GATED_PATH = '/forum-opens-later'
