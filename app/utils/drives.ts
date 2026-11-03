/**
 * Shaping helpers for the Donation Drives page (blood-center/drives.vue).
 *
 * The server owns every rule (who may change a drive, whether its date can
 * move, whether it takes bookings); these only decide how a drive is shown,
 * which buttons it offers, and what the form sends.
 *
 * Two figures, never one: `capacity` is the hard limit on bookings (null = no
 * limit) and `expected_participants` is a planning estimate nobody enforces.
 */

export type DriveStatus = 'Draft' | 'Upcoming' | 'Open' | 'Full' | 'Completed' | 'Cancelled'

export interface Drive {
  id: number
  name: string
  location: string
  event_date: string
  start_time?: string | null
  end_time?: string | null
  capacity?: number | null
  expected_participants?: number | null
  registered_count?: number | null
  assigned_staff?: string | null
  announcement?: string | null
  status: DriveStatus | string
  published_at?: string | null
  registration_open?: boolean
  registration_closed_at?: string | null
  cancelled_at?: string | null
  cancellation_reason?: string | null
}

export type DriveTab = 'upcoming' | 'completed' | 'cancelled' | 'all'

export const DRIVE_TABS: ReadonlyArray<{ value: DriveTab, label: string }> = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
]

/** Which tab a drive belongs to (besides All). Drafts sit with the upcoming ones. */
export function driveTab(drive: Pick<Drive, 'status'>): Exclude<DriveTab, 'all'> {
  if (drive.status === 'Cancelled') return 'cancelled'
  if (drive.status === 'Completed') return 'completed'
  return 'upcoming'
}

/** The drives a tab shows: upcoming soonest first, the rest most recent first. */
export function drivesFor<T extends Pick<Drive, 'status' | 'event_date'>>(drives: T[], tab: DriveTab): T[] {
  const byDate = (x: T, y: T) => String(x.event_date).localeCompare(String(y.event_date))
  if (tab === 'all') return [...drives].sort((x, y) => byDate(y, x))
  const picked = drives.filter((d) => driveTab(d) === tab)
  return tab === 'upcoming' ? picked.sort(byDate) : picked.sort((x, y) => byDate(y, x))
}

/** The status badge's words. `Open` is the server's word for a drive held today. */
export function driveStatusLabel(drive: Pick<Drive, 'status'>): string {
  return drive.status === 'Open' ? 'Today' : String(drive.status)
}

/**
 * True when a published drive that has not happened was closed to new
 * bookings by staff. Shown beside the status, which says nothing about it.
 */
export function registrationClosed(drive: Pick<Drive, 'status' | 'registration_closed_at'>): boolean {
  return Boolean(drive.registration_closed_at) && driveTab(drive) === 'upcoming' && drive.status !== 'Draft'
}

export interface DriveActions {
  edit: boolean
  publish: boolean
  closeRegistration: boolean
  reopenRegistration: boolean
  cancel: boolean
  /** Date and hours are fixed once a donor is booked. */
  scheduleLocked: boolean
}

/** What a drive's row offers. A held or cancelled drive offers none of these. */
export function driveActions(drive: Drive): DriveActions {
  const live = driveTab(drive) === 'upcoming'
  const draft = drive.status === 'Draft'
  const closed = Boolean(drive.registration_closed_at)

  return {
    edit: live,
    publish: live && draft,
    closeRegistration: live && !draft && !closed,
    reopenRegistration: live && !draft && closed,
    cancel: live,
    scheduleLocked: (drive.registered_count ?? 0) > 0,
  }
}

export interface DriveForm {
  name: string
  location: string
  event_date: string
  start_time: string
  end_time: string
  max_capacity: number | string | null
  expected_participants: number | string | null
  assigned_staff: string
  announcement: string
  publish: boolean
}

/** A new drive: no capacity limit and no estimate until staff type one; published on save. */
export function blankDriveForm(): DriveForm {
  return {
    name: '',
    location: '',
    event_date: '',
    start_time: '08:00',
    end_time: '16:00',
    max_capacity: '',
    expected_participants: '',
    assigned_staff: '',
    announcement: '',
    publish: true,
  }
}

/** The form filled with a drive's current values. */
export function driveFormFrom(drive: Drive): DriveForm {
  return {
    name: drive.name ?? '',
    location: drive.location ?? '',
    event_date: String(drive.event_date ?? '').slice(0, 10),
    start_time: String(drive.start_time ?? '08:00').slice(0, 5),
    end_time: String(drive.end_time ?? '16:00').slice(0, 5),
    max_capacity: drive.capacity ?? '',
    expected_participants: drive.expected_participants ?? '',
    assigned_staff: drive.assigned_staff ?? '',
    announcement: drive.announcement ?? '',
    publish: Boolean(drive.published_at),
  }
}

/** A blank count is null (no limit, no estimate); anything else a whole number. */
export function countOrNull(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

/**
 * What the form sends, keyed like the `mobile_events` columns. `publish` goes
 * only with a new drive: an existing one is published from its row.
 */
export function drivePayload(form: DriveForm, creating: boolean): Record<string, unknown> {
  const text = (value: string) => (value.trim() === '' ? null : value.trim())
  const payload: Record<string, unknown> = {
    name: form.name.trim(),
    location: form.location.trim(),
    event_date: form.event_date,
    start_time: form.start_time || null,
    end_time: form.end_time || null,
    max_capacity: countOrNull(form.max_capacity),
    expected_participants: countOrNull(form.expected_participants),
    assigned_staff: text(form.assigned_staff),
    announcement: text(form.announcement),
  }
  if (creating) payload.publish = form.publish
  return payload
}
