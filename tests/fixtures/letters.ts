/**
 * Synthetic letter and briefing fixtures for the QA harness and the A/D-series
 * tests. Everything here is invented: no real person, no captured citizen
 * content. Bodies marked "(QA)" are fictional on purpose.
 *
 * THE GOLDENS ARE AN INDEPENDENT ORACLE. Every `expectedLetter` and
 * `expectedGuidance` below was written by hand, line by line, from the plan's
 * rules (Open Cave UI and filings remediation r4.1, "The filings design" §1
 * "Lossless rendering with a defined projection" and §2 "Letter and guidance
 * split only for recorded marker-v1 letters"). None of them is computed by,
 * or was checked against, a parser: no parser existed when they were written.
 * If parseLetter() disagrees with a golden, the parser is wrong unless the
 * golden misreads §1/§2, and that is a plan question, not a test edit.
 *
 * Conventions the goldens follow, each read straight off §1/§2:
 *
 * - A projection is the projected lines joined with "\n". CRLF is read as LF
 *   first, so no golden contains "\r".
 * - Nothing is trimmed. Blank lines are kept where they stand, including a
 *   blank line directly before or after the marker, and a trailing newline at
 *   the end of the content (it shows up as a final "" line, so the golden ends
 *   with "\n").
 * - The marker line belongs to neither part. The letter is every line before
 *   it; the guidance is every line after it. A marker on the first line gives
 *   an empty letter (""); on the last line, an empty guidance ("").
 * - When there is no clean split (`none`, `ambiguous`, `legacy`), the whole
 *   text is the letter, projected, with any marker line left verbatim, and
 *   `expectedGuidance` is null.
 * - Inline constructs (strong, emphasis, links) are projected inside heading
 *   and list-item text too, since every construct is evaluated per line.
 * - A link's `[text]` is a link, not a placeholder. A placeholder is any other
 *   `[...]` span, counted in the letter part only.
 * - Fallback (input over 200,000 characters): one verbatim block, unsplit,
 *   so `expectedLetter` is the content exactly and `expectedGuidance` is null.
 */

/** `metadata.letterFormat`. `undefined` means the field is absent: legacy. */
export type LetterFormat = 'marker-v1' | undefined

export type LetterSplit = 'marker' | 'none' | 'ambiguous' | 'legacy'

export const GUIDANCE_MARKER = '=== NOT PART OF YOUR REQUEST ==='

/** How scripts/qa/seed-local.ts stores a fixture as a lever action. */
export interface LetterSeed {
  /** Stable key; the seed derives each action's title from it. */
  key: string
  actionType: 'fippa_request'
  /** `metadata.publicBody` (the canonical key actions/route.ts writes). */
  publicBody: string | null
  /** `metadata.jurisdiction`; absent on legacy rows and on the unresolved fixture. */
  jurisdiction?: 'bc' | 'ab' | 'on'
  /** Link the action to user A's seeded investigation (which resolves to BC). */
  linkInvestigation: boolean
}

export interface LetterFixture {
  id: string
  /** What the fixture exists to pin. */
  purpose: string
  content: string
  format: LetterFormat
  expectedLetter: string
  /** null when there is no clean split. */
  expectedGuidance: string | null
  /** Omitted only for fallback fixtures, where §1 says the text is not split at all. */
  expectedSplit?: LetterSplit
  expectedFallback: boolean
  /** `[...]` placeholders in the letter part. Set where the count is unambiguous. */
  expectedPlaceholders?: number
  /** Present on the fixtures the harness seeds (one action per status). */
  seed?: LetterSeed
}

const lines = (...ls: string[]): string => ls.join('\n')

// ---------------------------------------------------------------------------
// The seeded letters: one lever action per fixture per status (draft, final,
// filed) for user A. Plan Q0 harness "Seed": legacy, marker-v1, ambiguous,
// missing marker, placeholder, literal-marker, Other body, unresolved
// jurisdiction.
// ---------------------------------------------------------------------------

export const LEGACY_LETTER: LetterFixture = {
  id: 'legacy',
  purpose:
    'A letter from before marker-v1: guidance (NEXT STEPS) mixed into the text, markdown, a rule. Never split.',
  format: undefined,
  content: lines(
    '# FIPPA Request: Water licence records',
    '',
    '[YOUR NAME]',
    '[YOUR ADDRESS]',
    '',
    'FOI Coordinator',
    'Ministry of Forests',
    '',
    'Dear FOI Coordinator,',
    '',
    'I request access to the following records:',
    '',
    '1. The **2024 water licence amendment** for the Mill Creek intake.',
    '2. Inspection reports for the intake from 2023 to the present.',
    '',
    'Yours truly,',
    '',
    '[YOUR NAME]',
    '',
    '---',
    '',
    "NEXT STEPS: Send this to the ministry's FOI office by email or mail. If you get no reply in time, ask the Information and Privacy Commissioner to review it."
  ),
  expectedLetter: lines(
    'FIPPA Request: Water licence records',
    '',
    '[YOUR NAME]',
    '[YOUR ADDRESS]',
    '',
    'FOI Coordinator',
    'Ministry of Forests',
    '',
    'Dear FOI Coordinator,',
    '',
    'I request access to the following records:',
    '',
    '1. The 2024 water licence amendment for the Mill Creek intake.',
    '2. Inspection reports for the intake from 2023 to the present.',
    '',
    'Yours truly,',
    '',
    '[YOUR NAME]',
    '',
    '',
    '',
    "NEXT STEPS: Send this to the ministry's FOI office by email or mail. If you get no reply in time, ask the Information and Privacy Commissioner to review it."
  ),
  expectedGuidance: null,
  expectedSplit: 'legacy',
  expectedFallback: false,
  expectedPlaceholders: 3,
  seed: {
    key: 'legacy',
    actionType: 'fippa_request',
    // The legacy name the A2 alias table maps to "BC Ministry of Forests".
    publicBody: 'Ministry of Forests',
    linkInvestigation: true,
  },
}

