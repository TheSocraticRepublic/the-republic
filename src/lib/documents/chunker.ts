import 'server-only'

export interface Chunk {
  content: string
  chunkIndex: number
  sectionHeading: string | null
}

const MAX_CHARS = 2048

// Patterns that identify section headings
const HEADING_PATTERNS = [
  /^[A-Z][A-Z\s\d:,()&/-]{4,}$/, // ALL CAPS (at least 5 chars)
  /^(Section|Part|Chapter|Article|Division|Schedule)\s+[\dA-Z]/i,
  /^\d+(\.\d+)*\s+[A-Z]/, // numbered headings like "1.2 Definitions"
]

function isHeading(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  return HEADING_PATTERNS.some((re) => re.test(trimmed))
}

function endsWithSentenceBoundary(text: string): boolean {
  return /[.!?]\s*$/.test(text.trimEnd())
}

/**
 * Split text at the last sentence boundary before maxLen.
 * Returns [before, after].
 */
function splitAtSentence(text: string, maxLen: number): [string, string] {
  const candidate = text.slice(0, maxLen)
  // Find last sentence-ending punctuation
  const match = candidate.match(/^([\s\S]*[.!?])\s/)
  if (match) {
    const boundary = match[1].length
    return [text.slice(0, boundary + 1).trim(), text.slice(boundary + 1).trim()]
  }
  // No sentence boundary found — fall back to word boundary
  const lastSpace = candidate.lastIndexOf(' ')
  if (lastSpace > 0) {
    return [text.slice(0, lastSpace).trim(), text.slice(lastSpace + 1).trim()]
  }
  // Hard split
  return [text.slice(0, maxLen).trim(), text.slice(maxLen).trim()]
}

/**
 * Break a single block of text into chunks of MAX_CHARS, never splitting mid-sentence.
 */
function chunkBlock(text: string): string[] {
  const results: string[] = []
  let remaining = text.trim()
  while (remaining.length > MAX_CHARS) {
    const [before, after] = splitAtSentence(remaining, MAX_CHARS)
    if (before) results.push(before)
    remaining = after
    if (!remaining) break
  }
  if (remaining) results.push(remaining)
  return results
}

export function chunkDocument(text: string): Chunk[] {
  const lines = text.split('\n')

  // Group lines into sections: each section is { heading, paragraphs[] }
  const sections: Array<{ heading: string | null; paragraphs: string[] }> = []
  let currentHeading: string | null = null
  let currentParagraphs: string[] = []
  let paragraphBuffer: string[] = []

  function flushParagraph() {
    const para = paragraphBuffer.join(' ').trim()
    if (para) currentParagraphs.push(para)
    paragraphBuffer = []
  }

  function flushSection() {
    flushParagraph()
    if (currentParagraphs.length > 0 || currentHeading !== null) {
      sections.push({ heading: currentHeading, paragraphs: currentParagraphs })
    }
    currentParagraphs = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (isHeading(trimmed)) {
      flushSection()
      currentHeading = trimmed
    } else if (!trimmed) {
      // blank line = paragraph break
      flushParagraph()
    } else {
      paragraphBuffer.push(trimmed)
    }
  }
  flushSection()

  // Now convert sections + paragraphs into chunks
  const chunks: Chunk[] = []
  let chunkIndex = 0

  for (const section of sections) {
    const heading = section.heading
    let buffer = ''

    for (const para of section.paragraphs) {
      const candidate = buffer ? `${buffer}\n\n${para}` : para

      if (candidate.length <= MAX_CHARS) {
        buffer = candidate
      } else {
        // Flush current buffer first
        if (buffer) {
          chunks.push({ content: buffer, chunkIndex: chunkIndex++, sectionHeading: heading })
          buffer = ''
        }
        // The paragraph itself may exceed MAX_CHARS
        if (para.length > MAX_CHARS) {
          const subChunks = chunkBlock(para)
          for (const sub of subChunks) {
            chunks.push({ content: sub, chunkIndex: chunkIndex++, sectionHeading: heading })
          }
        } else {
          buffer = para
        }
      }
    }

    // Flush remaining buffer for this section
    if (buffer) {
      chunks.push({ content: buffer, chunkIndex: chunkIndex++, sectionHeading: heading })
    }
  }

  // If nothing produced (e.g. document had no structure), chunk the whole text
  if (chunks.length === 0 && text.trim()) {
    const rawChunks = chunkBlock(text.trim())
    for (const content of rawChunks) {
      chunks.push({ content, chunkIndex: chunkIndex++, sectionHeading: null })
    }
  }

  return chunks
}
