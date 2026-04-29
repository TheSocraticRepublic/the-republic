import { describe, it, expect } from 'vitest'
import { investigations } from '@/lib/db/schema'

describe('Lens persistence schema', () => {
  it('investigations table has lensContextText column', () => {
    expect(investigations.lensContextText).toBeDefined()
    expect(investigations.lensContextText.name).toBe('lens_context_text')
  })

  it('investigations table has lensCompletedAt column', () => {
    expect(investigations.lensCompletedAt).toBeDefined()
    expect(investigations.lensCompletedAt.name).toBe('lens_completed_at')
  })

  it('lensContextText is nullable (no .notNull())', () => {
    expect(investigations.lensContextText.notNull).toBe(false)
  })

  it('lensCompletedAt is nullable (no .notNull())', () => {
    expect(investigations.lensCompletedAt.notNull).toBe(false)
  })
})
