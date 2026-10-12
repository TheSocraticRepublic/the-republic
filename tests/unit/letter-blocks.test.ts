import { describe, it, expect, vi } from 'vitest'
import {
  parseLetter,
  projectBlocks,
  escapeHtml,
  blocksToHtml,
  GUIDANCE_MARKER as PARSER_MARKER,
  MAX_PARSE_LENGTH,
  type Block,
} from '@/lib/lever/letter-blocks'
import {
  LETTER_FIXTURES,
  GUIDANCE_MARKER,
  HOSTILE_INPUT,
  PLACEHOLDER_LETTER,
  LITERAL_MARKER_LETTER,
  AMBIGUOUS_LETTER,
  EMPHASIS_RULES,
  type LetterFixture,
} from '../fixtures/letters'

/*
 * The oracle is tests/fixtures/letters.ts: hand-written goldens, written from
 * the plan before this parser existed. These tests compare against them
 * exactly. They are never edited to make the parser pass.
 */

function project(blocks: Block[] | null): string | null {
  return blocks === null ? null : projectBlocks(blocks)
}

/*
 * Fixtures added in A1 (goldens written by hand from §1/§2, not from the
 * parser). They live here rather than in the shared fixture file because only
 * this test reads them.
 */
const OVERSIZE_LEGACY_CONTENT = ('# Big **heading**\n[Your name]\n').repeat(9_000).slice(0, 250_000)
const A1_FIXTURES: LetterFixture[] = [
  {
    id: 'a1-oversize-legacy-crlf',
    purpose: '§1 bounds: 250,000 characters of legacy CRLF text with markup: fallback keeps every byte, CR included.',
    format: undefined,
    content: OVERSIZE_LEGACY_CONTENT.replace(/\n/g, '\r\n').slice(0, 250_000),
    expectedLetter: OVERSIZE_LEGACY_CONTENT.replace(/\n/g, '\r\n').slice(0, 250_000),
    expectedGuidance: null,
    expectedFallback: true,
  },
  {
    id: 'a1-one-over-bound',
    purpose: '§1 bounds: 200,001 characters is over the bound.',
    format: undefined,
    content: '**a**' + 'x'.repeat(199_996),
    expectedLetter: '**a**' + 'x'.repeat(199_996),
    expectedGuidance: null,
    expectedFallback: true,
  },
  {
    id: 'a1-empty',
    purpose: 'Empty stored text: one empty line, nothing else.',
    format: 'marker-v1',
    content: '',
    expectedLetter: '',
    expectedGuidance: null,
    expectedSplit: 'none',
    expectedFallback: false,
    expectedPlaceholders: 0,
  },
  {
    id: 'a1-placeholder-in-strong-and-link-text',
    purpose:
      'A placeholder inside strong counts; `**[` is not a strong opener (next character must be a letter or digit) but its bracket span is still a placeholder; a link text is never a placeholder; an unbalanced link leaves a placeholder.',
    format: 'marker-v1',
    content: [
      '**Signed [Your name]** wrote [the guide](https://example.org/g). **[Not strong]**',
      '[Unbalanced](https://example.org/a_(b)',
      GUIDANCE_MARKER,
      '[Guidance bracket] and [another]',
    ].join('\n'),
    expectedLetter: [
      'Signed [Your name] wrote the guide (https://example.org/g). **[Not strong]**',
      '[Unbalanced](https://example.org/a_(b)',
    ].join('\n'),
    expectedGuidance: '[Guidance bracket] and [another]',
    expectedSplit: 'marker',
    expectedFallback: false,
    expectedPlaceholders: 3,
  },
  {
    id: 'a1-marker-blank-lines-both-sides',
    purpose: '§2: the blank lines around the marker stay in their parts; only the marker line is dropped.',
    format: 'marker-v1',
    content: ['Letter.', '', GUIDANCE_MARKER, '', 'Guidance.'].join('\n'),
    expectedLetter: 'Letter.\n',
    expectedGuidance: '\nGuidance.',
    expectedSplit: 'marker',
    expectedFallback: false,
    expectedPlaceholders: 0,
  },
  {
    id: 'a1-unknown-format',
    purpose: '§2: a format other than marker-v1 is not marker-v1, so the text is never split.',
    format: 'marker-v2' as unknown as undefined,
    content: ['Letter.', GUIDANCE_MARKER, 'Guidance.'].join('\n'),
    expectedLetter: ['Letter.', GUIDANCE_MARKER, 'Guidance.'].join('\n'),
    expectedGuidance: null,
    expectedSplit: 'legacy',
    expectedFallback: false,
    expectedPlaceholders: 0,
  },
]

