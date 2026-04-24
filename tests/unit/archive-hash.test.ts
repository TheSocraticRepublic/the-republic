import { describe, it, expect } from 'vitest'
import { computeContentHash, canonicalize } from '@/lib/archive/hash'

describe('canonicalize', () => {
  it('handles null', () => {
    expect(canonicalize(null)).toBe('null')
  })

  it('handles undefined', () => {
    expect(canonicalize(undefined)).toBe('undefined')
  })

  it('handles strings', () => {
    expect(canonicalize('hello')).toBe('"hello"')
  })

  it('handles numbers', () => {
    expect(canonicalize(42)).toBe('42')
  })

  it('handles booleans', () => {
    expect(canonicalize(true)).toBe('true')
    expect(canonicalize(false)).toBe('false')
  })

  it('handles empty objects', () => {
    expect(canonicalize({})).toBe('{}')
  })

  it('handles empty arrays', () => {
    expect(canonicalize([])).toBe('[]')
  })

  it('sorts object keys alphabetically', () => {
    const unordered = { z: 1, a: 2, m: 3 }
    const ordered = { a: 2, m: 3, z: 1 }
    expect(canonicalize(unordered)).toBe(canonicalize(ordered))
  })

  it('sorts keys regardless of insertion order — { b, a } == { a, b }', () => {
    const ba = { b: 2, a: 1 }
    const ab = { a: 1, b: 2 }
    expect(canonicalize(ba)).toBe(canonicalize(ab))
  })

  it('does not sort array elements', () => {
    const arr1 = [3, 1, 2]
    const arr2 = [1, 2, 3]
    expect(canonicalize(arr1)).not.toBe(canonicalize(arr2))
  })

  it('handles nested objects — sorts keys at all levels', () => {
    const a = { outer: { z: 1, a: 2 }, b: 'x' }
    const b = { b: 'x', outer: { a: 2, z: 1 } }
    expect(canonicalize(a)).toBe(canonicalize(b))
  })

  it('handles arrays of objects — sorts object keys but not array order', () => {
    const input = [{ b: 2, a: 1 }, { d: 4, c: 3 }]
    const expected = '[{"a":1,"b":2},{"c":3,"d":4}]'
    expect(canonicalize(input)).toBe(expected)
  })
})

describe('computeContentHash', () => {
  it('returns a 64-character lowercase hex string (SHA-256)', () => {
    const hash = computeContentHash({ foo: 'bar' })
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic — same input always produces same hash', () => {
    const data = { version: '1.0', investigation: { id: 'abc', concern: 'test' } }
    const h1 = computeContentHash(data)
    const h2 = computeContentHash(data)
    expect(h1).toBe(h2)
  })

  it('is key-order independent — { b, a } produces same hash as { a, b }', () => {
    const ba = { b: 2, a: 1 }
    const ab = { a: 1, b: 2 }
    expect(computeContentHash(ba)).toBe(computeContentHash(ab))
  })

  it('different data produces different hashes', () => {
    const h1 = computeContentHash({ foo: 'bar' })
    const h2 = computeContentHash({ foo: 'baz' })
    expect(h1).not.toBe(h2)
  })

  it('handles nested objects — keys sorted at all levels', () => {
    const a = { outer: { z: 1, a: 2 }, b: 'x' }
    const b = { b: 'x', outer: { a: 2, z: 1 } }
    expect(computeContentHash(a)).toBe(computeContentHash(b))
  })

  it('array element order matters for hash', () => {
    const h1 = computeContentHash([1, 2, 3])
    const h2 = computeContentHash([3, 2, 1])
    expect(h1).not.toBe(h2)
  })

  it('handles null and undefined without throwing', () => {
    expect(() => computeContentHash(null)).not.toThrow()
    expect(() => computeContentHash(undefined)).not.toThrow()
  })
})
