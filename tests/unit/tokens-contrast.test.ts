/**
 * B1 design-token gate: WCAG contrast for every text token on every surface it
 * sits on, the neutral focus ring, the sans mapping, and the phone field rule.
 *
 * Production path: the browser never reads `src/app/globals.css` as written. It
 * reads what `@tailwindcss/postcss` (the only plugin in `postcss.config.mjs`)
 * compiles it to. So these tests compile the file through that same plugin and
 * read the tokens, the rules and the cascade layers out of the COMPILED CSS.
 * What this does not cover: the browser's own cascade and colour maths, which
 * the route-wide axe sweep and computed-style checks in the final gate do.
 *
 * Scopes tested, and the grounds their text actually sits on:
 *   - `.dark` (the app chrome; `<html class="dark">` always): surface-0..3 and
 *     each `[data-arm]` tint (surface-0 mixed with the arm accent);
 *   - `.dark-island` (Gadfly sheet, dark briefing toggle): surface-0..3 for the
 *     text tokens, and the island grounds for the island text tokens;
 *   - `.light-scope` (landing daylight and return movements): the two journey
 *     grounds those movements paint, `--journey-daylight` and `--journey-paper`.
 * The `:root` light set is not tested: `.dark` sits on the same element and
 * overrides it everywhere, so it never renders.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import postcss, { type Root, type Rule, type AtRule, type Container } from 'postcss'
import tailwind from '@tailwindcss/postcss'

const REPO = path.resolve(__dirname, '../..')
const GLOBALS = path.join(REPO, 'src/app/globals.css')

/** WCAG 2.x minimum for body text (1.4.3) and for a focus indicator (1.4.11). */
const BODY_MIN = 4.5
const NON_TEXT_MIN = 3

let compiled: Root

beforeAll(async () => {
  const source = fs.readFileSync(GLOBALS, 'utf8')
  const result = await postcss([tailwind()]).process(source, { from: GLOBALS })
  compiled = postcss.parse(result.css)
}, 60_000)

// ---- colour maths ---------------------------------------------------------

type RGBA = { r: number; g: number; b: number; a: number }

function parseHex(hex: string): RGBA {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) throw new Error(`not a 6-digit hex colour: ${hex}`)
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 }
}

function luminance({ r, g, b }: RGBA): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrast(fg: RGBA, bg: RGBA): number {
  const a = luminance(fg)
  const b = luminance(bg)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** `color-mix(in srgb, A p%, B q%)` for opaque A and B. */
function mix(a: RGBA, p: number, b: RGBA, q: number): RGBA {
  const t = p / (p + q)
  return { r: a.r * t + b.r * (1 - t), g: a.g * t + b.g * (1 - t), b: a.b * t + b.b * (1 - t), a: 1 }
}

/** Composite a translucent colour over an opaque ground. */
function over(fg: RGBA, bg: RGBA): RGBA {
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  }
}

// ---- reading the compiled CSS ---------------------------------------------

function layerOf(node: { parent?: Container | Root | undefined }): string | null {
  let p = node.parent as (Container & { parent?: Container }) | undefined
  while (p && p.type !== 'root') {
    if (p.type === 'atrule' && (p as AtRule).name === 'layer') return (p as AtRule).params || '(anonymous)'
    p = p.parent as (Container & { parent?: Container }) | undefined
  }
  return null
}

/**
 * Custom properties declared by the unlayered top-level rules with exactly this
 * selector, merged in source order (`:root` has two such rules).
 */
function scopeVars(selector: string): Map<string, string> {
  const vars = new Map<string, string>()
  compiled.each((node) => {
    if (node.type !== 'rule' || (node as Rule).selector !== selector) return
    ;(node as Rule).each((d) => {
      // Tailwind emits a solid fallback before an `@supports (color-mix)` block;
      // only the rule's own declarations are read here, nested blocks below.
      if (d.type === 'decl' && d.prop.startsWith('--')) vars.set(d.prop, d.value)
      if (d.type === 'atrule' && d.name === 'supports') {
        d.walkDecls((nd) => {
          if (nd.prop.startsWith('--')) vars.set(nd.prop, nd.value)
        })
      }
    })
  })
  if (vars.size === 0) throw new Error(`no unlayered top-level rule for ${selector}`)
  return vars
}

