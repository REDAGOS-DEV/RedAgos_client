/**
 * Shaping helpers for the Testing dashboard (blood-center/testing-dashboard.vue).
 *
 * Every count comes from the server; these decide only how a count is read.
 * The chart's scale and column shapes are the Collection dashboard's
 * (utils/collectionDashboard), so the two charts draw alike.
 */

export interface PanelDay {
  date: string
  non_reactive: number
  reactive: number
}

/** The busiest day, both outcomes together. */
export function panelPeak(days: PanelDay[]): number {
  return days.reduce((peak, d) => Math.max(peak, d.non_reactive + d.reactive), 0)
}

export function panelTotals(days: PanelDay[]): { panels: number, reactive: number } {
  return days.reduce(
    (sum, d) => ({ panels: sum.panels + d.non_reactive + d.reactive, reactive: sum.reactive + d.reactive }),
    { panels: 0, reactive: 0 },
  )
}

/**
 * A span of hours as a person would say it: minutes under an hour, hours
 * under two days, days after that. Null is "not known", shown as a dash.
 *
 * 0.75 → "45 min", 5 → "5 h", 5.5 → "5.5 h", 50 → "2.1 days"
 */
export function durationLabel(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || !Number.isFinite(hours) || hours < 0) return '—'
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`
  if (hours < 48) return `${trimmed(hours)} h`
  return `${trimmed(hours / 24)} days`
}

/** How long ago an instant was, in the same words; a dash when unknown. */
export function ageLabel(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '—'
  const at = new Date(iso).getTime()
  if (Number.isNaN(at)) return '—'
  return durationLabel(Math.max(0, now.getTime() - at) / 3_600_000)
}

/** One decimal, without a trailing ".0". */
function trimmed(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}
