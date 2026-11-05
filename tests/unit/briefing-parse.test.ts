// @vitest-environment jsdom
/**
 * The briefing parser's contract (D2): src/lib/briefing/parse.ts and the
 * renderers in src/components/briefing/briefing-view.tsx that consume it.
 *
 * 1. Goldens. One hand-written expected parse per shape fixture in
 *    tests/fixtures/letters.ts, plus one for SEEDED_BRIEFING. They were written
 *    from the fixture text and the D2 rules, not pasted from a parser run.
 * 2. The word-sequence property. For every fixture, the words of the input
 *    (markdown syntax and the renderer-replaced field labels removed) equal the
 *    words of the parsed output flattened in render order: nothing dropped,
 *    duplicated or reordered.
 * 3. The rendered briefing. BriefingView through react-dom/server, the same
 *    path paper-ink.test.ts uses: every field renderer goes through
 *    renderInline, role words, eyebrows, Primary Authority, no invented
 *    Outcome box, no edge rule, no every-5th divider, no evidence callout.
 *
 * Sections are routed by routeSection, the same function BriefingView switches
 * on. Questions Worth Asking is rendered by QuestionsSection's own line
 * parser, which D2 does not own; here it is flattened through preprocessBlocks,
 * which yields the same words.
 */

import { describe, it, expect } from 'vitest'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  type AccessLevel,
  type BlockElement,
  type GoverningBlock,
  type ComparisonItem,
  type JurisdictionPart,
  type PlayerPart,
  type PlayersItem,
  detectAccess,
  extractFippaLetter,
  extractTitle,
  getRoleKey,
  parseGoverningDocuments,
  parseComparison,
  parsePlayers,
  parseSections,
  preprocessBlocks,
  roleLabel,
  routeSection,
} from '@/lib/briefing/parse'
import { BriefingView, renderInline } from '@/components/briefing/briefing-view'
import { BRIEFING_SHAPE_FIXTURES, SEEDED_BRIEFING } from '../fixtures/letters'

// ---- the parse, routed the way BriefingView routes it ----------------------

type SectionParse =
  | { heading: string; kind: 'prose'; blocks: BlockElement[] }
  | { heading: string; kind: 'governs'; blocks: GoverningBlock[] }
  | { heading: string; kind: 'players'; items: PlayersItem[] }
  | { heading: string; kind: 'actions'; before: BlockElement[]; letter: string; after: BlockElement[] }
  | { heading: string; kind: 'comparison'; items: ComparisonItem[] }

interface BriefingParse {
  title: string | null
  sections: SectionParse[]
}

function parseSection(heading: string, content: string): SectionParse {
  const prose = (): SectionParse => ({ heading, kind: 'prose', blocks: preprocessBlocks(content) })
  switch (routeSection(heading)) {
    case 'governs': {
      const blocks = parseGoverningDocuments(content)
      return blocks.some((b) => b.type === 'document') ? { heading, kind: 'governs', blocks } : prose()
    }
    case 'players': {
      const items = parsePlayers(content)
      return items.length > 0 ? { heading, kind: 'players', items } : prose()
    }
    case 'actions': {
      const fippa = extractFippaLetter(content)
      if (!fippa) return prose()
      return {
        heading,
        kind: 'actions',
        before: fippa.before ? preprocessBlocks(fippa.before) : [],
        letter: fippa.letter,
        after: fippa.after ? preprocessBlocks(fippa.after) : [],
      }
    }
    case 'comparison': {
      const items = parseComparison(content)
      return items.some((x) => x.type === 'jurisdiction') ? { heading, kind: 'comparison', items } : prose()
    }
    default:
      return prose()
  }
}

function parseBriefing(text: string): BriefingParse {
  return {
    title: extractTitle(text),
    sections: parseSections(text).map((s) => parseSection(s.heading, s.content)),
  }
}

// ---- goldens, written by hand ----------------------------------------------

const p = (text: string): BlockElement => ({ type: 'paragraph', text })
const list = (...items: string[]): BlockElement => ({ type: 'list', items })
/** A player whose parts are a Why they matter line then a Track record line, when given. */
const player = (name: string, role: string, whyTheyMatter = '', trackRecord = ''): PlayersItem =>
  playerOf(name, role, ...(whyTheyMatter ? [whyM(whyTheyMatter)] : []), ...(trackRecord ? [track(trackRecord)] : []))
const playerOf = (name: string, role: string, ...parts: PlayerPart[]): PlayersItem => ({ type: 'player', player: { name, role, parts } })
const whyM = (value: string): PlayerPart => ({ type: 'field', key: 'whyTheyMatter', value })
const track = (value: string): PlayerPart => ({ type: 'field', key: 'trackRecord', value })
const whatDo = (value: string): PlayerPart => ({ type: 'field', key: 'whatTheyDo', value })
const relate = (value: string): PlayerPart => ({ type: 'field', key: 'howTheyRelate', value })
const note = (text: string): PlayerPart => ({ type: 'prose', text })
const playersProse = (text: string): PlayersItem => ({ type: 'prose', text })
const jur = (name: string, ...parts: JurisdictionPart[]): ComparisonItem => ({ type: 'jurisdiction', jurisdiction: { name, parts } })
const body = (text: string): JurisdictionPart => ({ type: 'body', text })
const what = (value: string): JurisdictionPart => ({ type: 'field', key: 'whatTheyDid', value })
const why = (value: string): JurisdictionPart => ({ type: 'field', key: 'whyItMatters', value })
const outcome = (value: string): JurisdictionPart => ({ type: 'field', key: 'outcome', value })
const prose = (text: string): ComparisonItem => ({ type: 'prose', text })