export const MARKER_V1_LETTER: LetterFixture = {
  id: 'marker-v1',
  purpose:
    'A clean marker-v1 letter: strong, emphasis, numbered and bullet items, a link, placeholders; guidance after the marker.',
  format: 'marker-v1',
  content: lines(
    '**Re: Request for records about the Cedar Ridge cutblock approvals**',
    '',
    'FOI Coordinator',
    'Ministry of Forests',
    'PO Box 9049 Stn Prov Govt',
    'Victoria, BC V8W 9E2',
    '',
    'Dear FOI Coordinator,',
    '',
    'I am requesting access to the following records under the *Freedom of Information and Protection of Privacy Act*:',
    '',
    '1. All correspondence between the district manager and the licensee about cutblock CR-14, from January 1, 2025 to the date of this request.',
    '2. The silviculture prescription for cutblock CR-14.',
    '- Any briefing notes prepared for the Minister about this cutblock.',
    '',
    'Please provide the records in electronic form. See [the request guide](https://example.org/foi-guide) for how requests are handled.',
    '',
    'Sincerely,',
    '',
    '[Your name]',
    '[Your email]',
    GUIDANCE_MARKER,
    '## Before you send this',
    '',
    "- Check the recipient address against the ministry's own FOI page.",
    '- Keep a dated copy of what you sent.'
  ),
  expectedLetter: lines(
    'Re: Request for records about the Cedar Ridge cutblock approvals',
    '',
    'FOI Coordinator',
    'Ministry of Forests',
    'PO Box 9049 Stn Prov Govt',
    'Victoria, BC V8W 9E2',
    '',
    'Dear FOI Coordinator,',
    '',
    'I am requesting access to the following records under the Freedom of Information and Protection of Privacy Act:',
    '',
    '1. All correspondence between the district manager and the licensee about cutblock CR-14, from January 1, 2025 to the date of this request.',
    '2. The silviculture prescription for cutblock CR-14.',
    '• Any briefing notes prepared for the Minister about this cutblock.',
    '',
    'Please provide the records in electronic form. See the request guide (https://example.org/foi-guide) for how requests are handled.',
    '',
    'Sincerely,',
    '',
    '[Your name]',
    '[Your email]'
  ),
  expectedGuidance: lines(
    'Before you send this',
    '',
    "• Check the recipient address against the ministry's own FOI page.",
    '• Keep a dated copy of what you sent.'
  ),
  expectedSplit: 'marker',
  expectedFallback: false,
  expectedPlaceholders: 2,
  seed: {
    key: 'marker-v1',
    actionType: 'fippa_request',
    publicBody: 'BC Ministry of Forests',
    jurisdiction: 'bc',
    linkInvestigation: true,
  },
}

export const AMBIGUOUS_LETTER: LetterFixture = {
  id: 'ambiguous',
  purpose: 'marker-v1 with the marker twice: no split, both marker lines stay verbatim in the letter.',
  format: 'marker-v1',
  content: lines(
    'Dear FOI Coordinator,',
    '',
    'I request the **2025** grazing tenure maps for the Elk Flats range unit.',
    GUIDANCE_MARKER,
    'Check the address first.',
    GUIDANCE_MARKER,
    'Keep a copy.'
  ),
  expectedLetter: lines(
    'Dear FOI Coordinator,',
    '',
    'I request the 2025 grazing tenure maps for the Elk Flats range unit.',
    '=== NOT PART OF YOUR REQUEST ===',
    'Check the address first.',
    '=== NOT PART OF YOUR REQUEST ===',
    'Keep a copy.'
  ),
  expectedGuidance: null,
  expectedSplit: 'ambiguous',
  expectedFallback: false,
  expectedPlaceholders: 0,
  seed: {
    key: 'ambiguous',
    actionType: 'fippa_request',
    publicBody: 'BC Ministry of Forests',
    jurisdiction: 'bc',
    linkInvestigation: true,
  },
}

export const MISSING_MARKER_LETTER: LetterFixture = {
  id: 'missing-marker',
  purpose: 'marker-v1 where the model left the marker out: no split, guidance-looking text stays in the letter.',
  format: 'marker-v1',
  content: lines(
    'Dear FOI Coordinator,',
    '',
    'Please send me the *final* inspection report for the Mill Creek intake.',
    '',
    '- Tip: keep a dated copy of this request.'
  ),
  expectedLetter: lines(
    'Dear FOI Coordinator,',
    '',
    'Please send me the final inspection report for the Mill Creek intake.',
    '',
    '• Tip: keep a dated copy of this request.'
  ),
  expectedGuidance: null,
  expectedSplit: 'none',
  expectedFallback: false,
  expectedPlaceholders: 0,
  seed: {
    key: 'missing-marker',
    actionType: 'fippa_request',
    publicBody: 'BC Ministry of Forests',
    jurisdiction: 'bc',
    linkInvestigation: true,
  },
}

