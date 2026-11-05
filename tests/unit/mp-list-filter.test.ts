// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { createElement, type ReactElement, type ReactNode } from 'react'

/*
 * The All MPs list (UI plan E2a): the last-name key on the real name shapes
 * in federal_mps (read 2026-11-05), the three filters combined with AND, the
 * letter grouping, the divided list of rows, and the EmptyState with its
 * "Clear filters" action. The component is rendered for real in jsdom and
 * driven through its labelled controls; only next/link, next/image and the
 * database are replaced.
 */

vi.mock('next/link', async () => {
  const { createElement } = await import('react')
  return {
    default: ({ href, children, ...rest }: { href: string; children?: ReactNode } & Record<string, unknown>) =>
      createElement('a', { href, ...rest }, children),
  }
})
vi.mock('next/image', async () => {
  const { createElement } = await import('react')
  return {
    default: ({ src, alt, width, height, ...rest }: { src: string; alt: string; width?: number; height?: number } & Record<string, unknown>) =>
      createElement('img', { src, alt, width, height, ...rest }),
  }
})
// The freshness badge fetches its own status; it is E1's, tested there.
vi.mock('@/components/votes/data-freshness-badge', () => ({ DataFreshnessBadge: () => null }))

const dbResults: unknown[][] = []
vi.mock('@/lib/db', () => {
  const chain = (): unknown =>
    new Proxy(() => {}, {
      get(_t, prop) {
        if (prop === 'then') {
          return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) =>
            Promise.resolve(dbResults.shift() ?? []).then(ok, bad)
        }
        return () => chain()
      },
    })
  return { getDb: () => ({ select: () => chain() }) }
})

import {
  MpListFilter,
  lastNameKey,
  letterFor,
  monogramFor,
  sortByLastName,
  filterMps,
  groupByLetter,
  NO_FILTERS,
  LETTER_HEADERS_AFTER,
  type MpListRow,
} from '@/components/votes/mp-list-filter'
import AllMPsPage from '@/app/(app)/votes/mp/page'

let n = 0
function mp(name: string, party: string, ridingName: string, ridingProvince: string, photoUrl: string | null = null): MpListRow {
  n += 1
  return { id: `mp-${String(n).padStart(3, '0')}`, name, party, ridingName, ridingProvince, photoUrl }
}

// Real name shapes from production, with ridings and parties as stored.
const VAN_KOEVERDEN = mp('Adam van Koeverden', 'Liberal', 'Burlington North—Milton West', 'Ontario')
const DEBELLEFEUILLE = mp('Claude DeBellefeuille', 'Bloc', 'Beauharnois—Salaberry—Soulanges—Huntingdon', 'Quebec')
const LEBLANC = mp('Dominic LeBlanc', 'Liberal', 'Beauséjour', 'New Brunswick')
const MACDONALD = mp('Heath MacDonald', 'Liberal', 'Malpeque', 'Prince Edward Island')
const MCGUINTY = mp('David McGuinty', 'Liberal', 'Ottawa South', 'Ontario', 'https://example.test/mcguinty.jpg')
const DERIDDER = mp('Kelly DeRidder', 'Conservative', 'Kitchener Centre', 'Ontario')
const GUNN = mp('Aaron Gunn', 'Conservative', 'North Island—Powell River', 'British Columbia')
const ELISABETH = mp('Élisabeth Brière', 'Liberal', 'Sherbrooke', 'Quebec')
const BRIERE = mp('Zoe Briere', 'NDP', 'Lévis—Lotbinière', 'Quebec')
const ABBOTT = mp('Wren Abbott', 'Green', 'Saanich—Gulf Islands', 'British Columbia')