const GOLDENS: Record<string, BriefingParse> = {
  'role-raw-enum': {
    title: null,
    sections: [
      {
        heading: 'Key Players',
        kind: 'players',
        items: [
          player('District Manager (QA)', 'decision_maker'),
          player('Synthetic Nation (QA)', 'rights_holder'),
          player('Synthetic Timber Ltd. (QA)', 'proponent'),
        ],
      },
    ],
  },
  'literal-asterisks': {
    title: null,
    sections: [
      {
        heading: 'What the Public Record Shows',
        kind: 'prose',
        blocks: [
          p('The plan applies to *community watersheds* only.'),
          list('The approval date is not public.', 'The prescription is not public.'),
        ],
      },
    ],
  },
  'markdown-links': {
    title: null,
    sections: [
      {
        heading: 'What Governs This',
        kind: 'governs',
        blocks: [
          {
            type: 'document',
            name: 'Forest Stewardship Plan (QA)',
            intro: '',
            fields: [
              { label: 'How to find it', value: '[BC forestry pages](https://www2.gov.bc.ca/gov/content/industry/forestry)' },
              { label: 'Access', value: 'Public' },
            ],
            isPrimary: true,
          },
          {
            type: 'document',
            name: 'Local reporting (QA)',
            intro: '',
            fields: [
              { label: 'How to find it', value: '[a news report](https://example.com/news/mill-creek)' },
              { label: 'Access', value: 'Public' },
            ],
            isPrimary: false,
          },
        ],
      },
    ],
  },
  'empty-heading': {
    title: null,
    sections: [
      // No document under the heading: the section falls back to prose, where
      // the heading is the 11px subheading label.
      { heading: 'What Governs This', kind: 'prose', blocks: [{ type: 'subheading', text: 'Supporting Documents' }] },
      { heading: 'Key Players', kind: 'players', items: [player('Someone (QA)', '')] },
    ],
  },
  'outcome-word': {
    title: null,
    sections: [
      // Places written as bullets are not jurisdiction cards (Razor C1): the
      // section renders as prose, as before D2, and nothing is invented.
      {
        heading: 'How Other Places Handle This',
        kind: 'prose',
        blocks: [
          list('**Synthetic Town A (QA)** publishes permits before approval.', '**Outcome:** Reported but unverified.'),
          list('**Synthetic Town B (QA)** requires a hydrology assessment. The outcome is not documented.'),
        ],
      },
    ],
  },
  'outcome-word-heading': {
    title: null,
    sections: [
      {
        heading: 'How Other Places Handle This',
        kind: 'comparison',
        items: [
          jur('Synthetic Town C (QA)', what('Published every *cutting permit* before approval.'), outcome('Reported but unverified.')),
          jur('Synthetic Town D (QA)', body('Requires a hydrology assessment above every intake.'), body('The outcome is not documented.')),
        ],
      },
    ],
  },
  'mixed-list-lead-in': {
    title: null,
    sections: [
      {
        heading: 'What You Can Do',
        kind: 'prose',
        blocks: [
          p('Two things you can do this week:'),
          list('File the request below.', "Ask the water users' board to write to the district manager."),
        ],
      },
    ],
  },
  'trailing-rule': {
    title: null,
    sections: [{ heading: 'What This Analysis Cannot See', kind: 'prose', blocks: [list('The prescription text.')] }],
  },
  'name-field': {
    title: null,
    sections: [{ heading: 'Key Players', kind: 'players', items: [player('Mill Creek Water Users (QA)', 'affected')] }],
  },
  'mirror-lead-in-and-closing': {
    title: null,
    sections: [
      {
        heading: 'How Other Places Handle This',
        kind: 'comparison',
        items: [
          prose('Several comparable municipalities have handled this differently:'),
          jur(
            'Synthetic Town H (QA)',
            what('Posted every permit online.'),
            outcome('Reported but unverified.'),
            body("The figures come from the town's own report.")
          ),
          jur('Synthetic Town I (QA)', body('It runs a smaller program.'), what('Required a hearing.')),
          prose('If two comparable towns can publish permits, the status quo here needs a reason.'),
        ],
      },
    ],
  },
  'mirror-bullet-inside-heading': {
    title: null,
    sections: [
      {
        heading: 'How Other Places Handle This',
        kind: 'comparison',
        items: [jur('Synthetic Saanich (QA)', body('**Policy 4.2** requires notice within 30 days.'), outcome('Fewer complaints.'))],
      },
    ],
  },
  'mirror-colonless-labels': {
    title: null,
    sections: [
      {
        heading: 'How Other Places Handle This',
        kind: 'comparison',
        items: [
          jur(
            'Synthetic Saanich (QA)',
            body('**What they did differently** — the town requires notice.'),
            body('**Why it matters** — residents hear before approval.'),
            body('**Outcome** (unverified) — fewer complaints.')
          ),
        ],
      },
    ],
  },
  'mirror-prompt-labels': {
    title: null,
    sections: [
      {
        heading: 'How Other Places Handle This',
        kind: 'comparison',
        items: [
          jur(
            'Synthetic Town J (QA)',
            what('Published every permit.'),
            why('Residents could object in time.'),
            outcome('Reported but unverified.')
          ),
        ],
      },
    ],
  },
  'players-extra-fields': {
    title: null,
    sections: [
      {
        heading: 'Key Players',
        kind: 'players',
        items: [
          playersProse('These are the people with a hand in it:'),
          playerOf(
            'Synthetic Regulator (QA)',
            'regulator',
            note('Named in the permit file.'),
            whatDo('Issues cutting permits.'),
            relate('Answers to the minister.'),
            whyM('They decide.')
          ),
          playersProse('Taken together, the regulator holds most of the cards.'),
        ],
      },
    ],
  },
  'players-wrapped-value': {
    title: null,
    sections: [
      {
        heading: 'Key Players',
        kind: 'players',
        items: [player('Synthetic Council (QA)', 'decision_maker', 'It decides whether notice is given.', 'None found.')],
      },
    ],
  },
  'document-intro': {
    title: null,
    sections: [
      {
        heading: 'What Governs This',
        kind: 'governs',
        blocks: [
          { type: 'prose', text: 'Two documents set the rules here.' },
          {
            type: 'document',
            name: 'Zoning Bylaw 2287 (QA)',
            intro: 'The bylaw was amended in 2019.',
            fields: [
              { label: 'What it is', value: 'The bylaw that sets the height limit.' },
              { label: 'How to find it', value: "The city clerk's office." },
              { label: 'Access', value: 'Public' },
            ],
            isPrimary: true,
          },
          { type: 'prose', text: 'Council can amend it again.' },
        ],
      },
    ],
  },
  'players-two-roles': {
    title: null,
    sections: [
      {
        heading: 'Key Players',
        kind: 'players',
        items: [player('Synthetic Mine Co (QA)', 'proponent / applicant', 'They want the permit.')],
      },
    ],
  },
  'document-access-values': {
    title: null,
    sections: [
      {
        heading: 'What Governs This',
        kind: 'governs',
        blocks: [
          {
            type: 'document',
            name: 'Synthetic Bylaw A (QA)',
            intro: '',
            fields: [
              { label: 'What it is', value: 'A bylaw.' },
              { label: 'Access', value: 'Public' },
            ],
            isPrimary: true,
          },
          {
            type: 'document',
            name: 'Synthetic Plan B (QA)',
            intro: '',
            fields: [
              { label: 'What it is', value: 'A plan.' },
              { label: 'Access', value: 'Public, online' },
            ],
            isPrimary: false,
          },
          {
            type: 'document',
            name: 'Synthetic Memo C (QA)',
            intro: '',
            fields: [
              { label: 'What it is', value: 'A memo.' },
              { label: 'Access', value: 'FIPPA Required (withheld as deliberative advice)' },
            ],
            isPrimary: false,
          },
          {
            type: 'document',
            name: 'Synthetic Report D (QA)',
            intro: '',
            fields: [
              { label: 'What it is', value: 'A report.' },
              { label: 'Access', value: 'Partly public' },
            ],
            isPrimary: false,
          },
          {
            type: 'document',
            name: 'Synthetic Permit E (QA)',
            intro: '',
            fields: [
              { label: 'What it is', value: 'A permit.' },
              { label: 'Access', value: 'Not public' },
            ],
            isPrimary: false,
          },
          {
            type: 'document',
            name: 'Synthetic Minutes F (QA)',
            intro: '',
            fields: [
              { label: 'What it is', value: 'Minutes.' },
              { label: 'Access', value: 'Council Record' },
            ],
            isPrimary: false,
          },
          {
            type: 'document',
            name: 'Synthetic Letter G (QA)',
            intro: '',
            fields: [
              { label: 'What it is', value: 'A letter.' },
              { label: 'Access', value: 'Public: no' },
            ],
            isPrimary: false,
          },
          {
            type: 'document',
            name: 'Synthetic Audit H (QA)',
            intro: '',
            fields: [
              { label: 'What it is', value: 'An audit.' },
              { label: 'Access', value: 'Public records request' },
            ],
            isPrimary: false,
          },
        ],
      },
    ],
  },
  'many-paragraphs': {
    title: null,
    sections: [
      {
        heading: 'What the Public Record Shows',
        kind: 'prose',
        blocks: [
          p('Paragraph one.'),
          p('Paragraph two.'),
          p('Paragraph three.'),
          p('Paragraph four.'),
          p('Paragraph five.'),
          p('Paragraph six.'),
        ],
      },
    ],
  },
}

