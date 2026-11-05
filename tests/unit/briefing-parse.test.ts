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
  type BlockElement,
  type GoverningBlock,
  type JurisdictionData,
  type PlayerData,
  extractFippaLetter,
  extractTitle,
  getRoleKey,
  parseGoverningDocuments,
  parseJurisdictions,
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
  | { heading: string; kind: 'players'; players: PlayerData[] }
  | { heading: string; kind: 'actions'; before: BlockElement[]; letter: string; after: BlockElement[] }
  | { heading: string; kind: 'comparison'; jurisdictions: JurisdictionData[] }

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
      const players = parsePlayers(content)
      return players.length > 0 ? { heading, kind: 'players', players } : prose()
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
      const jurisdictions = parseJurisdictions(content)
      return jurisdictions.length > 0 ? { heading, kind: 'comparison', jurisdictions } : prose()
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
const player = (name: string, role: string, whyTheyMatter = '', trackRecord = ''): PlayerData => ({
  name,
  role,
  whyTheyMatter,
  trackRecord,
})
const jur = (name: string, body: string[], f: Partial<Omit<JurisdictionData, 'name' | 'body'>> = {}): JurisdictionData => ({
  name,
  body,
  whatTheyDid: f.whatTheyDid ?? '',
  whyItMatters: f.whyItMatters ?? '',
  outcome: f.outcome ?? '',
})

