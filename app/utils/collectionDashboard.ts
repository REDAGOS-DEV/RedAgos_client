/**
 * Shaping helpers for the Donor/Collection dashboard
 * (blood-center/collection-dashboard.vue).
 *
 * Every count comes from the server; these decide only how a count is drawn.
 */

import { BLOOD_GROUP_ORDER } from '~/utils/donorRecords'

export interface TrendDay {
  date: string
  donations: number
  deferrals: number
}

/**
 * A y-axis that ends on a round number, with 3–5 gridlines.
 *
 * Never below 4, so a quiet month does not draw a single donation as a bar
 * that fills the chart.
 */
export function niceScale(max: number): { max: number, ticks: number[] } {
  const top = Math.max(4, Math.ceil(max))
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]
  const step = steps.find((s) => top / s <= 4) ?? Math.ceil(top / 4)
  const scaled = Math.ceil(top / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= scaled; v += step) ticks.push(v)
  return { max: scaled, ticks }
}

/** The tallest day, donations and deferrals together. */
export function trendPeak(days: TrendDay[]): number {
  return days.reduce((peak, d) => Math.max(peak, d.donations + d.deferrals), 0)
}

export function trendTotals(days: TrendDay[]): { donations: number, deferrals: number } {
  return days.reduce(
    (sum, d) => ({ donations: sum.donations + d.donations, deferrals: sum.deferrals + d.deferrals }),
    { donations: 0, deferrals: 0 },
  )
}

function toDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00`)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** 2026-10-02 → "2 Oct" */
export function dayMonth(value: string): string {
  const d = toDate(value)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** 2026-10-02 → "Fri" */
export function weekday(value: string): string {
  return WEEKDAYS[toDate(value).getDay()] ?? ''
}

/** 2026-10-02 → "Friday, 2 October 2026", for the page's subtitle. */
export function longDate(value: string): string {
  return toDate(value).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * The path of a column segment: square at the bottom, and with the 4px
 * rounded data-end on top when it is the top of its stack. The radius never
 * exceeds half the width or the height, so a short segment stays a shape.
 */
export function columnPath(x: number, y: number, width: number, height: number, roundTop: boolean): string {
  if (height <= 0 || width <= 0) return ''
  const r = roundTop ? Math.min(4, width / 2, height) : 0
  const bottom = y + height

  if (r === 0) return `M${x},${bottom}V${y}H${x + width}V${bottom}Z`

  return [
    `M${x},${bottom}`,
    `V${y + r}`,
    `A${r},${r} 0 0 1 ${x + r},${y}`,
    `H${x + width - r}`,
    `A${r},${r} 0 0 1 ${x + width},${y + r}`,
    `V${bottom}`,
    'Z',
  ].join('')
}

/**
 * Eligible donors per blood group, in the filter's order, with every group
 * present (a zero is information: nobody to call in for that group).
 */
export function bloodGroupRows(rows: { code: string, count: number }[]): { code: string, count: number }[] {
  const counts = new Map(rows.map((r) => [r.code, r.count]))
  const known = BLOOD_GROUP_ORDER.map((code) => ({ code, count: counts.get(code) ?? 0 }))
  const other = rows.filter((r) => !BLOOD_GROUP_ORDER.includes(r.code))
  return [...known, ...other]
}

/** "1 donor" / "3 donors" */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`
}