const SEEDED_GOLDEN: BriefingParse = {
  title: 'Cedar Ridge cutblock approvals above the Mill Creek intake',
  sections: [
    {
      heading: 'Context',
      kind: 'prose',
      blocks: [
        p(
          "You're worried that logging approved above the Mill Creek intake could affect the water your community drinks, and that residents weren't told before the cutblock was approved."
        ),
      ],
    },
    {
      heading: 'What Governs This',
      kind: 'governs',
      blocks: [
        { type: 'prose', text: 'The first document is the Primary Authority.' },
        {
          type: 'document',
          name: 'Forest Stewardship Plan for the Cedar Ridge licence area (QA)',
          intro: '',
          fields: [
            { label: 'What it is', value: "The licensee's plan setting results and strategies for the area." },
            { label: 'Why it matters', value: 'It states what the licensee committed to for water quality.' },
            { label: 'How to find it', value: '[BC forestry pages](https://www2.gov.bc.ca/gov/content/industry/forestry)' },
            { label: 'Access', value: 'Public' },
          ],
          isPrimary: true,
        },
        {
          type: 'document',
          name: 'Cutblock CR-14 silviculture prescription (QA)',
          intro: '',
          fields: [
            { label: 'What it is', value: 'The site-level plan for harvesting and replanting cutblock CR-14.' },
            { label: 'Why it matters', value: 'It would show whether the intake was considered.' },
            { label: 'How to find it', value: 'Ask the district office, or file a request.' },
            { label: 'Access', value: 'FIPPA Required' },
          ],
          isPrimary: false,
        },
        { type: 'eyebrow', text: 'Supporting Documents' },
      ],
    },
    {
      heading: 'Key Players',
      kind: 'players',
      items: [
        player(
          'Synthetic Timber Ltd. (QA)',
          'proponent',
          'It holds the licence and wrote the stewardship plan.',
          'No public record found for this synthetic company.'
        ),
        player(
          'District Manager, Mill Creek Resource District (QA)',
          'decision_maker',
          'Approves cutting permits in the district.',
          'Not assessed.'
        ),
        player(
          'Mill Creek Water Users (QA)',
          'affected',
          'They draw drinking water from the intake below the cutblock.',
          'See [a local news report](https://example.com/news/mill-creek) (not a government source).'
        ),
      ],
    },
    {
      heading: 'What the Public Record Shows',
      kind: 'prose',
      blocks: [
        p("The plan's water results apply to *community watersheds* only, and Mill Creek isn't listed as one."),
        list('The approval date is not public.', 'The prescription is not public.'),
        p('Who benefits is plain enough: the licensee gets the volume, and the cost of any turbidity lands on the water users.'),
        p("The outcome of the district's 2024 review is not in the public record."),
        p('Oversight sits with the district manager, who both approves the permit and decides whether the plan was followed.'),
        p('What should be public and is not: the prescription, and any hydrology assessment done for CR-14.'),
        p('What public documents cannot answer: whether anyone at the district looked at the intake at all.'),
      ],
    },
    {
      heading: 'What You Can Do',
      kind: 'actions',
      before: [
        p('Two things you can do this week:'),
        list('File the request below for the CR-14 prescription.', "Ask the water users' board to write to the district manager."),
      ],
      letter: [
        '[YOUR NAME]',
        '[YOUR ADDRESS]',
        '',
        'FOI Coordinator',
        'Ministry of Forests',
        '',
        'Re: Freedom of Information Request — CR-14 silviculture prescription',
        '',
        'Dear FOI Coordinator,',
        '',
        'I request access to the silviculture prescription for cutblock CR-14 and any hydrology assessment prepared for it.',
        '',
        'Yours truly,',
        '',
        '[YOUR NAME]',
      ].join('\n'),
      after: [p("NEXT STEPS: Send the request to the ministry's FOI office and note the date you sent it.")],
    },
    {
      heading: 'How Other Places Handle This',
      kind: 'prose',
      blocks: [
        list(
          '**Synthetic Town A (QA)** publishes every cutting permit near a drinking-water intake before approval.',
          '**Outcome:** Reported but unverified in this synthetic fixture.'
        ),
        list('**Synthetic Town B (QA)** requires a hydrology assessment above every intake. The outcome is not documented.'),
      ],
    },
    {
      heading: 'Questions Worth Asking',
      kind: 'prose',
      blocks: [
        list(
          'Who decided Mill Creek was not a community watershed, and when?',
          'Was a hydrology assessment done for CR-14 before approval?',
          'Who would be told if turbidity rose at the intake?',
          'Why is the prescription not public when the plan is?',
          'What would it take for the district to pause the permit?'
        ),
      ],
    },
    {
      heading: 'What This Analysis Cannot See',
      kind: 'prose',
      blocks: [list('The actual prescription text, which has not been released.', 'Any field inspection notes.')],
    },
  ],
}

describe('goldens: one hand-written parse per briefing shape', () => {
  it('every shape fixture has a golden, and every golden a fixture', () => {
    expect(Object.keys(GOLDENS).sort()).toEqual(BRIEFING_SHAPE_FIXTURES.map((f) => f.id).sort())
  })

  it.each(BRIEFING_SHAPE_FIXTURES.map((f) => [f.id, f.content] as const))('%s', (id, content) => {
    expect(parseBriefing(content)).toEqual(GOLDENS[id])
  })

  it('SEEDED_BRIEFING', () => {
    expect(parseBriefing(SEEDED_BRIEFING)).toEqual(SEEDED_GOLDEN)
  })

  it("SEEDED_BRIEFING's letter is still extracted between its --- fences (the edge-rule drop does not touch it)", () => {
    const actions = parseSections(SEEDED_BRIEFING).find((s) => s.heading === 'What You Can Do')!
    const fippa = extractFippaLetter(actions.content)
    expect(fippa).not.toBeNull()
    expect(fippa!.letter.startsWith('[YOUR NAME]\n[YOUR ADDRESS]')).toBe(true)
    expect(fippa!.letter).toContain('Dear FOI Coordinator,')
  })
})

// ---- the rules the goldens rest on, one at a time ---------------------------

describe('routeSection', () => {
  it.each([
    ['Context', 'context'],
    ['Your Concern', 'context'],
    ['What Governs This', 'governs'],
    ['Key Players', 'players'],
    ['What the Public Record Shows', 'record'],
    ['What You Can Do', 'actions'],
    ['How Other Places Handle This', 'comparison'],
    ['Questions Worth Asking', 'questions'],
    ['What This Analysis Cannot See', 'limitations'],
    ['Limitations', 'limitations'],
    ['Appendix', 'other'],
    // First match wins: a heading naming two sections goes to the earlier test.
    ['Context: what governs this', 'context'],
  ])('%s -> %s', (heading, kind) => {
    expect(routeSection(heading)).toBe(kind)
  })
})

