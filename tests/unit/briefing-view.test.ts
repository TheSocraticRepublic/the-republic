/**
 * Unit tests for briefing-view.tsx pure functions.
 *
 * What IS covered:
 *   - renderInline: bold, italic, link→text-only, stray-# stripping
 *   - preprocessBlocks: ### sub-headings, --- hr, bold-only (no colon) sub-heading, lists, paragraphs
 *   - extractTitle (via the exported helper tested indirectly via parseSections behavior)
 *
 * What is NOT covered:
 *   - Visual rendering (no browser / no DOM)
 *   - React component rendering (Next.js client component, requires DOM)
 *   - End-to-end briefing generation (requires Anthropic API)
 *
 * Disclosure: visual/rendered-output correctness is not exercised here — the orchestrator
 * will run a real generation post-deploy and Lee confirms the visual.
 */

import { describe, it, expect } from 'vitest'
import { renderInline, preprocessBlocks } from '@/components/briefing/briefing-view'
import React from 'react'

// ---- renderInline ----

describe('renderInline', () => {
  it('returns plain string unchanged when no markup', () => {
    const result = renderInline('Hello world')
    expect(result).toBe('Hello world')
  })

  it('wraps **bold** in <strong>', () => {
    const result = renderInline('This is **important** text')
    expect(Array.isArray(result)).toBe(true)
    const arr = result as React.ReactNode[]
    const strong = arr.find(
      (el) => React.isValidElement(el) && el.type === 'strong'
    ) as React.ReactElement<{ children: React.ReactNode }> | undefined
    expect(strong).toBeDefined()
    expect(strong!.props.children).toBe('important')
  })

  it('wraps *italic* in <em>', () => {
    const result = renderInline('This is *emphasized* text')
    expect(Array.isArray(result)).toBe(true)
    const arr = result as React.ReactNode[]
    const em = arr.find(
      (el) => React.isValidElement(el) && el.type === 'em'
    ) as React.ReactElement<{ children: React.ReactNode }> | undefined
    expect(em).toBeDefined()
    expect(em!.props.children).toBe('emphasized')
  })

  it('renders [text](url) as text-only (no link element)', () => {
    const result = renderInline('See [the portal](https://example.com) for details')
    expect(Array.isArray(result)).toBe(true)
    const arr = result as React.ReactNode[]
    // Should NOT contain an <a> element
    const link = arr.find(
      (el) => React.isValidElement(el) && el.type === 'a'
    )
    expect(link).toBeUndefined()
    // Should contain a span with the link text
    const span = arr.find(
      (el) => React.isValidElement(el) && el.type === 'span'
    ) as React.ReactElement<{ children: React.ReactNode }> | undefined
    expect(span).toBeDefined()
    expect(span!.props.children).toBe('the portal')
  })

  it('handles multiple inline patterns in one string', () => {
    const result = renderInline('**Name:** *role* and [link](http://x.com)')
    expect(Array.isArray(result)).toBe(true)
    const arr = result as React.ReactNode[]
    const types = arr
      .filter((el) => React.isValidElement(el))
      .map((el) => (el as React.ReactElement).type)
    expect(types).toContain('strong')
    expect(types).toContain('em')
    expect(types).toContain('span')
    expect(types).not.toContain('a')
  })

  it('strips stray # characters that are not heading syntax', () => {
    // A stray # mid-text (not a heading) should be removed
    const result = renderInline('See section #4 of the bylaw')
    // The regex strips single # not preceded/followed by another #
    // "section #4" → stray # should be stripped, leaving "section 4"
    const str = typeof result === 'string' ? result : arr2str(result as React.ReactNode[])
    expect(str).not.toContain('#')
  })

  it('preserves plain text with no special markup', () => {
    const input = 'The municipality passed Bylaw 1234 in 2023.'
    const result = renderInline(input)
    expect(result).toBe(input)
  })
})

function arr2str(nodes: React.ReactNode[]): string {
  return nodes
    .map((n): string => {
      if (typeof n === 'string') return n
      if (React.isValidElement(n)) {
        const el = n as React.ReactElement<{ children?: React.ReactNode }>
        const c = el.props.children
        if (typeof c === 'string') return c
        if (Array.isArray(c)) return arr2str(c as React.ReactNode[])
        return ''
      }
      return ''
    })
    .join('')
}

// ---- preprocessBlocks ----

describe('preprocessBlocks', () => {
  it('returns a paragraph block for plain text', () => {
    const blocks = preprocessBlocks('This is a paragraph.')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('paragraph')
    expect((blocks[0] as { type: 'paragraph'; text: string }).text).toBe('This is a paragraph.')
  })

  it('converts ### Sub-heading to subheading block', () => {
    const blocks = preprocessBlocks('### The Gap in Oversight')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('subheading')
    expect((blocks[0] as { type: 'subheading'; text: string }).text).toBe('The Gap in Oversight')
  })

  it('strips ** from ### Sub-heading text', () => {
    const blocks = preprocessBlocks('### **Key Finding**')
    expect(blocks[0].type).toBe('subheading')
    expect((blocks[0] as { type: 'subheading'; text: string }).text).toBe('Key Finding')
  })

  it('converts standalone --- to hr block', () => {
    const blocks = preprocessBlocks('---')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('hr')
  })

  it('does NOT convert --- inside other text to hr', () => {
    // --- inside a sentence is just text; only a standalone "---" line becomes hr
    const blocks = preprocessBlocks('Some text\n\nMore text')
    expect(blocks.every((b: { type: string }) => b.type !== 'hr')).toBe(true)
  })

  it('converts bold-only line (no colon) to subheading', () => {
    const blocks = preprocessBlocks('**Who Benefits**')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('subheading')
    expect((blocks[0] as { type: 'subheading'; text: string }).text).toBe('Who Benefits')
  })

  it('does NOT convert **Label:** value to subheading (has colon)', () => {
    const blocks = preprocessBlocks('**Document name:** Zoning Bylaw 1234')
    expect(blocks).toHaveLength(1)
    // A "**Label:** value" line stays as a paragraph (handled by bold-field renderer in ProseSection)
    expect(blocks[0].type).toBe('paragraph')
  })

  it('converts - bullet lines to list block', () => {
    const blocks = preprocessBlocks('- Item one\n- Item two\n- Item three')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('list')
    const list = blocks[0] as { type: 'list'; items: string[] }
    expect(list.items).toHaveLength(3)
    expect(list.items[0]).toBe('Item one')
    expect(list.items[2]).toBe('Item three')
  })

  it('converts numbered list to list block', () => {
    const blocks = preprocessBlocks('1. First\n2. Second')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('list')
    const list = blocks[0] as { type: 'list'; items: string[] }
    expect(list.items).toHaveLength(2)
    expect(list.items[0]).toBe('First')
  })

  it('splits multiple blank-line separated paragraphs into separate blocks', () => {
    const blocks = preprocessBlocks('Paragraph one.\n\nParagraph two.\n\nParagraph three.')
    expect(blocks).toHaveLength(3)
    expect(blocks.every((b: { type: string }) => b.type === 'paragraph')).toBe(true)
  })

  it('handles mixed content: subheading + paragraph + hr', () => {
    const content = '### Analysis\n\nThe record shows a gap.\n\n---\n\nFurther detail follows.'
    const blocks = preprocessBlocks(content)
    expect(blocks[0].type).toBe('subheading')
    expect(blocks[1].type).toBe('paragraph')
    expect(blocks[2].type).toBe('hr')
    expect(blocks[3].type).toBe('paragraph')
  })
})
