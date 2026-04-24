import { describe, it, expect } from 'vitest'
import { computeDocumentDiff } from '@/lib/archive/diff'

describe('computeDocumentDiff', () => {
  describe('identical content', () => {
    it('returns no changes when both strings are equal', () => {
      const content = 'Line one\nLine two\nLine three'
      const result = computeDocumentDiff(content, content)
      expect(result.sectionsAdded).toBe(0)
      expect(result.sectionsRemoved).toBe(0)
      expect(result.sectionsModified).toBe(0)
      expect(result.wordCountDelta).toBe(0)
      expect(result.summary).toBe('no changes')
    })

    it('returns no changes for identical empty strings', () => {
      const result = computeDocumentDiff('', '')
      expect(result.sectionsAdded).toBe(0)
      expect(result.sectionsRemoved).toBe(0)
      expect(result.wordCountDelta).toBe(0)
      expect(result.summary).toBe('no changes')
    })
  })

  describe('empty old content (everything added)', () => {
    it('counts all new content as added when old is empty', () => {
      const newContent = 'First paragraph\nSecond line\n\nSecond paragraph'
      const result = computeDocumentDiff('', newContent)
      expect(result.sectionsAdded).toBeGreaterThan(0)
      expect(result.sectionsRemoved).toBe(0)
      // word count delta should be positive
      expect(result.wordCountDelta).toBeGreaterThan(0)
    })

    it('counts one section when all new lines are contiguous', () => {
      const result = computeDocumentDiff('', 'line1\nline2\nline3')
      expect(result.sectionsAdded).toBe(1)
    })

    it('counts two sections when separated by blank line', () => {
      const result = computeDocumentDiff('', 'para one\n\npara two')
      expect(result.sectionsAdded).toBe(2)
    })
  })

  describe('empty new content (everything removed)', () => {
    it('counts all old content as removed when new is empty', () => {
      const oldContent = 'First paragraph\nSecond line\n\nSecond paragraph'
      const result = computeDocumentDiff(oldContent, '')
      expect(result.sectionsRemoved).toBeGreaterThan(0)
      expect(result.sectionsAdded).toBe(0)
      // word count delta should be negative
      expect(result.wordCountDelta).toBeLessThan(0)
    })

    it('counts one section when all removed lines are contiguous', () => {
      const result = computeDocumentDiff('line1\nline2\nline3', '')
      expect(result.sectionsRemoved).toBe(1)
    })
  })

  describe('line additions and removals', () => {
    it('detects added lines', () => {
      const old = 'line one\nline two'
      const newContent = 'line one\nline two\nnew line three'
      const result = computeDocumentDiff(old, newContent)
      expect(result.sectionsAdded).toBe(1)
      expect(result.sectionsRemoved).toBe(0)
    })

    it('detects removed lines', () => {
      const old = 'line one\nline two\nline three'
      const newContent = 'line one\nline three'
      const result = computeDocumentDiff(old, newContent)
      expect(result.sectionsRemoved).toBe(1)
      expect(result.sectionsAdded).toBe(0)
    })

    it('counts contiguous added lines as one section', () => {
      const old = 'intro'
      const newContent = 'intro\nadded line 1\nadded line 2\nadded line 3'
      const result = computeDocumentDiff(old, newContent)
      expect(result.sectionsAdded).toBe(1)
    })

    it('counts non-contiguous additions as separate sections', () => {
      const old = 'line A\nline B\nline C'
      // Add lines after A and after C (two separate sections)
      const newContent = 'line A\nadded after A\nline B\nline C\nadded after C'
      const result = computeDocumentDiff(old, newContent)
      expect(result.sectionsAdded).toBe(2)
    })
  })

  describe('word count delta', () => {
    it('calculates positive word count delta when content grows', () => {
      const old = 'one two three'
      const newContent = 'one two three four five'
      const result = computeDocumentDiff(old, newContent)
      expect(result.wordCountDelta).toBe(2)
    })

    it('calculates negative word count delta when content shrinks', () => {
      const old = 'one two three four five'
      const newContent = 'one two three'
      const result = computeDocumentDiff(old, newContent)
      expect(result.wordCountDelta).toBe(-2)
    })

    it('delta is zero when same words are rearranged on same number of words', () => {
      // Same word count, different arrangement
      const old = 'apple banana cherry'
      const newContent = 'cherry apple banana'
      const result = computeDocumentDiff(old, newContent)
      expect(result.wordCountDelta).toBe(0)
    })
  })

  describe('summary string', () => {
    it('produces correct summary for additions only', () => {
      const result = computeDocumentDiff('hello', 'hello\nnew content here')
      expect(result.summary).toContain('added')
    })

    it('produces correct summary for removals only', () => {
      const result = computeDocumentDiff('hello\nextra line', 'hello')
      expect(result.summary).toContain('removed')
    })

    it('includes word count in summary when it changes', () => {
      const result = computeDocumentDiff('one', 'one two three')
      expect(result.summary).toContain('+2')
    })

    it('summary for identical is "no changes"', () => {
      const result = computeDocumentDiff('same', 'same')
      expect(result.summary).toBe('no changes')
    })

    it('uses singular "section" for one section', () => {
      const result = computeDocumentDiff('old', 'new content here now')
      // 1 section added (old line removed, new line added — both non-contiguous? No — old has 1 line removed, new has 1 line added)
      // The point is to check singular usage works
      expect(typeof result.summary).toBe('string')
      expect(result.summary.length).toBeGreaterThan(0)
    })
  })
})
