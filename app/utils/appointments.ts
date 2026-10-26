/**
 * Shaping helpers for the Appointments page (blood-center/appointments.vue).
 *
 * Which actions a row allows is the server's call (`can` on each row); these
 * only decide how a booking is shown and what the booking form sends.
 */

/** The status filter, in the order a day runs. */
export const APPOINTMENT_STATUSES = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'confirmed', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No-show' },
] as const

export type AppointmentTone = 'info' | 'ok' | 'warn' | 'crit' | 'neutral'

/**
 * The dot colour for a booking's status. A completed booking is green when
 * blood was collected and red when the donor was deferred; the server's label
 * says which.
 */
export function appointmentTone(status: string, label?: string | null): AppointmentTone {
  switch (status) {
    case 'scheduled': return 'info'
    case 'confirmed': return 'warn'
    case 'completed': return label === 'Deferred' ? 'crit' : 'ok'
    case 'no_show': return 'crit'
    default: return 'neutral'
  }
}

/** "09:00 - 10:00 · 2 left", "Full" or "Past", for the time-slot picker. */
export function slotOptionLabel(slot: { time: string, end?: string | null, available?: number | null, total?: number | null }, isPast = false): string {
  const range = slot.end ? `${slot.time} - ${slot.end}` : slot.time
  if (isPast) return `${range} · Past`
  if (slot.available === null || slot.available === undefined) return range
  if (slot.available <= 0) return `${range} · Full`
  return `${range} · ${slot.available} left`
}

/**
 * An exact identifier a caller might read out — a donor ID, an email or a
 * mobile number — shaped for the donor lookup, which matches exactly. The
 * desk's list only holds this centre's donors; this finds one who has only
 * ever given elsewhere.
 */
export function exactIdentifier(term: string): { type: string, value: string } | null {
  const text = term.trim()
  if (/^DONOR-\d{1,10}$/i.test(text)) return { type: 'donor_code', value: text.toUpperCase() }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return { type: 'email', value: text.toLowerCase() }

  const phone = text.replace(/[\s-]+/g, '')
  if (/^09\d{9}$/.test(phone)) return { type: 'phone', value: `+63${phone.slice(1)}` }
  if (/^\+639\d{9}$/.test(phone)) return { type: 'phone', value: phone }

  return null
}

/** YYYY-MM-DD for a local date, `days` from today. */
export function isoDaysFromToday(days = 0, today: Date = new Date()): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
