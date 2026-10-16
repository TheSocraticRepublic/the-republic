// @vitest-environment jsdom
/**
 * D1: paper ink shared with the PDF renderer.
 *
 * `src/lib/design/paper-ink.ts` duplicates the `:root` island set of
 * `src/app/globals.css` for react-pdf. That duplication is deliberate and
 * named; this file is the drift test that makes it safe:
 *   - every paper ink equals its CSS variable, read from the COMPILED CSS (what
 *     `@tailwindcss/postcss`, the only plugin in `postcss.config.mjs`, emits;
 *     the browser never reads globals.css as written);
 *   - every text ink clears 4.5:1 on the paper and on the card (and on every
 *     other paper ground);
 *   - marks are not text inks, and are lighter than every text ink (Jen, B1
 *     review C4: a rule must never outweigh the words beside it);
 *   - the PDF's shared colours ARE the paper inks, and the filing still prints
 *     exactly the colours it printed before D1.
 *
 * The briefing is rendered with React's server renderer (the markup Next.js
 * serves before hydration) and read back as a DOM, so the token wiring is
 * checked on the elements a citizen actually sees. What this does not cover:
 * the browser's cascade (whether `var(--color-island-*)` resolves at paint
 * time); the compiled-CSS checks below and the harness walk cover that.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, back: () => {}, prefetch: () => {} }),
  usePathname: () => '/investigate/c0000000-0000-4000-8000-0000000000c1',
  useSearchParams: () => new URLSearchParams(),
}))

import fs from 'fs'
import path from 'path'
import postcss, { type Root, type Rule } from 'postcss'
import tailwind from '@tailwindcss/postcss'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import {
  PAPER_INK,
  PAPER_INK_CSS_VAR,
  PAPER_TEXT_INKS,
  PAPER_MARK_INKS,
  PAPER_GROUNDS,
  type PaperInk,
} from '@/lib/design/paper-ink'
import { colors } from '@/lib/pdf/styles'
import { PDF_PAPER } from '@/lib/pdf/templates/fippa-request'
import { renderLeverPdf } from '@/lib/pdf/render'
import { BriefingView } from '@/components/briefing/briefing-view'
import { PLACEHOLDER_LETTER, BLOCK_CONSTRUCTS } from '../fixtures/letters'
import { drain } from './pdf-text'

const REPO = path.resolve(__dirname, '../..')
const GLOBALS = path.join(REPO, 'src/app/globals.css')
const BRIEFING_SRC = path.join(REPO, 'src/components/briefing/briefing-view.tsx')

/** WCAG 2.x body text minimum (1.4.3). */
const BODY_MIN = 4.5

let compiled: Root

beforeAll(async () => {
  const source = fs.readFileSync(GLOBALS, 'utf8')
  const result = await postcss([tailwind()]).process(source, { from: GLOBALS })
  compiled = postcss.parse(result.css)
}, 60_000)

// ---- compiled CSS readers ---------------------------------------------------

/** Custom properties of the unlayered top-level rules with exactly this selector. */
function scopeVars(selector: string): Map<string, string> {
  const vars = new Map<string, string>()
  compiled.each((node) => {
    if (node.type !== 'rule' || (node as Rule).selector !== selector) return
    ;(node as Rule).walkDecls((d) => {
      if (d.prop.startsWith('--')) vars.set(d.prop, d.value)
    })
  })
  if (vars.size === 0) throw new Error(`no top-level rule for ${selector}`)
  return vars
}

/** `--color-*` declarations Tailwind emitted in its theme layer. */
function themeVars(): Map<string, string> {
  const vars = new Map<string, string>()
  compiled.walkAtRules('layer', (at) => {
    if (at.params !== 'theme') return
    at.walkDecls((d) => {
      if (d.prop.startsWith('--color-')) vars.set(d.prop, d.value)
    })
  })
  return vars
}

// ---- colour maths -----------------------------------------------------------

