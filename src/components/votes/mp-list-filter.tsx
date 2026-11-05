'use client'

import { useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { PartyBadge } from '@/components/votes/party-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Field, fieldControlClass } from '@/components/ui/field'

/*
 * The All MPs list (UI plan E2a; app-arms P1-8, mobile P1-6): one search box
 * and two selects that narrow the list together, a last-name sort with letter
 * headers, and a single divided list of 48px rows.
 *
 * The server page owns the query; this component owns everything the citizen
 * changes. Filter state is local, not in the URL (the brief makes URL state
 * optional), so a reload starts from the whole list.
 */

export interface MpListRow {
  id: string
  name: string
  party: string
  ridingName: string
  ridingProvince: string
  photoUrl: string | null
}

export interface MpFilters {
  query: string
  province: string
  party: string
}

export const NO_FILTERS: MpFilters = { query: '', province: '', party: '' }

/**
 * Lowercase surname particles, matched exactly as stored. "van" in "Adam van
 * Koeverden" starts the surname; "DeBellefeuille" and "LeBlanc" are one token
 * each and never split, and "MacDonald" stays "MacDonald" (never read as "Mc").
 */
const SURNAME_PARTICLES = new Set(['van', 'von', 'de', 'du', 'des', 'la', 'le', 'da', 'di', 'der', 'den', 'ter'])

/**
 * The last-name sort key for a name held in one field ("Aaron Gunn"). The key
 * starts at the first lowercase particle after the first token and runs to
 * the end; otherwise it is the last token (a particle that is itself the last
 * token is both). Hyphenated surnames are one token and stay whole.
 */
export function lastNameKey(name: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return ''
  for (let i = 1; i < tokens.length; i++) {
    if (SURNAME_PARTICLES.has(tokens[i])) return tokens.slice(i).join(' ')
  }
  return tokens[tokens.length - 1]
}

/** Case- and accent-insensitive form for matching ("Élisabeth" finds "elisabeth"). */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/** The letter a name files under: the key's first character, uppercased, accents folded (É under E). */
export function letterFor(name: string): string {
  const first = lastNameKey(name).charAt(0)
  return first ? fold(first).toUpperCase() : '#'
}

/**
 * The two letters in a row's placeholder disc: the given name's initial, then
 * the letter the row files under ("Adam van Koeverden" is AV), so the disc
 * agrees with the letter header instead of reading as a second index (Jen C1).
 */
export function monogramFor(name: string): string {
  return `${name.trim().charAt(0).toUpperCase()}${letterFor(name)}`
}

/** One collator for every comparison: `localeCompare` with options builds a
 *  new one per call, and the sort runs on every keystroke (Razor N1). */
const COLLATOR = new Intl.Collator('en-CA', { sensitivity: 'base' })
const collate = COLLATOR.compare

/** By last name, then by the whole name, then by id so equal names keep a stable order. */
export function sortByLastName<T extends Pick<MpListRow, 'id' | 'name'>>(rows: readonly T[]): T[] {
  // Each key is derived once, not twice per comparison.
  const keyed = rows.map((row) => ({ row, key: lastNameKey(row.name) }))
  keyed.sort(
    (a, b) =>
      collate(a.key, b.key) ||
      collate(a.row.name, b.row.name) ||
      (a.row.id < b.row.id ? -1 : a.row.id > b.row.id ? 1 : 0)
  )
  return keyed.map((k) => k.row)
}

/** Every set filter must match (AND). The search matches the name or the riding. */
export function filterMps<T extends MpListRow>(rows: readonly T[], filters: MpFilters): T[] {
  const q = fold(filters.query.trim())
  return rows.filter(
    (mp) =>
      (q === '' || fold(mp.name).includes(q) || fold(mp.ridingName).includes(q)) &&
      (filters.province === '' || mp.ridingProvince === filters.province) &&
      (filters.party === '' || mp.party === filters.party)
  )
}

/** Sorted rows split into runs that share a letter, in order. */
export function groupByLetter<T extends MpListRow>(rows: readonly T[]): { letter: string; mps: T[] }[] {
  const groups: { letter: string; mps: T[] }[] = []
  for (const mp of sortByLastName(rows)) {
    const letter = letterFor(mp.name)
    const last = groups[groups.length - 1]
    if (last && last.letter === letter) last.mps.push(mp)
    else groups.push({ letter, mps: [mp] })
  }
  return groups
}

/** Letter headers appear only when the visible list has more than this many
 *  MPs: the full list and the big parties and provinces keep them, a search
 *  result or a narrow filter does not (Jen C2). */
export const LETTER_HEADERS_AFTER = 20

interface MpListFilterProps {
  mps: MpListRow[]
  /** The provinces and territories present, as the page already computes them. */
  provinces: string[]
}

export function MpListFilter({ mps, provinces }: MpListFilterProps) {
  const [filters, setFilters] = useState<MpFilters>(NO_FILTERS)

  const parties = useMemo(() => [...new Set(mps.map((m) => m.party))].sort(collate), [mps])
  const groups = useMemo(() => groupByLetter(filterMps(mps, filters)), [mps, filters])
  const count = groups.reduce((n, g) => n + g.mps.length, 0)
  const showLetters = count > LETTER_HEADERS_AFTER

  const filtering = filters.query.trim() !== '' || filters.province !== '' || filters.party !== ''
  const searchRef = useRef<HTMLInputElement>(null)
  // Both Clear buttons unmount once the filters reset, which would drop focus
  // to <body>; it goes to the search field instead (Razor W2, Jen C7).
  const clear = () => {
    setFilters(NO_FILTERS)
    searchRef.current?.focus()
  }

  const set = (key: keyof MpFilters) => (value: string) => setFilters((f) => ({ ...f, [key]: value }))

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <Field id="mp-search" label="Search">
          {(control) => (
            <input
              {...control}
              ref={searchRef}
              type="search"
              value={filters.query}
              onChange={(e) => set('query')(e.target.value)}
              placeholder="Name or riding"
              autoComplete="off"
              // No native clear glyph, as Scout's search (Jen C1 C6, E2a C5).
              className={`${fieldControlClass('input')} [&::-webkit-search-cancel-button]:appearance-none`}
            />
          )}
        </Field>
        {/* Province and Party side by side on phones from 360px, so the list
            starts above the keyboard; stacked at 320; at sm and up the wrapper
            dissolves (`contents`) into the three-across row (Jen C9). */}
        <div data-select-pair className="grid gap-3 min-[360px]:grid-cols-2 sm:contents">
          <Field id="mp-province" label="Province or territory">
            {(control) => (
              <div className="relative">
                <select
                  {...control}
                  value={filters.province}
                  onChange={(e) => set('province')(e.target.value)}
                  className={fieldControlClass('select')}
                >
                  <option value="">All</option>
                  {provinces.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={13}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted"
                />
              </div>
            )}
          </Field>
          <Field id="mp-party" label="Party">
            {(control) => (
              <div className="relative">
                <select
                  {...control}
                  value={filters.party}
                  onChange={(e) => set('party')(e.target.value)}
                  className={fieldControlClass('select')}
                >
                  <option value="">All</option>
                  {parties.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={13}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted"
                />
              </div>
            )}
          </Field>
        </div>
      </div>

      {/* The count line (Jen C6). At rest it is the total. While a filter is
          set it reads "N of M MPs" with a Clear filters button beside it, so a
          narrowed list can be reset without a no-match. At zero it would only
          repeat the EmptyState below, so it is announced, not shown. */}
      <div className="mb-2 flex items-center gap-3">
        <p
          aria-live="polite"
          data-testid="mp-count"
          className={count === 0 ? 'sr-only' : 'text-xs text-text-muted'}
        >
          {count === 0
            ? 'No MPs match these filters.'
            : filtering
              ? `${count} of ${mps.length} MPs`
              : count === 1
                ? '1 MP'
                : `${count} MPs`}
        </p>
        {filtering && count > 0 && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex min-h-6 items-center text-xs text-text-secondary underline underline-offset-2 transition-colors hover:text-text-primary pointer-coarse:min-h-11"
          >
            Clear filters
          </button>
        )}
      </div>

      {count === 0 ? (
        <EmptyState
          message={
            <>
              No MPs match these filters.
              {/* EmptyState's own action is a link; clearing is local state,
                  so the action is a button drawn with the same recipe. */}
              <span className="mt-1 block pointer-coarse:mt-0">
                <button
                  type="button"
                  onClick={clear}
                  className="inline-flex min-h-6 items-center text-sm text-text-secondary underline underline-offset-2 transition-colors hover:text-text-primary pointer-coarse:min-h-11"
                >
                  Clear filters
                </button>
              </span>
            </>
          }
        />
      ) : (
        // overflow-clip, not overflow-hidden: it clips the rounded corners
        // without making the list a scroll container, so the sticky headers
        // stick to the shell's scroller (Jen C2).
        <ul className="overflow-clip rounded-xl border border-border bg-surface-1 divide-y divide-border">
          {groups.map((group) => [
            // A sticky letter header, only on lists long enough to need an
            // index (more than LETTER_HEADERS_AFTER rows); a short result
            // would get one header per row. role="presentation" drops the
            // list-item semantics so the count of items is the count of MPs;
            // the letter's text is still read as a separator.
            showLetters && (
            <li
              key={`letter-${group.letter}`}
              role="presentation"
              className="sticky top-0 z-10 bg-surface-2 px-4 py-1 text-sm font-semibold text-text-secondary"
            >
              {group.letter}
            </li>
            ),
            ...group.mps.map((mp) => (
              <li key={mp.id}>
                {/* The inset ring needs `!`: the unlayered global
                    `*:focus-visible { outline-offset: 2px }` beats any layered
                    utility, and an outset ring is clipped by the list's
                    rounding (Razor W1, Jen C4). */}
                <Link
                  href={`/votes/mp/${mp.id}`}
                  className="group flex min-h-12 items-center gap-4 px-4 py-2 transition-colors duration-150 -outline-offset-2! hover:bg-surface-3"
                >
                  {mp.photoUrl ? (
                    <Image
                      src={mp.photoUrl}
                      alt=""
                      width={36}
                      height={36}
                      // openparliament portraits are tall (142x230): crop from the top so the
                      // whole head shows, not the tie (Jen C8).
                      className="h-9 w-9 flex-shrink-0 rounded-full object-cover object-top"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-bold text-text-muted"
                    >
                      {monogramFor(mp.name)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight text-text-primary">{mp.name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2">
                      <PartyBadge party={mp.party} />
                      {/* The riding is what a citizen recognises: 12px muted,
                          and on phones always its own line, so rows hold one
                          height instead of wrapping by width (Jen C3). */}
                      <span data-riding className="text-xs text-text-muted max-sm:basis-full">
                        {mp.ridingName}, {mp.ridingProvince}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            )),
          ])}
        </ul>
      )}
    </div>
  )
}
