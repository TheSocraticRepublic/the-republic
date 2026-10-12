/**
 * The Forum's page gate (FORUM-1, R9). Every /forum URL, decoded and with
 * repeated slashes collapsed so an encoded or doubled path can't slip past,
 * plus the `/forum.<suffix>` forms Next uses for RSC and segment requests.
 *
 * A URL that can't be decoded fails closed only if it could be the Forum:
 * its ASCII escapes decoded (so `/%66orum%E0` counts), it starts with
 * `/forum` in any case. Any other malformed URL (`/votes%E0`, an `/api/...`
 * path) is left to the app, which gives it its ordinary 404 or API answer,
 * not a false "the Forum opens later" (Razor RN1).
 */
const FORUM_PATH = /^\/forum(?:[/.]|$)/i
const COULD_BE_FORUM = /^\/forum/i
const collapse = (p: string) => p.replace(/\/{2,}/g, '/')

export function isForumPath(pathname: string): boolean {
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    const asciiDecoded = pathname.replace(/%([0-7][0-9a-f])/gi, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    return COULD_BE_FORUM.test(collapse(asciiDecoded))
  }
  return FORUM_PATH.test(collapse(decoded))
}

/** Where a gated Forum URL is served from: a route OUTSIDE the forum segment. */
export const FORUM_GATED_PATH = '/forum-opens-later'
