import { describe, expect, it } from 'vitest'
import { periodFor, periodLabel } from '../app/utils/reportPeriod'

/**
 * The period presets Statements and Financial Reports share: each runs from
 * its first day to today, or covers the whole of a period already over.
 */
describe('report periods', () => {
  const now = new Date(2026, 9, 25) // 25 Oct 2026

  it('runs this month, quarter and year up to today', () => {
    expect(periodFor('month', now)).toEqual({ from: '2026-10-01', to: '2026-10-25' })
    expect(periodFor('quarter', now)).toEqual({ from: '2026-10-01', to: '2026-10-25' })
    expect(periodFor('year', now)).toEqual({ from: '2026-01-01', to: '2026-10-25' })
  })

  it('covers the whole of last month and last quarter', () => {
    expect(periodFor('last-month', now)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(periodFor('last-quarter', now)).toEqual({ from: '2026-07-01', to: '2026-09-30' })
  })

  it('crosses into the previous year in January', () => {
    const january = new Date(2027, 0, 10)
    expect(periodFor('last-month', january)).toEqual({ from: '2026-12-01', to: '2026-12-31' })
    expect(periodFor('last-quarter', january)).toEqual({ from: '2026-10-01', to: '2026-12-31' })
  })

  it('leaves a custom range to its own dates', () => {
    expect(periodFor('custom', now)).toBeNull()
  })

  it('names one day once', () => {
    expect(periodLabel('2026-10-25', '2026-10-25')).toBe(new Date(2026, 9, 25).toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' }))
    expect(periodLabel('2026-10-01', '2026-10-25')).toContain('–')
  })
})
