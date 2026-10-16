import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import ts from 'typescript'

/*
 * The server/client boundary, swept statically (Razor C2b N5).
 *
 * A server component that imports from a 'use client' module gets client
 * references, never the module's real values. Two ways that breaks silently,
 * both seen in this repo:
 *   1. a server file uses an imported client binding as a VALUE (C2b: the
 *      Investigate page read SECTION_LABEL_CLASS from a client field.tsx and
 *      rendered a function's source as its class);
 *   2. a server file passes a function, or a component that is not itself a
 *      client reference, as a prop to a client component (C2a: an icon
 *      component handed to CrossArmActions).
 * Neither fails the type check, the build or a jsdom test. This sweep does.
 *
 * The server graph is every non-'use client' file under src/app plus every
 * non-client module it imports, transitively. Ported from Razor's two review
 * sweeps (C2a function props, C2b value imports); each has a control below
 * that must be caught.
 */

type Parsed = { sf: ts.SourceFile; dir: 'client' | 'server-actions' | null }
type Imported = { spec: string; r: string | null }

function directive(sf: ts.SourceFile): Parsed['dir'] {
  for (const s of sf.statements) {
    if (ts.isExpressionStatement(s) && ts.isStringLiteral(s.expression)) {
      if (s.expression.text === 'use client') return 'client'
      if (s.expression.text === 'use server') return 'server-actions'
    } else break
  }
  return null
}

/** Sweeps a source tree given as { absolute path: source }. `src` is the
 *  `@/` root; the server graph starts at files under `src/app`. */
