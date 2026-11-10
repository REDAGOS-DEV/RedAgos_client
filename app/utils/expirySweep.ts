/**
 * The warning Blood Inventory and the Issuance dashboard show when the nightly
 * expiry check is overdue.
 *
 * The server decides "overdue" on its own clock: no completed run on record,
 * or none in the last 26 hours (GET /blood-center/inventory/summary,
 * `expiry_sweep`). This only words it. Until the check runs, a unit past its
 * date still reads available and is counted as stock, which is what the
 * warning says.
 */

export interface ExpirySweepStatus {
  last_completed_at: string | null
  overdue: boolean
}

const TIME_ZONE = 'Asia/Manila'

/** The warning to show, or null when the check is on time or the summary has not loaded. */
export function expirySweepWarning(sweep: ExpirySweepStatus | null | undefined, now: Date = new Date()): string | null {
  if (!sweep?.overdue) return null

  const when = finishedAt(sweep.last_completed_at, now)

  return when
    ? `The nightly expiry check last finished ${when}. Units past their expiry date may still be counted as available.`
    : 'The nightly expiry check has no finished run on record. Units past their expiry date may still be counted as available.'
}

/** "Nov 8, 12:30 AM" in Manila time, with the year when it is not this one. */
function finishedAt(value: string | null, now: Date): string | null {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const year = (d: Date) => d.toLocaleString('en-US', { year: 'numeric', timeZone: TIME_ZONE })

  return date
    .toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(year(date) !== year(now) ? { year: 'numeric' } : {}),
      hour: 'numeric',
      minute: '2-digit',
      timeZone: TIME_ZONE,
    })
    // Newer ICU puts a narrow no-break space before AM/PM. \s matches it, as a
    // Unicode space separator, so the text reads the same on every browser.
    .replace(/\s/g, ' ')
}
