import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { APPOINTMENT_STATUSES, appointmentTone, exactIdentifier, isoDaysFromToday, slotOptionLabel } from '~/utils/appointments'

/**
 * The Appointments page (project owner, 2026-10-17): one table of bookings at
 * the centre and its drives, and the desk booking a donor who phones in.
 *
 * What is locked in: the old stat cards and time-slot grid are gone, the
 * actions shown are the ones the server says apply, the booking form reaches
 * a donor who has only given elsewhere by an exact ID, and a drive is a drive.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8')
}

describe('appointment helpers', () => {
  it('filters by every status, in the order a day runs', () => {
    expect(APPOINTMENT_STATUSES.map((s) => s.value)).toEqual(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'])
  })

  it('colours a completed booking by what came of it', () => {
    expect(appointmentTone('completed', 'Collected')).toBe('ok')
    expect(appointmentTone('completed', 'Deferred')).toBe('crit')
    expect(appointmentTone('scheduled')).toBe('info')
    expect(appointmentTone('no_show')).toBe('crit')
    expect(appointmentTone('cancelled')).toBe('neutral')
  })

  it('labels a slot with what is left of it', () => {
    expect(slotOptionLabel({ time: '09:00', end: '10:00', available: 2, total: 4 })).toBe('09:00 - 10:00 · 2 left')
    expect(slotOptionLabel({ time: '09:00', end: '10:00', available: 0, total: 4 })).toBe('09:00 - 10:00 · Full')
    expect(slotOptionLabel({ time: '09:00', end: '10:00', available: null, total: null })).toBe('09:00 - 10:00')
    expect(slotOptionLabel({ time: '09:00', end: '10:00', available: 3 }, true)).toBe('09:00 - 10:00 · Past')
  })

  it('recognises an exact identifier a caller reads out', () => {
    expect(exactIdentifier('donor-000032')).toEqual({ type: 'donor_code', value: 'DONOR-000032' })
    expect(exactIdentifier(' Ana@Example.com ')).toEqual({ type: 'email', value: 'ana@example.com' })
    expect(exactIdentifier('0917 123 4567')).toEqual({ type: 'phone', value: '+639171234567' })
    expect(exactIdentifier('Ana Cruz')).toBeNull()
  })

  it('counts days from a local today', () => {
    expect(isoDaysFromToday(0, new Date(2026, 9, 31))).toBe('2026-10-31')
    expect(isoDaysFromToday(1, new Date(2026, 9, 31))).toBe('2026-11-01')
  })
})

describe('the appointment service', () => {
  it('reaches the centre-scoped routes and names no facility', async () => {
    const { bloodCenterService } = await import('~/api/bloodcenter/BloodCenterService')
    const request = vi.fn(async () => ({}))
    const requestBlob = vi.fn(async () => new Blob())
    ;(bloodCenterService as any).request = request
    ;(bloodCenterService as any).requestBlob = requestBlob

    await bloodCenterService.bookAppointment({ donor_uuid: 'u', date: '2026-10-20', time_slot: '09:00' })
    await bloodCenterService.cancelAppointment(7)
    await bloodCenterService.deleteAppointment(7)
    await bloodCenterService.exportAppointments({ status: 'scheduled', search: '' })

    expect(request).toHaveBeenNthCalledWith(1, '/blood-center/appointments', 'POST', { donor_uuid: 'u', date: '2026-10-20', time_slot: '09:00' })
    expect(request).toHaveBeenNthCalledWith(2, '/blood-center/appointments/7/cancel', 'POST')
    expect(request).toHaveBeenNthCalledWith(3, '/blood-center/appointments/7', 'DELETE')
    expect(requestBlob).toHaveBeenCalledWith('/blood-center/appointments/export?status=scheduled')
  })
})

describe('the appointments page', () => {
  const page = source('app/pages/blood-center/appointments.vue')

  it('is the mock-up table: no stat cards, no time-slot grid', () => {
    expect(page).not.toContain('stat-card')
    expect(page).not.toContain('time-slot-card')
    expect(page).not.toContain('Time Slots')
    for (const heading of ['ID', 'Donor', 'Date', 'Slot', 'Drive / Center', 'Status', 'Actions']) {
      expect(page).toMatch(new RegExp(`<th scope="col" class="c-[a-z]+">${heading.replace('/', '\\/')}</th>`))
    }
    for (const control of ['Search donor / drive…', 'All statuses', 'Export', 'Refresh', 'New Appointment']) {
      expect(page).toContain(control)
    }
  })

  it('shows a scheduled row all four actions, enabled only where the server says they apply', () => {
    // The ✓ marks the booking collected (project owner, 2026-10-17).
    expect(page).toContain('v-if="canVerify && (row.status === \'scheduled\' || row.status === \'confirmed\')"')
    expect(page).toContain(':disabled="busyId === row.id || !row.can.collect"')
    expect(page).toContain('bloodCenterService.markAppointmentCollected(row.id)')
    expect(page).toContain(':disabled="busyId === row.id || !row.can.no_show"')
    expect(page).toContain('v-if="canManage && row.status === \'scheduled\'"')
    expect(page).toContain(':disabled="busyId === row.id || !row.can.cancel"')
    expect(page).toContain(':disabled="busyId === row.id || !row.can.delete"')
  })

  it('keeps an open tab\'s permissions current, so a new role shows without a reload', () => {
    const plugin = source('app/plugins/user-refresh.client.ts')
    expect(plugin).toContain("document.addEventListener('visibilitychange'")
    expect(plugin).toContain('refreshUser()')
    expect(source('app/composables/useUser.ts')).toContain('async function refreshUser(): Promise<void>')
  })

  it('gates booking and deleting on their own abilities', () => {
    expect(page).toContain("requires: 'appointments.view'")
    expect(page).toContain("const canManage = computed(() => can('appointments.manage'))")
    expect(page).toContain("const canDelete = computed(() => can('appointments.delete'))")
    expect(page).toMatch(/<button v-if="canManage" type="button" class="btn-primary" @click="openBooking">/)
  })

  it('books at the centre or a drive, never both', () => {
    expect(page).toContain('...(booking.drive ? { drive_id: booking.drive.id } : { date: booking.date })')
    // The centre's own name, never "Main Center" (project owner, 2026-10-17).
    expect(page).toContain(':placeholder="`${centerName} (default) - search drive…`"')
    expect(page).not.toContain('Main Center')
  })

  it('finds a caller who has only given elsewhere by an exact ID', () => {
    expect(page).toContain('const exact = exactIdentifier(term)')
    expect(page).toContain('bloodCenterService.lookupDonor(exact)')
  })
})
