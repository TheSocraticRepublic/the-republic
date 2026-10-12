// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MISSING_MARKER_LETTER } from '../fixtures/letters'

/*
 * The Lever action page (a server component) is the only way the stored
 * confirm time reaches the screen after a reload (Razor A5 N3). Rendered for
 * real with its request headers, database and investigation lookup replaced.
 */

const ID = '66666666-6666-4666-8666-666666666666'
let row: Record<string, unknown> | null = null

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-user-id': 'user-a' }),
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound')
  },
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  usePathname: () => `/lever/${ID}`,
}))
vi.mock('@/lib/db', () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => (row ? [row] : []) }) }) }),
  }),
}))
vi.mock('@/lib/lever/load-recipient', () => ({ loadInvestigationProvince: async () => null }))

const { default: LeverActionPage } = await import('@/app/(app)/lever/[id]/page')

function action(status: 'draft' | 'final' | 'filed', extra: Record<string, unknown> = {}) {
  return {
    id: ID,
    userId: 'user-a',
    actionType: 'fippa_request',
    title: 'QA A5 page',
    content: MISSING_MARKER_LETTER.content,
    status,
    metadata: { publicBody: 'BC Ministry of Forests', jurisdiction: 'bc', letterFormat: 'marker-v1', ...extra },
    investigationId: null,
    documentId: null,
    createdAt: new Date('2026-10-01T12:00:00Z'),
  }
}

async function renderPage() {
  render(await LeverActionPage({ params: Promise.resolve({ id: ID }) }))
}

const notice = () => document.querySelector('[data-letter-notice]')

afterEach(() => {
  cleanup()
  row = null
})

describe('the action page passes the stored confirm time (A5, Razor N3)', () => {
  it('a confirmed final letter, freshly loaded: no notes notice, letter shown', async () => {
    row = action('final', { notesRemovalConfirmedAt: '2026-10-12T16:00:00.000Z' })
    await renderPage()
    expect(document.querySelector('[data-letter-paper]')!.textContent).toContain('Mill Creek')
    expect(notice()).toBeNull()
  })

  it('the same letter without the time keeps the notice', async () => {
    row = action('final')
    await renderPage()
    expect(notice()!.textContent).toContain('may include notes')
  })
})