function parseHex(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) throw new Error(`not a 6-digit hex: ${hex}`)
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((c) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** `fg` at alpha `a` over an opaque `bg` (sRGB, the browser's color-mix with transparent). */
function composite(fg: string, a: number, bg: string): string {
  const [r, g, b] = parseHex(fg)
  const [R, G, B] = parseHex(bg)
  return '#' + [[r, R], [g, G], [b, B]].map(([f, k]) => Math.round(f * a + k * (1 - a)).toString(16).padStart(2, '0')).join('')
}

// ---- the drift test ---------------------------------------------------------

describe('paper ink: TypeScript and CSS are the same values', () => {
  it('every paper ink equals its :root island variable in the compiled CSS', () => {
    const root = scopeVars(':root')
    const keys = Object.keys(PAPER_INK) as PaperInk[]
    expect(keys.length).toBeGreaterThanOrEqual(13)
    const mismatches = keys
      .map((k) => ({ k, css: root.get(PAPER_INK_CSS_VAR[k]), ts: PAPER_INK[k] }))
      .filter(({ css, ts }) => css === undefined || css.toLowerCase() !== ts.toLowerCase())
      .map(({ k, css, ts }) => `${k}: TS ${ts}, CSS ${PAPER_INK_CSS_VAR[k]} ${css ?? '(undeclared)'}`)
    expect(mismatches).toEqual([])
  })

  it('every entry maps to a distinct island variable', () => {
    const names = Object.values(PAPER_INK_CSS_VAR)
    expect(new Set(names).size).toBe(names.length)
    expect(Object.keys(PAPER_INK_CSS_VAR).sort()).toEqual(Object.keys(PAPER_INK).sort())
  })
})

describe('paper ink: text inks clear 4.5:1, marks are lighter than text', () => {
  it('the text inks are exactly text, body, secondary, muted and faint; the mark is not one', () => {
    expect([...PAPER_TEXT_INKS]).toEqual(['text', 'body', 'secondary', 'muted', 'faint'])
    expect([...PAPER_MARK_INKS]).toEqual(['mark'])
    for (const m of PAPER_MARK_INKS) expect(PAPER_TEXT_INKS as readonly string[]).not.toContain(m)
  })

  it('every text ink clears 4.5:1 on the paper and on the card', () => {
    const low: string[] = []
    for (const ink of PAPER_TEXT_INKS)
      for (const ground of ['bg', 'card'] as const) {
        const r = contrast(PAPER_INK[ink], PAPER_INK[ground])
        if (r < BODY_MIN) low.push(`${ink} on ${ground}: ${r.toFixed(2)}`)
      }
    expect(low).toEqual([])
  })

  it('every text ink clears 4.5:1 on every paper ground (white, warm lift, hover too)', () => {
    expect([...PAPER_GROUNDS]).toEqual(['bg', 'card', 'white', 'warmLift', 'hover'])
    const low: string[] = []
    for (const ink of PAPER_TEXT_INKS)
      for (const ground of PAPER_GROUNDS) {
        const r = contrast(PAPER_INK[ink], PAPER_INK[ground])
        if (r < BODY_MIN) low.push(`${ink} on ${ground}: ${r.toFixed(2)}`)
      }
    expect(low).toEqual([])
  })

  it('pins the B1 text values and Jen\'s mark', () => {
    expect(PAPER_INK.muted).toBe('#625c56')
    expect(PAPER_INK.faint).toBe('#6f6963')
    expect(PAPER_INK.mark).toBe('#a8a29e')
  })

  it('the mark is lighter on the paper than every text ink (light and dark island)', () => {
    const lightMark = contrast(PAPER_INK.mark, PAPER_INK.bg)
    for (const ink of PAPER_TEXT_INKS) expect(lightMark, ink).toBeLessThan(contrast(PAPER_INK[ink], PAPER_INK.bg))

    const dark = scopeVars('.dark-island')
    expect(dark.get('--island-mark')).toBe('#71717a')
    const darkBg = dark.get('--island-bg')!
    const darkMark = contrast(dark.get('--island-mark')!, darkBg)
    for (const v of ['--island-text', '--island-secondary', '--island-body', '--island-muted', '--island-faint'])
      expect(darkMark, v).toBeLessThan(contrast(dark.get(v)!, darkBg))
  })

  it('the contrast maths matches the WCAG reference (black on white is 21:1)', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrast('#a8a29e', '#fafaf9')).toBeLessThan(BODY_MIN)
  })
})