function hexVar(vars: Map<string, string>, name: string): RGBA {
  const v = vars.get(name)
  if (v === undefined) throw new Error(`${name} is not declared`)
  return parseHex(v)
}

/** Resolve a scope's `--focus-ring`: `color-mix(in srgb, var(--x) N%, transparent)`. */
function focusRing(vars: Map<string, string>): RGBA {
  const v = vars.get('--focus-ring')
  if (v === undefined) throw new Error('--focus-ring is not declared in this scope')
  const m = /^color-mix\(in srgb, var\((--[a-z0-9-]+)\) (\d+(?:\.\d+)?)%, transparent\)$/.exec(v)
  if (!m) throw new Error(`unexpected --focus-ring form: ${v}`)
  return { ...hexVar(vars, m[1]), a: Number(m[2]) / 100 }
}

/** The arm tint recipe as the compiled `[data-arm]` rule writes it. */
function armTintRecipe(): { surface: number; tint: number } {
  let found: { surface: number; tint: number } | null = null
  compiled.walkRules('[data-arm]', (rule) => {
    rule.walkDecls('background', (d) => {
      const m = /color-mix\(in srgb, var\(--surface-0\) (\d+)%, var\(--arm-tint\) (\d+)%\)/.exec(d.value)
      if (m) found = { surface: Number(m[1]), tint: Number(m[2]) }
    })
  })
  if (!found) throw new Error('[data-arm] tint recipe not found')
  return found
}

const ARMS = ['scout', 'oracle', 'gadfly', 'lever', 'mirror', 'votes'] as const
const SURFACES = ['--surface-0', '--surface-1', '--surface-2', '--surface-3'] as const
const TEXT = ['--text-primary', '--text-secondary', '--text-muted', '--text-faint'] as const
const STATUS = ['--status-success', '--status-danger', '--status-warning', '--status-neutral'] as const
const ISLAND_TEXT = ['--island-text', '--island-secondary', '--island-body', '--island-muted', '--island-faint'] as const
const ISLAND_GROUNDS = ['--island-bg', '--island-card', '--island-white', '--island-warm-lift', '--island-hover'] as const

type Pair = { fg: string; bg: string; ratio: number }

function failures(pairs: Pair[], min: number): string[] {
  return pairs.filter((p) => p.ratio < min).map((p) => `${p.fg} on ${p.bg}: ${p.ratio.toFixed(2)}:1`)
}

// ---- the values the plan pins ---------------------------------------------

describe('B1 token values', () => {
  it('warms the dark surfaces to the landing umber (R4) in .dark and .dark-island', () => {
    for (const scope of ['.dark', '.dark-island']) {
      const v = scopeVars(scope)
      expect([v.get('--surface-0'), v.get('--surface-1'), v.get('--surface-2'), v.get('--surface-3')]).toEqual([
        '#0B0A09',
        '#121110',
        '#1A1816',
        '#292623',
      ])
    }
    // The cave ground the R4 ruling matches.
    expect(scopeVars(':root').get('--journey-cave')).toBe('#0B0A09')
  })

  it('pins the faint text tokens', () => {
    expect(scopeVars('.dark').get('--text-faint')).toBe('#8e8e97')
    expect(scopeVars('.dark-island').get('--text-faint')).toBe('#8e8e97')
    expect(scopeVars('.light-scope').get('--text-faint')).toBe('#6f6963')
  })
})

// ---- contrast ---------------------------------------------------------------

