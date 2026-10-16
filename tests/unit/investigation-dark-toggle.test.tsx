// @vitest-environment jsdom
/**
 * Jen D1 C3(a): until D4 makes the dark paper real, the investigation page
 * offers no briefing dark toggle and applies no stored dark state to the
 * briefing. Rendered on the client (React DOM in jsdom, after hydration-time
 * effects), with a citizen who pressed the old toggle (`republic-island-dark`
 * = 'true' in localStorage), so the client snapshot is the one under test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, back: () => {}, prefetch: () => {} }),
  usePathname: () => '/investigate/c0000000-0000-4000-8000-0000000000c1',
  useSearchParams: () => new URLSearchParams(),
}))

import { InvestigationPage } from '@/components/investigation/investigation-page'

const BRIEFING = ['# Variance 2025-114', '', '## Context', 'Council granted a height variance.', '', '## What This Analysis Cannot See', 'Closed sessions.'].join('\n')

beforeEach(() => {
  localStorage.setItem('republic-island-dark', 'true')
  // The civic strip fetches on mount; answer nothing, never resolve into state.
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('the briefing dark toggle is withheld until D4', () => {
  it('renders no toggle, and a stored dark preference leaves the paper light', () => {
    const { container } = render(
      <InvestigationPage
        id="c0000000-0000-4000-8000-0000000000c1"
        concern="A variance"
        jurisdictionName="Nelson, BC"
        briefingText={BRIEFING}
        isAuthor={false}
        archiveStatus={null}
      />
    )
    const article = container.querySelector('article.content-island')
    expect(article).not.toBeNull()
    expect(screen.getByText('Want to go deeper?')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /switch to (dark|light) mode/i })).toBeNull()
    expect(article!.className).not.toContain('dark-island')
    expect(article!.className).not.toContain('content-island--dark')
  })
})