describe('island tokens D1 adds, and the dark values the toggle needs', () => {
  const ADDED = [
    'mark',
    'toggle',
    'note',
    'accent-gadfly',
    'accent-scout',
    'role-regulator',
    'role-proponent',
    'role-affected',
    'role-indigenous',
    'role-other',
    'role-regulator-ink',
    'role-proponent-ink',
    'role-affected-ink',
    'role-indigenous-ink',
    'role-other-ink',
    'accent-oracle',
  ] as const

  it('every new token is exposed as --color-island-* through @theme inline', () => {
    const theme = themeVars()
    const missing = ADDED.filter((t) => theme.get(`--color-island-${t}`) !== `var(--island-${t})`)
    expect(missing).toEqual([])
  })

  it(':root keeps the values the briefing painted before D1', () => {
    const root = scopeVars(':root')
    expect(root.get('--island-toggle')).toBe('rgba(0, 0, 0, 0.04)')
    expect(root.get('--island-note')).toBe('rgba(120, 113, 108, 0.04)')
    expect(root.get('--island-accent-gadfly')).toBe('#C8A84B')
    expect(root.get('--island-accent-scout')).toBe('#B088C8')
    expect(root.get('--island-role-regulator')).toBe('#0891B2')
    expect(root.get('--island-role-proponent')).toBe('#B45309')
    expect(root.get('--island-role-affected')).toBe('#059669')
    expect(root.get('--island-role-indigenous')).toBe('#7C3AED')
    expect(root.get('--island-role-other')).toBe('#64748B')
  })

  it('.dark-island holds the dark-toggle values (for D4: the toggle never has to choose in JS)', () => {
    const dark = scopeVars('.dark-island')
    expect(dark.get('--island-toggle')).toBe('rgba(255, 255, 255, 0.08)')
    expect(dark.get('--island-note')).toBe('var(--island-card)')
    expect(dark.get('--island-mark')).toBe('#71717a')
  })

  it('every --color-island-* the briefing references is emitted (the Oracle accent included)', () => {
    const theme = themeVars()
    const src = fs.readFileSync(BRIEFING_SRC, 'utf8')
    const used = [...new Set([...src.matchAll(/var\((--color-island-[a-z-]+)\)/g)].map((m) => m[1]))]
    for (const k of ROLES) {
      expect(used).toContain(`--color-island-role-${k}`)
      expect(used).toContain(`--color-island-role-${k}-ink`)
    }
    expect(used).toContain('--color-island-mark')
    expect(used).toContain('--color-island-accent-oracle')
    expect(used.filter((v) => !theme.has(v))).toEqual([])
  })
})

const ROLES = ['regulator', 'proponent', 'affected', 'indigenous', 'other'] as const

describe('role badges: text ink clears 4.5:1 on its own tint (W1)', () => {
  /** The badge ground: the role colour at 8% (color-mix with transparent) over a paper ground. */
  function tint(role: string, ground: string): string {
    const [r, g, b] = parseHex(role)
    const [R, G, B] = parseHex(ground)
    const mix = (f: number, k: number) => Math.round(f * 0.08 + k * 0.92)
    return '#' + [mix(r, R), mix(g, G), mix(b, B)].map((n) => n.toString(16).padStart(2, '0')).join('')
  }

  it.each(ROLES)('%s: the -ink twin clears 4.5:1 on its tint over the paper and over the card', (k) => {
    const root = scopeVars(':root')
    const fill = root.get(`--island-role-${k}`)!
    const ink = root.get(`--island-role-${k}-ink`)!
    for (const ground of [PAPER_INK.bg, PAPER_INK.card]) {
      const r = contrast(ink, tint(fill, ground))
      expect(r, `${k} ink ${ink} on ${fill} 8% over ${ground}`).toBeGreaterThanOrEqual(BODY_MIN)
    }
  })

  it('the checker sees the old failure: the role colours as text fail on their own tint (3.06 to 4.12)', () => {
    const root = scopeVars(':root')
    const low = ROLES.filter((k) => {
      const fill = root.get(`--island-role-${k}`)!
      return contrast(fill, tint(fill, PAPER_INK.card)) < BODY_MIN
    })
    expect(low).toEqual(['regulator', 'proponent', 'affected', 'other'])
  })
})

