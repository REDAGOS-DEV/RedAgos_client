import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

/**
 * The Donation counter's walk-in search, as you type (project owner,
 * 2026-10-17).
 *
 * What is locked in: typing searches after a short pause with no button to
 * press, only the newest search may show its results, and a box under two
 * characters shows none.
 */

const root = fileURLToPath(new URL('..', import.meta.url))
const page = readFileSync(path.join(root, 'app/pages/blood-center/donation.vue'), 'utf8')

describe('walk-in donor search', () => {
  it('searches as the staff member types, after a short pause', () => {
    expect(page).toMatch(/watch\(lookupValue, \(value\) => \{[\s\S]*?searchTimer = setTimeout\(searchDonors, SEARCH_DELAY_MS\)/)
    expect(page).toContain('const SEARCH_DELAY_MS = 300')
    // No Search button left to press; Enter still submits the form.
    expect(page).not.toMatch(/<button type="submit"[^>]*>\s*\{\{ searching \? 'Searching…' : 'Search' \}\}/)
    expect(page).toContain('<form class="lookup" role="search" @submit.prevent="searchDonors">')
  })

  it('lets only the newest search write its results', () => {
    expect(page).toContain('const mine = ++searchSeq')
    expect(page).toContain('if (mine !== searchSeq) return')
  })

  it('clears the results under two characters and stops on leaving', () => {
    expect(page).toMatch(/if \(value\.trim\(\)\.length < 2\) \{[\s\S]*?searchResults\.value = null/)
    expect(page).toContain('onBeforeUnmount(() => clearTimeout(searchTimer))')
  })
})
