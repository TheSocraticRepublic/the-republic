/**
 * computeVoteWeight — quadratic voting weight function.
 *
 * Converts a raw credential weight into a quadratic vote weight by taking the
 * square root. This compresses the influence of high-credential actors relative
 * to a linear scheme, preserving signal while limiting plutocratic concentration.
 *
 * credentialWeight <= 0 returns 0 (no negative or zero-weight votes).
 */
export function computeVoteWeight(credentialWeight: number): number {
  if (credentialWeight <= 0) return 0
  return Math.sqrt(credentialWeight)
}