export const PLACEHOLDER_LETTER: LetterFixture = {
  id: 'placeholder',
  purpose:
    'marker-v1 with the [Public body FOI address] placeholder and seven more in the letter; one bracket in the guidance that must not count. The blank line before the marker stays in the letter.',
  format: 'marker-v1',
  content: lines(
    '[Your name]',
    '[Your street address]',
    '[City, Province, Postal code]',
    '',
    'FOI Coordinator',
    'BC Environmental Assessment Office',
    '[Public body FOI address]',
    '',
    'Dear FOI Coordinator,',
    '',
    'I request all records about the [Project name] environmental assessment from [start date] to [end date].',
    '',
    'Sincerely,',
    '[Your name]',
    '',
    GUIDANCE_MARKER,
    'Fill in every [bracketed] field before you send this.'
  ),
  expectedLetter: lines(
    '[Your name]',
    '[Your street address]',
    '[City, Province, Postal code]',
    '',
    'FOI Coordinator',
    'BC Environmental Assessment Office',
    '[Public body FOI address]',
    '',
    'Dear FOI Coordinator,',
    '',
    'I request all records about the [Project name] environmental assessment from [start date] to [end date].',
    '',
    'Sincerely,',
    '[Your name]',
    ''
  ),
  expectedGuidance: lines('Fill in every [bracketed] field before you send this.'),
  expectedSplit: 'marker',
  expectedFallback: false,
  expectedPlaceholders: 8,
  seed: {
    key: 'placeholder',
    actionType: 'fippa_request',
    publicBody: 'BC Environmental Assessment Office',
    jurisdiction: 'bc',
    linkInvestigation: true,
  },
}

export const LITERAL_MARKER_LETTER: LetterFixture = {
  id: 'literal-marker',
  purpose:
    'A legacy letter that quotes the marker string on its own line. Legacy text is never interpreted, so it is never split.',
  format: undefined,
  content: lines(
    'Dear FOI Coordinator,',
    '',
    'A previous reply from your office contained this line, which I quote:',
    '',
    GUIDANCE_MARKER,
    '',
    'I request the records that reply referred to.'
  ),
  expectedLetter: lines(
    'Dear FOI Coordinator,',
    '',
    'A previous reply from your office contained this line, which I quote:',
    '',
    '=== NOT PART OF YOUR REQUEST ===',
    '',
    'I request the records that reply referred to.'
  ),
  expectedGuidance: null,
  expectedSplit: 'legacy',
  expectedFallback: false,
  expectedPlaceholders: 0,
  seed: {
    key: 'literal-marker',
    actionType: 'fippa_request',
    publicBody: 'BC Ministry of Forests',
    linkInvestigation: true,
  },
}

export const OTHER_BODY_LETTER: LetterFixture = {
  id: 'other-body',
  purpose: "marker-v1 addressed to a body that is not in Open Cave's directory (resolver outcome `other`).",
  format: 'marker-v1',
  content: lines(
    'Dear Records Officer,',
    '',
    'I request the 2025 board meeting minutes of the Synthetic Test Authority.',
    '',
    'Sincerely,',
    '[Your name]',
    GUIDANCE_MARKER,
    'Look up how this body accepts records requests.'
  ),
  expectedLetter: lines(
    'Dear Records Officer,',
    '',
    'I request the 2025 board meeting minutes of the Synthetic Test Authority.',
    '',
    'Sincerely,',
    '[Your name]'
  ),
  expectedGuidance: lines('Look up how this body accepts records requests.'),
  expectedSplit: 'marker',
  expectedFallback: false,
  expectedPlaceholders: 1,
  seed: {
    key: 'other-body',
    actionType: 'fippa_request',
    publicBody: 'Synthetic Test Authority (QA)',
    jurisdiction: 'bc',
    linkInvestigation: true,
  },
}

export const UNRESOLVED_JURISDICTION_LETTER: LetterFixture = {
  id: 'unresolved-jurisdiction',
  purpose:
    'marker-v1 naming a BC body, but with no metadata.jurisdiction and no investigation: the resolver must say `unresolved`, never borrow BC.',
  format: 'marker-v1',
  content: lines(
    'Dear FOI Coordinator,',
    '',
    'I request the 2025 road permit records for the Cedar Ridge area.',
    '',
    'Sincerely,',
    '[Your name]',
    GUIDANCE_MARKER,
    'Confirm which province this request goes to before you send it.'
  ),
  expectedLetter: lines(
    'Dear FOI Coordinator,',
    '',
    'I request the 2025 road permit records for the Cedar Ridge area.',
    '',
    'Sincerely,',
    '[Your name]'
  ),
  expectedGuidance: lines('Confirm which province this request goes to before you send it.'),
  expectedSplit: 'marker',
  expectedFallback: false,
  expectedPlaceholders: 1,
  seed: {
    key: 'unresolved-jurisdiction',
    actionType: 'fippa_request',
    publicBody: 'BC Ministry of Forests',
    linkInvestigation: false,
  },
}

/** The eight fixtures the harness seeds, in seed order. */
export const SEEDED_LETTER_FIXTURES: readonly LetterFixture[] = [
  LEGACY_LETTER,
  MARKER_V1_LETTER,
  AMBIGUOUS_LETTER,
  MISSING_MARKER_LETTER,
  PLACEHOLDER_LETTER,
  LITERAL_MARKER_LETTER,
  OTHER_BODY_LETTER,
  UNRESOLVED_JURISDICTION_LETTER,
]

