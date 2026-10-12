import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
// @ts-expect-error -- jsdom ships no types and @types/jsdom is not a dependency; one constructor is used, typed below.
import { JSDOM as UntypedJSDOM } from 'jsdom'
import { LetterPaper } from '@/components/lever/letter-paper'
import { parseLetter } from '@/lib/lever/letter-blocks'
import { LETTER_FIXTURES, LEGACY_LETTER, PLACEHOLDER_LETTER } from '../fixtures/letters'

const JSDOM = UntypedJSDOM as new (html: string) => { window: { document: Document } }

/*
 * The screen letter, rendered to markup with React's own server renderer
 * (what the Lever page sends before hydration), then read with jsdom.
 */
function render(content: string, format: unknown, status: 'draft' | 'final' | 'filed' = 'draft') {
  const html = renderToStaticMarkup(<LetterPaper content={content} letterFormat={format} status={status} />)
  return new JSDOM(`<body>${html}</body>`).window.document
}
const partText = (el: Element | null) =>
  el ? Array.from(el.children).map((c) => c.textContent ?? '').join('\n') : null

describe('LetterPaper', () => {
  it('marks exactly `placeholders` spans, in the letter only, and its text equals the golden (W1)', () => {
    for (const fx of LETTER_FIXTURES) {
      if (fx.content.length > 60_000) continue // jsdom is slow at 200K; the parser test covers those
      const doc = render(fx.content, fx.format)
      const parsed = parseLetter(fx.content, fx.format)
      expect(doc.querySelectorAll('mark').length, fx.id).toBe(parsed.placeholders)
      expect(doc.querySelectorAll('[data-letter-guidance] mark').length, fx.id).toBe(0)
      expect(partText(doc.querySelector('[data-letter-text]')), fx.id).toBe(fx.expectedLetter)
      expect(partText(doc.querySelector('[data-letter-guidance-text]')), fx.id).toBe(fx.expectedGuidance)
    }
  })

  it('the placeholder fixture marks 8 on screen', () => {
    expect(render(PLACEHOLDER_LETTER.content, 'marker-v1').querySelectorAll('mark').length).toBe(8)
  })

  it('words the §2 notice by status, outside the paper', () => {
    const notice = (status: 'draft' | 'final' | 'filed') =>
      render(LEGACY_LETTER.content, undefined, status).querySelector('[data-letter-notice]')!.textContent
    expect(notice('draft')).toBe(
      "This letter may include notes that aren't part of your request. Read it through and remove anything that isn't before you send it."
    )
    expect(notice('final')).toBe(
      "This letter may include notes that aren't part of your request. Export it as plain text and remove anything that isn't part of your request before you send it."
    )
    expect(notice('filed')).toBe("This letter may include notes that weren't part of your request.")
    expect(render(LEGACY_LETTER.content, undefined).querySelector('[data-letter-paper]')!.textContent).not.toContain(
      'may include notes'
    )
  })

  it('a rule is an empty element with a drawn hairline; list items hang', () => {
    const doc = render(LEGACY_LETTER.content, undefined)
    const rule = doc.querySelector('[data-rule]')!
    expect(rule.textContent).toBe('')
    expect(rule.className).toContain('before:border-[#A8A29E]')
    const item = Array.from(doc.querySelectorAll('[data-letter-text] p')).find((p) => p.textContent?.startsWith('1. '))!
    expect((item as HTMLElement).style.paddingLeft).toBe('1.5em')
    expect((item as HTMLElement).style.textIndent).toBe('-1.5em')
  })

  it('paper ink is fixed #1C1917 on #FFFFFF, full-bleed below 640px', () => {
    const paper = render(LEGACY_LETTER.content, undefined).querySelector('[data-letter-paper]') as HTMLElement
    expect(paper.style.color).toBe('rgb(28, 25, 23)')
    expect(paper.style.backgroundColor).toBe('rgb(255, 255, 255)')
    expect(paper.className).toContain('-mx-6 rounded-none')
    expect(paper.className).toContain('sm:rounded-xl')
  })
})
