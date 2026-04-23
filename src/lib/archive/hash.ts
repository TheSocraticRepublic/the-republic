import { createHash } from 'crypto'

/**
 * Recursively canonicalize an unknown value for deterministic hashing.
 * - Objects: keys sorted alphabetically, values recursively canonicalized
 * - Arrays: elements recursively canonicalized (order preserved)
 * - Primitives: passed through to JSON.stringify directly
 * - undefined: rendered as the string "undefined" (JSON.stringify returns undefined
 *   for this type, so we handle it explicitly to guarantee a string is always returned)
 */
export function canonicalize(obj: unknown): string {
  if (obj === undefined) {
    return 'undefined'
  }

  if (obj === null) {
    return 'null'
  }

  if (Array.isArray(obj)) {
    const items = obj.map((item) => canonicalize(item))
    return `[${items.join(',')}]`
  }

  if (typeof obj === 'object') {
    const sorted = Object.keys(obj as Record<string, unknown>)
      .sort()
      .map((key) => {
        const val = canonicalize((obj as Record<string, unknown>)[key])
        return `${JSON.stringify(key)}:${val}`
      })
    return `{${sorted.join(',')}}`
  }

  return JSON.stringify(obj)
}

/**
 * Compute a SHA-256 content hash of arbitrary data.
 * Uses canonical JSON serialization (sorted keys, no whitespace) for
 * determinism across environments — same input always produces same hash.
 * Returns a 64-character lowercase hex string.
 */
export function computeContentHash(data: unknown): string {
  const canonical = canonicalize(data)
  return createHash('sha256').update(canonical, 'utf8').digest('hex')
}