describe('parse rules', () => {
  it('a lone heading with no fields is an eyebrow, and the primary goes to the first block with fields', () => {
    expect(parseGoverningDocuments('### Supporting Documents')).toEqual([{ type: 'eyebrow', text: 'Supporting Documents' }])
    expect(parseGoverningDocuments('**Supporting Documents**')).toEqual([{ type: 'eyebrow', text: 'Supporting Documents' }])
    const blocks = parseGoverningDocuments(
      ['Read these first.', '- **Document name:** Bylaw 1 (QA)', '- **Access:** Public'].join('\n')
    )
    expect(blocks.map((b) => b.type)).toEqual(['prose', 'document'])
    expect(blocks[1]).toMatchObject({ type: 'document', name: 'Bylaw 1 (QA)', isPrimary: true })
  })

  it('a heading with prose but no fields under it is an eyebrow followed by prose, not a card', () => {
    expect(parseGoverningDocuments('### Background\nThe bylaw was amended twice.')).toEqual([
      { type: 'eyebrow', text: 'Background' },
      { type: 'prose', text: 'The bylaw was amended twice.' },
    ])
  })

  it('a heading with fields under it names its document, keeping its markup for renderInline', () => {
    expect(parseGoverningDocuments('### Zoning *Bylaw* 2287\n- **What it is:** The bylaw.')).toEqual([
      {
        type: 'document',
        name: 'Zoning *Bylaw* 2287',
        intro: '',
        fields: [{ label: 'What it is', value: 'The bylaw.' }],
        isPrimary: true,
      },
    ])
  })

  it('documents: nothing is dropped; intro under the heading, prose before and after the card (Razor C2)', () => {
    expect(
      parseGoverningDocuments(
        ['### Zoning Bylaw 2287', 'The bylaw was amended in 2019.', '- **What it is:** The bylaw.', '- **Access:** Public', '', 'Council can amend it again.'].join('\n')
      )
    ).toEqual([
      {
        type: 'document',
        name: 'Zoning Bylaw 2287',
        intro: 'The bylaw was amended in 2019.',
        fields: [
          { label: 'What it is', value: 'The bylaw.' },
          { label: 'Access', value: 'Public' },
        ],
        isPrimary: true,
      },
      { type: 'prose', text: 'Council can amend it again.' },
    ])
    expect(parseGoverningDocuments(['Read the plan first.', '- **What it is:** A plan.', '  It runs to 2030.'].join('\n'))).toEqual([
      { type: 'prose', text: 'Read the plan first.' },
      { type: 'document', name: '', intro: '', fields: [{ label: 'What it is', value: 'A plan. It runs to 2030.' }], isPrimary: true },
    ])
  })

  it('Outcome, What they did and Why it matters come only from a line that opens with the label', () => {
    expect(
      parseComparison(
        ['### Synthetic Town E (QA)', 'What they did differently was publish. The outcome is unknown. Why it matters is unclear.'].join('\n')
      )
    ).toEqual([jur('Synthetic Town E (QA)', body('What they did differently was publish. The outcome is unknown. Why it matters is unclear.'))])
    expect(
      parseComparison(
        ['**Synthetic Town F (QA)**', '- **What they did:** Published.', '  **Why it matters:** It can be appealed.', '**Outcome**: Fewer variances.'].join('\n')
      )
    ).toEqual([jur('Synthetic Town F (QA)', what('Published.'), why('It can be appealed.'), outcome('Fewer variances.'))])
  })

  it('a field value continues until a blank line; prose past it after the last field closes the card', () => {
    expect(
      parseComparison(['### Synthetic Town G (QA)', 'Outcome: Variances fell', 'by a third.', '', 'Later prose.'].join('\n'))
    ).toEqual([jur('Synthetic Town G (QA)', outcome('Variances fell by a third.')), prose('Later prose.')])
  })

  it('a section-edge rule is dropped, a rule between blocks stays', () => {
    expect(preprocessBlocks('---\n\nA.\n\n---\n\nB.\n\n---')).toEqual([p('A.'), { type: 'hr' }, p('B.')])
  })

  it('a lead-in before a list is its own block; a lead-in that is a bold-only line is a subheading', () => {
    expect(preprocessBlocks('**Next steps**\n- One.\n- Two.')).toEqual([{ type: 'subheading', text: 'Next steps' }, list('One.', 'Two.')])
  })

  it('players: **Name:** starts a player, the bare-name form still works, values keep markup', () => {
    expect(parsePlayers(['**City Planning**', 'Role: Regulator', 'Why they matter: Recommends *every* variance.'].join('\n'))).toEqual([
      player('City Planning', 'Regulator', 'Recommends *every* variance.'),
    ])
    expect(parsePlayers(['- **Name:** A (QA)', '- **Role:** proponent', '- **Name:** B (QA)'].join('\n'))).toEqual([
      player('A (QA)', 'proponent'),
      player('B (QA)', ''),
    ])
  })

  it('players: nothing is dropped; unrecognised text is prose in its source position (Razor C2)', () => {
    expect(
      parsePlayers(
        [
          'These are the people with a hand in it:',
          '',
          '- **Name:** A (QA)',
          'A note under the name.',
          '- **Role:** regulator',
          '- **What they do:** Issues permits.',
          '- **How they relate:** Answers to the minister.',
          '- **Why they matter:** They decide',
          '  whether notice is given.',
          '- **Track record:** None found.',
          '',
          'Taken together, the regulator holds most of the cards.',
        ].join('\n')
      )
    ).toEqual([
      playersProse('These are the people with a hand in it:'),
      playerOf(
        'A (QA)',
        'regulator',
        note('A note under the name.'),
        whatDo('Issues permits.'),
        relate('Answers to the minister.'),
        whyM('They decide whether notice is given.'),
        track('None found.')
      ),
      playersProse('Taken together, the regulator holds most of the cards.'),
    ])
  })

  it.each([
    ['decision_maker', 'Decision-maker'],
    ['decision maker', 'Decision-maker'],
    ['DECISION_MAKER', 'Decision-maker'],
    ['rights_holder', 'Rights holder'],
    ['rights holder', 'Rights holder'],
    ['proponent', 'Proponent'],
    ['affected', 'Affected'],
    ['certificate_holder', 'Certificate holder'],
    ['Regulator', 'Regulator'],
  ])('roleLabel(%s) -> %s', (role, label) => {
    expect(roleLabel(role)).toBe(label)
  })

  it.each([
    ['International agency', 'other'],
    ['Self-determination council', 'other'],
    ['Synthetic Nation (QA)', 'indigenous'],
    ['Nations of the watershed', 'indigenous'],
    ['rights_holder', 'indigenous'],
  ])('getRoleKey(%s) -> %s (nation is a whole word)', (role, key) => {
    expect(getRoleKey(role)).toBe(key)
  })

  it('a joined role is shown as written, first letter capitalised', () => {
    expect(roleLabel('proponent / applicant')).toBe('Proponent / applicant')
  })

  it.each([
    ['Public', 'public'],
    ['public', 'public'],
    ['  Public.', 'public'],
    ['Public, online', null],
    ['Public: no', null],
    ['Public records request', null],
    ['Public, but only after a FIPPA request', null],
    ['Publicly posted', null],
    ['Partly public', null],
    ['Partially public', null],
    ['Not public', null],
    ['FIPPA Required', 'fippa'],
    ['fippa required.', 'fippa'],
    ['FIPPA required (withheld as deliberative advice)', null],
    ['FIPPA request needed', null],
    ['Needs a FIPPA request', null],
    ['Council Record', 'council'],
    ['council record', 'council'],
    ['council record, 2019 minutes', null],
    ['In the council record', null],
    ['On request from the district', null],
  ] as [string, AccessLevel | null][])('detectAccess(%s) -> %s (only an exact badge label earns a badge)', (value, level) => {
    expect(detectAccess(value)).toBe(level)
  })
})

