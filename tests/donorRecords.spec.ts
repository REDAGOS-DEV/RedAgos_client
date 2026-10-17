import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  ageFrom,
  blankDonorForm,
  donorFormFrom,
  donorSubline,
  donorTier,
  editPayload,
  eligibilityBadge,
  exportFilename,
  formatPhone,
  formatShortDate,
  orderBloodGroups,
  registerPayload,
  reminderSkipSummary,
} from '~/utils/donorRecords'

/**
 * The Donors page (Donor Management).
 *
 * What is locked in: the badges read the server's eligibility rather than
 * working it out again, an edit sends only what changed (so a locked field is
 * never re-sent), the export and reminders carry the page's filters, and the
 * page keeps the permission gates other specs rely on.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8')
}

describe('display helpers', () => {
  it('orders the blood groups as the filter lists them', () => {
    const codes = orderBloodGroups(['O+', 'AB-', 'A+', 'B-', 'O-', 'A-', 'AB+', 'B+'].map((code) => ({ code }))).map((t) => t.code)
    expect(codes).toEqual(['A-', 'A+', 'B-', 'B+', 'AB-', 'AB+', 'O-', 'O+'])
  })

  it('writes dates the way the list reads them', () => {
    expect(formatShortDate('2026-07-28')).toBe('28-Jul-2026')
    expect(formatShortDate('2026-10-26 09:30:00')).toBe('26-Oct-2026')
    expect(formatShortDate(null)).toBe('')
  })

  it('works out age from a birth date, not a year', () => {
    const today = new Date(2026, 9, 16)
    expect(ageFrom('1998-10-16', today)).toBe(28)
    expect(ageFrom('1998-10-17', today)).toBe(27)
    expect(donorSubline('female', '1998-10-17', today)).toBe('Female · 27y')
    expect(donorSubline(null, null, today)).toBe('')
  })

  it('reads a stored phone number the local way', () => {
    expect(formatPhone('+639171234567')).toBe('0917 123 4567')
    expect(formatPhone('(032) 555 0101')).toBe('(032) 555 0101')
    expect(formatPhone(null)).toBe('')
  })

  it('gives a tier from the first donation on', () => {
    expect(donorTier(0)).toBeNull()
    expect(donorTier(1)?.label).toBe('Bronze')
    expect(donorTier(5)?.label).toBe('Silver')
    expect(donorTier(10)?.label).toBe('Gold')
    expect(donorTier(25)?.label).toBe('Platinum')
  })

  it('names the export file by date', () => {
    expect(exportFilename(new Date(2026, 9, 6))).toBe('donors-2026-10-06.csv')
  })
})

describe('eligibility badge', () => {
  it('shows the date a waiting donor may give again', () => {
    expect(eligibilityBadge({ eligibility: 'waiting', next_eligible_date: '2026-10-26' })).toMatchObject({
      key: 'waiting',
      label: 'From 26-Oct-2026',
      tone: 'warn',
    })
  })

  it('reads red for a deferral with no end and amber for a temporary one', () => {
    expect(eligibilityBadge({ eligibility: 'deferred', deferral: { kind: 'permanent', recorded_on: '2026-02-14' } })).toMatchObject({
      label: 'Deferred',
      tone: 'crit',
      hint: 'Permanently deferred since 14-Feb-2026',
    })
    expect(eligibilityBadge({ eligibility: 'deferred', deferral: { kind: 'temporary' } }).tone).toBe('warn')
  })

  it('says only "Deferred" to the contact list, which is not told the kind', () => {
    expect(eligibilityBadge({ eligibility: 'deferred', deferral: null })).toMatchObject({ label: 'Deferred', hint: 'Deferred' })
  })

  it('never decides eligibility itself from the dates', () => {
    // The server said eligible; a stale next date must not turn it amber.
    expect(eligibilityBadge({ eligibility: 'eligible', next_eligible_date: '2099-01-01' }).key).toBe('eligible')
  })
})

describe('donor form payloads', () => {
  it('registers with only the fields that were filled in', () => {
    const form = { ...blankDonorForm(), first_name: ' Ana ', last_name: 'Cruz', birth_date: '1990-01-01', valid_id_number: 'N01', blood_type_id: '3' }
    expect(registerPayload(form)).toEqual({
      first_name: 'Ana',
      last_name: 'Cruz',
      birth_date: '1990-01-01',
      valid_id_number: 'N01',
      blood_type_id: 3,
      status: 'active',
    })
  })

  it('edits by sending only what changed, and clears a field with null', () => {
    const original = donorFormFrom({
      first_name: 'Mohit',
      last_name: 'Chandra',
      phone: '+639171234567',
      email: 'mohit@example.test',
      occupation: 'Engineer',
      address: 'House 42',
      status: 'active',
      blood_type_id: 2,
      valid_id_number: 'N01',
    })
    const form = { ...original, occupation: 'Teacher', address: '', valid_id_number: 'CHANGED' }

    expect(original.phone).toBe('09171234567')
    expect(editPayload(form, original)).toEqual({ occupation: 'Teacher', address: null })
  })

  it('sends nothing when nothing changed, so a locked field is never re-sent', () => {
    const original = donorFormFrom({ first_name: 'Ana', email: 'ana@example.test', status: 'inactive' })
    expect(editPayload({ ...original }, original)).toEqual({})
  })
})

describe('reminder dialog', () => {
  it('explains who is left out, in plain words', () => {
    expect(reminderSkipSummary({ not_yet_eligible: 4, no_email: 1, deferred: 0, opted_out: 0, recently_reminded: 2 }))
      .toBe('4 are not due yet · 2 were reminded in the last 7 days · 1 has no email address')
    expect(reminderSkipSummary({})).toBe('')
  })
})

describe('the donors service', () => {
  const request = vi.fn(async () => ({}))
  const requestBlob = vi.fn(async () => new Blob())

  beforeEach(() => {
    request.mockClear()
    requestBlob.mockClear()
  })

  async function service() {
    const { bloodCenterService } = await import('~/api/bloodcenter/BloodCenterService')
    ;(bloodCenterService as any).request = request
    ;(bloodCenterService as any).requestBlob = requestBlob
    return bloodCenterService
  }

  it('carries the page filters into the export, without empty ones', async () => {
    const svc = await service()
    await svc.exportDonors({ search: 'ana cruz', blood_type_id: 3, status: '', sort: 'newest' })
    expect(requestBlob).toHaveBeenCalledWith('/blood-center/donors/export?search=ana+cruz&blood_type_id=3&sort=newest')
  })

  it('reaches the centre-scoped routes and never names a facility', async () => {
    const svc = await service()
    await svc.sendDonorReminders({ blood_type_id: 3 })
    await svc.emailDonor('uuid-1', 'thank_you')
    await svc.updateDonor('uuid-1', { occupation: 'Nurse' })

    expect(request).toHaveBeenNthCalledWith(1, '/blood-center/donors/eligibility-reminders', 'POST', { blood_type_id: 3 })
    expect(request).toHaveBeenNthCalledWith(2, '/blood-center/donors/uuid-1/email', 'POST', { template: 'thank_you' })
    expect(request).toHaveBeenNthCalledWith(3, '/blood-center/donors/uuid-1', 'PATCH', { occupation: 'Nurse' })
  })
})

describe('the donors page', () => {
  const page = source('app/pages/blood-center/donors.vue')

  it('keeps its permission gates', () => {
    expect(page).toContain("requires: 'donors.view_contact'")
    expect(page).toContain("const canViewHistory = computed(() => can('donors.view_clinical'))")
    expect(page).toContain("const canManage = computed(() => can('donors.manage'))")
  })

  it('offers the mock-up toolbar: search, group, status, export, remind, refresh, new donor', () => {
    for (const text of ['All groups', 'All statuses', 'Export', 'Remind Eligible', 'Refresh', 'New Donor']) {
      expect(page).toContain(text)
    }
    expect(page).toMatch(/placeholder="Search name \/ phone \/ email \/ ID"/)
  })

  it('has no City column: the record keeps one address line', () => {
    expect(page).not.toMatch(/>\s*City\s*</)
    expect(page).toMatch(/<th v-if="!contactOnly" scope="col" class="c-address">Address<\/th>/)
  })

  it('fits its panel rather than scrolling sideways', () => {
    expect(page).toContain('table-layout: fixed')
    expect(page).toContain('container-type: inline-size')
    // Every header has a column class, so each width and breakpoint reaches it.
    const head = page.slice(page.indexOf('<table class="donor-table">'), page.indexOf('</thead>'))
    const headers = [...head.matchAll(/<th\b[^>]*scope="col"[^>]*>/g)].map((m) => m[0])
    expect(headers.length).toBe(10)
    expect(headers.filter((h) => !/class="c-[a-z]+/.test(h))).toEqual([])
  })

  it('shares one set of filters between the list, the export and the reminders', () => {
    expect(page).toContain('bloodCenterService.donors({ ...filterParams()')
    expect(page).toContain('bloodCenterService.exportDonors(filterParams())')
    expect(page).toContain('bloodCenterService.donorReminderPreview(filterParams())')
    expect(page).toContain('bloodCenterService.sendDonorReminders(filterParams())')
  })

  it('sends the server only what an edit changed', () => {
    expect(page).toContain('editPayload(form.data, form.original)')
  })
})

describe('settings', () => {
  it('puts the donor email templates on the Blood Center tab', () => {
    const settings = source('app/pages/blood-center/settings.vue')
    expect(settings).toMatch(/<BloodCenterFacilityLogoCard \/>\s*<BloodCenterDonorEmailTemplatesCard \/>/)
  })

  it('lets only the Admin edit them', () => {
    const card = source('app/components/BloodCenter/DonorEmailTemplatesCard.vue')
    expect(card).toContain("const canConfigure = computed(() => can('center.configure'))")
    expect(card).toMatch(/<section v-if="canConfigure"/)
  })
})