describe('the theme doctrine names the mechanism that exists (LIGHT_PALETTE drift)', () => {
  /** The doctrine paragraph: CLAUDE.md's "Theme doctrine" bullet, globals.css's header comment. */
  const claudeDoctrine = () => {
    const md = fs.readFileSync(path.join(REPO, 'CLAUDE.md'), 'utf8')
    const start = md.indexOf('- Theme doctrine:')
    expect(start).toBeGreaterThan(-1)
    return md.slice(start, md.indexOf('\n- ', start + 1))
  }
  const cssHeader = () => {
    const css = fs.readFileSync(GLOBALS, 'utf8')
    return css.slice(0, css.indexOf('*/'))
  }

  it.each([
    ['CLAUDE.md', claudeDoctrine],
    ['globals.css header', cssHeader],
  ])('%s: island tokens and paper-ink.ts, never a palette object', (_name, read) => {
    const text = read()
    expect(text).toContain('Theme doctrine')
    expect(text).toContain('--island-*')
    expect(text).toContain('src/lib/design/paper-ink.ts')
    expect(text).toContain('tests/unit/paper-ink.test.ts')
    expect(text).not.toContain('LIGHT_PALETTE')
  })

  it('the focus-ring comment no longer names DARK_PALETTE', () => {
    const css = fs.readFileSync(GLOBALS, 'utf8')
    const at = css.indexOf('`.content-island` (briefing paper) is not a theme scope')
    expect(at).toBeGreaterThan(-1)
    const para = css.slice(at, css.indexOf('*/', at))
    expect(para).toContain('island tokens')
    expect(para).not.toContain('PALETTE')
  })
})

// ---- the briefing, rendered -------------------------------------------------

const BRIEFING = [
  '# Variance 2025-114',
  '',
  '## Context',
  'Council granted a height variance.',
  '',
  '- First point',
  '- Second point',
  '',
  '## What Governs This',
  '### Zoning Bylaw 2287',
  '- **What it is:** The bylaw that sets the height limit.',
  '- **Access:** Public',
  '',
  '### Official Community Plan',
  '- **What it is:** The plan.',
  '',
  '## Key Players',
  '**City Planning**',
  'Role: Regulator',
  'Why they matter: Recommends.',
  '**Acme Developments**',
  'Role: Proponent',
  '**Lakeside residents**',
  'Role: Affected community',
  '**Sinixt Confederacy**',
  'Role: Indigenous nation',
  '**Transport Canada**',
  'Role: Federal department',
  '',
  '## What the Public Record Shows',
  'The minutes record the vote.',
  '',
  'The staff report is not publicly posted, and its absence matters.',
  '',
  '## What You Can Do',
  'File a request for the staff report.',
  '',
  '---',
  'Dear FOI officer, I request the staff report on variance 2025-114.',
  '---',
  '',
  'Then attend the next meeting.',
  '',
  '## Questions Worth Asking',
  '1. Who wrote the staff report?',
  '2. Why was it not posted?',
  '',
  '## What This Analysis Cannot See',
  'Closed-session deliberations.',
].join('\n')

function renderBriefing(darkMode: boolean): Document {
  const html = renderToStaticMarkup(
    createElement(BriefingView, {
      text: BRIEFING,
      isStreaming: false,
      darkMode,
      onToggleDarkMode: () => {},
      onOpenLens: () => {},
      onOpenCampaign: () => {},
      onOpenGadfly: () => {},
    })
  )
  return new DOMParser().parseFromString(html, 'text/html')
}

/** The raw inline style attribute, as React serialised it. */
const styleOf = (el: Element | null | undefined) => {
  if (!el) throw new Error('element not found')
  return el.getAttribute('style') ?? ''
}

function byText(doc: Document, selector: string, text: string): Element {
  const el = [...doc.querySelectorAll(selector)].find((e) => e.textContent?.trim() === text)
  if (!el) throw new Error(`no ${selector} with text "${text}"`)
  return el
}

const ARMS = ['scout', 'oracle', 'gadfly', 'lever', 'mirror'] as const