export function sweep(src: string, sources: Map<string, string>): string[] {
  const parsed = new Map<string, Parsed>()
  for (const [f, text] of sources) {
    const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    parsed.set(f, { sf, dir: directive(sf) })
  }
  const resolve = (from: string, spec: string): string | null => {
    let base: string
    if (spec.startsWith('@/')) base = path.join(src, spec.slice(2))
    else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec)
    else return null
    for (const c of [base, `${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`]) if (parsed.has(c)) return c
    return null
  }
  const imports = (f: string): Map<string, Imported> => {
    const out = new Map<string, Imported>()
    for (const s of parsed.get(f)!.sf.statements) {
      if (!ts.isImportDeclaration(s) || !s.importClause || s.importClause.isTypeOnly) continue
      const spec = (s.moduleSpecifier as ts.StringLiteral).text
      const r = resolve(f, spec)
      const ic = s.importClause
      if (ic.name) out.set(ic.name.text, { spec, r })
      const nb = ic.namedBindings
      if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) if (!el.isTypeOnly) out.set(el.name.text, { spec, r })
      if (nb && ts.isNamespaceImport(nb)) out.set(nb.name.text, { spec, r })
    }
    return out
  }
  const isClient = (r: string | null) => !!r && parsed.get(r)!.dir === 'client'

  // The server graph.
  const appDir = path.join(src, 'app')
  const server = new Set<string>()
  const queue: string[] = []
  for (const [f, v] of parsed) {
    if (f.startsWith(appDir + path.sep) && v.dir !== 'client' && /\.tsx?$/.test(f)) {
      server.add(f)
      queue.push(f)
    }
  }
  while (queue.length) {
    const f = queue.pop()!
    for (const [, { r }] of imports(f)) {
      if (r && !isClient(r) && !server.has(r)) {
        server.add(r)
        queue.push(r)
      }
    }
  }

  const hits: string[] = []
  const at = (f: string, sf: ts.SourceFile, n: ts.Node) =>
    `${path.relative(path.dirname(src), f)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`

  for (const f of server) {
    const { sf } = parsed.get(f)!
    const imp = imports(f)

    // 1. A client binding used as a value, not as a JSX tag or a type.
    const clientNames = new Map([...imp].filter(([, i]) => isClient(i.r)))
    if (clientNames.size) {
      const visit = (n: ts.Node): void => {
        if (ts.isIdentifier(n) && clientNames.has(n.text)) {
          const p = n.parent
          const isDecl = ts.isImportSpecifier(p) || ts.isImportClause(p) || ts.isNamespaceImport(p)
          const isTag =
            (ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p) || ts.isJsxClosingElement(p)) && p.tagName === n
          const isNsTag =
            ts.isPropertyAccessExpression(p) &&
            p.expression === n &&
            (ts.isJsxOpeningElement(p.parent) || ts.isJsxSelfClosingElement(p.parent) || ts.isJsxClosingElement(p.parent))
          const isTypeRef = ts.isTypeReferenceNode(p) || ts.isTypeQueryNode(p) || ts.isQualifiedName(p)
          const isPropName =
            (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n) || ts.isJsxAttribute(p)
          if (!isDecl && !isTag && !isNsTag && !isTypeRef && !isPropName) {
            hits.push(`${at(f, sf, n)} value use of ${n.text} from ${clientNames.get(n.text)!.spec}`)
          }
        }
        ts.forEachChild(n, visit)
      }
      ts.forEachChild(sf, visit)
    }

    // 2. A function, or a non-client component, passed as a prop to a client component.
    const localFns = new Set<string>()
    const localVars = new Map<string, ts.Expression>()
    const collect = (n: ts.Node): void => {
      if (ts.isFunctionDeclaration(n) && n.name) localFns.add(n.name.text)
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
        if (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer)) localFns.add(n.name.text)
        else localVars.set(n.name.text, n.initializer)
      }
      ts.forEachChild(n, collect)
    }
    ts.forEachChild(sf, collect)
    const seen = new Set<string>()
    const isInlineServerAction = (fn: ts.ArrowFunction | ts.FunctionExpression) => {
      const first = fn.body && ts.isBlock(fn.body) ? fn.body.statements[0] : undefined
      return !!first && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text === 'use server'
    }
    const bad = (e: ts.Expression | undefined): string | null => {
      if (!e) return null
      if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e)) return bad(e.expression)
      if (ts.isArrowFunction(e) || ts.isFunctionExpression(e)) return isInlineServerAction(e) ? null : 'inline function'
      if (ts.isIdentifier(e)) {
        const i = imp.get(e.text)
        if (i) {
          if (i.r && parsed.get(i.r)!.dir === 'server-actions') return null
          if (isClient(i.r)) return null // a client reference crosses the boundary fine
          // PascalCase is a component; an ALL_CAPS constant is a plain value.
          if (i.spec === 'lucide-react' || /^[A-Z][a-z]/.test(e.text)) return `imported ${e.text} from ${i.spec}`
        }
        if (localFns.has(e.text)) return `local function ${e.text}`
        const d = localVars.get(e.text)
        if (d && !seen.has(e.text)) {
          seen.add(e.text)
          const r = bad(d)
          seen.delete(e.text)
          if (r) return `via ${e.text}: ${r}`
        }
        return null
      }
      if (ts.isObjectLiteralExpression(e)) {
        for (const p of e.properties) {
          const r = ts.isPropertyAssignment(p)
            ? bad(p.initializer)
            : ts.isShorthandPropertyAssignment(p)
              ? bad(p.name)
              : ts.isMethodDeclaration(p)
                ? 'method'
                : null
          if (r) return r
        }
        return null
      }
      if (ts.isArrayLiteralExpression(e)) {
        for (const x of e.elements) {
          const r = bad(x)
          if (r) return r
        }
        return null
      }
      if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression) && e.expression.name.text === 'map') {
        const cb = e.arguments[0]
        if (cb && ts.isArrowFunction(cb) && !ts.isBlock(cb.body)) return bad(cb.body)
        return null
      }
      if (ts.isConditionalExpression(e)) return bad(e.whenTrue) || bad(e.whenFalse)
      if (ts.isBinaryExpression(e)) return bad(e.right)
      return null
    }
    const props = (n: ts.Node): void => {
      if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
        const tag = n.tagName.getText(sf)
        const i = imp.get(tag.split('.')[0])
        if (i && isClient(i.r)) {
          for (const a of n.attributes.properties) {
            if (ts.isJsxSpreadAttribute(a)) {
              const r = bad(a.expression)
              if (r) hits.push(`${at(f, sf, a)} <${tag} {...}> ${r}`)
              continue
            }
            if (!ts.isJsxAttribute(a) || !a.initializer || !ts.isJsxExpression(a.initializer)) continue
            const r = bad(a.initializer.expression)
            if (r) hits.push(`${at(f, sf, a)} <${tag} ${a.name.getText(sf)}> ${r}`)
          }
        }
      }
      ts.forEachChild(n, props)
    }
    ts.forEachChild(sf, props)
  }
  return hits
}

