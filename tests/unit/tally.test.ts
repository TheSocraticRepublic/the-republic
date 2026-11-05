// @vitest-environment jsdom
/**
 * UI plan E2b: ballots and tallies.
 *
 * The words come from the data model: a division's result is
 * passed / defeated / tie (`voteResultEnum`), a ballot is
 * yes / no / paired / didnt_vote (`mpBallotEnum`), and a division's totals
 * are yea_total, nay_total and paired_total. Shown as Passed / Defeated (a tie
 * shows as Defeated, R-A4), Yea / Nay / Paired / Didn't vote, and three
 * totals with no "Absent" and no percentage.
 *
 * The two fixtures are real House of Commons divisions, totals hard-coded from
 * the source (the same records scripts/qa/seed-local.ts transcribes, from
 * api.openparliament.ca, fetched 2026-10-11):
 *   https://openparliament.ca/votes/45-1/177/  Failed (stored as defeated), 141 yea, 187 nay, 6 paired
 *   https://openparliament.ca/votes/45-1/178/  Passed, 296 yea, 26 nay, 10 paired
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { cleanup, render, screen } from '@testing-library/react'

// next/link, reduced to the anchor it renders (jsdom has no app router).
vi.mock('next/link', async () => {
  const { createElement } = await import('react')
  return {
    default: ({ href, children, ...rest }: { href: string; children?: ReactNode } & Record<string, unknown>) =>
      createElement('a', { href, ...rest }, children),
  }
})

import { BALLOT_LABELS, BALLOT_ORDER, ResultLabel, resultLabelText } from '@/components/votes/result-label'
import { Tally, tallyLongForm } from '@/components/votes/tally'
import { VoteDetailCard } from '@/components/votes/vote-detail-card'
import { VoteBadge } from '@/components/votes/vote-badge'
import { PartyBreakdown } from '@/components/votes/party-breakdown'
import { BallotGroups, groupBallots, type BallotRecord } from '@/components/votes/ballot-list'
import { MpVoteList, keepBillNumbersWhole } from '@/components/votes/mp-vote-list'
import { InvestigationVotePanel } from '@/components/votes/investigation-vote-panel'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function html(node: ReturnType<typeof createElement>): HTMLElement {
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(node)
  return host
}

/** The visible tally items, as read on screen. */
function tallyItems(host: HTMLElement): string[] {
  return Array.from(host.querySelectorAll('[data-tally-item]')).map((el) => el.textContent ?? '')
}

function srText(host: HTMLElement): string {
  return host.querySelector('[data-tally] .sr-only')?.textContent ?? ''
}

// Source totals, https://openparliament.ca/votes/45-1/177/ and /178/.
const DIVISION_177 = { result: 'defeated', yeaTotal: 141, nayTotal: 187, pairedTotal: 6 }
const DIVISION_178 = { result: 'passed', yeaTotal: 296, nayTotal: 26, pairedTotal: 10 }

describe('Tally and ResultLabel against the source divisions', () => {
  it('45-1/177 renders Defeated, 141 Yea, 187 Nay, 6 Paired', () => {
    const host = html(createElement(VoteDetailCard, DIVISION_177))
    expect(host.querySelector('[data-result]')!.textContent).toBe('Defeated')
    expect(tallyItems(host)).toEqual(['141 Yea', '187 Nay', '6 Paired'])
    expect(srText(host)).toBe('141 voted yea, 187 voted nay, 6 paired')
  })

  it('45-1/178 renders Passed, 296 Yea, 26 Nay, 10 Paired', () => {
    const host = html(createElement(VoteDetailCard, DIVISION_178))
    expect(host.querySelector('[data-result]')!.textContent).toBe('Passed')
    expect(tallyItems(host)).toEqual(['296 Yea', '26 Nay', '10 Paired'])
    expect(srText(host)).toBe('296 voted yea, 26 voted nay, 10 paired')
  })

  it('the visible line is hidden from screen readers, which get the long form', () => {
    const host = html(createElement(Tally, { yeaTotal: 141, nayTotal: 187, pairedTotal: 6 }))
    expect(host.querySelector('[data-tally] > [aria-hidden="true"]')).not.toBeNull()
    expect(host.querySelector('[data-tally] > .sr-only')).not.toBeNull()
  })

  it('shows no Absent figure and no percentage', () => {
    const host = html(createElement(VoteDetailCard, DIVISION_177))
    expect(host.textContent).toContain('141')
    expect(host.textContent).not.toMatch(/absent/i)
    expect(host.textContent).not.toContain('%')
  })

  it('a paired total of 0 still shows, as 0 Paired', () => {
    const host = html(createElement(Tally, { yeaTotal: 170, nayTotal: 150, pairedTotal: 0 }))
    expect(tallyItems(host)).toEqual(['170 Yea', '150 Nay', '0 Paired'])
    expect(srText(host)).toBe('170 voted yea, 150 voted nay, 0 paired')
  })

  it('a null paired total leaves Paired out', () => {
    const host = html(createElement(Tally, { yeaTotal: 170, nayTotal: 150, pairedTotal: null }))
    expect(tallyItems(host)).toEqual(['170 Yea', '150 Nay'])
    expect(srText(host)).toBe('170 voted yea, 150 voted nay')
    expect(tallyLongForm({ yeaTotal: 1, nayTotal: 2, pairedTotal: null })).not.toContain('paired')
    expect(tallyLongForm({ yeaTotal: 1, nayTotal: 2, pairedTotal: 3 })).toContain('3 paired')
  })
})

