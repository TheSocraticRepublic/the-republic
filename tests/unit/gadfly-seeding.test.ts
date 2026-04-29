import { describe, it, expect } from 'vitest'

function extractDeeperQuestion(text: string): string | null {
  const match = text.match(/## The Deeper Question\s*\n+([\s\S]*?)(?=\n## |$)/)
  const result = match?.[1]?.trim() || null
  if (result?.startsWith('#')) return null
  return result
}

describe('Gadfly seeding — Deeper Question extraction', () => {
  it('extracts question from standard Lens output', () => {
    const text = `## How We Got Here

Some history here.

## Connected Issues

Related issues.

## What the Players Have Done Before

Player history.

## The Deeper Question

Who actually benefits from the framing of this development as inevitable, and what would change if that framing were removed?`

    expect(extractDeeperQuestion(text)).toBe(
      'Who actually benefits from the framing of this development as inevitable, and what would change if that framing were removed?'
    )
  })

  it('returns null when section is absent', () => {
    const text = `## How We Got Here

Some history here.

## Connected Issues

Related issues.`

    expect(extractDeeperQuestion(text)).toBeNull()
  })

  it('extracts multi-line question', () => {
    const text = `## The Deeper Question

If the consultation process is designed to produce consent rather than genuine input,
what would a process designed for honest engagement look like —
and who has the power to demand one?`

    const result = extractDeeperQuestion(text)
    expect(result).toContain('If the consultation process')
    expect(result).toContain('who has the power to demand one?')
  })

  it('stops extraction at the next heading', () => {
    const text = `## The Deeper Question

What is really being decided here?

## Some Other Section

This should not be included.`

    expect(extractDeeperQuestion(text)).toBe('What is really being decided here?')
  })

  it('handles question at end of text with no trailing newline', () => {
    const text = `## The Deeper Question

Is this a decision or a performance of decision-making?`

    expect(extractDeeperQuestion(text)).toBe(
      'Is this a decision or a performance of decision-making?'
    )
  })

  it('returns null for empty section', () => {
    const text = `## The Deeper Question

## Connected Issues

Something else.`

    expect(extractDeeperQuestion(text)).toBeNull()
  })
})