function readTree(src: string): Map<string, string> {
  const out = new Map<string, string>()
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(tsx?|jsx?)$/.test(e.name)) out.set(p, fs.readFileSync(p, 'utf8'))
    }
  }
  walk(src)
  return out
}

const SRC = path.resolve(__dirname, '../../src')

describe('the server/client boundary', () => {
  it('no server component reads a value from, or passes a function or component prop to, a client module', () => {
    const tree = readTree(SRC)
    // The sweep sees the real tree: the app's pages and its client modules.
    expect(tree.has(path.join(SRC, 'app/(app)/investigate/page.tsx'))).toBe(true)
    expect([...tree.values()].filter((t) => /^\s*['"]use client['"]/.test(t)).length).toBeGreaterThan(20)
    expect(sweep(SRC, tree)).toEqual([])
  })

  // Controls: each shape the sweep exists for, in a synthetic tree.
  const S = '/fixture/src'
  const client = `'use client'\nexport const LABEL = 'x'\nexport function Panel(props: { icon?: unknown; onPick?: () => void; label?: string }) { return null }\n`
  const tree = (page: string, extra: Record<string, string> = {}) =>
    new Map<string, string>([
      [`${S}/components/panel.tsx`, client],
      [`${S}/components/shared.tsx`, `export const SHARED = 'y'\nexport function Plain() { return null }\n`],
      [`${S}/app/page.tsx`, page],
      ...Object.entries(extra),
    ])

  it('control: a value read from a client module is caught (the C2b field.tsx bug)', () => {
    const hits = sweep(S, tree(`import { LABEL, Panel } from '@/components/panel'\nexport default function P() { return <Panel label={LABEL} /> }\n`))
    expect(hits).toEqual(['src/app/page.tsx:2 value use of LABEL from @/components/panel'])
  })

  it('control: a value read through a non-client module the page imports is caught too', () => {
    const hits = sweep(
      S,
      tree(`import { cls } from '@/lib/cls'\nexport default function P() { return <p className={cls} /> }\n`, {
        [`${S}/lib/cls.ts`]: `import { LABEL } from '@/components/panel'\nexport const cls = LABEL + ' y'\n`,
      })
    )
    expect(hits).toEqual(['src/lib/cls.ts:2 value use of LABEL from @/components/panel'])
  })

  it('control: an inline or local function prop to a client component is caught', () => {
    expect(
      sweep(S, tree(`import { Panel } from '@/components/panel'\nexport default function P() { return <Panel onPick={() => {}} /> }\n`))
    ).toEqual(['src/app/page.tsx:2 <Panel onPick> inline function'])
    expect(
      sweep(S, tree(`import { Panel } from '@/components/panel'\nfunction pick() {}\nexport default function P() { return <Panel onPick={pick} /> }\n`))
    ).toEqual(['src/app/page.tsx:3 <Panel onPick> local function pick'])
  })

  it('control: a component that is not a client reference, passed as a prop, is caught (the C2a icon bug)', () => {
    expect(
      sweep(S, tree(`import { Panel } from '@/components/panel'\nimport { Eye } from 'lucide-react'\nexport default function P() { return <Panel icon={Eye} /> }\n`))
    ).toEqual(['src/app/page.tsx:3 <Panel icon> imported Eye from lucide-react'])
    expect(
      sweep(S, tree(`import { Panel } from '@/components/panel'\nimport { Plain } from '@/components/shared'\nexport default function P() { return <Panel icon={Plain} /> }\n`))
    ).toEqual(['src/app/page.tsx:3 <Panel icon> imported Plain from @/components/shared'])
  })

  it('not caught: client components as tags, plain values from shared modules, rendered elements and server actions', () => {
    const hits = sweep(
      S,
      tree(
        `import { Panel } from '@/components/panel'\nimport { SHARED } from '@/components/shared'\nimport { Eye } from 'lucide-react'\nimport { save } from '@/app/actions'\nexport default function P() { return <Panel label={SHARED} icon={<Eye />} onPick={save} /> }\n`,
        { [`${S}/app/actions.ts`]: `'use server'\nexport async function save() {}\n` }
      )
    )
    expect(hits).toEqual([])
  })
})
