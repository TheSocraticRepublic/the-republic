/**
 * stripInternalFields — returns a new object containing only the keys present
 * in `allowlist`. Use this to sanitize server-side objects before returning
 * them from public API endpoints, preventing accidental exposure of internal
 * fields (e.g. raw embeddings, internal IDs, admin metadata).
 */
export function stripInternalFields<T extends Record<string, unknown>>(
  obj: T,
  allowlist: string[]
): Partial<T> {
  const allowed = new Set(allowlist)
  const result: Partial<T> = {}
  for (const key of Object.keys(obj)) {
    if (allowed.has(key)) {
      result[key as keyof T] = obj[key as keyof T]
    }
  }
  return result
}
