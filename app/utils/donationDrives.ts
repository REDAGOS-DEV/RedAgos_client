/**
 * The public list of upcoming donation drives.
 *
 * Shared by the landing page's Donation Drives section and the "Next drive"
 * card in the hero, so the two can never disagree. Only public details live
 * here (title, place, date, time); registration counts are internal to the
 * blood center and never shown on the public page.
 *
 * Hard-coded until drives come from the API.
 */

export interface DonationDrive {
  title: string
  location: string
  /** 'YYYY-MM-DD', local date. */
  date: string
  time: string
}

export interface UpcomingDrive extends DonationDrive {
  month: string
  day: number
  weekday: string
}

export const DONATION_DRIVES: DonationDrive[] = [
  {
    title: 'Davao City Hall Community Drive',
    location: 'Davao City Hall, San Pedro St.',
    date: '2026-12-05',
    time: '7:00 AM to 12:00 PM',
  },
  {
    title: 'SM Lanang Blood Donation',
    location: 'SM Lanang Premier, J.P. Laurel Ave.',
    date: '2026-11-21',
    time: '9:00 AM to 5:00 PM',
  },
  {
    title: 'Ateneo de Davao Blood Drive',
    location: 'Ateneo de Davao University, Jacinto St.',
    date: '2026-11-07',
    time: '8:00 AM to 3:00 PM',
  },
]

/**
 * Drives from today onward, soonest first. `today` is a local 'YYYY-MM-DD',
 * so a drive stays listed through its own day. `T00:00:00` parses as local
 * time; a bare date string is UTC and shows the previous day west of
 * Greenwich.
 */
export function upcomingDrives(
  drives: DonationDrive[] = DONATION_DRIVES,
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