// ---------------------------------------------------------------------------
// §2 marker cases
// ---------------------------------------------------------------------------

export const MARKER_FIRST_LINE: LetterFixture = {
  id: 'marker-first-line',
  purpose: '§2: marker as the first line gives an empty letter part.',
  format: 'marker-v1',
  content: lines(GUIDANCE_MARKER, 'Only guidance here.'),
  expectedLetter: '',
  expectedGuidance: 'Only guidance here.',
  expectedSplit: 'marker',
  expectedFallback: false,
  expectedPlaceholders: 0,
}

export const MARKER_LAST_LINE: LetterFixture = {
  id: 'marker-last-line',
  purpose: '§2: marker as the last line gives an empty guidance part.',
  format: 'marker-v1',
  content: lines('Dear FOI Coordinator,', '', 'I request the 2025 audit.', GUIDANCE_MARKER),
  expectedLetter: lines('Dear FOI Coordinator,', '', 'I request the 2025 audit.'),
  expectedGuidance: '',
  expectedSplit: 'marker',
  expectedFallback: false,
  expectedPlaceholders: 0,
}

export const MARKER_TRAILING_WHITESPACE: LetterFixture = {
  id: 'marker-trailing-whitespace',
  purpose: '§2: the marker matches after trimming TRAILING whitespace only.',
  format: 'marker-v1',
  content: lines('Letter line.', `${GUIDANCE_MARKER}  \t`, 'Guidance line.'),
  expectedLetter: 'Letter line.',
  expectedGuidance: 'Guidance line.',
  expectedSplit: 'marker',
  expectedFallback: false,
  expectedPlaceholders: 0,
}

export const MARKER_LEADING_SPACE: LetterFixture = {
  id: 'marker-leading-space',
  purpose: '§2: a leading space means the line is not exactly the marker, so there is no marker at all.',
  format: 'marker-v1',
  content: lines('Letter line.', ` ${GUIDANCE_MARKER}`, 'Guidance line.'),
  expectedLetter: lines('Letter line.', ' === NOT PART OF YOUR REQUEST ===', 'Guidance line.'),
  expectedGuidance: null,
  expectedSplit: 'none',
  expectedFallback: false,
  expectedPlaceholders: 0,
}

export const MARKER_INSIDE_LINE: LetterFixture = {
  id: 'marker-inside-line',
  purpose: '§2: the marker string inside a longer line is not a marker line.',
  format: 'marker-v1',
  content: lines('Letter line.', `Note: ${GUIDANCE_MARKER} here.`),
  expectedLetter: lines('Letter line.', 'Note: === NOT PART OF YOUR REQUEST === here.'),
  expectedGuidance: null,
  expectedSplit: 'none',
  expectedFallback: false,
  expectedPlaceholders: 0,
}

export const MARKER_WRONG_CASE: LetterFixture = {
  id: 'marker-wrong-case',
  purpose: '§2: the match is exact, so a lower-case marker is not the marker.',
  format: 'marker-v1',
  content: lines('Letter line.', '=== not part of your request ===', 'Guidance line.'),
  expectedLetter: lines('Letter line.', '=== not part of your request ===', 'Guidance line.'),
  expectedGuidance: null,
  expectedSplit: 'none',
  expectedFallback: false,
  expectedPlaceholders: 0,
}

export const CRLF_MARKER_V1: LetterFixture = {
  id: 'crlf-marker-v1',
  purpose:
    '§1/§2: CRLF is read as LF; the projection uses LF. The trailing CRLF becomes a trailing "\\n" on the guidance.',
  format: 'marker-v1',
  content:
    'Dear FOI Coordinator,\r\n\r\nI request **all** records.\r\n=== NOT PART OF YOUR REQUEST ===\r\nKeep a copy.\r\n',
  expectedLetter: 'Dear FOI Coordinator,\n\nI request all records.',
  expectedGuidance: 'Keep a copy.\n',
  expectedSplit: 'marker',
  expectedFallback: false,
  expectedPlaceholders: 0,
}

export const CRLF_LEGACY: LetterFixture = {
  id: 'crlf-legacy',
  purpose: '§1: CRLF legacy text, projected with LF, trailing newline kept.',
  format: undefined,
  content: '# Records request\r\nBody line with *emphasis*.\r\n',
  expectedLetter: 'Records request\nBody line with emphasis.\n',
  expectedGuidance: null,
  expectedSplit: 'legacy',
  expectedFallback: false,
  expectedPlaceholders: 0,
}

// ---------------------------------------------------------------------------
// §1 projection rules. Legacy format, so nothing is split.
// ---------------------------------------------------------------------------

export const LITERAL_EXAMPLES: LetterFixture = {
  id: 'literal-examples',
  purpose: 'Every literal example §1 names, each on its own line, with its stated projection.',
  format: undefined,
  content: lines(
    '*.pdf and *.txt',
    'src/*/x*',
    '"*literal*"',
    'See s. 75(5)(b) of the Act.',
    'Section 2.1. applies.',
    '[FOI](https://x.ca/a_(b))',
    'https://example.org/a_(b)?q=1',
    'A lone ** here',
    'An unclosed *star here',
    'A backslash \\*stays\\* a backslash.'
  ),
  expectedLetter: lines(
    '*.pdf and *.txt',
    'src/*/x*',
    '"literal"',
    'See s. 75(5)(b) of the Act.',
    'Section 2.1. applies.',
    'FOI (https://x.ca/a_(b))',
    'https://example.org/a_(b)?q=1',
    'A lone ** here',
    'An unclosed *star here',
    'A backslash \\*stays\\* a backslash.'
  ),
  expectedGuidance: null,
  expectedSplit: 'legacy',
  expectedFallback: false,
}