describe('Go Deeper cards align their text left, links and buttons alike (Jen D1 C2)', () => {
  it('all six cards, three of them buttons, carry text-left', () => {
    const doc = renderBriefing(false)
    const cards = ['Scout', 'Oracle', 'Gadfly', 'Lever', 'Mirror', 'Lens'].map((arm) => byText(doc, 'span', arm).closest('a, button'))
    expect(cards.map((c) => c?.tagName.toLowerCase())).toEqual(['a', 'a', 'button', 'button', 'a', 'button'])
    for (const c of cards) expect(c!.className.split(/\s+/)).toContain('text-left')
  })
})

describe('arm text on the paper uses the light-ground arm inks (Jen D1 C1)', () => {
  const PAPER_SCOPE = '.content-island:not(.content-island--dark)'

  it('the light paper re-points exactly the five arm inks to the .light-scope values, and nothing else', () => {
    const paper = scopeVars(PAPER_SCOPE)
    const light = scopeVars('.light-scope')
    expect([...paper.keys()].sort()).toEqual(ARMS.map((a) => `--accent-${a}-ink`).sort())
    for (const a of ARMS) expect(paper.get(`--accent-${a}-ink`), a).toBe(light.get(`--accent-${a}-ink`))
  })

  it('every arm ink clears 4.5:1 on paper, card, and its own 10% tint (the chrome accent) over each', () => {
    const paper = scopeVars(PAPER_SCOPE)
    const chrome = scopeVars('.dark')
    const low: string[] = []
    for (const a of ARMS) {
      const ink = paper.get(`--accent-${a}-ink`)!
      const accent = chrome.get(`--accent-${a}`)!
      for (const ground of [PAPER_INK.bg, PAPER_INK.card]) {
        for (const [name, g] of [['plain', ground], ['10% tint', composite(accent, 0.1, ground)]] as const) {
          const r = contrast(ink, g)
          if (r < BODY_MIN) low.push(`${a} ink ${ink} on ${name} over ${ground}: ${r.toFixed(2)}`)
        }
      }
    }
    expect(low).toEqual([])
  })

  it('the checker sees the failure it exists for: the chrome accents as text on paper', () => {
    const chrome = scopeVars('.dark')
    const low = ARMS.filter((a) => contrast(chrome.get(`--accent-${a}`)!, PAPER_INK.bg) < BODY_MIN)
    expect(low).toEqual([...ARMS])
  })

  it('in the rendered briefing, every arm-coloured text run uses an -ink; only icons keep the accent', () => {
    const doc = renderBriefing(false)
    const runs = [...doc.querySelectorAll('[style]')]
      .map((el) => ({ el, color: /(?:^|;)color:(var\(--accent-[a-z]+(?:-ink)?\))/.exec(el.getAttribute('style') ?? '')?.[1] }))
      .filter((r): r is { el: Element; color: string } => r.color !== undefined)
    const text = runs.filter((r) => r.el.tagName.toLowerCase() !== 'svg')
    // Chips, access badge, the What You Can Do and Questions labels, the letter
    // heading, question numbers, Explore with Gadfly, Go Deeper names.
    expect(text.length).toBeGreaterThanOrEqual(15)
    expect(text.filter((r) => !r.color.endsWith('-ink)')).map((r) => `${r.el.textContent?.trim().slice(0, 30)}: ${r.color}`)).toEqual([])
    for (const label of ['What You Can Do', 'Questions Worth Asking']) {
      expect(styleOf(byText(doc, 'h3', label))).toMatch(/color:var\(--accent-(lever|gadfly)-ink\)/)
    }
    expect(styleOf(byText(doc, 'span', 'Public'))).toContain('color:var(--accent-mirror-ink)')
    expect(styleOf(byText(doc, 'span', 'Scout'))).toContain('color:var(--accent-scout-ink)')
    // Icons keep the pale accent: shapes are unchanged.
    expect(runs.some((r) => r.el.tagName.toLowerCase() === 'svg' && !r.color.endsWith('-ink)'))).toBe(true)
  })
})

