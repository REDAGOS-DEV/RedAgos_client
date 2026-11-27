/*
 * Days of cover (project owner, 2026-11-27): how long the blood bank's shelf
 * lasts at its own rate of use. Shared by the Stock Thresholds card and the
 * dashboard's tile, so both judge and word a row the same way.
 */
import type { hospitalService } from '~/api/hospital/HospitalService'

export type CoverRow = Awaited<ReturnType<typeof hospitalService.daysOfCover>>['rows'][number]
export type CoverTone = 'short' | 'watch' | 'ok' | 'idle'

// Under SHORT_DAYS is a gap before the next weekly delivery; under WATCH_DAYS is worth a look.
export const SHORT_DAYS = 3
export const WATCH_DAYS = 7
// Bars stop here: past two weeks the difference does not matter.
export const CAP_DAYS = 14

export function coverTone(row: CoverRow): CoverTone {
  if (row.days_left === null) return 'idle'
  if (row.days_left <= SHORT_DAYS) return 'short'
  if (row.days_left <= WATCH_DAYS) return 'watch'
  return 'ok'
}

export function coverBarWidth(row: CoverRow): number {
  const days = row.days_left ?? 0
  return days <= 0 ? 0 : Math.max(3, (Math.min(days, CAP_DAYS) / CAP_DAYS) * 100)
}

export function coverDaysLabel(row: CoverRow, weeks: number): string {
  if (row.days_left === null) return `No use in ${weeks} weeks`
  if (row.days_left <= 0) return 'Out of stock'
  if (row.days_left < 1) return 'Under a day'
  const days = row.days_left >= 10 ? Math.round(row.days_left) : Math.round(row.days_left * 10) / 10
  return `${days} day${days === 1 ? '' : 's'}`
}

export function coverUseLabel(row: CoverRow): string {
  // Under one a day reads better per week.
  return row.per_day >= 1
    ? `${Math.round(row.per_day * 10) / 10} used a day`
    : `${Math.round(row.per_day * 7 * 10) / 10} used a week`
}