export const BLOCK_CONSTRUCTS: LetterFixture = {
  id: 'block-constructs',
  purpose:
    '§1 headings (1-6 hashes plus one space), rules (--- and *** with surrounding spaces), list items; near-misses stay literal.',
  format: undefined,
  content: lines(
    '# Level one',
    '###### Level six',
    '####### Seven hashes',
    '#No space',
    '---',
    ' ***  ',
    '----',
    '- Item one',
    '-Not an item',
    '3. Third, as written',
    '10. Tenth',
    '1.Not a list'
  ),
  expectedLetter: lines(
    'Level one',
    'Level six',
    '####### Seven hashes',
    '#No space',
    '',
    '',
    '----',
    '• Item one',
    '-Not an item',
    '3. Third, as written',
    '10. Tenth',
    '1.Not a list'
  ),
  expectedGuidance: null,
  expectedSplit: 'legacy',
  expectedFallback: false,
  expectedPlaceholders: 0,
}

export const EMPHASIS_RULES: LetterFixture = {
  id: 'emphasis-rules',
  purpose: '§1 strong/emphasis: every allowed opener and closer, and the near-misses that stay literal.',
  format: undefined,
  content: lines(
    '**Strong** at line start.',
    'A (*parenthesised*) word.',
    "An ['*bracketed*'] word.",
    'Closing before punctuation: *one*, *two*; *three*: *four*! *five*? *six*.',
    'Not closed by a space: *word *',
    'Opener before space: * word*',
    'Digits: *2025* and **42**.',
    'Inner star: *a*b* stays.',
    'Closing followed by a letter: *word*s stays.',
    '## Heading with **strong** text',
    '- Item with *emphasis*'
  ),
  expectedLetter: lines(
    'Strong at line start.',
    'A (parenthesised) word.',
    "An ['bracketed'] word.",
    'Closing before punctuation: one, two; three: four! five? six.',
    'Not closed by a space: *word *',
    'Opener before space: * word*',
    'Digits: 2025 and 42.',
    'Inner star: *a*b* stays.',
    'Closing followed by a letter: *word*s stays.',
    'Heading with strong text',
    '• Item with emphasis'
  ),
  expectedGuidance: null,
  expectedSplit: 'legacy',
  expectedFallback: false,
}

export const LINK_RULES: LetterFixture = {
  id: 'link-rules',
  purpose: '§1 links: balanced parentheses and no spaces in the URL; anything else is literal.',
  format: undefined,
  content: lines(
    'See [the guide](https://example.org/guide) for details.',
    '[Nested](https://example.org/a_(b)_(c))',
    '[Unbalanced](https://example.org/a_(b)',
    '[Has space](https://example.org/a b)',
    'A bare https://example.org/plain stays.'
  ),
  expectedLetter: lines(
    'See the guide (https://example.org/guide) for details.',
    'Nested (https://example.org/a_(b)_(c))',
    '[Unbalanced](https://example.org/a_(b)',
    '[Has space](https://example.org/a b)',
    'A bare https://example.org/plain stays.'
  ),
  expectedGuidance: null,
  expectedSplit: 'legacy',
  expectedFallback: false,
}

export const HOSTILE_INPUT: LetterFixture = {
  id: 'hostile-input',
  purpose:
    'A1 hostile input: markup and a javascript: link. The projection is plain text; renderers must escape it and never emit a link.',
  format: undefined,
  content: lines(
    '<script>alert("x")</script>',
    '[click me](javascript:alert(1))',
    `Tom & Jerry's "quote" <b>bold</b>`
  ),
  expectedLetter: lines(
    '<script>alert("x")</script>',
    'click me (javascript:alert(1))',
    `Tom & Jerry's "quote" <b>bold</b>`
  ),
  expectedGuidance: null,
  expectedSplit: 'legacy',
  expectedFallback: false,
  expectedPlaceholders: 0,
}

// ---------------------------------------------------------------------------
// §1 bounds. Built by repetition; the goldens follow from the rules stated
// beside each one (verbatim on fallback; identity for markup-free text).
// ---------------------------------------------------------------------------

/** Over 200,000 characters: fallback, verbatim, unsplit, even with markup and a marker inside. */
const OVERSIZE_UNIT = `## Heading with **markup**\n${GUIDANCE_MARKER}\n`
const OVERSIZE_CONTENT = OVERSIZE_UNIT.repeat(Math.ceil(250_000 / OVERSIZE_UNIT.length)).slice(0, 250_000)

export const OVERSIZE_FALLBACK: LetterFixture = {
  id: 'oversize-fallback',
  purpose: '§1 bounds: 250,000 characters returns fallback with the whole text verbatim and unsplit.',
  format: 'marker-v1',
  content: OVERSIZE_CONTENT,
  expectedLetter: OVERSIZE_CONTENT,
  expectedGuidance: null,
  expectedFallback: true,
}

