/**
 * "Open now" for the public facility directory, in Philippine time.
 *
 * The hours are typed in by hand (see ContactSection), so they are only as
 * accurate as that list. Keep it in step with what the facilities publish,
 * or the label misleads people deciding where to go.
 */

/** 0 = Sunday … 6 = Saturday, times 'HH:MM' 24-hour. */
export interface OpeningHours {
  days: number[]
  open: string
  close: string
}

export interface FacilityStatus {
  open: boolean
  /** 'Open now · closes 5:00 PM' or 'Closed · opens Mon 8:00 AM'. */
  label: string
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function clock(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`
}

/** Day of week and minutes past midnight in Asia/Manila. */
export function manilaNow(now: Date = new Date()): { day: number, minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  return {
    day: DAY.indexOf(get('weekday')),
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  }
}

export function facilityStatus(hours: OpeningHours[], now: Date = new Date()): FacilityStatus {
  const { day, minutes } = manilaNow(now)
  const today = hours.find(h => h.days.includes(day))

  if (today && minutes >= toMinutes(today.open) && minutes < toMinutes(today.close)) {
    return { open: true, label: `Open now · closes ${clock(today.close)}` }
  }

  // Later today, or the next day it opens within the week.
  if (today && minutes < toMinutes(today.open)) {
    return { open: false, label: `Closed · opens ${clock(today.open)}` }
  }
  for (let step = 1; step <= 7; step++) {
    const d = (day + step) % 7
    const next = hours.find(h => h.days.includes(d))
    if (next) {
      const when = step === 1 ? 'tomorrow' : DAY[d]
      return { open: false, label: `Closed · opens ${when} ${clock(next.open)}` }
    }
  }
  return { open: false, label: 'Closed' }
}