describe('parseLetter: exact golden projections (tests/fixtures/letters.ts)', () => {
  for (const fx of [...LETTER_FIXTURES, ...A1_FIXTURES]) {
    it(`${fx.id}: ${fx.purpose}`, () => {
      const parsed = parseLetter(fx.content, fx.format)
      expect(project(parsed.letter)).toBe(fx.expectedLetter)
      expect(project(parsed.guidance)).toBe(fx.expectedGuidance)
      expect(parsed.fallback).toBe(fx.expectedFallback)
      if (fx.expectedSplit !== undefined) expect(parsed.split).toBe(fx.expectedSplit)
      if (fx.expectedPlaceholders !== undefined) expect(parsed.placeholders).toBe(fx.expectedPlaceholders)
    })
  }

  it('uses the same marker string as the fixtures', () => {
    expect(PARSER_MARKER).toBe(GUIDANCE_MARKER)
  })
})

describe('parseLetter: §2 split rules', () => {
  it('never splits legacy text that quotes the marker on its own line', () => {
    const parsed = parseLetter(LITERAL_MARKER_LETTER.content, undefined)
    expect(parsed.split).toBe('legacy')
    expect(parsed.guidance).toBeNull()
    expect(project(parsed.letter)).toContain(GUIDANCE_MARKER)
  })

  it('the same text recorded as marker-v1 does split, so the format alone decides', () => {
    const parsed = parseLetter(LITERAL_MARKER_LETTER.content, 'marker-v1')
    expect(parsed.split).toBe('marker')
    expect(project(parsed.guidance)).toBe('\nI request the records that reply referred to.')
  })

  it('two markers: no split, nothing taken from either side', () => {
    const parsed = parseLetter(AMBIGUOUS_LETTER.content, 'marker-v1')
    expect(parsed.split).toBe('ambiguous')
    expect(parsed.guidance).toBeNull()
    expect(project(parsed.letter)).toBe(AMBIGUOUS_LETTER.expectedLetter)
    expect(project(parsed.letter)).toContain('Keep a copy.')
  })
})

describe('parseLetter: placeholders count in the letter part only', () => {
  it('a bracket in the guidance is not counted', () => {
    const parsed = parseLetter(PLACEHOLDER_LETTER.content, 'marker-v1')
    expect(parsed.placeholders).toBe(8)
    // The guidance has a bracketed span of its own; were it counted, 9.
    expect(project(parsed.guidance)).toContain('[bracketed]')
  })

  it('placeholders are marked as their own inline, brackets kept', () => {
    const parsed = parseLetter('Dear [Name],', undefined)
    const block = parsed.letter[0]
    expect(block.kind).toBe('line')
    if (block.kind !== 'line') return
    expect(block.inlines).toEqual([
      { kind: 'text', text: 'Dear ' },
      { kind: 'placeholder', text: '[Name]' },
      { kind: 'text', text: ',' },
    ])
  })
})

describe('parseLetter: bounds and failure', () => {
  it('the bound is 200,000 characters', () => {
    expect(MAX_PARSE_LENGTH).toBe(200_000)
  })

  it('250,000 characters returns fallback with the whole text in one verbatim block', () => {
    const text = `${'x'.repeat(100)}\n${GUIDANCE_MARKER}\n**y**\n`.repeat(2_500).slice(0, 250_000)
    const parsed = parseLetter(text, 'marker-v1')
    expect(parsed.fallback).toBe(true)
    expect(parsed.letter).toEqual([{ kind: 'verbatim', text }])
    expect(parsed.guidance).toBeNull()
    expect(parsed.split).not.toBe('marker')
  })

  it('never throws on a non-string; returns a fallback', () => {
    expect(() => parseLetter(undefined, undefined)).not.toThrow()
    expect(parseLetter(null, 'marker-v1')).toMatchObject({ fallback: true, guidance: null })
    expect(parseLetter(42, undefined).letter).toEqual([{ kind: 'verbatim', text: '42' }])
  })

  it('an internal error returns the fallback with the text intact, and logs it', () => {
    const text = 'Dear **FOI** Coordinator,\nline two'
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const orig = String.prototype.split
    // Force a failure inside the parse, after the bounds check.
    String.prototype.split = function () {
      throw new Error('boom')
    } as typeof String.prototype.split
    try {
      const parsed = parseLetter(text, undefined)
      expect(parsed.fallback).toBe(true)
      expect(parsed.letter).toEqual([{ kind: 'verbatim', text }])
    } finally {
      String.prototype.split = orig
    }
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })
})