describe('text contrast, .dark (app chrome)', () => {
  it('every text and status token clears 4.5:1 on every surface', () => {
    const v = scopeVars('.dark')
    const pairs: Pair[] = []
    for (const fg of [...TEXT, ...STATUS])
      for (const bg of SURFACES) pairs.push({ fg, bg, ratio: contrast(hexVar(v, fg), hexVar(v, bg)) })
    expect(pairs).toHaveLength(32)
    expect(failures(pairs, BODY_MIN)).toEqual([])
  })

  it('every text and status token clears 4.5:1 on every arm tint', () => {
    const v = scopeVars('.dark')
    const { surface, tint } = armTintRecipe()
    const pairs: Pair[] = []
    for (const arm of ARMS) {
      const ground = mix(hexVar(v, '--surface-0'), surface, hexVar(v, `--accent-${arm}`), tint)
      for (const fg of [...TEXT, ...STATUS]) pairs.push({ fg, bg: `${arm} tint`, ratio: contrast(hexVar(v, fg), ground) })
    }
    expect(pairs).toHaveLength(48)
    expect(failures(pairs, BODY_MIN)).toEqual([])
  })
})

describe('text contrast, .dark-island', () => {
  it('every text and status token clears 4.5:1 on every surface', () => {
    const v = scopeVars('.dark-island')
    const pairs: Pair[] = []
    for (const fg of [...TEXT, ...STATUS])
      for (const bg of SURFACES) pairs.push({ fg, bg, ratio: contrast(hexVar(v, fg), hexVar(v, bg)) })
    expect(failures(pairs, BODY_MIN)).toEqual([])
  })

  it('every island text token clears 4.5:1 on every island ground', () => {
    const v = scopeVars('.dark-island')
    const pairs: Pair[] = []
    for (const fg of ISLAND_TEXT)
      for (const bg of ISLAND_GROUNDS) pairs.push({ fg, bg, ratio: contrast(hexVar(v, fg), hexVar(v, bg)) })
    expect(pairs).toHaveLength(25)
    expect(failures(pairs, BODY_MIN)).toEqual([])
  })
})

describe('text contrast, .light-scope (landing daylight and return)', () => {
  it('every text token clears 4.5:1 on both journey grounds', () => {
    const v = scopeVars('.light-scope')
    const root = scopeVars(':root')
    const grounds = { '--journey-daylight': hexVar(root, '--journey-daylight'), '--journey-paper': hexVar(root, '--journey-paper') }
    const pairs: Pair[] = []
    for (const fg of TEXT)
      for (const [bg, ground] of Object.entries(grounds)) pairs.push({ fg, bg, ratio: contrast(hexVar(v, fg), ground) })
    expect(pairs).toHaveLength(8)
    expect(failures(pairs, BODY_MIN)).toEqual([])
  })
})

describe('the checker itself', () => {
  it('fails a body token below 4.5:1 (the pre-B1 dark --text-faint on the warm S3)', () => {
    const ratio = contrast(parseHex('#83838c'), parseHex('#292623'))
    expect(ratio).toBeLessThan(BODY_MIN)
    expect(failures([{ fg: '--text-faint', bg: '--surface-3', ratio }], BODY_MIN)).toHaveLength(1)
  })

  it('matches the WCAG reference values', () => {
    expect(contrast(parseHex('#000000'), parseHex('#ffffff'))).toBeCloseTo(21, 5)
    expect(contrast(parseHex('#767676'), parseHex('#ffffff'))).toBeCloseTo(4.54, 2)
  })
})

// ---- focus ring -------------------------------------------------------------

describe('focus ring', () => {
  it('the global ring draws from the neutral --focus-ring token, not an arm accent', () => {
    const outlines: string[] = []
    compiled.each((node) => {
      if (node.type === 'rule' && (node as Rule).selector === '*:focus-visible') {
        ;(node as Rule).walkDecls('outline', (d) => {
          outlines.push(d.value)
        })
      }
    })
    expect(outlines).toEqual(['2px solid var(--focus-ring)'])
  })

  it('every theme scope declares a ring that clears 3:1 on each of its grounds', () => {
    const root = scopeVars(':root')
    const grounds: Record<string, RGBA[]> = {
      '.dark': SURFACES.map((s) => hexVar(scopeVars('.dark'), s)),
      '.dark-island': [...SURFACES, ...ISLAND_GROUNDS].map((s) => hexVar(scopeVars('.dark-island'), s)),
      '.light-scope': [hexVar(root, '--journey-daylight'), hexVar(root, '--journey-paper')],
    }
    const low: string[] = []
    for (const [scope, list] of Object.entries(grounds)) {
      const ring = focusRing(scopeVars(scope))
      for (const g of list) {
        const ratio = contrast(over(ring, g), g)
        if (ratio < NON_TEXT_MIN) low.push(`${scope}: ${ratio.toFixed(2)}:1`)
      }
    }
    expect(low).toEqual([])
  })
})

