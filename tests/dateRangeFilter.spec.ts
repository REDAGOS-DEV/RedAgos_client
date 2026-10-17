import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { dateRangeLabel } from '~/utils/dateRange'

/**
 * The Donations and Appointments toolbars on one line (project owner,
 * 2026-10-17), like Donor Management's: From/To became one date-range
 * control, and Paper Records moved up beside the Donations title.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8')
}

const today = new Date(2026, 9, 17)

describe('date-range label', () => {
  it('reads "All dates" with nothing picked', () => {
    expect(dateRangeLabel('', '', today)).toBe('All dates')
    expect(dateRangeLabel(null, undefined, today)).toBe('All dates')
  })

  it('names the month once inside one month, and drops this year', () => {
    expect(dateRangeLabel('2026-10-01', '2026-10-17', today)).toBe('1–17 Oct')
    expect(dateRangeLabel('2026-09-28', '2026-10-17', today)).toBe('28 Sep – 17 Oct')
    expect(dateRangeLabel('2026-10-17', '2026-10-17', today)).toBe('17 Oct')
  })

  it('shows the year when it is not this year', () => {
    expect(dateRangeLabel('2025-10-01', '2025-10-17', today)).toBe('1–17 Oct 2025')
    expect(dateRangeLabel('2025-09-28', '2025-10-17', today)).toBe('28 Sep – 17 Oct 2025')
    expect(dateRangeLabel('2025-12-28', '2026-01-05', today)).toBe('28 Dec 2025 – 5 Jan 2026')
  })

  it('reads an open end as From or Until', () => {
    expect(dateRangeLabel('2026-10-01', '', today)).toBe('From 1 Oct')
    expect(dateRangeLabel('', '2025-10-17', today)).toBe('Until 17 Oct 2025')
  })
})

describe('one-line list toolbars', () => {
  for (const page of ['app/pages/blood-center/donations.vue', 'app/pages/blood-center/appointments.vue']) {
    it(`${path.basename(page)} filters dates through the one control`, () => {
      const text = source(page)
      expect(text).toContain('<DateRangeFilter v-model:from="fromDate" v-model:to="toDate" @change="load()" />')
      expect(text).not.toContain('type="date" class="date-input"')
    })
  }

  it('puts Paper Records beside the Donations title, not in the toolbar', () => {
    const text = source('app/pages/blood-center/donations.vue')
    const header = text.slice(text.indexOf('<header class="header-row">'), text.indexOf('</header>'))
    const toolbar = text.slice(text.indexOf('<div class="toolbar">'), text.indexOf('<div class="table-wrap"'))
    expect(header).toContain('to="/blood-center/paper-records"')
    expect(toolbar).not.toContain('Paper Records')
  })
})