/** Exactly 200,000 markup-free characters: NOT over the bound, so parsed normally (projection = content). */
const AT_BOUND_UNIT = 'Plain sentence with no markup at all.\n'
const AT_BOUND_CONTENT = AT_BOUND_UNIT.repeat(Math.ceil(200_000 / AT_BOUND_UNIT.length)).slice(0, 200_000)

export const AT_BOUND: LetterFixture = {
  id: 'at-bound',
  purpose: '§1 bounds: exactly 200,000 characters is not "over", so it is parsed, not a fallback.',
  format: undefined,
  content: AT_BOUND_CONTENT,
  expectedLetter: AT_BOUND_CONTENT,
  expectedGuidance: null,
  expectedSplit: 'legacy',
  expectedFallback: false,
  expectedPlaceholders: 0,
}

// ---------------------------------------------------------------------------
// A4 PDF layout fixtures. Markup-free except where stated, so each letter
// projection is the content itself (§1: everything else is literal).
// ---------------------------------------------------------------------------

const PROSE_PARAGRAPH =
  'I request copies of every record that sets out how the district decided to approve the cutting permit, ' +
  'including the notes, emails and memos that staff exchanged before the decision, and any record of the ' +
  'factors the decision maker weighed. Please include records held by contractors on the ministry\'s behalf.'

const FIFTY_KB_CONTENT = Array.from(
  { length: Math.ceil(50_000 / (PROSE_PARAGRAPH.length + 2)) },
  () => PROSE_PARAGRAPH
).join('\n\n')

export const FIFTY_KB_LETTER: LetterFixture = {
  id: 'fifty-kb',
  purpose: 'A4: a letter of about 50KB of plain paragraphs, for footer-band, page-count and capacity checks.',
  format: undefined,
  content: FIFTY_KB_CONTENT,
  expectedLetter: FIFTY_KB_CONTENT,
  expectedGuidance: null,
  expectedSplit: 'legacy',
  expectedFallback: false,
  expectedPlaceholders: 0,
}

const LONG_TOKEN = '0123456789'.repeat(500)

export const LONG_TOKEN_LETTER: LetterFixture = {
  id: 'long-token',
  purpose: 'A4: one unbroken 5,000-character token that must wrap inside the margins with nothing inserted.',
  format: undefined,
  content: lines('Reference number:', LONG_TOKEN, 'End of reference.'),
  expectedLetter: lines('Reference number:', LONG_TOKEN, 'End of reference.'),
  expectedGuidance: null,
  expectedSplit: 'legacy',
  expectedFallback: false,
  expectedPlaceholders: 0,
}

const LONG_URL = `https://example.org/${'a'.repeat(280)}`

export const LONG_URL_LETTER: LetterFixture = {
  id: 'long-url',
  purpose: 'A4: a bare 300-character URL (verbatim) that must stay inside the margins.',
  format: undefined,
  content: lines('The record is posted at', LONG_URL, 'as of this request.'),
  expectedLetter: lines('The record is posted at', LONG_URL, 'as of this request.'),
  expectedGuidance: null,
  expectedSplit: 'legacy',
  expectedFallback: false,
  expectedPlaceholders: 0,
}

export const WRAPPING_LINK_LETTER: LetterFixture = {
  id: 'wrapping-link',
  purpose: 'A4: a link whose projection wraps over about three lines at the letter measure.',
  format: undefined,
  content:
    'See [the district office page that lists every cutting permit approved in the Cedar Ridge area since 2020](https://example.org/district/cedar-ridge/cutting-permits/approved/2020-to-present/index.html) before you send this.',
  expectedLetter:
    'See the district office page that lists every cutting permit approved in the Cedar Ridge area since 2020 (https://example.org/district/cedar-ridge/cutting-permits/approved/2020-to-present/index.html) before you send this.',
  expectedGuidance: null,
  expectedSplit: 'legacy',
  expectedFallback: false,
}

export const TYPOGRAPHY_LETTER: LetterFixture = {
  id: 'typography',
  purpose: 'A4: accented Latin and typographic punctuation survive unchanged, with no inserted hyphens.',
  format: undefined,
  content: lines(
    'Société de développement de la Baie-Saint-Paul (QA) — « dossier n° 12 » …',
    '‘Single’ and “double” quotes, an en dash 2020–2025, Zoë, Måns, Ægir, façade, naïve.'
  ),
  expectedLetter: lines(
    'Société de développement de la Baie-Saint-Paul (QA) — « dossier n° 12 » …',
    '‘Single’ and “double” quotes, an en dash 2020–2025, Zoë, Måns, Ægir, façade, naïve.'
  ),
  expectedGuidance: null,
  expectedSplit: 'legacy',
  expectedFallback: false,
  expectedPlaceholders: 0,
}

const GUIDANCE_PARAGRAPH =
  'Before you send this, read the letter once more and check that it asks only for records, ' +
  'names the public body you mean, and gives a date range. Keep a dated copy of what you send ' +
  'and note the date you sent it, so you can tell when the reply is due.'

const LONG_GUIDANCE = Array.from({ length: 24 }, () => GUIDANCE_PARAGRAPH).join('\n\n')

export const LONG_GUIDANCE_LETTER: LetterFixture = {
  id: 'long-guidance',
  purpose: 'A4: marker-v1 guidance long enough to span two PDF pages.',
  format: 'marker-v1',
  content: lines('Dear FOI Coordinator,', '', 'I request the 2025 audit.', GUIDANCE_MARKER, LONG_GUIDANCE),
  expectedLetter: lines('Dear FOI Coordinator,', '', 'I request the 2025 audit.'),
  expectedGuidance: LONG_GUIDANCE,
  expectedSplit: 'marker',
  expectedFallback: false,
  expectedPlaceholders: 0,
}

