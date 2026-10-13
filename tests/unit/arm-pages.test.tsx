// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import fs from 'fs'
import path from 'path'
import postcss, { type Root, type Rule } from 'postcss'
import tailwind from '@tailwindcss/postcss'

/*
 * The arm landings (UI plan C2a), rendered for real.
 *
 * - Every arm says what it is for, in an intro inside its header, before the
 *   rule, in the arm's own copy register (app-arms P1-5; CLAUDE.md "Copy
 *   register": Gadfly, and Lever's landing, aphoristic; Mirror convivial-plain;
 *   Oracle, Scout and Votes plain-instructional).
 * - Each empty state's action goes somewhere real: Gadfly's and Lever's open
 *   their create dialogs (?new=1), Oracle's goes to Scout.
 * - The arm room is the page, not the column: `data-arm` sits on a full-width
 *   wrapper around the `max-w-2xl` column, and the compiled `[data-arm]` rule
 *   fills its box with `min-height: 100%` (app-arms P2-1).
 * - Mirror asks its question before its optional selects.
 *
 * The pages are the async server components called as Next calls them. Only
 * the request headers, the database (an empty list for the signed-in user),
 * the Next router, the network and ScoutHistory (a database-reading server
 * component that is not C2a's) are stubbed.
 */

const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace, refresh: () => {}, back: () => {}, prefetch: () => {} }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-user-id': 'user-a' }),
}))
/** Rows every list query returns: none, so each landing shows its empty state. */
const rows: unknown[] = []
vi.mock('@/lib/db', () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ orderBy: async () => rows }) }) }),
  }),
}))
vi.mock('@/components/scout/scout-history', () => ({ ScoutHistory: () => null }))

import OraclePage from '@/app/(app)/oracle/page'
import GadflyPage from '@/app/(app)/gadfly/page'
import LeverPage from '@/app/(app)/lever/page'
import MirrorPage from '@/app/(app)/mirror/page'
import VotesPage from '@/app/(app)/votes/page'
import ScoutPage from '@/app/(app)/scout/page'
import { ARM_REGISTER } from '@/components/layout/arm-header'

const REPO = path.resolve(__dirname, '../..')

type Arm = 'oracle' | 'gadfly' | 'lever' | 'mirror' | 'votes' | 'scout'

async function renderArm(arm: Arm, params: Record<string, string> = {}) {
  const searchParams = Promise.resolve(params)
  switch (arm) {
    case 'oracle':
      return render(await OraclePage())
    case 'gadfly':
      return render(await GadflyPage({ searchParams }))
    case 'lever':
      return render(await LeverPage({ searchParams }))
    case 'mirror':
      return render(await MirrorPage({ searchParams }))
    case 'votes':
      return render(VotesPage())
    case 'scout':
      return render(ScoutPage())
  }
}

/** The intro copy, verbatim, and the register each must be set in. */
const INTROS: Record<Arm, { text: string; register: 'aphoristic' | 'convivial-plain' | 'plain-instructional' }> = {
  oracle: {
    text: 'Upload a government document. Oracle shows who it benefits, who bears its costs, and what it leaves out.',
    register: 'plain-instructional',
  },
  gadfly: {
    text: 'Questions that sharpen your thinking. The Gadfly asks; it never answers for you.',
    register: 'aphoristic',
  },
  lever: {
    text: 'What you have learned, put on the record. Lever drafts FOI requests, public comments and policy briefs from your findings; every FOI request cites the law from fixed templates, never invented.',
    register: 'aphoristic',
  },
  mirror: {
    text: "Mirror sets a document or policy next to how other jurisdictions handle the same issue, so you can see what's normal and what isn't. Try comparing a rent-increase bylaw against three nearby cities.",
    register: 'convivial-plain',
  },
  votes: {
    text: 'Enter your postal code to find your Member of Parliament and see how they have voted in the House of Commons.',
    register: 'plain-instructional',
  },
  scout: {
    text: 'Scout searches public records for documents on a topic or place — bylaws, budgets, meeting minutes — so you don’t have to know which office is holding them.',
    register: 'plain-instructional',
  },
}

const ARMS = Object.keys(INTROS) as Arm[]

const normalise = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').replace(/'/g, '’').trim()