const ALL = [VAN_KOEVERDEN, DEBELLEFEUILLE, LEBLANC, MACDONALD, MCGUINTY, DERIDDER, GUNN, ELISABETH, BRIERE, ABBOTT]
const PROVINCES = [...new Set(ALL.map((m) => m.ridingProvince))].sort()
// Eleven more, all filed under X, so the list passes the 20-row header threshold.
const XS = ['Ada', 'Ben', 'Cal', 'Dee', 'Eve', 'Fay', 'Gus', 'Hal', 'Ida', 'Jo', 'Kit'].map((given) =>
  mp(`${given} Xu`, 'NDP', 'Vancouver East', 'British Columbia')
)
const BIG = [...ALL, ...XS] // 21 MPs

afterEach(() => {
  cleanup()
  dbResults.length = 0
})

function renderList(mps: MpListRow[] = ALL) {
  return render(createElement(MpListFilter, { mps, provinces: [...new Set(mps.map((m) => m.ridingProvince))].sort() }))
}

/** The names the list shows, top to bottom. */
function shownNames(container: HTMLElement): string[] {
  return [...container.querySelectorAll('ul > li > a p')].map((p) => p.textContent ?? '')
}

/** The letter headers, top to bottom. */
function shownLetters(container: HTMLElement): string[] {
  return [...container.querySelectorAll('ul > li[role="presentation"]')].map((li) => li.textContent ?? '')
}

const search = () => screen.getByLabelText('Search') as HTMLInputElement
const province = () => screen.getByLabelText('Province or territory') as HTMLSelectElement
const party = () => screen.getByLabelText('Party') as HTMLSelectElement

describe('lastNameKey: particles as stored', () => {
  it('starts the key at a lowercase particle: van Koeverden files under V', () => {
    expect(lastNameKey('Adam van Koeverden')).toBe('van Koeverden')
    expect(letterFor('Adam van Koeverden')).toBe('V')
  })

  it('keeps single-token surnames whole, capitals as stored', () => {
    expect(lastNameKey('Claude DeBellefeuille')).toBe('DeBellefeuille')
    expect(letterFor('Claude DeBellefeuille')).toBe('D')
    expect(lastNameKey('Dominic LeBlanc')).toBe('LeBlanc')
    expect(letterFor('Dominic LeBlanc')).toBe('L')
    expect(lastNameKey('Kelly DeRidder')).toBe('DeRidder')
  })

  it('files MacDonald under M as MacDonald, never read as Mc', () => {
    expect(lastNameKey('Heath MacDonald')).toBe('MacDonald')
    expect(letterFor('Heath MacDonald')).toBe('M')
    // Stored spelling decides: "MacDonald" sorts before "McGuinty" ("a" < "c").
    expect(sortByLastName([MCGUINTY, MACDONALD]).map((m) => m.name)).toEqual(['Heath MacDonald', 'David McGuinty'])
  })

  it('takes the last token when there is no particle, and keeps a hyphenated surname whole', () => {
    expect(lastNameKey('Aaron Gunn')).toBe('Gunn')
    expect(lastNameKey('Mary Smith-Jones')).toBe('Smith-Jones')
    expect(lastNameKey('  Aaron   Gunn ')).toBe('Gunn')
  })

  it('reads a particle only after the first token and before the last', () => {
    // A given name that happens to be a particle-shaped word is not a particle.
    expect(lastNameKey('de Smith')).toBe('Smith')
    // A trailing particle-shaped token is the surname itself.
    expect(lastNameKey('Anna Maria van')).toBe('van')
    // Capitalised "Van" is not a lowercase particle as stored.
    expect(lastNameKey('Chris Van Dusen')).toBe('Dusen')
  })

  it('folds accents for the letter and sorts accented names beside plain ones', () => {
    expect(letterFor('Émile Élan')).toBe('E')
    expect(sortByLastName([mp('Bo Zed', 'NDP', 'X', 'Ontario'), mp('Al Élan', 'NDP', 'X', 'Ontario'), mp('Cy Elam', 'NDP', 'X', 'Ontario')]).map((m) => m.name)).toEqual([
      'Cy Elam',
      'Al Élan',
      'Bo Zed',
    ])
  })

  it('sorts an accented given name by its surname, ties broken by the whole name', () => {
    // Brière and Briere share a base key; the whole name breaks the tie (É ~ E < Z),
    // not the id: Zoe is made first here, so an id tie-break would put her first.
    const zoe = mp('Zoe Briere', 'NDP', 'Lévis—Lotbinière', 'Quebec')
    const elisabeth = mp('Élisabeth Brière', 'Liberal', 'Sherbrooke', 'Quebec')
    expect(sortByLastName([zoe, elisabeth]).map((m) => m.name)).toEqual(['Élisabeth Brière', 'Zoe Briere'])
  })
})

