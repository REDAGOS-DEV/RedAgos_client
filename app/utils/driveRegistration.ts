/**
 * A drive's registration link (pages/drives/[token].vue) and its roster
 * (pages/blood-center/drive-registrations/[id].vue). Drive pre-registration
 * (project owner, 2026-11-11 and 2026-11-12).
 *
 * The link is for people without a portal account, and for partner
 * organisations putting their people on the list. No limit and no health
 * questions: someone without an account is screened in person at the drive.
 * A list entry is a plan; who was booked, checked in, deferred or collected
 * comes from the appointment and donation records the server reads.
 */

/** The link a centre shares: the portal's own address, then /drives/{token}. */
export function driveLinkUrl(origin: string, token: string | null | undefined): string {
  if (!token) return ''
  return `${origin.replace(/\/+$/, '')}/drives/${token}`
}

/** What a link page shows for each state the server reports. */
export const LINK_STATE_TITLES: Record<string, string> = {
  closed: 'Registration is closed',
  cancelled: 'This drive was cancelled',
  completed: 'This drive has already taken place',
}

export interface LinkPerson {
  first_name: string
  last_name: string
  phone: string
  email: string
  birth_date: string
  affiliation: string
}

export function blankPerson(): LinkPerson {
  return { first_name: '', last_name: '', phone: '', email: '', birth_date: '', affiliation: '' }
}

/** A row the partner left wholly empty is not a person: it is dropped, not refused. */
export function isBlankPerson(person: LinkPerson): boolean {
  return Object.values(person).every((value) => String(value ?? '').trim() === '')
}

/** One person as the server takes them: trimmed, with blanks as null. */
export function personPayload(person: LinkPerson): Record<string, string | null> {
  const text = (value: string) => (String(value ?? '').trim() === '' ? null : String(value).trim())
  return {
    first_name: String(person.first_name ?? '').trim(),
    last_name: String(person.last_name ?? '').trim(),
    phone: text(person.phone),
    email: text(person.email),
    birth_date: text(person.birth_date),
    affiliation: text(person.affiliation),
  }
}

/** The client's own check before sending: a name and one contact. The server decides. */
export function personProblem(person: LinkPerson): string {
  if (!String(person.first_name ?? '').trim() || !String(person.last_name ?? '').trim()) return 'Enter the first and last name.'
  if (!String(person.phone ?? '').trim() && !String(person.email ?? '').trim()) return 'Enter a mobile number or an email address.'
  return ''
}

export function selfPayload(person: LinkPerson, consent: boolean): Record<string, unknown> {
  return { ...personPayload(person), consent }
}

export interface PartnerContact {
  organisation_name: string
  contact_name: string
  contact_phone: string
  contact_email: string
}

export function groupPayload(contact: PartnerContact, people: LinkPerson[], consent: boolean): Record<string, unknown> {
  const text = (value: string) => (String(value ?? '').trim() === '' ? null : String(value).trim())
  return {
    organisation_name: contact.organisation_name.trim(),
    contact_name: contact.contact_name.trim(),
    contact_phone: text(contact.contact_phone),
    contact_email: text(contact.contact_email),
    consent,
    people: people.filter((person) => !isBlankPerson(person)).map(personPayload),
  }
}

/**
 * A 422 on the partner list names a row (`people.3.email`). Say which row,
 * counting from 1 as the partner sees them, once blank rows were dropped.
 */
export function groupErrorMessage(errors: Record<string, string[] | string> | null | undefined): string {
  if (!errors) return ''
  const [field, messages] = Object.entries(errors)[0] ?? []
  if (!field) return ''
  const message = Array.isArray(messages) ? messages[0] : messages
  const row = /^people\.(\d+)\./.exec(field)
  return row ? `Person ${Number(row[1]) + 1}: ${message}` : String(message ?? '')
}

/* ---------- The roster ---------- */

export interface DonorRef { uuid: string, code: string, name: string }

export interface RosterRow {
  key: string
  kind: 'listed' | 'booking' | 'paper' | string
  entry_id: number | null
  appointment_id: number | null
  donation_id: number | null
  walk_in: boolean
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  birth_date: string | null
  affiliation: string | null
  source: 'self' | 'partner' | 'portal' | 'desk' | 'walk_in' | 'paper' | string
  source_label: string
  organisation: string | null
  status: string
  status_label: string
  self_check: 'cleared' | 'follow_up' | 'not_completed'
  donor: DonorRef | null
  possible_donor: DonorRef | null
  anonymised: boolean
  can: {
    withdraw: boolean
    match: boolean
    unmatch: boolean
    register: boolean
    check_in: boolean
    open_counter: boolean
  }
}

