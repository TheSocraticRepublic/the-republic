/**
 * Document diff computation for re-ingestion change detection.
 *
 * Line-level granularity is intentional — institutional documents change at
 * the paragraph level, not the character level. This keeps the implementation
 * simple and the output meaningful.
 */

export interface DiffResult {
  sectionsAdded: number
  sectionsRemoved: number
  sectionsModified: number
  wordCountDelta: number
  summary: string  // human-readable, e.g. "3 sections added, 1 removed, +450 words"
}

function countWords(text: string): number {
  if (!text.trim()) return 0
  return text.trim().split(/\s+/).length
}

/**
 * Compute a line-level diff between two document content strings.
 *
 * "Sections" are contiguous blocks of changed lines — a paragraph that
 * changed across 3 lines counts as 1 section, not 3.
 *
 * For additions and removals, we use a simple LCS-based approach:
 * lines only in oldLines = removed, lines only in newLines = added.
 * Lines that appear in both (as sets) are considered unchanged.
 * This is intentionally naive — it matches the institution-document use case
 * where whole paragraphs are replaced, not individual words within lines.
 */
export function computeDocumentDiff(oldContent: string, newContent: string): DiffResult {
  const wordCountDelta = countWords(newContent) - countWords(oldContent)

  // Edge cases
  if (oldContent === newContent) {
    return {
      sectionsAdded: 0,
      sectionsRemoved: 0,
      sectionsModified: 0,
      wordCountDelta: 0,
      summary: 'no changes',
    }
  }

  const oldLines = oldContent === '' ? [] : oldContent.split('\n')
  const newLines = newContent === '' ? [] : newContent.split('\n')

  if (oldLines.length === 0) {
    // Everything is new — blank lines break sections (paragraph semantics)
    const sections = countContiguousSections(newLines.map((l) => l.trim() !== ''))
    return {
      sectionsAdded: sections,
      sectionsRemoved: 0,
      sectionsModified: 0,
      wordCountDelta,
      summary: buildSummary(sections, 0, 0, wordCountDelta),
    }
  }

  if (newLines.length === 0) {
    // Everything removed — blank lines break sections (paragraph semantics)
    const sections = countContiguousSections(oldLines.map((l) => l.trim() !== ''))
    return {
      sectionsAdded: 0,
      sectionsRemoved: sections,
      sectionsModified: 0,
      wordCountDelta,
      summary: buildSummary(0, sections, 0, wordCountDelta),
    }
  }

  // General case: use a set-based diff
  // Build a multiset of old lines and new lines, match them off greedily,
  // then classify what's left as added or removed.
  const oldLineCount = buildLineCountMap(oldLines)
  const newLineCount = buildLineCountMap(newLines)

  // Track which positions in old are "removed" and which in new are "added"
  const oldRemoved: boolean[] = new Array(oldLines.length).fill(true)
  const newAdded: boolean[] = new Array(newLines.length).fill(true)

  // For each old line, consume matching new lines
  const newLineConsumed: Map<string, number> = new Map()
  for (let i = 0; i < oldLines.length; i++) {
    const line = oldLines[i]
    const newCount = newLineCount.get(line) ?? 0
    const consumed = newLineConsumed.get(line) ?? 0
    if (consumed < newCount) {
      // This old line has a match in new content
      oldRemoved[i] = false
      newLineConsumed.set(line, consumed + 1)
    }
  }

  // Mark matched new lines as not-added
  const oldLineConsumed: Map<string, number> = new Map()
  for (let i = 0; i < newLines.length; i++) {
    const line = newLines[i]
    const oldCount = oldLineCount.get(line) ?? 0
    const consumed = oldLineConsumed.get(line) ?? 0
    if (consumed < oldCount) {
      newAdded[i] = false
      oldLineConsumed.set(line, consumed + 1)
    }
  }

  const sectionsAdded = countContiguousSections(newAdded)
  const sectionsRemoved = countContiguousSections(oldRemoved)

  return {
    sectionsAdded,
    sectionsRemoved,
    sectionsModified: 0,  // simple line-diff can't distinguish modified from add+remove
    wordCountDelta,
    summary: buildSummary(sectionsAdded, sectionsRemoved, 0, wordCountDelta),
  }
}

function buildLineCountMap(lines: string[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const line of lines) {
    map.set(line, (map.get(line) ?? 0) + 1)
  }
  return map
}

/**
 * Count contiguous blocks of `true` values in an array.
 * [F, T, T, F, T] → 2 sections
 */
function countContiguousSections(flags: boolean[]): number {
  let count = 0
  let inSection = false
  for (const flag of flags) {
    if (flag && !inSection) {
      count++
      inSection = true
    } else if (!flag) {
      inSection = false
    }
  }
  return count
}

function buildSummary(
  added: number,
  removed: number,
  modified: number,
  wordDelta: number
): string {
  const parts: string[] = []

  if (added > 0) parts.push(`${added} ${added === 1 ? 'section' : 'sections'} added`)
  if (removed > 0) parts.push(`${removed} ${removed === 1 ? 'section' : 'sections'} removed`)
  if (modified > 0) parts.push(`${modified} ${modified === 1 ? 'section' : 'sections'} modified`)

  if (wordDelta !== 0) {
    const sign = wordDelta > 0 ? '+' : ''
    parts.push(`${sign}${wordDelta} ${Math.abs(wordDelta) === 1 ? 'word' : 'words'}`)
  }

  return parts.length > 0 ? parts.join(', ') : 'no changes'
}