describe('monogramFor: the disc agrees with the letter header', () => {
  it('is the given-name initial plus the filing letter', () => {
    expect(monogramFor('Adam van Koeverden')).toBe('AV')
    expect(monogramFor('Aaron Gunn')).toBe('AG')
    expect(monogramFor('Heath MacDonald')).toBe('HM')
    expect(monogramFor('Claude DeBellefeuille')).toBe('CD')
    // The filing letter is accent-folded, as its header is.
    expect(monogramFor('Al Élan')).toBe('AE')
  })

  it('renders in the placeholder disc, aria-hidden', () => {
    const { container } = renderList([VAN_KOEVERDEN])
    const disc = container.querySelector('ul a [aria-hidden="true"]')!
    expect(disc.textContent).toBe('AV')
  })
})

describe('sort and grouping', () => {
  it('sorts the whole list by last name, not first name', () => {
    expect(sortByLastName(ALL).map((m) => m.name)).toEqual([
      'Wren Abbott',
      'Élisabeth Brière',
      'Zoe Briere',
      'Claude DeBellefeuille',
      'Kelly DeRidder',
      'Aaron Gunn',
      'Dominic LeBlanc',
      'Heath MacDonald',
      'David McGuinty',
      'Adam van Koeverden',
    ])
  })

  it('groups runs of one letter, in order', () => {
    expect(groupByLetter(ALL).map((g) => [g.letter, g.mps.length])).toEqual([
      ['A', 1],
      ['B', 2],
      ['D', 2],
      ['G', 1],
      ['L', 1],
      ['M', 2],
      ['V', 1],
    ])
  })

  it('renders one divided list: a sticky letter header before each group, a 48px link row per MP', () => {
    const { container } = renderList(BIG)
    const lists = container.querySelectorAll('ul')
    expect(lists).toHaveLength(1)
    // overflow-clip, never overflow-hidden: no scroll container, so headers stick to the shell.
    for (const cls of ['divide-y', 'divide-border', 'bg-surface-1', 'border', 'border-border', 'rounded-xl', 'overflow-clip']) {
      expect(lists[0].classList.contains(cls)).toBe(true)
    }
    expect(lists[0].classList.contains('overflow-hidden')).toBe(false)
    expect(shownLetters(container)).toEqual(['A', 'B', 'D', 'G', 'L', 'M', 'V', 'X'])
    expect(shownNames(container)).toEqual(sortByLastName(BIG).map((m) => m.name))

    const header = container.querySelector('ul > li[role="presentation"]')!
    for (const cls of ['sticky', 'top-0', 'z-10', 'bg-surface-2', 'py-1', 'text-sm', 'font-semibold', 'text-text-secondary']) {
      expect(header.classList.contains(cls)).toBe(true)
    }
    expect(header.classList.contains('uppercase')).toBe(false)

    const rows = container.querySelectorAll('ul > li:not([role="presentation"])')
    expect(rows).toHaveLength(BIG.length)
    const first = rows[0].querySelector('a')!
    expect(first.getAttribute('href')).toBe(`/votes/mp/${ABBOTT.id}`)
    expect(first.className).toContain('min-h-12')
    // Inset focus ring, important so it beats the unlayered global offset.
    expect(first.classList.contains('-outline-offset-2!')).toBe(true)

    // The header sits directly before its group's first row.
    const items = [...lists[0].children]
    const vHeader = items.findIndex((li) => li.getAttribute('role') === 'presentation' && li.textContent === 'V')
    expect(items[vHeader + 1].textContent).toContain('Adam van Koeverden')
  })

  it('shows letter headers only when more than 20 MPs are visible', () => {
    expect(LETTER_HEADERS_AFTER).toBe(20)
    const at20 = renderList(BIG.slice(0, 20))
    expect(shownNames(at20.container)).toHaveLength(20)
    expect(shownLetters(at20.container)).toEqual([])
    cleanup()
    const at21 = renderList(BIG)
    expect(shownLetters(at21.container)).toHaveLength(8)
  })

  it('drops the headers when a filter narrows the list to 20 or fewer', () => {
    const { container } = renderList(BIG)
    expect(shownLetters(container)).toHaveLength(8)
    fireEvent.change(party(), { target: { value: 'NDP' } }) // Briere + 11 Xu = 12
    expect(shownNames(container)).toHaveLength(12)
    expect(shownLetters(container)).toEqual([])
  })

  it('draws the photo or the initial as decoration only, and shows party and riding', () => {
    const { container } = renderList([MCGUINTY, GUNN])
    const img = container.querySelector('img')!
    expect(img.getAttribute('alt')).toBe('')
    expect(img.getAttribute('src')).toBe('https://example.test/mcguinty.jpg')
    expect(img.classList.contains('object-top')).toBe(true)
    const initial = [...container.querySelectorAll('[aria-hidden="true"]')].find((el) => el.textContent === 'AG')
    expect(initial).toBeDefined()
    const gunnRow = screen.getByText('Aaron Gunn').closest('a')!
    expect(within(gunnRow).getByText('Conservative')).toBeTruthy()
    expect(gunnRow.textContent).toContain('North Island—Powell River, British Columbia')
    const riding = gunnRow.querySelector('[data-riding]')!
    expect(riding.textContent).toBe('North Island—Powell River, British Columbia')
    for (const cls of ['text-xs', 'text-text-muted', 'max-sm:basis-full']) expect(riding.classList.contains(cls)).toBe(true)
  })
})

