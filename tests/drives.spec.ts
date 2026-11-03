import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  DRIVE_TABS,
  blankDriveForm,
  countOrNull,
  driveActions,
  driveFormFrom,
  drivePayload,
  driveStatusLabel,
  drivesFor,
  driveTab,
  registrationClosed,
  type Drive,
} from '~/utils/drives'

/**
 * Donation Drives, phase 1 of drive pre-registration: expected participants
 * beside the hard registration capacity, drafts and publishing, closing
 * registration, editing and cancelling, all wired to the server.
 */

const root = fileURLToPath(new URL('..', import.meta.url))
const source = (relative: string) => readFileSync(path.join(root, relative), 'utf8')

function drive(overrides: Partial<Drive> = {}): Drive {
  return {
    id: 1,
    name: 'UM Matina Bloodletting Drive',
    location: 'University of Mindanao',
    event_date: '2026-11-20',
    start_time: '08:00:00',
    end_time: '12:00:00',
    capacity: 60,
    expected_participants: 120,
    registered_count: 0,
    status: 'Upcoming',
    published_at: '2026-11-01T08:00:00+08:00',
    registration_open: true,
    registration_closed_at: null,
    cancelled_at: null,
    cancellation_reason: null,
    ...overrides,
  }
}

describe('drive tabs', () => {
  it('has a Cancelled tab beside Upcoming, Completed and All', () => {
    expect(DRIVE_TABS.map((t) => t.value)).toEqual(['upcoming', 'completed', 'cancelled', 'all'])
  })

  it('files drafts with the upcoming drives and keeps cancelled ones apart', () => {
    expect(driveTab({ status: 'Draft' })).toBe('upcoming')
    expect(driveTab({ status: 'Full' })).toBe('upcoming')
    expect(driveTab({ status: 'Open' })).toBe('upcoming')
    expect(driveTab({ status: 'Completed' })).toBe('completed')
    expect(driveTab({ status: 'Cancelled' })).toBe('cancelled')
  })

  it('lists upcoming drives soonest first and the rest most recent first', () => {
    const list = [
      drive({ id: 1, event_date: '2026-11-20' }),
      drive({ id: 2, event_date: '2026-11-10', status: 'Draft' }),
      drive({ id: 3, event_date: '2026-10-01', status: 'Completed' }),
      drive({ id: 4, event_date: '2026-10-05', status: 'Completed' }),
      drive({ id: 5, event_date: '2026-11-15', status: 'Cancelled' }),
    ]
    expect(drivesFor(list, 'upcoming').map((d) => d.id)).toEqual([2, 1])
    expect(drivesFor(list, 'completed').map((d) => d.id)).toEqual([4, 3])
    expect(drivesFor(list, 'cancelled').map((d) => d.id)).toEqual([5])
    expect(drivesFor(list, 'all').map((d) => d.id)).toEqual([1, 5, 2, 4, 3])
  })

  it('says Today for a drive held today', () => {
    expect(driveStatusLabel({ status: 'Open' })).toBe('Today')
    expect(driveStatusLabel({ status: 'Draft' })).toBe('Draft')
  })
})

describe('drive row actions', () => {
  it('offers a draft Publish, Edit and Cancel, and no registration switch', () => {
    expect(driveActions(drive({ status: 'Draft', published_at: null }))).toMatchObject({
      publish: true, edit: true, cancel: true, closeRegistration: false, reopenRegistration: false,
    })
  })

  it('offers a published drive the registration switch that applies', () => {
    expect(driveActions(drive())).toMatchObject({ publish: false, closeRegistration: true, reopenRegistration: false })
    expect(driveActions(drive({ registration_closed_at: '2026-11-02T09:00:00+08:00', registration_open: false })))
      .toMatchObject({ closeRegistration: false, reopenRegistration: true })
  })

  it('offers a held or cancelled drive nothing', () => {
    for (const status of ['Completed', 'Cancelled']) {
      expect(driveActions(drive({ status }))).toMatchObject({
        publish: false, edit: false, cancel: false, closeRegistration: false, reopenRegistration: false,
      })
    }
  })

  it('fixes the date and hours once a donor is booked', () => {
    expect(driveActions(drive({ registered_count: 0 })).scheduleLocked).toBe(false)
    expect(driveActions(drive({ registered_count: 3 })).scheduleLocked).toBe(true)
  })

  it('shows Registration closed only on a published drive still to come', () => {
    const closedAt = '2026-11-02T09:00:00+08:00'
    expect(registrationClosed(drive({ registration_closed_at: closedAt }))).toBe(true)
    expect(registrationClosed(drive({ registration_closed_at: closedAt, status: 'Completed' }))).toBe(false)
    expect(registrationClosed(drive({ registration_closed_at: null }))).toBe(false)
  })
})

describe('the drive form', () => {
  it('starts with no capacity limit, no estimate, and publishing on', () => {
    expect(blankDriveForm()).toMatchObject({ max_capacity: '', expected_participants: '', publish: true })
  })

  it('reads a blank count as null and anything else as a whole number', () => {
    expect(countOrNull('')).toBeNull()
    expect(countOrNull('  ')).toBeNull()
    expect(countOrNull(null)).toBeNull()
    expect(countOrNull('80')).toBe(80)
    expect(countOrNull(120)).toBe(120)
  })

  it('sends capacity and expected participants as two separate figures', () => {
    const form = { ...blankDriveForm(), name: ' Drive ', location: ' Gym ', event_date: '2026-11-20', max_capacity: '', expected_participants: '150' }
    expect(drivePayload(form, true)).toEqual({
      name: 'Drive',
      location: 'Gym',
      event_date: '2026-11-20',
      start_time: '08:00',
      end_time: '16:00',
      max_capacity: null,
      expected_participants: 150,
      assigned_staff: null,
      announcement: null,
      publish: true,
    })
  })

  it('sends publish only with a new drive', () => {
    expect(drivePayload({ ...blankDriveForm(), publish: false }, true)).toHaveProperty('publish', false)
    expect(drivePayload(blankDriveForm(), false)).not.toHaveProperty('publish')
  })

  it('fills the form from a drive, times as HH:MM', () => {
    expect(driveFormFrom(drive({ capacity: null }))).toMatchObject({
      start_time: '08:00', end_time: '12:00', max_capacity: '', expected_participants: 120,
    })
  })
})

describe('the Donation Drives page', () => {
  const page = source('app/pages/blood-center/drives.vue')
  const api = source('app/api/bloodcenter/BloodCenterService.ts')

  it('is wired to the server for edit, publish, registration and cancel', () => {
    expect(page).not.toMatch(/not connected yet/i)
    for (const call of ['updateDrive', 'publishDrive', 'setDriveRegistration', 'cancelDrive']) {
      expect(page).toContain(`bloodCenterService.${call}(`)
      expect(api).toContain(`async ${call}(`)
    }
  })

  it('names capacity as an optional limit beside expected participants', () => {
    expect(page).not.toContain('Max donors')
    expect(page).toContain('Registration capacity')
    expect(page).toContain('Expected participants')
  })

  it('asks in its own dialogs, with focus kept inside them', () => {
    expect(page).toContain('Publish this drive?')
    expect(page).toContain('Cancel this drive?')
    expect(page.match(/v-focus-trap/g)?.length).toBe(3)
  })
})