describe('the briefing paints marks, accents, roles and the toggle from island tokens', () => {
  let light: Document
  let dark: Document
  beforeAll(() => {
    light = renderBriefing(false)
    dark = renderBriefing(true)
  })

  it('list bullets are marks, not faint text', () => {
    const bullets = [...light.querySelectorAll('ul li')]
      .filter((li) => /First point|Second point/.test(li.textContent ?? ''))
      .map((li) => styleOf(li.firstElementChild))
    expect(bullets).toHaveLength(2)
    for (const s of bullets) {
      expect(s).toContain('background-color:var(--color-island-mark)')
      expect(s).not.toContain('--color-island-faint')
    }
  })

  it('Key Areas dots are marks', () => {
    const label = byText(light, 'div', 'Key Areas')
    const dots = [...label.nextElementSibling!.querySelectorAll('li > span:first-child')].map((s) => styleOf(s))
    expect(dots.length).toBeGreaterThan(0)
    for (const s of dots) expect(s).toContain('background-color:var(--color-island-mark)')
  })

  it('the "What This Analysis Cannot See" rule is a mark, on the note token ground, in both modes', () => {
    for (const doc of [light, dark]) {
      const s = styleOf(doc.querySelector('[role="note"]'))
      expect(s).toContain('border-left:3px solid var(--color-island-mark)')
      expect(s).toContain('background-color:var(--color-island-note)')
      expect(s).not.toContain('rgba(')
    }
    // Its label stays text: faint, the B1 text ink.
    const label = [...light.querySelectorAll('[role="note"] div')].find((d) => d.textContent?.includes('What This Analysis Cannot See'))
    expect(styleOf(label)).toContain('color:var(--color-island-faint)')
  })

  it('the insight callout draws gadfly gold from its token at the old 40% rule and 5% wash', () => {
    const p = byText(light, 'p', 'The staff report is not publicly posted, and its absence matters.')
    const s = styleOf(p.parentElement)
    expect(s).toContain('border-left:3px solid color-mix(in srgb, var(--color-island-accent-gadfly) 40%, transparent)')
    expect(s).toContain('background-color:color-mix(in srgb, var(--color-island-accent-gadfly) 5%, transparent)')
    expect(s).not.toContain('rgba(200,168,75')
  })

  it('the primary authority card draws its scout rule from its token at the old 50%', () => {
    const name = byText(light, 'span', 'Zoning Bylaw 2287')
    const card = name.closest('div.rounded-xl')
    const s = styleOf(card)
    expect(s).toContain('border-left:3px solid color-mix(in srgb, var(--color-island-accent-scout) 50%, transparent)')
    expect(s).not.toContain('rgba(176,136,200')
  })

  it.each([
    ['Regulator', 'regulator'],
    ['Proponent', 'proponent'],
    ['Affected community', 'affected'],
    ['Indigenous nation', 'indigenous'],
    ['Federal department', 'other'],
  ])('the %s badge and card rule use --color-island-role-%s', (role, token) => {
    const badge = byText(light, 'span', role)
    const s = styleOf(badge)
    expect(s).toMatch(new RegExp(`(^|;)color:var\\(--color-island-role-${token}-ink\\)`))
    expect(s).toContain(`background-color:color-mix(in srgb, var(--color-island-role-${token}) 8%, transparent)`)
    expect(s).not.toMatch(/#[0-9a-f]{6}/i)
    const card = badge.parentElement!.parentElement!
    expect(styleOf(card)).toContain(`border-left:2px solid var(--color-island-role-${token})`)
  })

  it('the Go Deeper archetype labels are 11px, and no 9px text is left on the paper', () => {
    for (const archetype of ['THE PYTHIA', 'THE GADFLY', 'THE EXAMINER']) {
      const s = styleOf(byText(light, 'span', archetype))
      expect(s).toContain('font-size:11px')
      // Jen D1 C2: the epithet sits under the name, not over it.
      expect(s).toContain('letter-spacing:0.06em')
    }
    expect(light.body.innerHTML).not.toMatch(/font-size:9px/)
  })

  it('the dark toggle paints one token in both modes; the scope, not JS, carries the dark value', () => {
    const lightBtn = light.querySelector('button[aria-label="Switch to dark mode"]')
    const darkBtn = dark.querySelector('button[aria-label="Switch to light mode"]')
    for (const b of [lightBtn, darkBtn]) {
      const s = styleOf(b)
      expect(s).toContain('background-color:var(--color-island-toggle)')
      expect(s).not.toContain('rgba(')
    }
    expect(dark.querySelector('article')!.className).toContain('dark-island')
    expect(light.querySelector('article')!.className).not.toContain('dark-island')
  })

  it('the toggle on the raw streaming paper (before the first section) paints the same token', () => {
    for (const darkMode of [false, true]) {
      const html = renderToStaticMarkup(
        createElement(BriefingView, { text: 'Reading the minutes', isStreaming: true, darkMode, onToggleDarkMode: () => {} })
      )
      const doc = new DOMParser().parseFromString(html, 'text/html')
      expect(doc.body.textContent).toContain('Reading the minutes')
      const s = styleOf(doc.querySelector('article > button'))
      expect(s).toContain('background-color:var(--color-island-toggle)')
      expect(s).not.toContain('rgba(')
    }
  })
})

// ---- the PDF ----------------------------------------------------------------

describe('the PDF draws its shared colours from the paper ink, and the filing prints what it printed', () => {
  it('the PDF paper, text, secondary and border are the paper inks', () => {
    expect(colors.bg).toBe(PAPER_INK.bg)
    expect(colors.text).toBe(PAPER_INK.text)
    expect(colors.textSecondary).toBe(PAPER_INK.secondary)
    expect(colors.border).toBe(PAPER_INK.border)
  })

  it('the print-only inks are untouched (unifying them would change what a filing prints)', () => {
    expect(colors.textMuted).toBe('#57534e')
    expect(colors.muted).toBe('#78716c')
    expect(colors.footerText).toBe('#a8a29e')
  })

  it('the filing keeps its own pure white page and its own rule ink, a literal, not the screen mark', () => {
    expect(PDF_PAPER.ground).toBe('#FFFFFF')
    expect(PDF_PAPER.placeholderInk).toBe('#92400E')
    // The filing's rule is its own constant: a screen-only change to --island-mark must never move a live filing.
    expect(PDF_PAPER.rule).toBe('#A8A29E')
  })

  it('a rendered filing strokes its rule #A8A29E (read from the PDF\'s own stroke operators)', async () => {
    const buf = await drain(
      await renderLeverPdf({
        title: 'QA letter',
        content: BLOCK_CONSTRUCTS.content,
        actionType: 'fippa_request',
        metadata: BLOCK_CONSTRUCTS.format ? { letterFormat: BLOCK_CONSTRUCTS.format } : {},
      })
    )
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise
    const strokes: string[] = []
    for (let n = 1; n <= doc.numPages; n++) {
      const ops = await (await doc.getPage(n)).getOperatorList()
      ops.fnArray.forEach((fn, i) => {
        if (fn === pdfjs.OPS.setStrokeRGBColor) {
          const arg = ops.argsArray[i] as unknown
          strokes.push(typeof arg === 'string' ? arg.toLowerCase() : String((arg as unknown[])[0]).toLowerCase())
        }
      })
    }
    await doc.destroy()
    expect(strokes.length).toBeGreaterThan(0)
    expect([...new Set(strokes)]).toEqual(['#a8a29e'])
  }, 60_000)

  it('the FIPPA PDF fills exactly the colours it filled before D1', async () => {
    const buf = await drain(
      await renderLeverPdf({
        title: 'QA letter',
        content: PLACEHOLDER_LETTER.content,
        actionType: 'fippa_request',
        metadata: PLACEHOLDER_LETTER.format ? { letterFormat: PLACEHOLDER_LETTER.format } : {},
      })
    )
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise
    const fills = new Set<string>()
    for (let n = 1; n <= doc.numPages; n++) {
      const ops = await (await doc.getPage(n)).getOperatorList()
      ops.fnArray.forEach((fn, i) => {
        if (fn === pdfjs.OPS.setFillRGBColor) {
          const arg = ops.argsArray[i] as unknown
          fills.add(typeof arg === 'string' ? arg.toLowerCase() : String((arg as unknown[])[0]).toLowerCase())
        }
      })
    }
    await doc.destroy()
    // ink, guidance section ink, footer muted ink, placeholder ink, page.
    expect([...fills].sort()).toEqual(['#1c1917', '#44403c', '#57534e', '#92400e', '#ffffff'])
  }, 60_000)
})