describe('parseLetter: a javascript: link is text, never a link', () => {
  it('projects as text and renders as escaped text with no anchor', () => {
    const parsed = parseLetter(HOSTILE_INPUT.content, undefined)
    const html = blocksToHtml(parsed.letter)
    expect(html).not.toMatch(/<a[\s>]/i)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
    expect(html).toContain('click me (<span class="url">javascript:alert(1)</span>)')
    expect(html).toContain('Tom &amp; Jerry&#39;s &quot;quote&quot; &lt;b&gt;bold&lt;/b&gt;')
  })
})

describe('escapeHtml', () => {
  it('escapes & < > " and \'', () => {
    expect(escapeHtml(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &#39;')
  })
  it('escapes & first, so an entity in the text survives as text', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;')
  })
  it('leaves other characters alone', () => {
    expect(escapeHtml('Zoë — « n° 12 » *x* [y](z)')).toBe('Zoë — « n° 12 » *x* [y](z)')
  })
})

describe('blocksToHtml: one element per block, text equal to the projection', () => {
  it('emphasis renders as markup, not as literal markers', () => {
    const html = blocksToHtml(parseLetter(EMPHASIS_RULES.content, undefined).letter)
    expect(html).toContain('<strong>Strong</strong> at line start.')
    expect(html).toContain('A (<em>parenthesised</em>) word.')
    // Literal near-misses survive verbatim.
    expect(html).toContain('Inner star: *a*b* stays.')
  })
})

/*
 * Second check, never the primary one: a word-sequence property over 500
 * fuzzed strings. For legacy text the parser only removes markup characters
 * and adds bullets and parentheses, so the sequence of letter-or-digit words
 * in the projection must equal the sequence in the input.
 */
describe('parseLetter: word-sequence property over 500 fuzzed strings', () => {
  // Deterministic PRNG (mulberry32) so a failure is reproducible.
  function rng(seed: number) {
    return () => {
      seed |= 0
      seed = (seed + 0x6d2b79f5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  const PIECES = [
    'word', 'Ünïcode', '2025', 's. 75(5)(b)', '*', '**', ' ', ' ', ' ', '\n', '\r\n', '# ', '## ', '- ',
    '1. ', '---', '***', '[', ']', '(', ')', '[Your name]', '[t](https://x.ca/a_(b))', '"', "'",
    '.', ',', '!', '\\', '<b>', '&', 'é', '•', GUIDANCE_MARKER, '`', '_',
  ]
  // The markup characters the parser may remove are deleted from BOTH sides
  // before splitting into words: removing `[` from `2025[t](u)` legitimately
  // joins two runs of letters, and is not a loss.
  const words = (s: string) => s.replace(/[*#[\]]/g, '').match(/[\p{L}\p{N}]+/gu) ?? []

  it('holds for every string, in both formats, and never throws or falls back', () => {
    const next = rng(20261011)
    for (let n = 0; n < 500; n++) {
      const len = 1 + Math.floor(next() * 40)
      let s = ''
      for (let k = 0; k < len; k++) s += PIECES[Math.floor(next() * PIECES.length)]

      const legacy = parseLetter(s, undefined)
      expect(legacy.fallback).toBe(false)
      expect(words(projectBlocks(legacy.letter))).toEqual(words(s))

      // marker-v1: letter + guidance words equal the input's minus one marker
      // line's words when it split; equal to the input's when it did not.
      const v1 = parseLetter(s, 'marker-v1')
      const got = [...words(projectBlocks(v1.letter)), ...(v1.guidance ? words(projectBlocks(v1.guidance)) : [])]
      if (v1.split === 'marker') {
        const lines = s.replace(/\r\n/g, '\n').split('\n')
        const at = lines.findIndex((l) => l.trimEnd() === GUIDANCE_MARKER)
        const expected = [...words(lines.slice(0, at).join('\n')), ...words(lines.slice(at + 1).join('\n'))]
        expect(got).toEqual(expected)
      } else {
        expect(got).toEqual(words(s))
      }
    }
  })
})
