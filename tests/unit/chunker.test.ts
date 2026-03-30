import { describe, it, expect } from 'vitest'
import { chunkDocument, type Chunk } from '@/lib/documents/chunker'

const MAX_CHARS = 2048

describe('chunkDocument', () => {
  it('chunks a document with clear section headings', () => {
    const text = [
      'INTRODUCTION',
      '',
      'This is the first paragraph under the introduction section.',
      '',
      'BACKGROUND',
      '',
      'This is a paragraph under the background section with more context.',
    ].join('\n')

    const chunks = chunkDocument(text)

    expect(chunks.length).toBeGreaterThan(0)
    // Each chunk that has content under INTRODUCTION should carry that heading
    const introChunk = chunks.find((c) => c.sectionHeading === 'INTRODUCTION')
    expect(introChunk).toBeDefined()
    expect(introChunk!.content).toContain('first paragraph')

    const bgChunk = chunks.find((c) => c.sectionHeading === 'BACKGROUND')
    expect(bgChunk).toBeDefined()
    expect(bgChunk!.content).toContain('background section')
  })

  it('handles documents with no headings (falls back to paragraph splitting)', () => {
    const text = [
      'This is just a paragraph with no heading at all.',
      '',
      'This is another paragraph, also without a heading.',
    ].join('\n')

    const chunks = chunkDocument(text)

    expect(chunks.length).toBeGreaterThan(0)
    // All chunks should have null sectionHeading
    for (const chunk of chunks) {
      expect(chunk.sectionHeading).toBeNull()
    }
    // Content should include the paragraph text
    const allContent = chunks.map((c) => c.content).join(' ')
    expect(allContent).toContain('paragraph with no heading')
  })

  it('respects max chunk size (~2048 chars)', () => {
    // Build a paragraph that is well over MAX_CHARS
    const sentence = 'This is a sentence that will repeat many times to test chunking behavior. '
    const longParagraph = sentence.repeat(40) // ~2960 chars

    const text = `LONG SECTION\n\n${longParagraph}`
    const chunks = chunkDocument(text)

    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(MAX_CHARS + 200) // small tolerance for last sentence
    }
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('never splits mid-sentence', () => {
    // Build text that would force a split partway through a sentence.
    // Each sentence is ~100 chars. 21 sentences ~2100 chars (just over MAX_CHARS).
    const sentence = 'Citizens have the right to access government documents under FIPPA. '
    const paragraph = sentence.repeat(31) // ~2170 chars

    const text = `RIGHTS\n\n${paragraph}`
    const chunks = chunkDocument(text)

    for (const chunk of chunks) {
      // After trimming, the last character of each chunk should be a sentence boundary,
      // a word character (for word-boundary splits), or be the entire content.
      // The key invariant: no chunk should end with a partial word mid-sentence,
      // i.e. the content should not end in the middle of "FIPPA" or "Citizens".
      // We verify each chunk ends at a natural boundary.
      const trimmed = chunk.content.trim()
      // Either ends with sentence punctuation or is the final chunk
      const endsWithPunctuation = /[.!?]$/.test(trimmed)
      const isOnlyChunk = chunks.length === 1
      expect(endsWithPunctuation || isOnlyChunk || chunks.indexOf(chunk) === chunks.length - 1).toBe(true)
    }
  })

  it('preserves section heading metadata on each chunk', () => {
    const heading = 'DEFINITIONS AND INTERPRETATIONS'
    const text = [
      heading,
      '',
      'The term "citizen" means any person ordinarily resident in the jurisdiction.',
      '',
      'The term "document" means any record in any format.',
    ].join('\n')

    const chunks = chunkDocument(text)

    for (const chunk of chunks) {
      expect(chunk.sectionHeading).toBe(heading)
    }
  })

  it('assigns sequential chunkIndex values starting at 0', () => {
    const text = [
      'SECTION ONE',
      '',
      'First section content.',
      '',
      'SECTION TWO',
      '',
      'Second section content.',
    ].join('\n')

    const chunks = chunkDocument(text)

    chunks.forEach((chunk, i) => {
      expect(chunk.chunkIndex).toBe(i)
    })
  })

  it('handles empty input', () => {
    const chunks = chunkDocument('')
    expect(chunks).toEqual([])
  })

  it('handles whitespace-only input', () => {
    const chunks = chunkDocument('   \n\n   \n')
    expect(chunks).toEqual([])
  })
})
