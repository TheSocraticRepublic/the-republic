/**
 * Paper ink: the light reading-surface palette, one set of values for the
 * screen and for react-pdf.
 *
 * THIS IS DUPLICATION WITH A DRIFT TEST, named as such. The screen reads these
 * values from the `:root` island set in `src/app/globals.css` (`--island-*`);
 * CSS can't import TypeScript, and react-pdf can't read a CSS custom property,
 * so the same hexes are written twice. `tests/unit/paper-ink.test.ts` compiles
 * `globals.css` and asserts every entry below equals its CSS variable, and that
 * every text ink clears 4.5:1 on the paper and on the card. Change a value in
 * both places or the test fails.
 *
 * Text inks and marks are separate on purpose (Jen, B1 review C4): a mark
 * (a bullet, a rule) carries no meaning on its own and owes no text contrast,
 * so it gets its own lighter ink instead of borrowing a text token. Never set
 * text in `mark`.
 *
 * Only the light paper lives here. The dark island values are screen-only and
 * stay in `globals.css` (`.dark-island`).
 *
 * Filings are not drawn from this set: the FIPPA PDF keeps its own pure-white
 * page and inks (`PDF_PAPER` in `src/lib/pdf/templates/fippa-request.tsx`;
 * DECISIONS R5: filings on pure white, no branding).
 */
export const PAPER_INK = {
  // Grounds
  bg: '#fafaf9',
  card: '#f5f4f3',
  white: '#ffffff',
  warmLift: '#fffdf8',
  hover: '#eeece8',
  // Text inks, darkest first
  text: '#1c1917',
  body: '#292524',
  secondary: '#44403c',
  muted: '#625c56',
  faint: '#6f6963',
  // Marks: bullets, dots, rules. Never text.
  mark: '#a8a29e',
  // Lines
  border: '#e7e5e4',
  cardBorder: '#e0ddd9',
} as const

export type PaperInk = keyof typeof PAPER_INK

/** The `globals.css` custom property each entry mirrors (`:root` island set). */
export const PAPER_INK_CSS_VAR: Record<PaperInk, `--island-${string}`> = {
  bg: '--island-bg',
  card: '--island-card',
  white: '--island-white',
  warmLift: '--island-warm-lift',
  hover: '--island-hover',
  text: '--island-text',
  body: '--island-body',
  secondary: '--island-secondary',
  muted: '--island-muted',
  faint: '--island-faint',
  mark: '--island-mark',
  border: '--island-border',
  cardBorder: '--island-card-border',
}

/** Inks text is set in: each owes 4.5:1 on every paper ground. */
export const PAPER_TEXT_INKS = ['text', 'body', 'secondary', 'muted', 'faint'] as const satisfies readonly PaperInk[]

/** Inks for marks only (bullets, rules): no text contrast owed. */
export const PAPER_MARK_INKS = ['mark'] as const satisfies readonly PaperInk[]

/** The grounds paper text sits on. */
export const PAPER_GROUNDS = ['bg', 'card', 'white', 'warmLift', 'hover'] as const satisfies readonly PaperInk[]