describe('filters (AND)', () => {
  it('builds the province and party selects from what is present', () => {
    renderList()
    expect([...province().options].map((o) => o.value)).toEqual(['', ...PROVINCES])
    expect([...party().options].map((o) => o.value)).toEqual(['', 'Bloc', 'Conservative', 'Green', 'Liberal', 'NDP'])
    expect(screen.getByTestId('mp-count').textContent).toBe('10 MPs')
  })

  it('pairs Province and Party on phones from 360px and folds them into the three-across row at sm', () => {
    const { container } = renderList()
    const pair = container.querySelector('[data-select-pair]')!
    for (const cls of ['grid', 'min-[360px]:grid-cols-2', 'sm:contents']) expect(pair.classList.contains(cls)).toBe(true)
    expect(pair.contains(province())).toBe(true)
    expect(pair.contains(party())).toBe(true)
    expect(pair.contains(search())).toBe(false)
    expect(pair.parentElement!.classList.contains('sm:grid-cols-[minmax(0,1fr)_auto_auto]')).toBe(true)
  })

  it("hides Chromium's native clear glyph on the search field, as Scout does", () => {
    renderList()
    expect(search().type).toBe('search')
    expect(search().classList.contains('[&::-webkit-search-cancel-button]:appearance-none')).toBe(true)
  })

  it('searches name or riding, ignoring case and accents', () => {
    const { container } = renderList()
    fireEvent.change(search(), { target: { value: 'ELISABETH' } })
    expect(shownNames(container)).toEqual(['Élisabeth Brière'])
    fireEvent.change(search(), { target: { value: 'levis' } })
    expect(shownNames(container)).toEqual(['Zoe Briere'])
    expect(screen.getByTestId('mp-count').textContent).toBe('1 MP')
  })

  it('search plus province', () => {
    const { container } = renderList()
    fireEvent.change(search(), { target: { value: 'de' } })
    expect(shownNames(container)).toEqual(['Claude DeBellefeuille', 'Kelly DeRidder', 'Adam van Koeverden'])
    fireEvent.change(province(), { target: { value: 'Ontario' } })
    expect(shownNames(container)).toEqual(['Kelly DeRidder', 'Adam van Koeverden'])
  })

  it('province plus party', () => {
    const { container } = renderList()
    fireEvent.change(province(), { target: { value: 'Ontario' } })
    expect(shownNames(container)).toEqual(['Kelly DeRidder', 'David McGuinty', 'Adam van Koeverden'])
    fireEvent.change(party(), { target: { value: 'Liberal' } })
    expect(shownNames(container)).toEqual(['David McGuinty', 'Adam van Koeverden'])
    // Two rows: under the threshold, so no letter headers.
    expect(shownLetters(container)).toEqual([])
  })

  it('all three together', () => {
    const { container } = renderList()
    fireEvent.change(search(), { target: { value: 'ottawa' } })
    fireEvent.change(province(), { target: { value: 'Ontario' } })
    fireEvent.change(party(), { target: { value: 'Liberal' } })
    expect(shownNames(container)).toEqual(['David McGuinty'])
    fireEvent.change(party(), { target: { value: 'Conservative' } })
    expect(shownNames(container)).toEqual([])
  })

  it('filterMps requires every set filter, never any one of them', () => {
    // Each filter alone would match something; together they match nothing.
    expect(filterMps(ALL, { query: 'Gunn', province: 'Ontario', party: '' })).toEqual([])
    expect(filterMps(ALL, { query: '', province: 'Quebec', party: 'Green' })).toEqual([])
    expect(filterMps(ALL, { query: '', province: 'Quebec', party: 'Bloc' })).toEqual([DEBELLEFEUILLE])
    expect(filterMps(ALL, NO_FILTERS)).toHaveLength(ALL.length)
  })

  it('no match shows the EmptyState and Clear filters restores the whole list', () => {
    const { container } = renderList()
    fireEvent.change(search(), { target: { value: 'Gunn' } })
    fireEvent.change(province(), { target: { value: 'Ontario' } })
    expect(container.querySelector('ul')).toBeNull()
    expect(container.textContent).toContain('No MPs match these filters.')
    expect(screen.getByTestId('mp-count').textContent).toBe('0 MPs')

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(container.textContent).not.toContain('No MPs match these filters.')
    expect(shownNames(container)).toHaveLength(ALL.length)
    expect(search().value).toBe('')
    expect(province().value).toBe('')
    expect(party().value).toBe('')
  })
})

describe('the page', () => {
  it('hands the rows and the provinces to the list', async () => {
    dbResults.push([GUNN, VAN_KOEVERDEN, ABBOTT])
    const { container } = render((await AllMPsPage()) as ReactElement)
    expect(container.textContent).toContain('3 current MPs across 2 provinces and territories')
    expect(shownNames(container)).toEqual(['Wren Abbott', 'Aaron Gunn', 'Adam van Koeverden'])
    expect([...province().options].map((o) => o.value)).toEqual(['', 'British Columbia', 'Ontario'])
  })

  it('shows the plain EmptyState when nothing has synced', async () => {
    dbResults.push([])
    const { container } = render((await AllMPsPage()) as ReactElement)
    expect(container.textContent).toContain('No MP data yet. This deployment hasn’t synced with Parliament.')
    expect(container.querySelector('.rounded-xl.border.border-border.bg-surface-1')).not.toBeNull()
    expect(screen.queryByLabelText('Search')).toBeNull()
  })
})