describe('ResultLabel', () => {
  it('a tie displays as Defeated (R-A4), never as carried', () => {
    expect(resultLabelText('tie')).toBe('Defeated')
    const host = html(createElement(ResultLabel, { result: 'tie' }))
    expect(host.textContent).toBe('Defeated')
    expect(host.textContent).not.toMatch(/passed|carried/i)
  })

  it('maps passed and defeated, and shows an unknown value as stored', () => {
    expect(resultLabelText('passed')).toBe('Passed')
    expect(resultLabelText('defeated')).toBe('Defeated')
    expect(resultLabelText('withdrawn')).toBe('withdrawn')
  })

  it('is neutral text: no success, danger or warning colour', () => {
    for (const result of ['passed', 'defeated', 'tie']) {
      const span = html(createElement(ResultLabel, { result })).querySelector('span')!
      expect(span.className).toContain('text-text-secondary')
      expect(span.getAttribute('style')).toBeNull()
      expect(span.className).not.toMatch(/status-/)
    }
  })

  it('on the vote card the outcome is the headline: 18px primary on its own line, the tally beneath at 14px (Jen C2)', () => {
    const host = html(createElement(VoteDetailCard, DIVISION_177))
    const card = host.querySelector('[data-vote-detail-card]')!
    expect(card.className.split(/\s+/)).toContain('flex-col')
    const [first, second] = Array.from(card.children)
    expect(first.hasAttribute('data-result')).toBe(true)
    expect(first.className.split(/\s+/)).toEqual(expect.arrayContaining(['text-lg', 'text-text-primary', 'font-semibold']))
    expect(second.hasAttribute('data-tally')).toBe(true)
    expect(second.className.split(/\s+/)).toContain('text-sm')
  })

  it('the 2xs size swaps the type size only', () => {
    const span = html(createElement(ResultLabel, { result: 'passed', size: '2xs' })).querySelector('span')!
    expect(span.className.split(/\s+/)).toContain('text-2xs')
    expect(span.className.split(/\s+/)).not.toContain('text-xs')
  })
})

describe('ballot words', () => {
  it('maps all four stored ballots to the House words', () => {
    expect(BALLOT_LABELS).toEqual({ yes: 'Yea', no: 'Nay', paired: 'Paired', didnt_vote: "Didn't vote" })
    expect(BALLOT_ORDER).toEqual(['yes', 'no', 'paired', 'didnt_vote'])
  })

  it("VoteBadge shows Didn't vote, not Absent", () => {
    const text = html(createElement(VoteBadge, { ballot: 'didnt_vote' })).textContent
    expect(text).toBe("Didn't vote")
    expect(text).not.toMatch(/absent/i)
    expect(html(createElement(VoteBadge, { ballot: 'yes' })).textContent).toBe('Yea')
    expect(html(createElement(VoteBadge, { ballot: 'no' })).textContent).toBe('Nay')
    expect(html(createElement(VoteBadge, { ballot: 'paired' })).textContent).toBe('Paired')
  })

  it('PartyBreakdown says Yea and Nay, not Yes and No (app-arms P2-4)', () => {
    const host = html(createElement(PartyBreakdown, {
      partyVotes: [
        { party: 'Liberal', position: 'Yes', disagreement: 0 },
        { party: 'Conservative', position: 'No', disagreement: 0 },
        { party: 'Bloc', position: 'Paired', disagreement: null },
      ],
    }))
    // The same chip as an MP's ballot (Jen C4), so it is VoteBadge's markup.
    const chips = Array.from(host.querySelectorAll('[data-ballot]'))
    expect(chips.map((el) => el.textContent)).toEqual(['Yea', 'Nay', 'Paired'])
    expect(chips.map((el) => el.getAttribute('data-ballot'))).toEqual(['yes', 'no', 'paired'])
  })

  it('PartyBreakdown shows an unknown position as Unknown, in the neutral chip', () => {
    const host = html(createElement(PartyBreakdown, {
      partyVotes: [{ party: 'Green', position: 'Unknown', disagreement: null }],
    }))
    const chip = host.querySelector('[data-ballot]')!
    expect(chip.textContent).toBe('Unknown')
    expect(chip.getAttribute('style')).toContain('status-neutral')
  })

  it('ballot and outcome values are words, not tracked caps, and a ballot never wraps (Jen C4)', () => {
    for (const ballot of ['yes', 'no', 'paired', 'didnt_vote']) {
      const cls = html(createElement(VoteBadge, { ballot })).querySelector('span')!.className.split(/\s+/)
      expect(cls).toContain('whitespace-nowrap')
      expect(cls).not.toContain('uppercase')
      expect(cls).not.toContain('tracking-wider')
    }
    const rl = html(createElement(ResultLabel, { result: 'passed' })).querySelector('span')!.className.split(/\s+/)
    expect(rl).toContain('font-semibold')
    expect(rl).not.toContain('uppercase')
    expect(rl).not.toContain('tracking-wider')
  })

  it('VoteBadge shows a value outside the enum as stored, not as Didn\'t vote', () => {
    const chip = html(createElement(VoteBadge, { ballot: 'spoiled' })).querySelector('span')!
    expect(chip.textContent).toBe('spoiled')
    expect(chip.getAttribute('style')).toContain('status-neutral')
  })
})