/** Every letter fixture, seeded or not. */
export const LETTER_FIXTURES: readonly LetterFixture[] = [
  ...SEEDED_LETTER_FIXTURES,
  MARKER_FIRST_LINE,
  MARKER_LAST_LINE,
  MARKER_TRAILING_WHITESPACE,
  MARKER_LEADING_SPACE,
  MARKER_INSIDE_LINE,
  MARKER_WRONG_CASE,
  CRLF_MARKER_V1,
  CRLF_LEGACY,
  LITERAL_EXAMPLES,
  BLOCK_CONSTRUCTS,
  EMPHASIS_RULES,
  LINK_RULES,
  HOSTILE_INPUT,
  OVERSIZE_FALLBACK,
  AT_BOUND,
  FIFTY_KB_LETTER,
  LONG_TOKEN_LETTER,
  LONG_URL_LETTER,
  WRAPPING_LINK_LETTER,
  TYPOGRAPHY_LETTER,
  LONG_GUIDANCE_LETTER,
]

/** The non-FIPPA action the seed adds (a public comment). Its print text must not change. */
export const PUBLIC_COMMENT_FIXTURE = {
  id: 'public-comment',
  content: lines(
    '# Comment on the Mill Creek watershed plan',
    '',
    'I live downstream of the Mill Creek intake and I ask council to require a water-quality monitoring plan before any further cutting permits are approved upstream.',
    '',
    '- Monitoring results should be published every quarter.',
    '- The plan should name who is responsible for acting on a bad result.'
  ),
} as const

// ---------------------------------------------------------------------------
// AI stub responses (scripts/qa/ai-stub.ts serves these as the model's text).
// ---------------------------------------------------------------------------

export const AI_STUB_LETTERS = {
  'marker-v1': MARKER_V1_LETTER.content,
  'missing-marker': MISSING_MARKER_LETTER.content,
  'double-marker': AMBIGUOUS_LETTER.content,
} as const

export type AiStubLetterScenario = keyof typeof AI_STUB_LETTERS

/** Served for a Mirror comparison request. Synthetic: names no real jurisdiction's policy. */
export const AI_STUB_MIRROR_TEXT = lines(
  '## Synthetic comparison (QA)',
  '',
  'This is a synthetic Mirror response served by the QA harness AI stub. It is not a real comparison and cites no real jurisdiction.'
)

/** Served for any other model request. */
export const AI_STUB_GENERIC_TEXT = 'Synthetic response from the QA harness AI stub.'

// ---------------------------------------------------------------------------
// Briefings
//
// SEEDED_BRIEFING is user A's completed investigation. It is shaped like the
// briefing prompt's output (src/lib/ai/prompts/briefing-system.ts) and
// carries every parser-debris shape the audit reported, so D2-D4 have real
// states on the harness.
//
// BRIEFING_SHAPE_FIXTURES isolate one shape each. They carry content only:
// the briefing parser's output structure is defined in D2, so D2 writes its
// goldens against these in its own test file.
// ---------------------------------------------------------------------------

export const SEEDED_BRIEFING_CONCERN =
  'Logging was approved above the Mill Creek intake in Victoria, BC, and nobody told residents before the cutblock was approved.'

export const SEEDED_BRIEFING = lines(
  '# Cedar Ridge cutblock approvals above the Mill Creek intake',
  '',
  '## Context',
  '',
  "You're worried that logging approved above the Mill Creek intake could affect the water your community drinks, and that residents weren't told before the cutblock was approved.",
  '',
  '## What Governs This',
  '',
  'The first document is the Primary Authority.',
  '- **Document name:** Forest Stewardship Plan for the Cedar Ridge licence area (QA)',
  "- **What it is:** The licensee's plan setting results and strategies for the area.",
  '- **Why it matters:** It states what the licensee committed to for water quality.',
  '- **How to find it:** [BC forestry pages](https://www2.gov.bc.ca/gov/content/industry/forestry)',
  '- **Access:** Public',
  '',
  '- **Document name:** Cutblock CR-14 silviculture prescription (QA)',
  '- **What it is:** The site-level plan for harvesting and replanting cutblock CR-14.',
  '- **Why it matters:** It would show whether the intake was considered.',
  '- **How to find it:** Ask the district office, or file a request.',
  '- **Access:** FIPPA Required',
  '',
  '### Supporting Documents',
  '',
  '## Key Players',
  '',
  '- **Name:** Synthetic Timber Ltd. (QA)',
  '- **Role:** proponent',
  '- **Why they matter:** It holds the licence and wrote the stewardship plan.',
  '- **Track record:** No public record found for this synthetic company.',
  '',
  '- **Name:** District Manager, Mill Creek Resource District (QA)',
  '- **Role:** decision_maker',
  '- **Why they matter:** Approves cutting permits in the district.',
  '- **Track record:** Not assessed.',
  '',
  '- **Name:** Mill Creek Water Users (QA)',
  '- **Role:** affected',
  '- **Why they matter:** They draw drinking water from the intake below the cutblock.',
  '- **Track record:** See [a local news report](https://example.com/news/mill-creek) (not a government source).',
  '',
  '## What the Public Record Shows',
  '',
  "The plan's water results apply to *community watersheds* only, and Mill Creek isn't listed as one.",
  '',
  '* The approval date is not public.',
  '* The prescription is not public.',
  '',
  'Who benefits is plain enough: the licensee gets the volume, and the cost of any turbidity lands on the water users.',
  '',
  "The outcome of the district's 2024 review is not in the public record.",
  '',
  'Oversight sits with the district manager, who both approves the permit and decides whether the plan was followed.',
  '',
  'What should be public and is not: the prescription, and any hydrology assessment done for CR-14.',
  '',
  'What public documents cannot answer: whether anyone at the district looked at the intake at all.',
  '',
  '## What You Can Do',
  '',
  'Two things you can do this week:',
  '1. File the request below for the CR-14 prescription.',
  '- Ask the water users\' board to write to the district manager.',
  '',
  '---',
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
  '---',
  '',
  'NEXT STEPS: Send the request to the ministry\'s FOI office and note the date you sent it.',
  '',
  '## How Other Places Handle This',
  '',
  '- **Synthetic Town A (QA)** publishes every cutting permit near a drinking-water intake before approval.',
  '  **Outcome:** Reported but unverified in this synthetic fixture.',
  '',
  '- **Synthetic Town B (QA)** requires a hydrology assessment above every intake. The outcome is not documented.',
  '',
  '## Questions Worth Asking',
  '',
  '1. Who decided Mill Creek was not a community watershed, and when?',
  '2. Was a hydrology assessment done for CR-14 before approval?',
  '3. Who would be told if turbidity rose at the intake?',
  '4. Why is the prescription not public when the plan is?',
  '5. What would it take for the district to pause the permit?',
  '',
  '## What This Analysis Cannot See',
  '',
  '- The actual prescription text, which has not been released.',
  '- Any field inspection notes.',
  '',
  '---'
)

