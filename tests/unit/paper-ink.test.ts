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
import { PLACEHOLDER_LETTER } from '../fixtures/letters'
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

  it('every --color-island-* the briefing references is emitted, except the one known-missing oracle accent', () => {
    const theme = themeVars()
    const used = [...new Set([...fs.readFileSync(BRIEFING_SRC, 'utf8').matchAll(/var\((--color-island-[a-z-]+)\)/g)].map((m) => m[1]))]
    expect(used).toContain('--color-island-mark')
    // Pre-existing, outside D1's scope: --color-island-accent-oracle was never
    // added to @theme inline, so the Oracle pull-quote rule and callout paint
    // nothing. Reported as deferred; this pin fails if it changes either way.
    expect(used.filter((v) => !theme.has(v))).toEqual(['--color-island-accent-oracle'])
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
    expect(s).toContain(`color:var(--color-island-role-${token})`)
    expect(s).toContain(`background-color:color-mix(in srgb, var(--color-island-role-${token}) 8%, transparent)`)
    expect(s).not.toMatch(/#[0-9a-f]{6}/i)
    const card = badge.parentElement!.parentElement!
    expect(styleOf(card)).toContain(`border-left:2px solid var(--color-island-role-${token})`)
  })

  it('the Go Deeper archetype labels are 11px, and no 9px text is left on the paper', () => {
    for (const archetype of ['THE PYTHIA', 'THE GADFLY', 'THE EXAMINER']) {
      const s = styleOf(byText(light, 'span', archetype))
      expect(s).toContain('font-size:11px')
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

  it('the filing keeps its own pure white page, and its rule is the paper mark', () => {
    expect(PDF_PAPER.ground).toBe('#FFFFFF')
    expect(PDF_PAPER.placeholderInk).toBe('#92400E')
    expect(PDF_PAPER.rule.toLowerCase()).toBe(PAPER_INK.mark)
  })

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
