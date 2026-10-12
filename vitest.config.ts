import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    // .tsx tests are included too. The default environment stays `node`; a
    // component test opts into the DOM with a `// @vitest-environment jsdom`
    // pragma on its first line.
    include: ['tests/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // 'server-only' is a Next.js guard that throws in non-Next environments.
      // In unit tests we mock it with an empty module.
      'server-only': path.resolve(__dirname, 'tests/__mocks__/server-only.ts'),
    },
  },
})
