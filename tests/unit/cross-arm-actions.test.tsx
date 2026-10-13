// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import fs from 'fs'
import path from 'path'
import { FileText, GitCompare, MessageCircleQuestion } from 'lucide-react'
import { CROSS_ARM_ICONS, CrossArmActions, type CrossArmIcon } from '@/components/ui/cross-arm-actions'

/*
 * CrossArmActions takes a string icon key, never a component: a lucide icon is
 * a forwardRef object React can't serialise from a server component to this
 * client one, which crashed every ready Oracle document page (digest
 * 3702761282). The harness test cross-arm-pages-http.test.ts renders the two
 * server-component callers for real.
 */

const REPO = path.resolve(__dirname, '../..')

afterEach(cleanup)

describe('the icon-key map', () => {
  it('maps each key to its lucide icon', () => {
    expect(CROSS_ARM_ICONS).toEqual({ question: MessageCircleQuestion, compare: GitCompare, document: FileText })
  })

  const CLASSES: Record<CrossArmIcon, string> = {
    question: 'lucide-message-circle-question',
    compare: 'lucide-git-compare',
    document: 'lucide-file-text',
  }
  for (const key of Object.keys(CLASSES) as CrossArmIcon[]) {
    it(`"${key}" renders its icon beside the label`, () => {
      const { container } = render(
        <CrossArmActions actions={[{ label: `Go ${key}`, href: `/x/${key}`, color: 'var(--accent-oracle)', icon: key }]} />,
      )
      const link = container.querySelector('a')!
      expect(link.getAttribute('href')).toBe(`/x/${key}`)
      expect(link.textContent).toBe(`Go ${key}`)
      const svg = link.querySelector('svg')!
      expect(svg.getAttribute('class')).toContain(CLASSES[key])
    })
  }

  it('an action is plain data: it survives a JSON round trip, as it must to cross the server/client boundary', () => {
    const actions = [{ label: 'Compare', href: '/mirror?documentId=d', color: 'var(--accent-mirror)', icon: 'compare' as const }]
    expect(JSON.parse(JSON.stringify(actions))).toEqual(actions)
  })

  it('every caller passes a key, never a component', () => {
    const callers: string[] = []
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) walk(p)
        else if (/\.tsx$/.test(e.name) && !p.endsWith('cross-arm-actions.tsx')) {
          const src = fs.readFileSync(p, 'utf8')
          if (src.includes('<CrossArmActions')) callers.push(path.relative(REPO, p))
        }
      }
    }
    walk(path.join(REPO, 'src'))
    expect(callers.sort()).toEqual([
      'src/app/(app)/lever/[id]/page.tsx',
      'src/app/(app)/oracle/[id]/page.tsx',
      'src/components/campaign/campaign-panel.tsx',
      'src/components/gadfly/gadfly-session.tsx',
      'src/components/mirror/comparison-view.tsx',
    ])
    const bad: string[] = []
    for (const c of callers) {
      const src = fs.readFileSync(path.join(REPO, c), 'utf8')
      const keys = [...src.matchAll(/icon: ([^,\n]+),/g)].map((m) => m[1].trim())
      expect(keys.length, c).toBeGreaterThan(0)
      for (const k of keys) if (!/^'(question|compare|document)'$/.test(k)) bad.push(`${c}: icon: ${k}`)
    }
    expect(bad).toEqual([])
  })
})
