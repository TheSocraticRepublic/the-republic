// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

// Proves the tooling later batches depend on: vitest collects `.tsx` tests,
// the per-file jsdom pragma gives them a DOM, and @testing-library/react
// renders a React 19 component into it.

afterEach(cleanup)

function Greeting({ name }: { name: string }) {
  return (
    <section aria-label="greeting">
      <h1>Hello, {name}</h1>
    </section>
  )
}

describe('jsdom component test environment', () => {
  it('provides a DOM through the per-file pragma', () => {
    expect(typeof window).toBe('object')
    expect(navigator.userAgent).toContain('jsdom')
  })

  it('renders a React component with @testing-library/react', () => {
    render(<Greeting name="citizen" />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Hello, citizen')
    expect(screen.getByRole('region', { name: 'greeting' })).toBeTruthy()
  })
})
