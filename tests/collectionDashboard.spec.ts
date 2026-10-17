import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  bloodGroupRows,
  columnPath,
  dayMonth,
  niceScale,
  plural,
  trendPeak,
  trendTotals,
  weekday,
} from '~/utils/collectionDashboard'

/**
 * The Donor/Collection dashboard.
 *
 * What is locked in: the page and its nav link are gated alike on
 * donations.view, the chart's scale and columns are drawn as the chart rules
 * ask (round top only, never taller than the axis), and every blood group is
 * listed even when nobody of that group can donate.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8')
}

describe('chart helpers', () => {
  it('ends the axis on a round number with a few gridlines', () => {
    expect(niceScale(0)).toEqual({ max: 4, ticks: [0, 1, 2, 3, 4] })
    expect(niceScale(13)).toEqual({ max: 15, ticks: [0, 5, 10, 15] })
    expect(niceScale(40).max).toBe(40)
    for (const peak of [1, 7, 19, 38, 99, 640]) {
      const scale = niceScale(peak)
      expect(scale.max).toBeGreaterThanOrEqual(peak)
      expect(scale.ticks.length).toBeLessThanOrEqual(5)
    }
  })

  it('measures a day as donations and deferrals together', () => {
    const days = [
      { date: '2026-10-01', donations: 3, deferrals: 1 },
      { date: '2026-10-02', donations: 5, deferrals: 0 },
    ]
    expect(trendPeak(days)).toBe(5)
    expect(trendTotals(days)).toEqual({ donations: 8, deferrals: 1 })
  })

  it('rounds only the top of a column, and draws nothing for an empty one', () => {
    expect(columnPath(10, 20, 12, 30, false)).toBe('M10,50V20H22V50Z')
    expect(columnPath(10, 20, 12, 30, true)).toContain('A4,4')
    expect(columnPath(10, 20, 12, 30, true).startsWith('M10,50')).toBe(true)
    // A segment shorter than the radius keeps its height.
    expect(columnPath(0, 0, 12, 2, true)).toContain('A2,2')
    expect(columnPath(0, 0, 12, 0, true)).toBe('')
  })

  it('lists every blood group, in the filter order', () => {
    const rows = bloodGroupRows([{ code: 'O+', count: 4 }, { code: 'AB-', count: 1 }])
    expect(rows.map((r) => r.code)).toEqual(['A-', 'A+', 'B-', 'B+', 'AB-', 'AB+', 'O-', 'O+'])
    expect(rows.find((r) => r.code === 'O+')?.count).toBe(4)
    expect(rows.find((r) => r.code === 'A-')?.count).toBe(0)
  })

  it('writes days and counts the way the cards read them', () => {
    expect(dayMonth('2026-10-02')).toBe('2 Oct')
    expect(weekday('2026-10-16')).toBe('Fri')
    expect(plural(1, 'donor')).toBe('1 donor')
    expect(plural(3, 'donor')).toBe('3 donors')
  })
})

describe('the dashboard service', () => {
  it('reads the centre-scoped route and names no facility', async () => {
    const { bloodCenterService } = await import('~/api/bloodcenter/BloodCenterService')
    const request = vi.fn(async () => ({}))
    ;(bloodCenterService as any).request = request

    await bloodCenterService.collectionDashboard()

    expect(request).toHaveBeenCalledWith('/blood-center/collection/dashboard', 'GET')
  })
})

describe('the dashboard page and its link', () => {
  const page = source('app/pages/blood-center/collection-dashboard.vue')
  const nav = source('app/composables/useBloodCenterNav.ts')

  it('is gated on donations.view, exactly as its nav link is', () => {
    expect(page).toContain("requires: 'donations.view'")
    expect(nav).toMatch(/label: 'Dashboard', path: '\/blood-center\/collection-dashboard'[^}]*requires: 'donations\.view'/)
  })

  it('sits under Overview, with the centre-wide dashboard renamed beside it', () => {
    const overview = nav.slice(nav.indexOf("label: 'Overview'"), nav.indexOf("label: 'Donor',"))
    expect(overview).toContain("path: '/blood-center/collection-dashboard'")
    expect(overview).toMatch(/label: 'Center Dashboard', path: BLOOD_CENTER_OVERVIEW/)
  })

  it('splits the department into Donor and Collection', () => {
    expect(nav).toMatch(/label: 'Donor',\s*items: \[\s*\{ label: 'Donor Management'[^\n]*\n\s*\{ label: 'Appointments'/)
    // The list of visits, the counter, then the drives (project owner, 2026-10-17).
    expect(nav).toMatch(/label: 'Collection',\s*items: \[[\s\S]*?\{ label: 'Donations', path: '\/blood-center\/donations'[^\n]*\n\s*\{ label: 'Donation Counter'[^\n]*\n\s*\{ label: 'Blood Donation Drive'/)
    expect(nav).toContain("collection: ['Donor', 'Collection']")
  })

  it('gives the chart a table view and keyboard reading', () => {
    expect(page).toContain('trend-table')
    expect(page).toContain('@keydown="onChartKey"')
  })
})
