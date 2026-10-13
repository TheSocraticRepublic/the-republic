// @vitest-environment jsdom
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
 *     grounds those movements paint, `--journey-daylight` and `--journey-paper`;
 *   - `:root` island set (light paper: briefing, Lens, Campaign, civic strip,
 *     Votes views): the island text tokens on the island grounds. `.dark`
 *     redeclares `--surface-*`, `--text-*` and `--status-*` on the same element,
 *     so the `:root` values of THOSE never render; it never redeclares the
 *     `--island-*` set, so the light island tokens render on every default
 *     (light) paper.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'

// The civic strip (rendered below for its real markup) reaches the app router
// through a child; give it an inert one. Only markup is read, nothing navigates.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, back: () => {}, prefetch: () => {} }),
  usePathname: () => '/investigate/c0000000-0000-4000-8000-0000000000c1',
  useSearchParams: () => new URLSearchParams(),
}))
import fs from 'fs'
import path from 'path'
import postcss, { type Root, type Rule, type AtRule, type Container } from 'postcss'
import tailwind from '@tailwindcss/postcss'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CTAButton, type CTAButtonArm } from '@/components/ui/cta-button'

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

// OKLab / OKLCH (Björn Ottosson's matrices, as CSS Color 4 uses them).
const toLin = (c: number) => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const fromLin = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

type LCH = { L: number; C: number; h: number }

function toOklch({ r, g, b }: RGBA): LCH {
  const [lr, lg, lb] = [toLin(r), toLin(g), toLin(b)]
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { L, C: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 }
}

