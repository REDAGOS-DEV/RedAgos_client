/**
 * The period pickers on Statements and Financial Reports: the presets Reports
 * & Analytics offers, worked out on the browser's calendar as Y-m-d days.
 */
export const PERIOD_PRESETS = [
  { value: 'month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'last-quarter', label: 'Last quarter' },
  { value: 'year', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
] as const

export type PeriodPreset = typeof PERIOD_PRESETS[number]['value']

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** A preset's first and last day; null for a custom range, which keeps the dates it has. */
export function periodFor(preset: PeriodPreset, now = new Date()): { from: string; to: string } | null {
  const today = isoDay(now)
  const year = now.getFullYear()
  const month = now.getMonth()
  // Quarters run Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec.
  const quarter = Math.floor(month / 3) * 3

  switch (preset) {
    case 'month': return { from: isoDay(new Date(year, month, 1)), to: today }
    case 'last-month': return { from: isoDay(new Date(year, month - 1, 1)), to: isoDay(new Date(year, month, 0)) }
    case 'quarter': return { from: isoDay(new Date(year, quarter, 1)), to: today }
    case 'last-quarter': return { from: isoDay(new Date(year, quarter - 3, 1)), to: isoDay(new Date(year, quarter, 0)) }
    case 'year': return { from: `${year}-01-01`, to: today }
    default: return null
  }
}

/** "1 Oct 2026 – 25 Oct 2026", or the one day. */
export function periodLabel(from: string, to: string): string {
  const day = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' })

  if (!from || !to) return ''

  return from === to ? day(from) : `${day(from)} – ${day(to)}`
}