// ---- the word-sequence property ---------------------------------------------

/**
 * Every field label variant the parser accepts and the renderer replaces with
 * its own eyebrow, badge or position. Written down here, not imported from the
 * parser: removed from both sides at the start of a line.
 */
const REPLACED_LABELS: RegExp[] = [
  // Key Players: the name and role go to the card header and badge; the rest render without a label.
  /^name:/i,
  /^role:/i,
  /^why they matter:/i,
  /^track record:/i,
  /^what they do:/i,
  /^how they relate:/i,
  // What Governs This: the name goes to the header, Access to the badge, How to find it to its own footer label.
  /^document name:/i,
  /^document:/i,
  /^what it is:/i,
  /^access:/i,
  /^(?:how|where) to find(?: it)?:/i,
  // How Other Places Handle This: the three Mirror labels, in every phrasing the parser takes.
  /^what they did(?:\s+[^:*.!?\n]{1,60}?)?:/i,
  /^why it matters(?:\s+[^:*.!?\n]{1,60}?)?:/i,
  /^(?:outcome|what the outcome was):/i,
]

const words = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []

const stripLabel = (line: string): string => {
  for (const label of REPLACED_LABELS) {
    const m = line.match(label)
    if (m) return line.slice(m[0].length)
  }
  return line
}
const isReplacedLabel = (label: string) => REPLACED_LABELS.some((re) => re.test(`${label}:`))

/**
 * The Access badge, written down here rather than imported: a value earns a
 * badge only when it IS a badge label (trimmed, trailing punctuation removed,
 * any case). Then the badge replaces the field; otherwise the field stays and
 * there is no badge.
 */
const BADGE_LABEL: Record<AccessLevel, string> = { public: 'Public', fippa: 'FIPPA Required', council: 'Council Record' }
const accessBadgeOf = (value: string): string | null => {
  const v = value.trim().replace(/[\s.,;:!?]+$/, '').toLowerCase()
  return Object.values(BADGE_LABEL).find((label) => label.toLowerCase() === v) ?? null
}

/**
 * DocumentCard's layout, applied to the input so it reads in render order:
 * an Access line that is exactly a badge label moves up to just after its
 * card's start (the badge sits in the header); any other Access line stays a
 * field in place. A How/Where to find
 * line moves down to the end of its field run (its footer). Card starts: a ###
 * or bold-only heading, or a Document name field. Written down, not derived
 * from the parser.
 */