export const ROSTER_STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'pre_registered', label: 'Pre-registered' },
  { value: 'booked', label: 'Booked' },
  { value: 'checked_in', label: 'Checked in' },
  { value: 'collected', label: 'Collected' },
  { value: 'deferred', label: 'Deferred' },
  { value: 'no_show', label: 'No-show' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'withdrawn', label: 'Withdrawn' },
] as const

export const ROSTER_SOURCE_FILTERS = [
  { value: '', label: 'All sources' },
  { value: 'self', label: 'Self (link)' },
  { value: 'partner', label: 'Partner (link)' },
  { value: 'portal', label: 'Portal booking' },
  { value: 'desk', label: 'Desk booking' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'paper', label: 'Paper record' },
] as const

/** The badge tone (utils/listBadge) for a roster status. */
export function rosterTone(status: string): string {
  switch (status) {
    case 'pre_registered': return 'info'
    case 'booked': return 'info'
    case 'checked_in': return 'progress'
    case 'collected': return 'ok'
    case 'deferred': return 'warn'
    case 'no_show': return 'crit'
    default: return 'neutral'
  }
}

/** The self-check as staff read it: a status only, never an answer. */
export const SELF_CHECK_LABELS: Record<string, string> = {
  cleared: 'Cleared',
  follow_up: 'Needs follow-up',
  not_completed: 'Not completed',
}

export function selfCheckLabel(value: string | null | undefined): string {
  return SELF_CHECK_LABELS[value ?? ''] ?? SELF_CHECK_LABELS.not_completed!
}

export function rosterName(row: Pick<RosterRow, 'first_name' | 'last_name' | 'anonymised'>): string {
  if (row.anonymised) return 'Removed after the retention period'
  return [row.first_name, row.last_name].filter(Boolean).join(' ') || '—'
}

/** Search by name, email, number or organisation, then the two filters. */
export function filterRoster<T extends RosterRow>(rows: T[], search: string, status: string, source: string): T[] {
  const term = search.trim().toLowerCase()
  const digits = term.replace(/\D+/g, '')
  return rows.filter((row) => {
    if (status && row.status !== status) return false
    if (source && row.source !== source) return false
    if (!term) return true
    const text = [row.first_name, row.last_name, row.email, row.organisation, row.affiliation, row.donor?.code].filter(Boolean).join(' ').toLowerCase()
    if (text.includes(term)) return true
    // 0917 123 4567 finds +639171234567.
    return digits.length >= 4 && String(row.phone ?? '').replace(/\D+/g, '').replace(/^63/, '0').includes(digits)
  })
}

/**
 * Donor Management's Register Donor form, opened from a roster row with what
 * the person typed on the link (`?register=drive` …). After registering, the
 * page links the new donor to the entry.
 */
export function registerDonorQuery(driveId: number | string, row: Pick<RosterRow, 'entry_id' | 'first_name' | 'last_name' | 'phone' | 'email' | 'birth_date'>): Record<string, string> {
  const query: Record<string, string> = { register: 'drive', drive: String(driveId), entry: String(row.entry_id ?? '') }
  for (const key of ['first_name', 'last_name', 'phone', 'email', 'birth_date'] as const) {
    if (row[key]) query[key] = String(row[key])
  }
  return query
}

export interface DonorPrefill {
  driveId: string
  entryId: string
  fields: { first_name: string, last_name: string, phone: string, email: string, birth_date: string }
}

/** Read registerDonorQuery() back on Donor Management; null when the page was opened another way. */
export function donorPrefillFromQuery(query: Record<string, unknown>): DonorPrefill | null {
  const one = (value: unknown) => String(Array.isArray(value) ? (value[0] ?? '') : (value ?? '')).trim()
  if (one(query.register) !== 'drive' || !/^\d+$/.test(one(query.drive)) || !/^\d+$/.test(one(query.entry))) return null
  return {
    driveId: one(query.drive),
    entryId: one(query.entry),
    fields: {
      first_name: one(query.first_name),
      last_name: one(query.last_name),
      phone: one(query.phone),
      email: one(query.email),
      birth_date: /^\d{4}-\d{2}-\d{2}$/.test(one(query.birth_date)) ? one(query.birth_date) : '',
    },
  }
}