// ---- fonts ------------------------------------------------------------------

describe('fonts', () => {
  it('maps Tailwind sans (preflight and font-sans) to the body face', () => {
    let utility: string | undefined
    let preflightDefault: string | undefined
    compiled.walkRules('.font-sans', (r) => r.walkDecls('font-family', (d) => void (utility = d.value)))
    compiled.walkDecls('--default-font-family', (d) => void (preflightDefault = d.value))
    expect(utility).toBe('var(--font-body)')
    expect(preflightDefault).toBe('var(--font-body)')
  })

  it('emits the family variables that inline styles read', () => {
    const emitted = new Set<string>()
    compiled.walkDecls(/^--font-(body|display|serif)$/, (d) => void emitted.add(d.prop))
    expect([...emitted].sort()).toEqual(['--font-body', '--font-display', '--font-serif'])
  })

  it('briefing view and feedback dialog name no font family by hand', () => {
    const literal = /fontFamily:\s*['"`][^'"`]*(Inter|Plus Jakarta Sans|Source Serif 4|Georgia|system-ui)/
    for (const [file, wants] of [
      ['src/components/briefing/briefing-view.tsx', ['var(--font-body)', 'var(--font-serif)', 'var(--font-display)']],
      ['src/components/layout/feedback-dialog.tsx', ['var(--font-display)']],
    ] as const) {
      const src = fs.readFileSync(path.join(REPO, file), 'utf8')
      for (const w of wants) expect(src).toContain(`fontFamily: '${w}'`)
      expect(src).not.toMatch(literal)
    }
  })
})

// ---- phones: the 16px field rule -------------------------------------------

describe('phone field rule', () => {
  function fieldRules(): { media: AtRule; rule: Rule; size: string | undefined }[] {
    const out: { media: AtRule; rule: Rule; size: string | undefined }[] = []
    compiled.walkAtRules('media', (media) => {
      media.walkRules((rule) => {
        const sel = rule.selectors.map((s) => s.trim())
        if (['input', 'select', 'textarea'].every((t) => sel.includes(t))) {
          let size: string | undefined
          rule.walkDecls('font-size', (d) => void (size = d.value))
          out.push({ media, rule, size })
        }
      })
    })
    return out
  }

  it('sets every input, select and textarea to 16px below 768px', () => {
    const found = fieldRules()
    expect(found).toHaveLength(1)
    expect(found[0].media.params).toBe('(max-width: 767.98px)')
    expect(found[0].size).toBe('16px')
  })

  it('is unlayered, so it beats a layered utility like text-sm', () => {
    const found = fieldRules()
    expect(found).toHaveLength(1)
    expect(layerOf(found[0].media)).toBeNull()
    expect(layerOf(found[0].rule)).toBeNull()
    // The utility it has to beat really is layered (the premise of the rule).
    let textSmLayer: string | null | undefined
    compiled.walkRules('.text-sm', (r) => void (textSmLayer = layerOf(r)))
    expect(textSmLayer).toBe('utilities')
  })

  it('never disables zoom in the viewport', () => {
    const layout = fs.readFileSync(path.join(REPO, 'src/app/layout.tsx'), 'utf8')
    expect(layout).toContain("from 'next/font/google'")
    expect(layout).not.toMatch(/maximum-scale|maximumScale|user-scalable|userScalable/)
  })
})
