import { describe, it, expect } from 'vitest'

import {
  driveIcs,
  driveMapsUrl,
  driveUtcRange,
  relativeDay,
  upcomingDrives,
  type DonationDrive,
} from '~/utils/donationDrives'
import { facilityStatus, manilaNow, type OpeningHours } from '~/utils/facilityHours'

/**
 * The landing page's drive actions (calendar file, directions, "in N days")
 * and the facility directory's "Open now" label. Pure functions only; the
 * rendering is out of scope, as everywhere else in this suite.
 */

const drive: DonationDrive = {
  title: 'SM Lanang Blood Donation',
  location: 'SM Lanang Premier, J.P. Laurel Ave.',
  date: '2026-11-21',
  time: '9:00 AM to 5:00 PM',
}

describe('donation drive actions', () => {
  it('converts Philippine drive times to UTC for calendars', () => {
    // 9:00 AM Manila (UTC+8) is 01:00 UTC the same day.
    expect(driveUtcRange(drive)).toEqual({ start: '20261121T010000Z', end: '20261121T090000Z' })
  })

  it('handles a morning start that is the previous day in UTC', () => {
    // 7:00 AM Manila on 5 Dec is 23:00 UTC on 4 Dec.
    const early = { ...drive, date: '2026-12-05', time: '7:00 AM to 12:00 PM' }
    expect(driveUtcRange(early)).toEqual({ start: '20261204T230000Z', end: '20261205T040000Z' })
  })

  it('builds a calendar file with the venue and escaped text', () => {
    const ics = driveIcs(drive, new Date('2026-10-14T00:00:00Z'))!
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('DTSTART:20261121T010000Z')
    expect(ics).toContain('LOCATION:SM Lanang Premier\\, J.P. Laurel Ave.')
    expect(ics.split('\r\n').length).toBeGreaterThan(8)
  })

  it('returns no calendar file when the time cannot be read', () => {
    expect(driveIcs({ ...drive, time: 'Whole day' })).toBeNull()
  })

  it('adds Davao City to the map search only when missing', () => {
    expect(decodeURIComponent(driveMapsUrl(drive))).toContain('J.P. Laurel Ave., Davao City')
    const inDavao = { ...drive, location: 'Davao City Hall, San Pedro St.' }
    expect(decodeURIComponent(driveMapsUrl(inDavao))).not.toContain(', Davao City, Davao City')
  })

  it.each([
    ['2026-10-14', 'Today'],
    ['2026-10-15', 'Tomorrow'],
    ['2026-10-20', 'In 6 days'],
    ['2026-11-07', 'In 3 weeks'],
  ])('describes %s as %s', (date, label) => {
    expect(relativeDay(date, '2026-10-14')).toBe(label)
  })

  it('lists only drives from today on, soonest first', () => {
    const list = upcomingDrives([
      { ...drive, date: '2026-12-01' },
      { ...drive, date: '2026-10-01' },
      { ...drive, date: '2026-11-01' },
    ], '2026-10-14')
    expect(list.map(d => d.date)).toEqual(['2026-11-01', '2026-12-01'])
  })
})

describe('facility opening status (Philippine time)', () => {
  const weekdays: OpeningHours[] = [{ days: [1, 2, 3, 4, 5], open: '08:00', close: '17:00' }]

  // Instants given in UTC; Manila is UTC+8.
  const manila = (iso: string) => new Date(`${iso}+08:00`)

  it('reads the day and time in Manila, whatever the browser zone', () => {
    // Wed 14 Oct 2026, 10:30 in Manila.
    expect(manilaNow(manila('2026-10-14T10:30:00'))).toEqual({ day: 3, minutes: 630 })
  })

  it('is open during hours', () => {
    expect(facilityStatus(weekdays, manila('2026-10-14T10:30:00')))
      .toEqual({ open: true, label: 'Open now · closes 5:00 PM' })
  })

  it('is closed before opening, and says when it opens today', () => {
    expect(facilityStatus(weekdays, manila('2026-10-14T06:00:00')).label).toBe('Closed · opens 8:00 AM')
  })

  it('closes exactly at closing time', () => {
    expect(facilityStatus(weekdays, manila('2026-10-14T17:00:00')).open).toBe(false)
  })

  it('names tomorrow after hours on a weekday', () => {
    expect(facilityStatus(weekdays, manila('2026-10-14T19:00:00')).label).toBe('Closed · opens tomorrow 8:00 AM')
  })

  it('names the next open day over a weekend', () => {
    // Saturday 17 Oct → opens Monday.
    expect(facilityStatus(weekdays, manila('2026-10-17T12:00:00')).label).toBe('Closed · opens Mon 8:00 AM')
  })
})