export interface BriefingShapeFixture {
  id: string
  shape: string
  content: string
}

export const BRIEFING_SHAPE_FIXTURES: readonly BriefingShapeFixture[] = [
  {
    id: 'role-raw-enum',
    shape: 'A role written as the raw enum value (the source of DECISION_MAKER on screen).',
    content: lines(
      '## Key Players',
      '',
      '- **Name:** District Manager (QA)',
      '- **Role:** decision_maker',
      '',
      '- **Name:** Synthetic Nation (QA)',
      '- **Role:** rights_holder',
      '',
      '- **Name:** Synthetic Timber Ltd. (QA)',
      '- **Role:** proponent'
    ),
  },
  {
    id: 'literal-asterisks',
    shape: 'Asterisk bullets and emphasis inside paragraphs (the source of literal * on screen).',
    content: lines(
      '## What the Public Record Shows',
      '',
      'The plan applies to *community watersheds* only.',
      '',
      '* The approval date is not public.',
      '* The prescription is not public.'
    ),
  },
  {
    id: 'markdown-links',
    shape: 'Markdown links in field values, one government and one not (the source of [t](u) on screen).',
    content: lines(
      '## What Governs This',
      '',
      '- **Document name:** Forest Stewardship Plan (QA)',
      '- **How to find it:** [BC forestry pages](https://www2.gov.bc.ca/gov/content/industry/forestry)',
      '- **Access:** Public',
      '',
      '- **Document name:** Local reporting (QA)',
      '- **How to find it:** [a news report](https://example.com/news/mill-creek)',
      '- **Access:** Public'
    ),
  },
  {
    id: 'empty-heading',
    shape: 'A heading with nothing under it (the source of empty heading cards).',
    content: lines('## What Governs This', '', '### Supporting Documents', '', '## Key Players', '', '- **Name:** Someone (QA)'),
  },
  {
    id: 'outcome-word',
    shape:
      'Comparisons where only one has an explicit **Outcome:** line; the other only uses the word (the source of invented Outcome boxes).',
    content: lines(
      '## How Other Places Handle This',
      '',
      '- **Synthetic Town A (QA)** publishes permits before approval.',
      '  **Outcome:** Reported but unverified.',
      '',
      '- **Synthetic Town B (QA)** requires a hydrology assessment. The outcome is not documented.'
    ),
  },
  {
    id: 'mixed-list-lead-in',
    shape: 'A lead-in line in the same block as a mixed numbered and bulleted list.',
    content: lines(
      '## What You Can Do',
      '',
      'Two things you can do this week:',
      '1. File the request below.',
      "- Ask the water users' board to write to the district manager."
    ),
  },
  {
    id: 'trailing-rule',
    shape: 'A section ending in a stray --- rule.',
    content: lines('## What This Analysis Cannot See', '', '- The prescription text.', '', '---'),
  },
  {
    id: 'name-field',
    shape: 'A **Name:** field label, which the field-label list did not include.',
    content: lines('## Key Players', '', '- **Name:** Mill Creek Water Users (QA)', '- **Role:** affected'),
  },
  {
    id: 'many-paragraphs',
    shape: 'Six plain paragraphs in one section (the every-5th-paragraph callout rule fires on these).',
    content: lines(
      '## What the Public Record Shows',
      '',
      'Paragraph one.',
      '',
      'Paragraph two.',
      '',
      'Paragraph three.',
      '',
      'Paragraph four.',
      '',
      'Paragraph five.',
      '',
      'Paragraph six.'
    ),
  },
]