function fromOklch({ L, C, h }: LCH): RGBA {
  const A = C * Math.cos((h * Math.PI) / 180)
  const B = C * Math.sin((h * Math.PI) / 180)
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  const clamp = (x: number) => Math.min(255, Math.max(0, x))
  return {
    r: clamp(fromLin(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    g: clamp(fromLin(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    b: clamp(fromLin(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
    a: 1,
  }
}

/**
 * `color-mix(in oklch, A p%, B q%)` for opaque A and B: shorter-arc hue, as CSS
 * defaults. `aHueMissing` models what Chromium does when A is a near-neutral
 * colour converted to OKLCH (measured on the harness, Chromium 153: the warm S0
 * at C 0.003): its hue is treated as powerless and B's hue is taken whole.
 */
function mixOklch(a: RGBA, p: number, b: RGBA, q: number, aHueMissing = false): RGBA {
  const t = q / (p + q)
  const x = toOklch(a)
  const y = toOklch(b)
  if (aHueMissing) x.h = y.h
  let dh = y.h - x.h
  if (dh > 180) dh -= 360
  if (dh < -180) dh += 360
  return fromOklch({ L: x.L + (y.L - x.L) * t, C: x.C + (y.C - x.C) * t, h: (x.h + dh * t + 360) % 360 })
}

function mixIn(space: string, a: RGBA, p: number, b: RGBA, q: number, aHueExplicit = false): RGBA {
  if (space === 'srgb') return mix(a, p, b, q)
  if (space === 'oklch') return mixOklch(a, p, b, q, !aHueExplicit)
  throw new Error(`unmodelled color-mix space: ${space}`)
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
function armTintRecipe(): { space: string; surface: number; tint: number; explicit: boolean } {
  let found: { space: string; surface: number; tint: number; explicit: boolean } | null = null
  compiled.walkRules('[data-arm]', (rule) => {
    rule.walkDecls('background', (d) => {
      const m = /color-mix\(in ([a-z]+), (var\(--surface-0\)|oklch\(from var\(--surface-0\) l c h\)) (\d+)%, var\(--arm-tint\) (\d+)%\)/.exec(d.value)
      if (m) found = { space: m[1], explicit: m[2].startsWith('oklch(from'), surface: Number(m[3]), tint: Number(m[4]) }
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
    const { space, surface, tint, explicit } = armTintRecipe()
    const pairs: Pair[] = []
    for (const arm of ARMS) {
      const ground = mixIn(space, hexVar(v, '--surface-0'), surface, hexVar(v, `--accent-${arm}`), tint, explicit)
      for (const fg of [...TEXT, ...STATUS]) pairs.push({ fg, bg: `${arm} tint`, ratio: contrast(hexVar(v, fg), ground) })
    }
    expect(pairs).toHaveLength(48)
    expect(failures(pairs, BODY_MIN)).toEqual([])
  })

  // R4 (Lee): the app's dark surfaces are warm. Warm here means the OKLCH hue of
  // the tinted room sits in 30°-100° (the umber band; S0 itself is ~69°) with
  // chroma >= 0.003, so the hue is not a rounding artefact of a neutral grey.
  it('every arm-tinted room stays warm (OKLCH hue 30-100°, chroma >= 0.003)', () => {
    const v = scopeVars('.dark')
    const { space, surface, tint, explicit } = armTintRecipe()
    const cold: string[] = []
    for (const arm of ARMS) {
      const ground = toOklch(mixIn(space, hexVar(v, '--surface-0'), surface, hexVar(v, `--accent-${arm}`), tint, explicit))
      if (!(ground.h >= 30 && ground.h <= 100 && ground.C >= 0.003)) cold.push(`${arm}: h ${ground.h.toFixed(0)}, C ${ground.C.toFixed(4)}`)
    }
    expect(cold).toEqual([])
  })

  it('an engine without relative colour syntax paints plain S0, declared first and outside the guard', () => {
    // Every [data-arm] background declaration in compiled order, with the @supports conditions around it.
    const decls: { value: string; conds: string[]; layer: string | null }[] = []
    compiled.walkDecls('background', (d) => {
      let owner = d.parent as Container | undefined
      while (owner && owner.type !== 'rule' && owner.type !== 'root') owner = owner.parent as Container | undefined
      if (!owner || owner.type !== 'rule' || (owner as Rule).selector !== '[data-arm]') return
      const conds: string[] = []
      for (let p = d.parent as Container | undefined; p && p.type !== 'root'; p = p.parent as Container | undefined)
        if (p.type === 'atrule' && (p as AtRule).name === 'supports') conds.push((p as AtRule).params)
      decls.push({ value: d.value, conds, layer: layerOf(d) })
    })
    expect(decls.length).toBeGreaterThan(1)
    expect(decls[0]).toEqual({ value: 'var(--surface-0)', conds: [], layer: null })
    // Simulate the engine: it skips any @supports that needs `oklch(from ...)` and drops any
    // declaration whose value uses it. What survives, last wins.
    const survivors = decls.filter((d) => !d.conds.some((c) => c.includes('oklch(from')) && !d.value.includes('oklch(from'))
    expect(survivors.at(-1)?.value).toBe('var(--surface-0)')
    // A supporting engine reaches the mix.
    expect(decls.at(-1)?.value).toContain('color-mix(in oklch, oklch(from var(--surface-0) l c h)')
    expect(decls.at(-1)?.conds.some((c) => c.includes('oklch(from red l c h)'))).toBe(true)
  })

  it('the warmth check sees both failures: the sRGB grey Oracle, and OKLCH with S0 hue left powerless', () => {
    const v = scopeVars('.dark')
    const s0 = hexVar(v, '--surface-0')
    const oracle = toOklch(mix(s0, 96, hexVar(v, '--accent-oracle'), 4))
    expect(oracle.C).toBeLessThan(0.003)
    // Chromium measured Oracle at h 228 and Scout at h 312 for `in oklch, var(--surface-0) ...`.
    expect(toOklch(mixOklch(s0, 96, hexVar(v, '--accent-oracle'), 4, true)).h).toBeGreaterThan(200)
    // With S0's hue explicit, Chromium measured Oracle h 74.8; the model agrees.
    expect(toOklch(mixOklch(s0, 96, hexVar(v, '--accent-oracle'), 4, false)).h).toBeCloseTo(74.8, 0)
    // and the converter round-trips
    const back = fromOklch(toOklch(parseHex('#292623')))
    expect(Math.round(back.r)).toBe(0x29)
    expect(Math.round(back.b)).toBe(0x23)
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

  // Known failure, recorded rather than skipped. Light-scope muted and faint
  // clear 4.5:1 only on the journey grounds above. On the light-scope surface
  // tokens they measure: faint #6f6963 4.34 on S0, 4.00 on S2, 3.63 on S3;
  // muted #6B6560 4.24 on S2, 3.85 on S3. Nothing pairs them today (the light
  // movements paint the journey grounds; Razor's B1 review, N1). `it.fails`
  // keeps this red-if-fixed: when a later batch lifts these tokens this test
  // starts "unexpectedly passing" and must be turned into a plain `it`.
  it.fails('KNOWN FAILURE: muted and faint clear 4.5:1 on light-scope surface-0, -2 and -3', () => {
    const v = scopeVars('.light-scope')
    const pairs: Pair[] = []
    for (const fg of ['--text-muted', '--text-faint'])
      for (const bg of ['--surface-0', '--surface-2', '--surface-3'])
        pairs.push({ fg, bg, ratio: contrast(hexVar(v, fg), hexVar(v, bg)) })
    expect(failures(pairs, BODY_MIN)).toEqual([])
  })

  it('the known light-scope failures are exactly the measured ones, no more', () => {
    const v = scopeVars('.light-scope')
    const pairs: Pair[] = []
    for (const fg of TEXT) for (const bg of SURFACES) pairs.push({ fg, bg, ratio: contrast(hexVar(v, fg), hexVar(v, bg)) })
    expect(failures(pairs, BODY_MIN)).toEqual([
      '--text-muted on --surface-2: 4.24:1',
      '--text-muted on --surface-3: 3.85:1',
      '--text-faint on --surface-0: 4.34:1',
      '--text-faint on --surface-2: 4.00:1',
      '--text-faint on --surface-3: 3.63:1',
    ])
  })
})

describe('text contrast, :root island set (light paper)', () => {
  it('every island text token clears 4.5:1 on every light island ground', () => {
    const v = scopeVars(':root')
    const pairs: Pair[] = []
    for (const fg of ISLAND_TEXT)
      for (const bg of ISLAND_GROUNDS) pairs.push({ fg, bg, ratio: contrast(hexVar(v, fg), hexVar(v, bg)) })
    expect(pairs).toHaveLength(25)
    expect(failures(pairs, BODY_MIN)).toEqual([])
  })

  it('.dark does not redeclare the island set (the premise that makes :root island tokens render)', () => {
    const dark = scopeVars('.dark')
    expect(dark.has('--surface-0')).toBe(true)
    expect([...dark.keys()].filter((k) => k.startsWith('--island-'))).toEqual([])
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

describe('focus ring on island paper (the grounds the ring actually lands on)', () => {
  const PAPER_SELECTORS = [
    '[style*="background-color:var(--color-island-"]',
    '[style*="background-color: var(--color-island-"]',
    '[style*="background:var(--color-island-"]',
    '[style*="background: var(--color-island-"]',
    '[class*="bg-island-"]',
  ]

  /** Declarations of one compiled rule, `@supports` blocks included (they come last and win). */
  function ruleVars(rule: Rule): Map<string, string> {
    const vars = new Map<string, string>()
    rule.each((d) => {
      if (d.type === 'decl') vars.set(d.prop, d.value)
      if (d.type === 'atrule' && d.name === 'supports') d.walkDecls((nd) => void vars.set(nd.prop, nd.value))
    })
    return vars
  }

  function topRules(): Rule[] {
    const out: Rule[] = []
    compiled.each((n) => void (n.type === 'rule' && out.push(n as Rule)))
    return out
  }

  function paperRule(): Rule {
    const hits = topRules().filter((r) => PAPER_SELECTORS.every((s) => r.selector.includes(s)))
    expect(hits).toHaveLength(1)
    return hits[0]
  }

  /**
   * `color-mix(in srgb, var(--x) N%, transparent)` as an element inside `scopes` sees it.
   * `--color-island-*` is emitted only at the theme root (`:root` on `<html>`, see the
   * premise test below), where it resolves against the light `:root` island set and
   * is inherited as that value; every other variable resolves in `scopes`.
   */
  function resolveRing(value: string, scopes: Map<string, string>): RGBA {
    const m = /^color-mix\(in srgb, var\((--[a-z0-9-]+)\) (\d+(?:\.\d+)?)%, transparent\)$/.exec(value)
    if (!m) throw new Error(`unexpected ring form: ${value}`)
    const alpha = Number(m[2]) / 100
    if (m[1].startsWith('--color-island-')) return { ...hexVar(themeRoot(), m[1].replace(/^--color-island-/, '--island-')), a: alpha }
    return { ...hexVar(scopes, m[1]), a: alpha }
  }

  /**
   * The variables an element actually sees: `:root` and `.dark` are both on
   * `<html>`, so `.dark` overrides `:root` wherever it redeclares; a
   * `.dark-island` ancestor overrides both.
   */
  function effective(...selectors: string[]): Map<string, string> {
    const out = new Map<string, string>()
    for (const sel of selectors) for (const [k, v] of scopeVars(sel)) out.set(k, v)
    return out
  }
  const LIGHT_PAPER = [':root', '.dark']
  const DARK_PAPER = [':root', '.dark', '.dark-island']
  /** What `--color-island-*` resolves against: the variables on `<html>`. */
  const themeRoot = () => effective(...LIGHT_PAPER)

  function lowOn(ring: RGBA, vars: Map<string, string>, grounds: readonly string[]): string[] {
    return grounds
      .map((g) => ({ g, r: contrast(over(ring, hexVar(vars, g)), hexVar(vars, g)) }))
      .filter((x) => x.r < NON_TEXT_MIN)
      .map((x) => `${x.g}: ${x.r.toFixed(2)}:1`)
  }

  it('the chrome ring is invisible on light paper (why the paper rule exists)', () => {
    const ring = focusRing(scopeVars('.dark'))
    const paper = hexVar(scopeVars(':root'), '--island-bg')
    expect(contrast(over(ring, paper), paper)).toBeLessThan(1.1)
  })

  it('premise: --color-island-* is declared only at the theme root, never by a theme scope', () => {
    const atRoot: string[] = []
    compiled.walkDecls('--color-island-text', (d) => void atRoot.push(`${layerOf(d)}:${d.value}`))
    expect(atRoot).toEqual(['theme:var(--island-text)'])
    for (const scope of [':root', '.dark', '.dark-island', '.light-scope'])
      expect([...scopeVars(scope).keys()].filter((k) => k.startsWith('--color-island-'))).toEqual([])
  })

  it('paper re-points the ring through its own ground chain: >= 3:1 inside the chrome and inside .dark-island', () => {
    const value = ruleVars(paperRule()).get('--focus-ring')
    expect(value).toBeDefined()
    // Inline grounds are `var(--color-island-*)`, so they paint the theme-root island set in both contexts.
    for (const ctx of [LIGHT_PAPER, DARK_PAPER]) {
      expect(lowOn(resolveRing(value as string, effective(...ctx)), themeRoot(), ISLAND_GROUNDS)).toEqual([])
    }
  })

  it('the paper rule is unlayered and comes after .dark-island, so it wins on an element that is both', () => {
    const rules = topRules()
    const paper = paperRule()
    expect(layerOf(paper)).toBeNull()
    const lastIsland = rules.map((r, i) => (r.selector === '.dark-island' ? i : -1)).reduce((a, b) => Math.max(a, b), -1)
    expect(lastIsland).toBeGreaterThanOrEqual(0)
    expect(rules.indexOf(paper)).toBeGreaterThan(lastIsland)
  })

  it('the paper rule reaches what is INSIDE a paper, in every inline-style spelling, never the paper itself', () => {
    const sel = paperRule().selector
    expect(sel.replace(/\s+/g, ' ')).toMatch(/\) \*$/)
    const inside = (paper: HTMLElement) => {
      const b = document.createElement('button')
      paper.appendChild(b)
      return b
    }
    // Server render: React writes `background-color:var(...)`.
    const host = document.createElement('div')
    host.innerHTML = renderToStaticMarkup(
      createElement('div', { id: 'ssr', style: { backgroundColor: 'var(--color-island-bg)' } }, createElement('button', null, 'x'))
    )
    const ssr = host.querySelector('#ssr') as HTMLElement
    expect(ssr.getAttribute('style')).toBe('background-color:var(--color-island-bg)')
    expect((ssr.querySelector('button') as HTMLElement).matches(sel)).toBe(true)
    expect(ssr.matches(sel)).toBe(false)
    // Client: the CSSOM (React's client renderer, hover handlers) writes `background-color: var(...)`.
    const client = document.createElement('div')
    client.style.backgroundColor = 'var(--color-island-hover)'
    expect(client.getAttribute('style')).toContain('background-color: var(--color-island-hover)')
    expect(inside(client).matches(sel)).toBe(true)
    expect(client.matches(sel)).toBe(false)
    const shorthand = document.createElement('div')
    shorthand.setAttribute('style', 'background: var(--color-island-card)')
    expect(inside(shorthand).matches(sel)).toBe(true)
    const utility = document.createElement('header')
    utility.className = 'bg-island-bg/80 backdrop-blur-md'
    expect(inside(utility).matches(sel)).toBe(true)
    expect(utility.matches(sel)).toBe(false)
    // Chrome grounds and island borders do not re-point the ring.
    const chrome = document.createElement('div')
    chrome.setAttribute('style', 'background-color: var(--surface-1); border: 1px solid var(--color-island-border)')
    chrome.className = 'bg-surface-1'
    expect(inside(chrome).matches(sel)).toBe(false)
  })

  /**
   * The ring a focused element gets, and the ground its outline is painted on.
   * The outline sits OUTSIDE the element's box, so its ground is the nearest
   * ANCESTOR's paint, never the element's own background.
   */
  function ringAndGround(el: HTMLElement): { ring: RGBA; ground: RGBA; where: string } {
    const chrome = scopeVars('.dark')
    const islandValue = ruleVars(paperRule()).get('--focus-ring') as string
    const ring = el.matches(paperRule().selector)
      ? resolveRing(islandValue, effective(...LIGHT_PAPER))
      : focusRing(chrome)
    let ground = hexVar(chrome, '--surface-0')
    let where = 'page S0'
    for (let a = el.parentElement; a; a = a.parentElement) {
      const m = /background(?:-color)?:\s*var\(--color-island-([a-z-]+)\)/.exec(a.getAttribute('style') ?? '')
      if (m) {
        ground = hexVar(themeRoot(), `--island-${m[1]}`)
        where = `--island-${m[1]}`
        break
      }
    }
    return { ring, ground, where }
  }

  async function renderStrip(expanded: string | null): Promise<HTMLElement> {
    const { CivicContextStrip } = await import('@/components/investigation/civic-context-strip')
    const page = document.createElement('main')
    page.innerHTML = renderToStaticMarkup(
      createElement(CivicContextStrip, {
        investigationId: 'c0000000-0000-4000-8000-0000000000c1',
        isAuthor: true,
        archiveStatus: null,
        expanded: expanded as never,
        onExpand: () => {},
      })
    )
    return page
  }

  it('civic strip cards (the paper IS the button) keep a ring >= 3:1 on the dark page: rest, hover, expanded', async () => {
    const rows: string[] = []
    const low: string[] = []
    const collapsed = await renderStrip(null)
    const cards = [...collapsed.querySelectorAll('button')].filter((b) => /--color-island-bg/.test(b.getAttribute('style') ?? ''))
    expect(cards.length).toBe(4)
    for (const card of cards) {
      const { ring, ground, where } = ringAndGround(card)
      const r = contrast(over(ring, ground), ground)
      rows.push(`rest ${where} ${r.toFixed(2)}`)
      if (r < NON_TEXT_MIN) low.push(`rest: ${r.toFixed(2)}:1`)
    }
    // Hover: the handler writes the CSSOM spelling onto the card itself.
    cards[0].style.backgroundColor = 'var(--color-island-hover)'
    {
      const { ring, ground } = ringAndGround(cards[0])
      const r = contrast(over(ring, ground), ground)
      if (r < NON_TEXT_MIN) low.push(`hover: ${r.toFixed(2)}:1`)
    }
    const expanded = await renderStrip('archive')
    const active = [...expanded.querySelectorAll('button')].find((b) => /color-mix\(in srgb/.test(b.getAttribute('style') ?? ''))
    expect(active).toBeDefined()
    {
      const { ring, ground } = ringAndGround(active as HTMLElement)
      const r = contrast(over(ring, ground), ground)
      if (r < NON_TEXT_MIN) low.push(`expanded: ${r.toFixed(2)}:1`)
    }
    expect(rows).toHaveLength(4)
    expect(low).toEqual([])
  })

  it('controls inside a paper keep the ink ring at about 6.3:1 on that paper', () => {
    for (const g of ISLAND_GROUNDS.filter((x) => x !== '--island-hover')) {
      const paper = document.createElement('div')
      paper.setAttribute('style', `background-color: var(--color-${g.slice(2)})`)
      const btn = document.createElement('button')
      paper.appendChild(btn)
      const { ring, ground, where } = ringAndGround(btn)
      expect(where).toBe(g)
      expect(contrast(over(ring, ground), ground)).toBeGreaterThan(6)
    }
  })

  it('every inline island ground in src is written as a bare var(), so the selector sees it', () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) walk(p)
        else if (/\.tsx$/.test(e.name)) files.push(p)
      }
    }
    walk(path.join(REPO, 'src'))
    const ground = /--color-island-(bg|card|white|warm-lift|hover|veil)(?![a-z-])/
    const offenders: string[] = []
    let seen = 0
    for (const f of files) {
      fs.readFileSync(f, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          const m = /\bbackground(?:Color)?\s*[:=]\s*(.*)$/.exec(line)
          if (!m || !ground.test(m[1])) return
          for (const q of m[1].match(/(['"`])(?:(?!\1).)*\1/g) ?? []) {
            if (!ground.test(q)) continue
            seen++
            if (!/^(['"`])var\(--color-island-[a-z-]+\)\1$/.test(q)) offenders.push(`${path.relative(REPO, f)}:${i + 1} ${q}`)
          }
        })
    }
    expect(seen).toBeGreaterThan(10)
    expect(offenders).toEqual([])
  })

  it('the briefing paper keeps its own ink ring, >= 3:1 on every light island ground', () => {
    const hits = topRules().filter((r) => r.selector === '.content-island:not(.content-island--dark) *:focus-visible')
    expect(hits).toHaveLength(1)
    const value = ruleVars(hits[0]).get('outline-color')
    expect(value).toBeDefined()
    expect(lowOn(resolveRing(value as string, themeRoot()), themeRoot(), ISLAND_GROUNDS)).toEqual([])
  })
})

// ---- fonts ------------------------------------------------------------------

describe('CTAButton arm recipe (UI plan C1, Razor b)', () => {
  /*
   * The recipe is read from the component's own markup, rest and busy, and
   * resolved against each scope's compiled tokens, so a change to either the
   * component or the tokens is measured. Hover is the same recipe at the
   * `hover:opacity-90` the component carries, composited over the ground.
   *
   * Allowed grounds, the complete list (anything else is unmeasured):
   *   .dark          surface-0..3 and all six arm rooms;
   *   .dark-island   surface-0..3;
   *   .light-scope   surface-0..3, --journey-daylight and --journey-paper.
   * The ring is the global outline at 2px offset, so it lands on the ground.
   */
  type Style = { fill: RGBA; label: RGBA }

  function armMarkupStyle(arm: CTAButtonArm, busy: boolean): { style: string; className: string } {
    // children travel as createElement's third argument; the cast only
    // satisfies the props type, which declares children as required.
    const props = { variant: 'arm', arm, busy, onClick: () => {} } as unknown as Parameters<typeof CTAButton>[0]
    const html = renderToStaticMarkup(createElement(CTAButton, props, 'Go'))
    const style = /style="([^"]*)"/.exec(html)?.[1] ?? ''
    const className = /class="([^"]*)"/.exec(html)?.[1] ?? ''
    return { style, className }
  }

  function resolveColor(value: string, vars: Map<string, string>): RGBA {
    const plain = /^var\((--[a-z0-9-]+)\)$/.exec(value.trim())
    if (plain) return hexVar(vars, plain[1])
    const mixed = /^color-mix\(in srgb, var\((--[a-z0-9-]+)\) (\d+(?:\.\d+)?)%, transparent\)$/.exec(value.trim())
    if (mixed) return { ...hexVar(vars, mixed[1]), a: Number(mixed[2]) / 100 }
    throw new Error(`unmodelled colour in the arm recipe: ${value}`)
  }

  function recipe(arm: CTAButtonArm, busy: boolean, vars: Map<string, string>): Style {
    const { style } = armMarkupStyle(arm, busy)
    const decls = new Map(
      style.split(';').filter(Boolean).map((d) => {
        const i = d.indexOf(':')
        return [d.slice(0, i).trim(), d.slice(i + 1).trim()] as const
      })
    )
    return { fill: resolveColor(decls.get('background-color') ?? '', vars), label: resolveColor(decls.get('color') ?? '', vars) }
  }

  function groundsFor(scope: '.dark' | '.dark-island' | '.light-scope'): Array<[string, RGBA]> {
    const v = scopeVars(scope)
    const list: Array<[string, RGBA]> = SURFACES.map((s) => [s, hexVar(v, s)])
    if (scope === '.dark') {
      const { space, surface, tint, explicit } = armTintRecipe()
      for (const room of ARMS)
        list.push([`${room} room`, mixIn(space, hexVar(v, '--surface-0'), surface, hexVar(v, `--accent-${room}`), tint, explicit)])
    }
    if (scope === '.light-scope') {
      const root = scopeVars(':root')
      list.push(['--journey-daylight', hexVar(root, '--journey-daylight')], ['--journey-paper', hexVar(root, '--journey-paper')])
    }
    return list
  }

  const HOVER_OPACITY = 0.9

  function measure(scope: '.dark' | '.dark-island' | '.light-scope', labelOverride?: (arm: CTAButtonArm) => string): Pair[] {
    const v = scopeVars(scope)
    const pairs: Pair[] = []
    for (const arm of ARMS) {
      for (const busy of [false, true]) {
        const r = recipe(arm, busy, v)
        const label = labelOverride ? hexVar(v, labelOverride(arm)) : r.label
        for (const [name, ground] of groundsFor(scope)) {
          const fill = over(r.fill, ground)
          const state = busy ? 'busy' : 'rest'
          pairs.push({ fg: `${scope} ${arm} ${state}`, bg: name, ratio: contrast(over(label, fill), fill) })
          if (!busy) {
            const hoverFill = over({ ...fill, a: HOVER_OPACITY }, ground)
            const hoverLabel = over({ ...over(label, fill), a: HOVER_OPACITY }, ground)
            pairs.push({ fg: `${scope} ${arm} hover`, bg: name, ratio: contrast(hoverLabel, hoverFill) })
          }
        }
      }
    }
    return pairs
  }

  it('the label is the arm ink token, the fill and border the accent, at rest and busy', () => {
    for (const arm of ARMS)
      for (const busy of [false, true]) {
        const { style, className } = armMarkupStyle(arm, busy)
        expect(style).toContain(`color:var(--accent-${arm}-ink)`)
        expect(style).toContain(`background-color:color-mix(in srgb, var(--accent-${arm}) 15%, transparent)`)
        if (!busy) expect(className.split(/\s+/)).toContain('hover:opacity-90')
      }
  })

  it.each(['.dark', '.dark-island', '.light-scope'] as const)(
    '%s: every arm label clears 4.5:1 at rest, hover and busy on every allowed ground',
    (scope) => {
      const pairs = measure(scope)
      const grounds = groundsFor(scope).length
      expect(pairs).toHaveLength(ARMS.length * grounds * 3)
      expect(failures(pairs, BODY_MIN)).toEqual([])
    }
  )

  it.each(['.dark', '.dark-island', '.light-scope'] as const)('%s: the focus ring clears 3:1 on every allowed ground', (scope) => {
    const ring = focusRing(scopeVars(scope))
    const low = groundsFor(scope)
      .map(([name, g]) => ({ name, ratio: contrast(over(ring, g), g) }))
      .filter((x) => x.ratio < NON_TEXT_MIN)
      .map((x) => `${scope} ${x.name}: ${x.ratio.toFixed(2)}:1`)
    expect(low).toEqual([])
  })

  it('the inks are declared in every scope; :root matches .light-scope and .dark-island matches .dark', () => {
    for (const arm of ARMS) {
      const name = `--accent-${arm}-ink`
      expect(scopeVars(':root').get(name)).toBe(scopeVars('.light-scope').get(name))
      expect(scopeVars('.dark-island').get(name)).toBe(scopeVars('.dark').get(name))
      expect(scopeVars('.dark').get(name)).toMatch(/^#[0-9A-F]{6}$/i)
      expect(scopeVars('.light-scope').get(name)).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })

  it('each ink keeps its accent hue (OKLCH, within 3 degrees)', () => {
    for (const scope of ['.dark', '.light-scope'] as const) {
      const v = scopeVars(scope)
      for (const arm of ARMS) {
        const a = toOklch(hexVar(v, `--accent-${arm}`)).h
        const i = toOklch(hexVar(v, `--accent-${arm}-ink`)).h
        const d = Math.abs(((a - i + 540) % 360) - 180)
        expect(d, `${scope} ${arm}`).toBeLessThan(3)
      }
    }
  })

  it('the checker itself: the raw accent as label fails (why the ink exists)', () => {
    expect(failures(measure('.light-scope', (arm) => `--accent-${arm}`), BODY_MIN).length).toBeGreaterThan(0)
    expect(failures(measure('.dark', (arm) => `--accent-${arm}`), BODY_MIN).length).toBeGreaterThan(0)
  })
})

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
    // A quoted string value (any quote style) that names a family by hand.
    const literal = /fontFamily:\s*(['"`])(?:(?!\1)[^\n])*?(Inter|Plus Jakarta Sans|Source Serif 4|Georgia|system-ui)/
    // The pattern really catches the literals B1 removed.
    expect(`fontFamily: '"Source Serif 4", Georgia, serif',`).toMatch(literal)
    expect(`fontFamily: '"Inter", system-ui, sans-serif',`).toMatch(literal)
    expect(`fontFamily: "'Plus Jakarta Sans', system-ui"`).toMatch(literal)
    expect(`fontFamily: 'var(--font-serif)',`).not.toMatch(literal)
    for (const [file, wants] of [
      ['src/components/briefing/briefing-view.tsx', ['var(--font-body)', 'var(--font-serif)', 'var(--font-display)']],
      ['src/components/layout/feedback-dialog.tsx', []],
    ] as const) {
      const src = fs.readFileSync(path.join(REPO, file), 'utf8')
      for (const w of wants) expect(src).toContain(`fontFamily: '${w}'`)
      expect(src).not.toMatch(literal)
    }
  })

  it('every fontFamily site in both files names a family variable the compiled CSS emits', () => {
    const emitted = new Set<string>()
    compiled.walkDecls(/^--font-[a-z-]+$/, (d) => void emitted.add(d.prop))
    const sites: string[] = []
    const unknown: string[] = []
    for (const file of ['src/components/briefing/briefing-view.tsx', 'src/components/layout/feedback-dialog.tsx']) {
      const src = fs.readFileSync(path.join(REPO, file), 'utf8')
      for (const m of src.matchAll(/fontFamily:\s*(['"`])((?:(?!\1).)*)\1/g)) {
        sites.push(m[2])
        const vars = [...m[2].matchAll(/var\((--[a-z0-9-]+)/g)].map((v) => v[1])
        if (vars.length === 0 || vars.some((v) => !emitted.has(v))) unknown.push(`${file}: ${m[2]}`)
      }
    }
    // briefing-view: 2 serif base fonts + 7 body + 2 serif + 1 display (the H1). The dialog: none.
    expect(sites).toHaveLength(12)
    expect(unknown).toEqual([])
  })

  it('Fraunces is the briefing H1 only: the document names and the feedback title use the body face (Jen C2, C3)', () => {
    const bv = fs.readFileSync(path.join(REPO, 'src/components/briefing/briefing-view.tsx'), 'utf8')
    const display = [...bv.matchAll(/fontFamily: 'var\(--font-display\)'/g)]
    expect(display).toHaveLength(1)
    // ...and that one site is the 22px H1.
    expect(bv.slice(display[0].index, (display[0].index as number) + 120)).toContain("fontSize: '22px'")
    // The primary document name: the span rendering {docName} sets no family.
    const docName = bv.indexOf('{docName && (\n            <span')
    expect(docName).toBeGreaterThan(-1)
    const span = bv.slice(docName, bv.indexOf('</span>', docName))
    expect(span).toContain('{docName}')
    expect(span).not.toContain('fontFamily')
    const fd = fs.readFileSync(path.join(REPO, 'src/components/layout/feedback-dialog.tsx'), 'utf8')
    expect(fd).toContain('<Dialog.Title')
    expect(fd).not.toContain('fontFamily')
  })
})

// ---- phones: the 16px field rule -------------------------------------------

describe('phone field rule', () => {
  function fieldRules(): { media: AtRule; rule: Rule; size: string | undefined }[] {
    const out: { media: AtRule; rule: Rule; size: string | undefined }[] = []
    compiled.walkAtRules('media', (media) => {
      media.walkRules((rule) => {
        if (['input', 'select', 'textarea'].every((t) => new RegExp(`\\b${t}\\b`).test(rule.selector))) {
          let size: string | undefined
          rule.walkDecls('font-size', (d) => void (size = d.value))
          out.push({ media, rule, size })
        }
      })
    })
    return out
  }

  it('sets input, select and textarea to 16px below 768px', () => {
    const found = fieldRules()
    expect(found).toHaveLength(1)
    expect(found[0].media.params).toBe('(max-width: 767.98px)')
    expect(found[0].size).toBe('16px')
  })

  /** The `className` string of the element carrying `id="<id>"` in a source file. */
  function classOf(file: string, id: string): string {
    const src = fs.readFileSync(path.join(REPO, file), 'utf8')
    const at = src.indexOf(`id="${id}"`)
    expect(at).toBeGreaterThan(-1)
    const m = /className="([^"]+)"/.exec(src.slice(at, at + 1200))
    expect(m).not.toBeNull()
    return (m as RegExpExecArray)[1]
  }

  it('is a floor: small fields are raised, fields already at 16px or more keep their size', () => {
    const sel = fieldRules()[0].rule.selector
    const make = (tag: string, cls: string) => {
      const el = document.createElement(tag)
      el.className = cls
      return el
    }
    // Raised: the common small utilities and bare fields.
    expect(make('input', 'w-full rounded-lg text-sm').matches(sel)).toBe(true)
    expect(make('textarea', 'text-xs').matches(sel)).toBe(true)
    expect(make('select', '').matches(sel)).toBe(true)
    expect(make('input', 'text-sm md:text-lg').matches(sel)).toBe(true)
    // Left alone: the two real 18px fields, read from their components.
    const code = classOf('src/app/(auth)/login/page.tsx', 'code')
    const postal = classOf('src/components/votes/postal-code-form.tsx', 'postal-code')
    expect(code).toContain('text-lg')
    expect(postal).toContain('text-lg')
    expect(make('input', code).matches(sel)).toBe(false)
    expect(make('input', postal).matches(sel)).toBe(false)
    for (const size of ['text-base', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl'])
      expect(make('input', `w-full ${size}`).matches(sel)).toBe(false)
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