describe('BallotList grouping', () => {
  const B = (mpId: string, mpName: string, party: string, ballot: string): BallotRecord =>
    ({ mpId, mpName, party, ridingName: 'R', ballot })
  const BALLOTS = [
    B('1', 'Zed', 'Liberal', 'didnt_vote'),
    B('2', 'Amy', 'NDP', 'no'),
    B('3', 'Bea', 'Bloc', 'paired'),
    B('4', 'Cal', 'Liberal', 'yes'),
    B('5', 'Abe', 'Conservative', 'yes'),
    B('6', 'Dee', 'Bloc', 'no'),
  ]

  it('groups under Yea, Nay, Paired, Didn\'t vote, in that order', () => {
    const groups = groupBallots(BALLOTS, 'name')
    expect(groups.map((g) => g.label)).toEqual(['Yea', 'Nay', 'Paired', "Didn't vote"])
    expect(groups[0].rows.map((r) => r.mpName)).toEqual(['Abe', 'Cal'])
    expect(groups[1].rows.map((r) => r.mpName)).toEqual(['Amy', 'Dee'])
  })

  it('sorts within a group by party, then name', () => {
    const groups = groupBallots(BALLOTS, 'party')
    expect(groups[0].rows.map((r) => r.mpName)).toEqual(['Abe', 'Cal'])
    expect(groups[1].rows.map((r) => r.mpName)).toEqual(['Dee', 'Amy'])
  })

  it('leaves out an empty group and keeps an unknown value in its own group, last', () => {
    const groups = groupBallots([B('1', 'Amy', 'NDP', 'no'), B('2', 'Bo', 'NDP', 'spoiled')], 'name')
    expect(groups.map((g) => g.label)).toEqual(['Nay', 'spoiled'])
  })

  // Razor C1: the rows can be a few short of the House's totals, so neither
  // the headers nor the list title carry a count; the official figures are
  // the Tally's alone.
  it('renders the group headers in order, with no count, under "Recorded ballots"', () => {
    const host = html(createElement(BallotGroups, { ballots: BALLOTS, sortBy: 'party', onSort: () => {} }))
    const headers = Array.from(host.querySelectorAll('[data-ballot-group] h2')).map((h) => h.textContent)
    expect(headers).toEqual(['Yea', 'Nay', 'Paired', "Didn't vote"])
    expect(host.textContent).toContain('Recorded ballots')
    expect(host.textContent).not.toMatch(/All Ballots/i)
    expect(host.textContent).not.toMatch(/\(\d+\)/)
  })

  it('group headers stick, and each row carries its ballot for a screen reader (Jen C1)', () => {
    const host = html(createElement(BallotGroups, { ballots: BALLOTS, sortBy: 'name', onSort: () => {} }))
    const h2 = host.querySelector('[data-ballot-group="no"] h2')!
    expect(h2.className.split(/\s+/)).toEqual(expect.arrayContaining(['sticky', 'top-0', 'bg-surface-2', 'text-sm']))
    expect(h2.className).not.toContain('uppercase')
    const rows = Array.from(host.querySelectorAll('[data-ballot-group="no"] a'))
    expect(rows.map((r) => r.querySelector('.sr-only')!.textContent)).toEqual([', Nay', ', Nay'])
    expect(rows[0].className.split(/\s+/)).toContain('scroll-mt-8')
  })

  it('the sort control reports its state with aria-pressed (mobile P2-5)', () => {
    const host = html(createElement(BallotGroups, { ballots: BALLOTS, sortBy: 'name', onSort: () => {} }))
    const buttons = Array.from(host.querySelectorAll('button'))
    expect(buttons.map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['Party', 'false'],
      ['Name', 'true'],
    ])
  })

  it('the pressed sort is neutral, not the action hue, and has a 44px coarse-pointer target (Jen C6)', () => {
    const host = html(createElement(BallotGroups, { ballots: BALLOTS, sortBy: 'name', onSort: () => {} }))
    const [party, name] = Array.from(host.querySelectorAll('button'))
    const pressed = name.className.split(/\s+/)
    const unpressed = party.className.split(/\s+/)
    expect(pressed).toEqual(expect.arrayContaining(['border', 'border-text-muted', 'bg-surface-3', 'text-text-primary']))
    expect(unpressed).toEqual(expect.arrayContaining(['border', 'border-transparent', 'text-text-muted']))
    expect(unpressed).not.toContain('bg-surface-3')
    for (const cls of [pressed, unpressed]) {
      expect(cls).toEqual(expect.arrayContaining([
        'relative', 'min-h-6', 'pointer-coarse:after:absolute', 'pointer-coarse:after:inset-x-0', 'pointer-coarse:after:-inset-y-2.5',
      ]))
    }
    expect(name.getAttribute('style')).toBeNull()
    expect(party.getAttribute('style')).toBeNull()
  })
})

