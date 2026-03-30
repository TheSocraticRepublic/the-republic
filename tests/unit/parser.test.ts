import { describe, it, expect } from 'vitest'

/**
 * Extraction quality heuristic test.
 *
 * The parser (src/lib/documents/parser.ts) determines extraction quality as:
 *   avgWordsPerPage = wordCount / pageCount
 *   quality = avgWordsPerPage < 50 ? 'low' : 'high'
 *
 * We test this logic in isolation — the parser itself cannot run in vitest
 * because it instantiates PDFParse (a native binding). Instead we verify the
 * heuristic formula and threshold directly.
 */

function extractionQuality(wordCount: number, pageCount: number): 'high' | 'low' {
  const avgWordsPerPage = pageCount > 0 ? wordCount / pageCount : 0
  return avgWordsPerPage < 50 ? 'low' : 'high'
}

describe('extraction quality heuristic', () => {
  it('returns high quality when words per page > 50', () => {
    // 500 words, 5 pages = 100 words/page
    expect(extractionQuality(500, 5)).toBe('high')
  })

  it('returns high quality at exactly 50 words per page (boundary)', () => {
    // 50 words, 1 page = 50 words/page — not strictly < 50, so 'high'
    expect(extractionQuality(50, 1)).toBe('high')
  })

  it('returns low quality when words per page < 50', () => {
    // 40 words, 1 page = 40 words/page
    expect(extractionQuality(40, 1)).toBe('low')
  })

  it('returns low quality when words per page is 0 (blank PDF)', () => {
    expect(extractionQuality(0, 5)).toBe('low')
  })

  it('returns low quality for a likely scanned PDF (few words, many pages)', () => {
    // 30 words across 10 pages = 3 words/page
    expect(extractionQuality(30, 10)).toBe('low')
  })

  it('returns high quality for a dense text document', () => {
    // 3000 words, 10 pages = 300 words/page
    expect(extractionQuality(3000, 10)).toBe('high')
  })

  it('handles single page documents correctly', () => {
    expect(extractionQuality(100, 1)).toBe('high')
    expect(extractionQuality(49, 1)).toBe('low')
  })

  it('returns low quality when pageCount is 0 (guard against division by zero)', () => {
    // pageCount = 0 → avgWordsPerPage = 0 → 'low'
    expect(extractionQuality(100, 0)).toBe('low')
  })
})
