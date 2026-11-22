/**
 * The landing page's upcoming donation drives.
 *
 * Shared by the landing page's Donation Drives section and the "Next drive"
 * card in the hero, so the two can never disagree. The drives are the ones
 * blood centers create and publish, read from GET /public/drives
 * (composables/usePublicDrives.ts); with none created, nothing is shown.
 * Only public details live here (title, place, date, time); registration
 * counts are internal to the blood center and never shown on the public page.
 */

export interface DonationDrive {
  id?: number
  title: string
  location: string
  /** 'YYYY-MM-DD', local date. */
  date: string
  /** '9:00 AM to 5:00 PM', 'From 9:00 AM', or '' when the centre gave no times. */
  time: string
}

export interface UpcomingDrive extends DonationDrive {
  month: string
  day: number
  weekday: string
}

/** One drive as GET /public/drives answers it. Times are 'HH:MM', Philippine time. */
export interface PublicDriveRow {
  id: number
  name: string
  location: string
  date: string
  start_time: string | null
  end_time: string | null
}

/** '09:00' → '9:00 AM', '17:30' → '5:30 PM'. */
export function clockLabel(hhmm: string | null | undefined): string {
  const m = String(hhmm ?? '').match(/^(\d{1,2}):(\d{2})/)
  if (!m) return ''
  const h = Number(m[1])
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`
}

/** A /public/drives row in the shape the landing page shows. */
export function fromPublicDrive(row: PublicDriveRow): DonationDrive {
  const start = clockLabel(row.start_time)
  const end = clockLabel(row.end_time)
  return {
    id: row.id,
    title: row.name,
    location: row.location,
    date: row.date,
    time: start && end ? `${start} to ${end}` : start ? `From ${start}` : end ? `Until ${end}` : '',
  }
}

/**
 * Drives from today onward, soonest first. `today` is a local 'YYYY-MM-DD',
 * so a drive stays listed through its own day. `T00:00:00` parses as local
 * time; a bare date string is UTC and shows the previous day west of
 * Greenwich.
 */
export function upcomingDrives(
  drives: DonationDrive[],
  today: string = new Date().toLocaleDateString('en-CA'),
): UpcomingDrive[] {
  return drives
    .filter(drive => drive.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((drive) => {
      const d = new Date(`${drive.date}T00:00:00`)
      return {
        ...drive,
        month: d.toLocaleString('en-US', { month: 'short' }),
        day: d.getDate(),
        weekday: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
      }
    })
}

// ── Actions on a drive ──────────────────────────────────────────────────

/** Google Maps search for the venue. Opens the app on phones. */
export function driveMapsUrl(drive: DonationDrive): string {
  const query = /davao/i.test(drive.location) ? drive.location : `${drive.location}, Davao City`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

/** '7:00 AM' → [7, 0]. */
function parseClock(text: string): [number, number] | null {
  const m = text.trim().match(/^(\d{1,2}):(\d{2})\s*([AP])M$/i)
  if (!m) return null
  let h = Number(m[1]) % 12
  if (m[3]!.toUpperCase() === 'P') h += 12
  return [h, Number(m[2])]
}

/**
 * Start and end as UTC 'YYYYMMDDTHHMMSSZ' for a calendar file. Drive times
 * are Philippine time (UTC+8, no daylight saving), so converting to UTC is a
 * fixed 8-hour shift and the event lands at the right hour in any calendar.
 */
export function driveUtcRange(drive: DonationDrive): { start: string, end: string } | null {
  const [from, to] = drive.time.split(/\s+to\s+/i)
  const a = from ? parseClock(from) : null
  const b = to ? parseClock(to) : null
  const [y, mo, d] = drive.date.split('-').map(Number)
  if (!a || !b || !y || !mo || !d) return null
  const stamp = (h: number, min: number) =>
    new Date(Date.UTC(y, mo - 1, d, h - 8, min)).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  return { start: stamp(a[0], a[1]), end: stamp(b[0], b[1]) }
}

/** An .ics calendar file for one drive (Google, Apple and Outlook calendars). */
export function driveIcs(drive: DonationDrive, now: Date = new Date()): string | null {
  const range = driveUtcRange(drive)
  if (!range) return null
  // iCalendar text escaping: backslash first, then commas and semicolons.
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1')
  const dtstamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RedAgos//Donation Drives//EN',
    'BEGIN:VEVENT',
    `UID:${drive.date}-${drive.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}@redagos`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${range.start}`,
    `DTEND:${range.end}`,
    `SUMMARY:${esc(`Blood donation: ${drive.title}`)}`,
    `LOCATION:${esc(drive.location)}`,
    `DESCRIPTION:${esc('Bring a valid ID and eat a light meal before donating. Organized through RedAgos.')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

/** 'Today', 'Tomorrow', 'In 5 days', 'In 3 weeks'. `today` is local 'YYYY-MM-DD'. */
export function relativeDay(date: string, today: string = new Date().toLocaleDateString('en-CA')): string {
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 14) return `In ${days} days`
  const weeks = Math.round(days / 7)
  return weeks < 9 ? `In ${weeks} weeks` : `In ${Math.round(days / 30)} months`
}
