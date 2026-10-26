/**
 * Shaping helpers for the Processing dashboard (blood-center/processing-dashboard.vue).
 *
 * Every count comes from the server; these decide only how a count is read.
 * Spans read as on the Testing dashboard (durationLabel, ageLabel), and the
 * chart's scale and column shapes are the Collection dashboard's.
 */

export interface BagDay {
  date: string
  bags: number
  units: number
}

/** The busiest day, in bags. */
export function bagPeak(days: BagDay[]): number {
  return days.reduce((peak, d) => Math.max(peak, d.bags), 0)
}

export function bagTotals(days: BagDay[]): { bags: number, units: number } {
  return days.reduce(
    (sum, d) => ({ bags: sum.bags + d.bags, units: sum.units + d.units }),
    { bags: 0, units: 0 },
  )
}

/** Bags per unit over the period, to one decimal; a dash when nothing was separated. */
export function bagsPerUnit(days: BagDay[]): string {
  const { bags, units } = bagTotals(days)
  if (!units) return '—'
  const ratio = Math.round((bags / units) * 10) / 10
  return Number.isInteger(ratio) ? String(ratio) : ratio.toFixed(1)
}
