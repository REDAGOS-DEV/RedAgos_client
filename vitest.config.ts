import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Unit tests for the logic that decides where users go and what they may see.
 *
 * Deliberately narrow, and deliberately *not* running the Nuxt test
 * environment. Everything covered here is a pure function or a plain class;
 * booting a Nuxt runtime for it costs ~25s per run and buys nothing, which is
 * the difference between a suite people run and one they skip. Nuxt
 * auto-imports these files rely on are stubbed per-spec instead.
 *
 * Scope is the pieces where a wrong answer sends someone to the wrong portal,
 * strands an expired session, or hides a page from the person who owns it.
 * Rendering the 2,000-line pages is out of scope — the Playwright journeys
 * cover those, and component tests over templates that large would be brittle
 * without paying for themselves.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '@': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
})
