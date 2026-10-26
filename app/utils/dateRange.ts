/**
 * The label on a list's date-range filter (components/common/DateRangeFilter).
 *
 * Kept short so the filter sits on one line with the rest of the toolbar: the
 * year shows only when it is not this year, and a range inside one month
 * names the month once.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parse(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function dayMonth(d: Date, withYear: boolean): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ''}`
}

/** 2026-10-01 + 2026-10-17 → "1–17 Oct"; nothing picked → "All dates". */
export function dateRangeLabel(from: string | null | undefined, to: string | null | undefined, today: Date = new Date()): string {
  const start = parse(from)
  const end = parse(to)
  const thisYear = today.getFullYear()

  if (start && end) {
    const sameYear = start.getFullYear() === end.getFullYear()
    const showYear = !sameYear || start.getFullYear() !== thisYear
    const yearSuffix = showYear ? ` ${end.getFullYear()}` : ''

    if (start.getTime() === end.getTime()) return dayMonth(end, showYear)
    if (sameYear && start.getMonth() === end.getMonth()) {
      return `${start.getDate()}–${end.getDate()} ${MONTHS[end.getMonth()]}${yearSuffix}`
    }
    return `${dayMonth(start, !sameYear)} – ${dayMonth(end, false)}${yearSuffix}`
  }

  if (start) return `From ${dayMonth(start, start.getFullYear() !== thisYear)}`
  if (end) return `Until ${dayMonth(end, end.getFullYear() !== thisYear)}`
  return 'All dates'
}