const GOLDENS: Record<string, BriefingParse> = {
  'role-raw-enum': {
    title: null,
    sections: [
      {
        heading: 'Key Players',
        kind: 'players',
        players: [
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
            fields: [
              { label: 'How to find it', value: '[BC forestry pages](https://www2.gov.bc.ca/gov/content/industry/forestry)' },
              { label: 'Access', value: 'Public' },
            ],
            isPrimary: true,
          },
          {
            type: 'document',
            name: 'Local reporting (QA)',
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
      { heading: 'Key Players', kind: 'players', players: [player('Someone (QA)', '')] },
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
        jurisdictions: [
          jur('Synthetic Town C (QA)', [], {
            whatTheyDid: 'Published every *cutting permit* before approval.',
            outcome: 'Reported but unverified.',
          }),
          jur('Synthetic Town D (QA)', ['Requires a hydrology assessment above every intake.', 'The outcome is not documented.']),
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
    sections: [{ heading: 'Key Players', kind: 'players', players: [player('Mill Creek Water Users (QA)', 'affected')] }],
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
      players: [
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
        fields: [{ label: 'What it is', value: 'The bylaw.' }],
        isPrimary: true,
      },
    ])
  })

  it('Outcome, What they did and Why it matters come only from a line that opens with the label', () => {
    const [j] = parseJurisdictions(
      [
        '### Synthetic Town E (QA)',
        'What they did differently was publish. The outcome is unknown. Why it matters is unclear.',
      ].join('\n')
    )
    expect(j).toEqual(
      jur('Synthetic Town E (QA)', ['What they did differently was publish. The outcome is unknown. Why it matters is unclear.'])
    )
    const [k] = parseJurisdictions(
      ['**Synthetic Town F (QA)**', '- **What they did:** Published.', '  **Why it matters:** It can be appealed.', '**Outcome**: Fewer variances.'].join('\n')
    )
    expect(k).toEqual(
      jur('Synthetic Town F (QA)', [], { whatTheyDid: 'Published.', whyItMatters: 'It can be appealed.', outcome: 'Fewer variances.' })
    )
  })

  it('bulleted places are prose, not cards: no Outcome box, no invented jurisdiction', () => {
    const doc = render(BRIEFING_SHAPE_FIXTURES.find((f) => f.id === 'outcome-word')!.content)
    expect(findAll(doc, 'span', 'OUTCOME')).toHaveLength(0)
    expect([...doc.querySelectorAll('li')].some((li) => li.textContent?.startsWith('Synthetic Town A (QA) publishes'))).toBe(true)
  })

  it('a field value continues on the following lines until a blank line', () => {
    const [j] = parseJurisdictions(['### Synthetic Town G (QA)', 'Outcome: Variances fell', 'by a third.', '', 'Later prose.'].join('\n'))
    expect(j).toEqual(jur('Synthetic Town G (QA)', ['Later prose.'], { outcome: 'Variances fell by a third.' }))
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

  it.each([
    ['decision_maker', 'Decision-maker'],
    ['decision maker', 'Decision-maker'],
    ['DECISION_MAKER', 'Decision-maker'],
    ['rights_holder', 'Rights holder'],
    ['rights holder', 'Rights holder'],
    ['proponent', 'Proponent'],
    ['affected', 'affected'],
    ['certificate_holder', 'certificate holder'],
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
})

// ---- the word-sequence property ---------------------------------------------

/**
 * Field labels the renderer replaces with its own eyebrow or position. Written
 * down, not derived: removed from both sides at the start of a line.
 */
const REPLACED_LABELS = [
  'Name:',
  'Role:',
  'Why they matter:',
  'Track record:',
  'Document name:',
  'What it is:',
  'Access:',
  'Outcome:',
  'What they did:',
  'Why it matters:',
]

const words = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []

const stripLabel = (line: string): string => {
  for (const label of REPLACED_LABELS) {
    if (line.toLowerCase().startsWith(label.toLowerCase())) return line.slice(label.length)
  }
  return line
}

function inputWords(markdown: string): string[] {
  const text = markdown
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
        for (const b of s.blocks) {
          if (b.type === 'eyebrow') out.push(b.text)
          else if (b.type === 'prose') preprocessBlocks(b.text).forEach((x) => out.push(...blockText(x)))
          else {
            out.push(inlineText(b.name))
            for (const f of b.fields) {
              if (!REPLACED_LABELS.includes(`${f.label}:`)) out.push(f.label)
              out.push(inlineText(f.value))
            }
          }
        }
        break
      case 'players':
        for (const pl of s.players) out.push(inlineText(pl.name), roleLabel(pl.role), inlineText(pl.whyTheyMatter), inlineText(pl.trackRecord))
        break
      case 'actions':
        s.before.forEach((b) => out.push(...blockText(b)))
        out.push(s.letter)
        s.after.forEach((b) => out.push(...blockText(b)))
        break
      case 'comparison':
        for (const j of s.jurisdictions) {
          out.push(inlineText(j.name), ...j.body.map(inlineText), inlineText(j.whatTheyDid), inlineText(j.whyItMatters), inlineText(j.outcome))
        }
        break
    }
  }
  return words(out.join('\n').split('\n').map(stripLabel).join('\n'))
}

describe('word-sequence property: nothing dropped, duplicated or reordered', () => {
  const cases: [string, string][] = [...BRIEFING_SHAPE_FIXTURES.map((f) => [f.id, f.content] as [string, string]), ['SEEDED_BRIEFING', SEEDED_BRIEFING]]

  it.each(cases)('%s', (_id, content) => {
    const input = inputWords(content)
    expect(input.length).toBeGreaterThan(0)
    expect(outputWords(parseBriefing(content))).toEqual(input)
  })

  it('the property fires: a parse that drops a word fails it', () => {
    const parse = parseBriefing(SEEDED_BRIEFING)
    const players = parse.sections.find((s) => s.kind === 'players')
    if (players?.kind !== 'players') throw new Error('no players section')
    players.players[0] = { ...players.players[0], trackRecord: '' }
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
const findAll = (doc: Document, selector: string, text: string) =>
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
    for (const word of ['docprimary', 'docsupporting', 'playername', 'playerwhy', 'playertrack', 'jurname', 'jurbody', 'jurwhat', 'jurwhy', 'juroutcome']) {
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

  it('a group label with nothing under it is the 11px muted eyebrow, never a card', () => {
    const doc = render(SEEDED_BRIEFING)
    const [eyebrow] = findAll(doc, 'h4', 'Supporting Documents')
    expect(eyebrow).toBeDefined()
    expect(styleOf(eyebrow)).toContain('font-size:11px')
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

  it('a citation-heavy paragraph is a plain paragraph: no evidence callout', () => {
    const doc = render(['## What the Public Record Shows', '', 'Under s. 25 of FIPPA, pursuant to the Forest Act (2024), the Certificate applies.'].join('\n'))
    const [para] = [...doc.querySelectorAll('p')].filter((e) => e.textContent?.startsWith('Under s. 25'))
    expect(para).toBeDefined()
    expect(para.parentElement!.getAttribute('style') ?? '').not.toContain('accent-oracle')
    expect(styleOf(para)).toContain('font-size:17px')
  })
})