function governsInRenderOrder(markdown: string): string {
  const out: string[] = []
  let inGoverns = false
  const isCardStart = (l: string) => /^###\s/.test(l) || /^\*\*[^*]+\*\*\s*$/.test(l) || /^[-*]\s+\*\*Document name:\*\*/i.test(l)
  const isField = (l: string) => /^[-*]\s+\*\*.+?:\*\*/.test(l)
  const lines = markdown.split('\n')
  let i = 0
  while (i < lines.length) {
    const l = lines[i]
    if (/^##\s/.test(l)) inGoverns = /governs/i.test(l)
    if (!inGoverns || !isCardStart(l)) {
      out.push(l)
      i++
      continue
    }
    // One card: its start line, then lines up to the next card start or section.
    let j = i + 1
    while (j < lines.length && !isCardStart(lines[j]) && !/^##\s/.test(lines[j])) j++
    const card = lines.slice(i + 1, j)
    // A field with its continuation lines.
    const take = (re: RegExp): string[] => {
      const k = card.findIndex((x) => re.test(x))
      if (k === -1) return []
      let e = k + 1
      while (e < card.length && card[e].trim() && !isField(card[e])) e++
      return card.splice(k, e - k)
    }
    const ACCESS_LINE = /^[-*]\s+\*\*Access:\*\*/i
    const accessAt = card.findIndex((x) => ACCESS_LINE.test(x))
    const accessValue = accessAt === -1 ? '' : card[accessAt].replace(ACCESS_LINE, '').trim()
    const badge = accessAt === -1 ? null : accessBadgeOf(accessValue)
    const access = badge ? take(ACCESS_LINE) : []
    const howTo = take(/^[-*]\s+\*\*(?:How|Where) to find(?: it)?:\*\*/i)
    // The end of the field run: after the last field and its continuation lines.
    let end = -1
    card.forEach((x, k) => {
      if (isField(x)) end = k
    })
    if (end !== -1) while (end + 1 < card.length && card[end + 1].trim()) end++
    card.splice(end + 1, 0, ...howTo)
    out.push(l, ...access, ...card)
    i = j
  }
  return out.join('\n')
}

/**
 * PlayersSection's layout, applied to the input: a Role line moves up to just
 * after its player's Name line or bold name (the badge sits in the header).
 * Written down, not derived from the parser.
 */
function playersInRenderOrder(markdown: string): string {
  const out: string[] = []
  let inPlayers = false
  // Where the next Role line goes: just after the name, then after any Role line
  // already moved there, so two Role lines keep their order (they join " / ").
  let roleAt = -1
  for (const l of markdown.split('\n')) {
    if (/^##\s/.test(l)) {
      inPlayers = /key players/i.test(l)
      roleAt = -1
    }
    const text = l.replace(/^\s*[-*]\s+/, '').trim()
    if (inPlayers && (/^\*\*name:\*\*/i.test(text) || /^name:/i.test(text) || /^\*\*[^*]+\*\*$/.test(text))) roleAt = out.length + 1
    if (inPlayers && roleAt !== -1 && /^(?:\*\*role:\*\*|\*\*role\*\*\s*:|role:)/i.test(text)) {
      out.splice(roleAt++, 0, l)
      continue
    }
    out.push(l)
  }
  return out.join('\n')
}

/**
 * DELIBERATE DROP, the one named exception to "nothing dropped" (Jen D2 C3): in a
 * What Governs section that has documents, an eyebrow renders only when a document
 * block follows it. One with nothing under it labels nothing, so it is left out.
 * (A section with no document at all renders as prose, eyebrow included.) The
 * property removes exactly these from the input, and a pin test below lists every
 * case that has one, so a new drop cannot pass silently.
 */
function eyebrowDropped(blocks: GoverningBlock[], j: number): boolean {
  return blocks[j].type === 'eyebrow' && blocks.some((b) => b.type === 'document') && blocks[j + 1]?.type !== 'document'
}
function droppedEyebrows(parse: BriefingParse): string[] {
  const out: string[] = []
  for (const s of parse.sections) {
    if (s.kind !== 'governs') continue
    s.blocks.forEach((b, j) => {
      if (b.type === 'eyebrow' && eyebrowDropped(s.blocks, j)) out.push(b.text)
    })
  }
  return out
}
/** The input with each deliberately dropped eyebrow's own heading line removed (first match in What Governs). */
function withoutDroppedEyebrows(markdown: string, dropped: string[]): string {
  const lines = markdown.split('\n')
  let inGoverns = false
  const left = [...dropped]
  return lines
    .filter((l) => {
      if (/^##\s/.test(l)) inGoverns = /governs/i.test(l)
      const text = l.replace(/^#{3,6}\s+/, '').replace(/^\*\*(.+)\*\*\s*$/, '$1').trim()
      const k = inGoverns && l !== text ? left.indexOf(text) : -1
      if (k === -1) return true
      left.splice(k, 1)
      return false
    })
    .join('\n')
}

function inputWords(markdown: string, dropped: string[] = []): string[] {
  const text = playersInRenderOrder(governsInRenderOrder(withoutDroppedEyebrows(markdown, dropped)))
    .split('\n')
    .map((line) =>
      line
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/^\s*#{1,6}\s+/, '')
        .replace(/^\s*[-*]\s+/, '')
        .replace(/^\s*\d+[.)]\s+/, '')
        .replace(/^\s*-{3,}\s*$/, '')
        .replace(/\*/g, '')
        .trim()
    )
    .map(stripLabel)
    .join('\n')
  return words(text)
}

/** What renderInline puts on the page, as text. */
function inlineText(value: string): string {
  const html = renderToStaticMarkup(createElement(Fragment, null, renderInline(value)))
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  return doc.body.textContent ?? ''
}

function blockText(b: BlockElement): string[] {
  if (b.type === 'hr') return []
  if (b.type === 'list') return b.items.map(inlineText)
  return [b.type === 'paragraph' ? inlineText(b.text) : b.text]
}

function outputWords(parse: BriefingParse): string[] {
  const out: string[] = []
  if (parse.title) out.push(parse.title)
  for (const s of parse.sections) {
    out.push(s.heading)
    switch (s.kind) {
      case 'prose':
        s.blocks.forEach((b) => out.push(...blockText(b)))
        break
      case 'governs':
        // In render order, as DocumentCard lays a card out: name, Access badge,
        // intro, the remaining fields under their labels, How to find it last.
        s.blocks.forEach((b, j) => {
          if (b.type === 'eyebrow') {
            if (!eyebrowDropped(s.blocks, j)) out.push(b.text)
          } else if (b.type === 'prose') preprocessBlocks(b.text).forEach((x) => out.push(...blockText(x)))
          else {
            const access = b.fields.find((f) => f.label.toLowerCase() === 'access')
            const level = access ? detectAccess(access.value) : null
            const badge = level ? BADGE_LABEL[level] : null
            // A badge replaces the field; with no badge the field shows the whole value.
            const accessHidden = badge !== null
            const howTo = b.fields.find((f) => /^(?:how|where) to find/i.test(f.label))
            out.push(inlineText(b.name))
            if (badge) out.push(badge)
            if (b.intro) out.push(inlineText(b.intro))
            for (const f of b.fields) {
              if ((f === access && accessHidden) || f === howTo) continue
              if (!isReplacedLabel(f.label)) out.push(f.label)
              out.push(inlineText(f.value))
            }
            if (howTo) out.push(inlineText(howTo.value))
          }
        })
        break
      case 'players':
        for (const item of s.items) {
          if (item.type === 'prose') preprocessBlocks(item.text).forEach((b) => out.push(...blockText(b)))
          else {
            out.push(inlineText(item.player.name), roleLabel(item.player.role))
            for (const part of item.player.parts) out.push(inlineText(part.type === 'field' ? part.value : part.text))
          }
        }
        break
      case 'actions':
        s.before.forEach((b) => out.push(...blockText(b)))
        out.push(s.letter)
        s.after.forEach((b) => out.push(...blockText(b)))
        break
      case 'comparison':
        for (const item of s.items) {
          if (item.type === 'prose') preprocessBlocks(item.text).forEach((b) => out.push(...blockText(b)))
          else {
            out.push(inlineText(item.jurisdiction.name))
            for (const part of item.jurisdiction.parts) out.push(inlineText(part.type === 'body' ? part.text : part.value))
          }
        }
        break
    }
  }
  return words(out.join('\n').split('\n').map(stripLabel).join('\n'))
}

describe('word-sequence property: nothing dropped, duplicated or reordered', () => {
  const cases: [string, string][] = [...BRIEFING_SHAPE_FIXTURES.map((f) => [f.id, f.content] as [string, string]), ['SEEDED_BRIEFING', SEEDED_BRIEFING]]

  it.each(cases)('%s', (_id, content) => {
    const parse = parseBriefing(content)
    const input = inputWords(content, droppedEyebrows(parse))
    expect(input.length).toBeGreaterThan(0)
    expect(outputWords(parse)).toEqual(input)
  })

  it('the deliberate drops, pinned: only SEEDED_BRIEFING has an eyebrow over nothing', () => {
    const drops = Object.fromEntries(cases.map(([id, content]) => [id, droppedEyebrows(parseBriefing(content))]).filter(([, d]) => d.length > 0))
    expect(drops).toEqual({ SEEDED_BRIEFING: ['Supporting Documents'] })
  })

  it('the property fires: a parse that drops a word fails it', () => {
    const parse = parseBriefing(SEEDED_BRIEFING)
    const players = parse.sections.find((s) => s.kind === 'players')
    if (players?.kind !== 'players') throw new Error('no players section')
    const first = players.items[0]
    if (first.type !== 'player') throw new Error('no first player')
    first.player = { ...first.player, parts: first.player.parts.slice(0, -1) }
    expect(outputWords(parse)).not.toEqual(inputWords(SEEDED_BRIEFING))
  })
})

// ---- the rendered briefing ----------------------------------------------------

function render(text: string): Document {
  const html = renderToStaticMarkup(createElement(BriefingView, { text, isStreaming: false }))
  return new DOMParser().parseFromString(html, 'text/html')
}

const styleOf = (el: Element | null | undefined) => el?.getAttribute('style') ?? ''
const textOf = (doc: Document) => doc.body.textContent ?? ''
const findAll = (doc: ParentNode, selector: string, text: string) =>
  [...doc.querySelectorAll(selector)].filter((e) => e.textContent?.trim() === text)
/** The card an element sits in (the 12px-radius island card or the primary rounded-xl card). */
const cardOf = (el: Element) => el.closest('div[style*="border-radius:12px"], div.rounded-xl')

/** Every field renderer, each with its own emphasised word. */
const EVERY_FIELD = [
  '# Every field (QA)',
  '',
  '## What Governs This',
  '',
  '### Primary *docprimary* Plan (QA)',
  'Its *docintro* note.',
  '- **What it is:** A plan.',
  '',
  '### Supporting *docsupporting* Permit (QA)',
  '- **What it is:** A permit.',
  '',
  '## Key Players',
  '',
  '- **Name:** Player *playername* (QA)',
  '- **Role:** decision_maker',
  '- **Why they matter:** They *playerwhy* decide.',
  '- **Track record:** See *playertrack* in [a report](https://example.com/r).',
  '',
  '## How Other Places Handle This',
  '',
  '### Town *jurname* (QA)',
  'It *jurbody* publishes.',
  '**What they did:** Published *jurwhat* permits.',
  '**Why it matters:** It *jurwhy* matters.',
  '**Outcome:** Fewer *juroutcome* complaints.',
].join('\n')

describe('the rendered briefing (BriefingView, react-dom/server)', () => {
  it('every field renderer goes through renderInline', () => {
    const doc = render(EVERY_FIELD)
    const ems = [...doc.querySelectorAll('em')].map((e) => e.textContent)
    for (const word of ['docprimary', 'docintro', 'docsupporting', 'playername', 'playerwhy', 'playertrack', 'jurname', 'jurbody', 'jurwhat', 'jurwhy', 'juroutcome']) {
      expect(ems, word).toContain(word)
    }
    expect(textOf(doc)).not.toMatch(/\*|\]\(/)
  })

  it.each([...BRIEFING_SHAPE_FIXTURES.map((f) => [f.id, f.content] as [string, string]), ['SEEDED_BRIEFING', SEEDED_BRIEFING]])(
    '%s: no literal markdown on the page, and no "Name:" prefix',
    (_id, content) => {
      const text = textOf(render(content))
      expect(text.length).toBeGreaterThan(0)
      expect(text).not.toMatch(/\*\*|\]\(|https?:\/\//)
      expect(text).not.toMatch(/\bName:/)
    }
  )

  it('links render as their label text (the domain rule is D3)', () => {
    const text = textOf(render(SEEDED_BRIEFING))
    expect(text).toContain('BC forestry pages')
    expect(text).toContain('See a local news report (not a government source).')
  })

  it('role badges show words, not enum values', () => {
    const doc = render(BRIEFING_SHAPE_FIXTURES.find((f) => f.id === 'role-raw-enum')!.content)
    for (const label of ['Decision-maker', 'Rights holder', 'Proponent']) expect(findAll(doc, 'span', label), label).toHaveLength(1)
    expect(textOf(doc)).not.toMatch(/_/)
  })

  it('Primary Authority sits on the first real document; the lead-in is plain prose, not a card', () => {
    const doc = render(SEEDED_BRIEFING)
    const badges = findAll(doc, 'span', 'Primary Authority')
    expect(badges).toHaveLength(1)
    expect(cardOf(badges[0])!.textContent).toContain('Forest Stewardship Plan for the Cedar Ridge licence area (QA)')
    const [leadIn] = findAll(doc, 'p', 'The first document is the Primary Authority.')
    expect(leadIn).toBeDefined()
    expect(cardOf(leadIn)).toBeNull()
  })

  it('one badge recipe on the paper: role and Primary Authority badges take the access badge recipe (Jen D2 C1)', () => {
    const doc = render(SEEDED_BRIEFING)
    const primary = findAll(doc, 'span', 'Primary Authority')[0]
    const role = findAll(render(BRIEFING_SHAPE_FIXTURES.find((f) => f.id === 'name-field')!.content), 'span', 'Affected')[0]
    for (const badge of [primary, role]) {
      expect(badge).toBeDefined()
      const s = styleOf(badge)
      expect(s).toContain('font-size:12px')
      expect(s).toContain('line-height:16px')
      expect(s).toContain('padding:2px 10px')
      expect(s).toContain('font-weight:500')
      expect(s).toContain('border:1px solid color-mix(in srgb, currentColor 18%, transparent)')
      expect(s).not.toContain('text-transform')
      expect(s).not.toContain('letter-spacing')
    }
  })

  it('a group label over a document is the 11px/600 muted eyebrow, never a card; over nothing it is left out (Jen D2 C3)', () => {
    expect(findAll(render(SEEDED_BRIEFING), 'h4', 'Supporting Documents')).toHaveLength(0)
    const doc = render(
      [
        '## What Governs This',
        '',
        '### Synthetic Plan (QA)',
        '- **What it is:** A plan.',
        '',
        '### Supporting Documents',
        '',
        '### Synthetic Permit (QA)',
        '- **What it is:** A permit.',
      ].join('\n')
    )
    const [eyebrow] = findAll(doc, 'h4', 'Supporting Documents')
    expect(eyebrow).toBeDefined()
    expect(styleOf(eyebrow)).toContain('font-size:11px')
    expect(styleOf(eyebrow)).toContain('font-weight:600')
    expect(styleOf(eyebrow)).toContain('letter-spacing:0.08em')
    expect(styleOf(eyebrow)).toContain('color:var(--color-island-muted)')
    expect(cardOf(eyebrow)).toBeNull()
  })

  it('an Outcome box appears only where an Outcome line was written', () => {
    for (const id of ['outcome-word-heading']) {
      const doc = render(BRIEFING_SHAPE_FIXTURES.find((f) => f.id === id)!.content)
      const outcomes = findAll(doc, 'span', 'OUTCOME')
      expect(outcomes, id).toHaveLength(1)
      expect(outcomes[0].nextElementSibling!.textContent).toBe('Reported but unverified.')
      expect(findAll(doc, 'span', 'WHY IT MATTERS'), id).toHaveLength(0)
      const prose = [...doc.querySelectorAll('p')].find((e) => e.textContent?.includes('The outcome is not documented.'))
      expect(prose, id).toBeDefined()
    }
  })

  it('one place, one card: bold-led bullets and colon-less labels inside a ### place invent nothing (Razor C1)', () => {
    for (const id of ['mirror-bullet-inside-heading', 'mirror-colonless-labels']) {
      const doc = render(BRIEFING_SHAPE_FIXTURES.find((f) => f.id === id)!.content)
      const cards = [...doc.querySelectorAll('div')].filter((d) => styleOf(d).includes('border-left:2px solid var(--accent-mirror)'))
      expect(cards, id).toHaveLength(1)
      expect(cards[0].textContent, id).toContain('Synthetic Saanich (QA)')
    }
  })

  it('section prose sits outside the cards, in source order; parts keep source order (Razor C2, W1)', () => {
    const doc = render(BRIEFING_SHAPE_FIXTURES.find((f) => f.id === 'mirror-lead-in-and-closing')!.content)
    const cards = [...doc.querySelectorAll('div')].filter((d) => styleOf(d).includes('border-left:2px solid var(--accent-mirror)'))
    expect(cards).toHaveLength(2)
    const [lead] = findAll(doc, 'p', 'Several comparable municipalities have handled this differently:')
    const [closing] = findAll(doc, 'p', 'If two comparable towns can publish permits, the status quo here needs a reason.')
    for (const p of [lead, closing]) {
      expect(p).toBeDefined()
      expect(cards.some((c) => c.contains(p))).toBe(false)
    }
    // Town H: the note written after its Outcome renders after it.
    const townH = cards[0].textContent ?? ''
    expect(townH.indexOf('OUTCOME')).toBeLessThan(townH.indexOf("The figures come from the town's own report."))
    // Town I: its prose renders above its WHAT THEY DID box, as written.
    const townI = cards[1].textContent ?? ''
    expect(townI.indexOf('It runs a smaller program.')).toBeLessThan(townI.indexOf('WHAT THEY DID'))
    // Document order: lead, both cards, closing.
    const all = [...doc.querySelectorAll('p, div')]
    expect(all.indexOf(lead)).toBeLessThan(all.indexOf(cards[0]))
    expect(all.indexOf(closing)).toBeGreaterThan(all.indexOf(cards[1]))
  })

  it('players and documents: lead-in, notes and closing prose all reach the page (Razor C2)', () => {
    const players = textOf(render(BRIEFING_SHAPE_FIXTURES.find((f) => f.id === 'players-extra-fields')!.content))
    for (const s of ['These are the people with a hand in it:', 'Named in the permit file.', 'Issues cutting permits.', 'Answers to the minister.', 'Taken together, the regulator holds most of the cards.']) {
      expect(players).toContain(s)
    }
    const docs = textOf(render(BRIEFING_SHAPE_FIXTURES.find((f) => f.id === 'document-intro')!.content))
    for (const s of ['Two documents set the rules here.', 'The bylaw was amended in 2019.', 'Council can amend it again.']) expect(docs).toContain(s)
  })

  it('no stray rule at the end of a section', () => {
    const doc = render(BRIEFING_SHAPE_FIXTURES.find((f) => f.id === 'trailing-rule')!.content)
    const note = doc.querySelector('[role="note"]')!
    expect(note.textContent).toContain('The prescription text.')
    expect(note.querySelectorAll('hr')).toHaveLength(0)
  })

  it('the lead-in is a paragraph before the list, not its first bullet', () => {
    const doc = render(BRIEFING_SHAPE_FIXTURES.find((f) => f.id === 'mixed-list-lead-in')!.content)
    const items = [...doc.querySelectorAll('li')].map((li) => li.textContent?.trim())
    expect(items).toContain('File the request below.')
    expect(items).toContain("Ask the water users' board to write to the district manager.")
    expect(items.filter((t) => t?.includes('Two things'))).toEqual([])
    expect(findAll(doc, 'p', 'Two things you can do this week:')).toHaveLength(1)
  })

  it('six paragraphs render as six paragraphs: no every-5th divider', () => {
    const doc = render(BRIEFING_SHAPE_FIXTURES.find((f) => f.id === 'many-paragraphs')!.content)
    for (const n of ['one', 'two', 'three', 'four', 'five', 'six']) expect(findAll(doc, 'p', `Paragraph ${n}.`)).toHaveLength(1)
    expect([...doc.querySelectorAll('div')].filter((d) => styleOf(d).includes('width:40%'))).toHaveLength(0)
  })

  it('an Access value the badge cannot say stays on the card as a field', () => {
    const doc = render(['## What Governs This', '', '- **Document name:** Plan (QA)', '- **Access:** On request from the district'].join('\n'))
    expect(textOf(doc)).toContain('On request from the district')
    const pub = render(['## What Governs This', '', '- **Document name:** Plan (QA)', '- **Access:** Public'].join('\n'))
    expect(findAll(pub, 'span', 'Public')).toHaveLength(1)
    expect(findAll(pub, 'span', 'Access')).toHaveLength(0)
  })

  // jsdom has no layout, so this holds the cause, not the pixels: a title with a zero
  // flex basis shrinks to nothing beside the no-shrink badge group before the row wraps
  // (one word per line at 375px). The harness screenshot holds the pixels.
  // Jen D2 C2, held at the cause for the same reason: a no-shrink badge group is as
  // wide as its one row, so its own wrap never fires and Public paints past the card at 320.
  it('the Primary Authority badge group may shrink to the card, and that card shares the others’ text edge', () => {
    const doc = render(BRIEFING_SHAPE_FIXTURES.find((f) => f.id === 'document-access-values')!.content)
    const group = findAll(doc, 'span', 'Primary Authority')[0].parentElement!
    const s = styleOf(group)
    expect(s).toContain('flex:0 1 auto')
    expect(s).toContain('min-width:0')
    expect(s).toContain('max-width:100%')
    expect(s).toContain('flex-wrap:wrap')
    expect(s).not.toContain('flex-shrink:0')
    const primaryCard = cardOf(group)!
    expect(styleOf(primaryCard)).toContain('padding-left:18px')
  })

  it.each(['Synthetic Bylaw A (QA)', 'Synthetic Minutes F (QA)'])(
    'the document title on %s has a real flex basis, so the badges wrap below it on a narrow card',
    (name) => {
      const doc = render(BRIEFING_SHAPE_FIXTURES.find((f) => f.id === 'document-access-values')!.content)
      const [title] = findAll(doc, 'span', name)
      expect(title).toBeDefined()
      const flex = styleOf(title).match(/(?:^|;)flex:([^;]+)/)?.[1].trim() ?? ''
      const [grow, , basis] = flex.split(/\s+/)
      expect(grow).toBe('1')
      const rem = basis?.match(/^(\d+(?:\.\d+)?)rem$/)?.[1]
      expect(Number(rem ?? 0)).toBeGreaterThanOrEqual(10)
      expect(styleOf(title.parentElement)).toContain('flex-wrap:wrap')
    }
  )

  it.each([
    // [card name, badge label or null, the Access value rendered as a field or null]
    ['Synthetic Bylaw A (QA)', 'Public', null],
    ['Synthetic Plan B (QA)', null, 'Public, online'],
    ['Synthetic Memo C (QA)', null, 'FIPPA Required (withheld as deliberative advice)'],
    ['Synthetic Report D (QA)', null, 'Partly public'],
    ['Synthetic Permit E (QA)', null, 'Not public'],
    ['Synthetic Minutes F (QA)', 'Council Record', null],
    ['Synthetic Letter G (QA)', null, 'Public: no'],
    ['Synthetic Audit H (QA)', null, 'Public records request'],
  ] as [string, string | null, string | null][])(
    'Access on %s: badge %s, field %s (the badge never says more or less than the text)',
    (name, badge, field) => {
      const doc = render(BRIEFING_SHAPE_FIXTURES.find((f) => f.id === 'document-access-values')!.content)
      const [heading] = [...doc.querySelectorAll('span, p, h3, h4, div')].filter((e) => e.textContent?.trim() === name)
      expect(heading).toBeDefined()
      const card = cardOf(heading)!
      expect(card).not.toBeNull()
      const badges = ['Public', 'FIPPA Required', 'Council Record'].flatMap((l) => findAll(card, 'span', l))
      expect(badges.map((b) => b.textContent)).toEqual(badge ? [badge] : [])
      expect(findAll(card, 'span', 'Access')).toHaveLength(field ? 1 : 0)
      if (field) expect(findAll(card, 'p', field)).toHaveLength(1)
    }
  )

  it('a citation-heavy paragraph is a plain paragraph: no evidence callout', () => {
    const doc = render(['## What the Public Record Shows', '', 'Under s. 25 of FIPPA, pursuant to the Forest Act (2024), the Certificate applies.'].join('\n'))
    const [para] = [...doc.querySelectorAll('p')].filter((e) => e.textContent?.startsWith('Under s. 25'))
    expect(para).toBeDefined()
    expect(para.parentElement!.getAttribute('style') ?? '').not.toContain('accent-oracle')
    expect(styleOf(para)).toContain('font-size:17px')
  })
})