describe('keepBillNumbersWhole', () => {
  it('wraps each House and Senate bill number, and leaves the rest as text', () => {
    const host = html(createElement('p', null, ...keepBillNumbersWhole('Bills C-39 and S-209, not C-')))
    expect(host.textContent).toBe('Bills C-39 and S-209, not C-')
    expect(Array.from(host.querySelectorAll('span.whitespace-nowrap')).map((el) => el.textContent)).toEqual(['C-39', 'S-209'])
  })
})

describe('MpVoteList rows', () => {
  it("leads with the MP's ballot, clamps the title, labels the division, and states the outcome neutrally", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        votes: [{
          voteId: 'v-177', session: '45-1', number: 177, date: '2026-10-07',
          descriptionEn: '2nd reading of Bill C-218', result: 'tie', ballot: 'didnt_vote',
        }],
        hasMore: false,
      }),
    } as unknown as Response)))
    const { container } = render(createElement(MpVoteList, { mpId: 'mp-1' }))
    // The title is split by the bill number's nowrap span, so match the <p>.
    const byTitle = (_: string, el: Element | null) => el?.tagName === 'P' && el.textContent === '2nd reading of Bill C-218'
    const title = await screen.findByText(byTitle)
    const row = container.querySelector('[data-mp-vote-row]')!
    const column = row.firstElementChild!
    expect(column.hasAttribute('data-ballot-column')).toBe(true)
    expect(column.textContent).toBe("Didn't vote")
    expect(title.className.split(/\s+/)).toEqual(expect.arrayContaining(['line-clamp-3', 'md:line-clamp-2']))
    // Jen C3: a 96px column from 640px, stacked above the title below it,
    // and the bill number never splits at its hyphen.
    expect(row.className.split(/\s+/)).toEqual(expect.arrayContaining(['flex', 'max-sm:flex-col']))
    expect(column.className.split(/\s+/)).toEqual(expect.arrayContaining(['w-24', 'max-sm:w-auto']))
    const bill = Array.from(title.querySelectorAll('span.whitespace-nowrap')).map((el) => el.textContent)
    expect(bill).toEqual(['C-218'])
    expect(row.querySelector('[data-division]')!.textContent).toBe('Vote 45-1/177')
    expect(row.querySelector('[data-result]')!.textContent).toBe('Defeated')
  })
})

describe('InvestigationVotePanel rows', () => {
  it("leads with the MP's ballot", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        mp: null,
        concern: '',
        votes: [{
          voteId: 'v-178', date: '2026-10-08', descriptionEn: '2nd reading of Bill C-39',
          result: 'passed', relevanceExplanation: null, mpBallot: 'yes',
        }],
      }),
    } as unknown as Response)))
    const { container } = render(createElement(InvestigationVotePanel, { investigationId: 'inv-1' }))
    const title = await screen.findByText('2nd reading of Bill C-39')
    const link = title.closest('a')!
    const column = link.firstElementChild!.firstElementChild!
    expect(column.hasAttribute('data-ballot-column')).toBe(true)
    expect(column.textContent).toBe('Yea')
    expect(container.textContent).not.toMatch(/absent/i)
  })
})
