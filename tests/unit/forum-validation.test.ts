import { describe, it, expect } from 'vitest'
import {
  validateThreadTitle,
  validatePostContent,
  THREAD_TITLE_MIN,
  THREAD_TITLE_MAX,
  POST_CONTENT_MIN,
  POST_CONTENT_MAX,
} from '@/lib/forum/validation'

describe('validateThreadTitle', () => {
  it('rejects title shorter than minimum', () => {
    // 4 chars — below THREAD_TITLE_MIN (5)
    const result = validateThreadTitle('abcd')
    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('rejects title longer than maximum', () => {
    // 201 chars — above THREAD_TITLE_MAX (200)
    const result = validateThreadTitle('a'.repeat(201))
    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('accepts title at minimum length (5)', () => {
    expect(validateThreadTitle('hello').valid).toBe(true)
    expect(validateThreadTitle('a'.repeat(THREAD_TITLE_MIN)).valid).toBe(true)
  })

  it('accepts title at maximum length (200)', () => {
    expect(validateThreadTitle('a'.repeat(THREAD_TITLE_MAX)).valid).toBe(true)
  })

  it('rejects empty title', () => {
    expect(validateThreadTitle('').valid).toBe(false)
  })

  it('strips HTML tags before measuring length', () => {
    // Visible text is only 4 chars after stripping — below minimum
    const result = validateThreadTitle('<b>abcd</b>')
    expect(result.valid).toBe(false)
  })

  it('accepts title whose visible text meets minimum after stripping', () => {
    // Visible text is "hello" (5 chars) — meets minimum
    const result = validateThreadTitle('<b>hello</b>')
    expect(result.valid).toBe(true)
  })
})

describe('validatePostContent', () => {
  it('rejects empty content', () => {
    const result = validatePostContent('')
    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('rejects content longer than maximum (5001 chars)', () => {
    const result = validatePostContent('a'.repeat(POST_CONTENT_MAX + 1))
    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('accepts content at minimum length (1)', () => {
    expect(validatePostContent('a'.repeat(POST_CONTENT_MIN)).valid).toBe(true)
  })

  it('accepts content at maximum length (5000)', () => {
    expect(validatePostContent('a'.repeat(POST_CONTENT_MAX)).valid).toBe(true)
  })

  it('strips HTML tags before measuring length — empty after strip is rejected', () => {
    // Tag with no inner text strips to empty string
    const result = validatePostContent('<br/>')
    expect(result.valid).toBe(false)
  })

  it('strips HTML tags before measuring length — valid inner text passes', () => {
    const result = validatePostContent('<p>Some content here</p>')
    expect(result.valid).toBe(true)
  })
})