beforeEach(() => {
  rows.length = 0
  replace.mockClear()
  // Mirror's form, the dialogs and the Votes badge read these on mount.
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).startsWith('/api/oracle/documents'))
        return new Response(JSON.stringify({ documents: [] }), { status: 200 })
      if (String(url).startsWith('/api/gadfly/sessions'))
        return new Response(JSON.stringify({ sessions: [] }), { status: 200 })
      return new Response(JSON.stringify({}), { status: 200 })
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('every arm says what it is for, in its own register (app-arms P1-5)', () => {
  it('the register map follows CLAUDE.md', () => {
    expect(ARM_REGISTER).toEqual({
      scout: 'plain-instructional',
      oracle: 'plain-instructional',
      gadfly: 'aphoristic',
      lever: 'aphoristic',
      mirror: 'convivial-plain',
      votes: 'plain-instructional',
    })
  })

  for (const arm of ARMS) {
    it(`${arm}: the intro is the copy, in the ${INTROS[arm].register} register, inside the header before the rule`, async () => {
      const { container } = await renderArm(arm)
      const intros = container.querySelectorAll('[data-arm-intro]')
      expect(intros).toHaveLength(1)
      const intro = intros[0] as HTMLElement
      expect(normalise(intro.textContent)).toBe(normalise(INTROS[arm].text))
      expect(intro.getAttribute('data-register')).toBe(INTROS[arm].register)

      const classes = intro.className.split(/\s+/)
      expect(classes).toEqual(expect.arrayContaining(['mt-4', 'text-sm', 'leading-relaxed', 'text-text-secondary']))
      if (INTROS[arm].register === 'aphoristic') {
        expect(classes).toEqual(expect.arrayContaining(['font-serif', 'italic']))
      } else {
        // the plain voices are sans: no serif, no italics (and the class list is real, above)
        expect(classes).not.toContain('font-serif')
        expect(classes).not.toContain('italic')
      }

      // after the title, before the header's rule, and the only purpose line on the page
      const h1 = container.querySelector('h1')!
      const rule = container.querySelector('.h-px.mt-6.mb-8')!
      expect(h1).not.toBeNull()
      expect(rule).not.toBeNull()
      expect(h1.compareDocumentPosition(intro) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(intro.compareDocumentPosition(rule) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(rule.parentElement).toBe(intro.parentElement)
    })
  }

  it('Gadfly keeps a two-word subtitle like every other arm; the long line moved into the intro', async () => {
    const { container } = await renderArm('gadfly')
    const subtitle = container.querySelector('h1 + p')!
    expect(subtitle.textContent).toBe('Socratic inquiry')
  })
})

describe('empty-state actions go somewhere real', () => {
  const ROUTE_FILES: Record<string, string> = {
    '/scout': 'src/app/(app)/scout/page.tsx',
    '/gadfly': 'src/app/(app)/gadfly/page.tsx',
    '/lever': 'src/app/(app)/lever/page.tsx',
  }

  const cases: { arm: Arm; label: string; href: string }[] = [
    { arm: 'oracle', label: 'Search public records with Scout', href: '/scout' },
    { arm: 'gadfly', label: 'Begin your first inquiry', href: '/gadfly?new=1' },
    { arm: 'lever', label: 'Draft your first civic action', href: '/lever?new=1' },
  ]

  for (const { arm, label, href } of cases) {
    it(`${arm}: the empty state links "${label}" to ${href}, a route that exists`, async () => {
      await renderArm(arm)
      const link = screen.getByRole('link', { name: label })
      expect(link.getAttribute('href')).toBe(href)
      const route = href.split('?')[0]
      expect(fs.existsSync(path.join(REPO, ROUTE_FILES[route]))).toBe(true)
    })
  }

  it('Oracle says where to start, plainly', async () => {
    await renderArm('oracle')
    expect(screen.getByText('No documents yet. Upload a government document above, or find one with Scout.')).toBeTruthy()
  })

  it('Gadfly: ?new=1 opens the Begin Inquiry dialog; without it the dialog is closed', async () => {
    await renderArm('gadfly')
    expect(screen.queryByRole('dialog')).toBeNull()
    cleanup()
    await renderArm('gadfly', { new: '1' })
    const dialog = await screen.findByRole('dialog')
    expect(screen.getByRole('heading', { name: 'Begin Inquiry' })).toBeTruthy()
    expect(dialog.contains(screen.getByRole('heading', { name: 'Begin Inquiry' }))).toBe(true)
  })

  it('Lever: ?new=1 opens the New Action dialog; without it the dialog is closed', async () => {
    await renderArm('lever')
    expect(screen.queryByRole('dialog')).toBeNull()
    cleanup()
    await renderArm('lever', { new: '1' })
    const dialog = await screen.findByRole('dialog')
    expect(dialog.contains(screen.getByRole('heading', { name: 'New Civic Action' }))).toBe(true)
  })

  // The production path: the empty state's link is a client navigation to the
  // same page, so React keeps the page's tree and only the props change. The
  // dialog must still open (Ted's browser check caught it staying shut).
  for (const arm of ['gadfly', 'lever'] as const) {
    it(`${arm}: a client navigation from the list to ?new=1 opens the dialog in the kept tree`, async () => {
      const Page = arm === 'gadfly' ? GadflyPage : LeverPage
      const view = render(await Page({ searchParams: Promise.resolve({}) }))
      expect(screen.queryByRole('dialog')).toBeNull()
      view.rerender(await Page({ searchParams: Promise.resolve({ new: '1' }) }))
      expect(await screen.findByRole('dialog')).toBeTruthy()
    })

    it(`${arm}: closing a ?new=1 dialog takes the flag off the address and keeps the rest`, async () => {
      window.history.replaceState(null, '', `/${arm}?new=1&documentId=d1`)
      await renderArm(arm, { new: '1' })
      await screen.findByRole('dialog')
      fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(replace).toHaveBeenCalledWith(`/${arm}?documentId=d1`, { scroll: false })
      window.history.replaceState(null, '', '/')
    })

    it(`${arm}: closing a dialog the button opened leaves the address alone`, async () => {
      await renderArm(arm)
      fireEvent.click(screen.getByRole('button', { name: arm === 'gadfly' ? 'New Inquiry' : 'New Action' }))
      await screen.findByRole('dialog')
      fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(replace).not.toHaveBeenCalled()
    })
  }

  it('any other value of new leaves the dialogs closed', async () => {
    await renderArm('gadfly', { new: '0' })
    await renderArm('lever', { new: 'yes' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('the arm room is the page, not a column slab (app-arms P2-1)', () => {
  let compiled: Root

  beforeAll(async () => {
    const file = path.join(REPO, 'src/app/globals.css')
    const result = await postcss([tailwind()]).process(fs.readFileSync(file, 'utf8'), { from: file })
    compiled = postcss.parse(result.css)
  }, 60_000)

  it('the compiled [data-arm] rule fills its box with min-height: 100%, not 100vh', () => {
    const minHeights: string[] = []
    compiled.walkRules('[data-arm]', (rule: Rule) => {
      rule.walkDecls('min-height', (d) => {
        minHeights.push(d.value)
      })
    })
    expect(minHeights).toEqual(['100%'])
  })

  for (const arm of ARMS) {
    it(`${arm}: data-arm is on a full-width outer wrapper; the column is inside it`, async () => {
      const { container } = await renderArm(arm)
      const rooms = container.querySelectorAll('[data-arm]')
      expect(rooms).toHaveLength(1)
      const room = rooms[0] as HTMLElement
      expect(room.getAttribute('data-arm')).toBe(arm)
      // the outermost element of the page
      expect(room).toBe(container.firstElementChild)
      // no width constraint on the room itself: no max-width, no centring, no padding
      expect(room.getAttribute('class') ?? '').toBe('')
      expect(room.getAttribute('style')).toBeNull()
      // its one child is the readable column, which carries the width
      expect(room.children).toHaveLength(1)
      const column = room.firstElementChild as HTMLElement
      expect(column.className.split(/\s+/)).toEqual(expect.arrayContaining(['mx-auto', 'max-w-2xl', 'px-6', 'py-10']))
      expect(column.querySelector('h1')).not.toBeNull()
    })
  }
})

describe("Mirror asks its question first", () => {
  it('the question field comes before both optional selects', async () => {
    await renderArm('mirror')
    // the document select replaces its loading skeleton once the list arrives
    const docSelect = await waitFor(() => {
      const el = document.getElementById('compare-document')
      if (!el) throw new Error('document select not rendered yet')
      return el
    })
    const question = document.getElementById('compare-description')!
    const area = document.getElementById('compare-policy-area')!
    expect(question.tagName).toBe('TEXTAREA')
    expect(question.compareDocumentPosition(docSelect) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(question.compareDocumentPosition(area) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // and it is the first form control in the form
    const controls = Array.from(document.querySelectorAll('textarea, select, input'))
    expect(controls[0]).toBe(question)
  })
})
