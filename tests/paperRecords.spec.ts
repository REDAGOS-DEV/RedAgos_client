import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  PAPER_OUTCOMES,
  blankPaperRow,
  daysSinceDrive,
  expectsCollection,
  paperRowPayload,
  paperRowProblems,
  sheetDay,
  sheetSummary,
} from '~/utils/paperDonations'
import { OTHER_DEFERRAL } from '~/utils/deferralCodes'

/**
 * Paper records (project owner, 2026-10-17): a remote drive's screening and
 * phlebotomy, written on paper and typed in when the sheets come back.
 *
 * What is locked in: every time is put on the drive's day, never on today;
 * a row sends only what the paper gave; and the pages are reached from the
 * Donations list and a completed drive, by the Collection department only.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8')
}

const HELD_ON = '2026-10-10'
const NOW = new Date(2026, 9, 17, 12, 0)
const SHEET = { screened_by_name: 'Dr. Reyes', phlebotomist_name: 'J. Cruz' }

function drawnRow() {
  return {
    ...blankPaperRow(SHEET),
    systolic_bp: '120',
    diastolic_bp: 80,
    temperature_c: '36.6',
    blood_bag_type: 'single',
    donation_barcode: ' pd-0001\t',
    started_time: '09:30',
    ended_time: '09:41',
    volume_ml: '450',
  }
}

describe('a paper row', () => {
  it('starts from the names the sheet says most rows carry, and accepted', () => {
    const row = blankPaperRow(SHEET)

    expect(row.screened_by_name).toBe('Dr. Reyes')
    expect(row.phlebotomist_name).toBe('J. Cruz')
    expect(row.outcome).toBe('accepted')
    expect(row.draw).toBe('collected')
    expect(row.blood_bag_type).toBe('')
    expect(PAPER_OUTCOMES.map((o) => o.value)).toEqual(['accepted', 'temporarily_deferred', 'permanently_deferred', 'indefinite_deferral'])
  })

  it('reads the drive day as a local date', () => {
    const day = sheetDay(HELD_ON)

    expect([day.getFullYear(), day.getMonth(), day.getDate()]).toEqual([2026, 9, 10])
  })

  it('carries a phlebotomist box only when accepted and drawn', () => {
    expect(expectsCollection({ outcome: 'accepted', draw: 'collected' })).toBe(true)
    expect(expectsCollection({ outcome: 'accepted', draw: 'failed' })).toBe(false)
    expect(expectsCollection({ outcome: 'temporarily_deferred', draw: 'collected' })).toBe(false)
  })
})

describe('what a paper row is missing', () => {
  it('is nothing for a complete drawn row', () => {
    expect(paperRowProblems(drawnRow(), HELD_ON, NOW)).toEqual([])
  })

  it('needs the names on the paper', () => {
    const row = { ...drawnRow(), screened_by_name: ' ', phlebotomist_name: '' }

    expect(paperRowProblems(row, HELD_ON, NOW)).toEqual([
      'Give the name of the physician who screened the donor.',
      'Give the name of the phlebotomist.',
    ])
  })

  it('holds the bag to the counter\'s own rules, on the drive\'s day', () => {
    const row = { ...drawnRow(), blood_bag_type: '', ended_time: '09:00' }

    expect(paperRowProblems(row, HELD_ON, NOW)).toEqual([
      'Choose the blood bag.',
      'The time ended cannot be before the time started.',
    ])

    // Today's drive: a draw cannot end after now.
    const today = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, '0')}-${String(NOW.getDate()).padStart(2, '0')}`
    expect(paperRowProblems({ ...drawnRow(), started_time: '12:30', ended_time: '12:40' }, today, NOW))
      .toContain('The time ended cannot be in the future.')
  })

  it('asks a deferral for its code and nothing about a bag', () => {
    const row = { ...blankPaperRow(SHEET), outcome: 'permanently_deferred' as const }

    expect(paperRowProblems(row, HELD_ON, NOW)).toEqual(['Choose the deferral code written on the paper.'])
  })

  it('asks why a draw was not completed, or why a bag will not reach the lab', () => {
    expect(paperRowProblems({ ...blankPaperRow(SHEET), draw: 'failed' as const }, HELD_ON, NOW))
      .toEqual(['Say why the draw was not completed.'])
    expect(paperRowProblems({ ...drawnRow(), not_to_lab: true }, HELD_ON, NOW))
      .toEqual(['Say why the bag will not reach the laboratory.'])
  })

  it('refuses a screening time that is not a time', () => {
    expect(paperRowProblems({ ...drawnRow(), screened_time: '25:00' }, HELD_ON, NOW))
      .toEqual(['The screening time is not a valid time.'])
  })
})

describe('what a paper row sends', () => {
  it('puts every time on the drive\'s day and normalises the barcode', () => {
    const payload = paperRowPayload({ ...drawnRow(), screened_time: '09:05' }, HELD_ON, 'uuid-1')
    const started = new Date(payload.collection.started_at)
    const screened = new Date(payload.screened_at)

    expect([started.getFullYear(), started.getMonth(), started.getDate(), started.getHours(), started.getMinutes()])
      .toEqual([2026, 9, 10, 9, 30])
    expect([screened.getDate(), screened.getHours(), screened.getMinutes()]).toEqual([10, 9, 5])
    expect(payload.collection).toMatchObject({
      blood_bag_type: 'single',
      donation_barcode: 'PD-0001',
      volume_ml: 450,
      phlebotomist_name: 'J. Cruz',
    })
  })

  it('sends only what the paper gave, as numbers where the server wants them', () => {
    const payload = paperRowPayload(drawnRow(), HELD_ON, 'uuid-1')

    expect(payload).toMatchObject({ donor_uuid: 'uuid-1', screened_by_name: 'Dr. Reyes', outcome: 'accepted', systolic_bp: 120, diastolic_bp: 80, temperature_c: 36.6 })
    for (const key of ['screened_at', 'pulse_bpm', 'weight_kg', 'haemoglobin_g_dl', 'fingerprick_blood_type_id', 'skin', 'notes', 'deferral_code', 'draw_failed', 'not_to_lab', 'confirm_interval']) {
      expect(payload).not.toHaveProperty(key)
    }
  })

  it('sends a deferral with the code written on the paper and no bag', () => {
    const payload = paperRowPayload({ ...drawnRow(), outcome: 'temporarily_deferred', deferral_code: ' R2-Low ' }, HELD_ON, 'u')

    expect(payload.deferral_code).toBe('R2-Low')
    expect(payload).not.toHaveProperty('other_reason')
    expect(payload).not.toHaveProperty('collection')
  })

  it('sends Other as the reason written, with no code', () => {
    const row = { ...drawnRow(), outcome: 'temporarily_deferred' as const, deferral_code: OTHER_DEFERRAL, other_reason: ' Low Hb ' }

    expect(paperRowProblems({ ...row, other_reason: '' }, HELD_ON, NOW)).toEqual(['Give the reason written on the paper.'])
    expect(paperRowPayload(row, HELD_ON, 'u')).toMatchObject({ other_reason: 'Low Hb' })
    expect(paperRowPayload(row, HELD_ON, 'u')).not.toHaveProperty('deferral_code')
  })

  it('sends a draw not completed, a bag not reaching the lab, and a confirmed interval', () => {
    expect(paperRowPayload({ ...drawnRow(), draw: 'failed', draw_failed_reason: 'Vein collapsed' }, HELD_ON, 'u'))
      .toMatchObject({ draw_failed: true, draw_failed_reason: 'Vein collapsed' })

    const lost = paperRowPayload({ ...drawnRow(), not_to_lab: true, not_to_lab_reason: 'Broken' }, HELD_ON, 'u', true)
    expect(lost).toMatchObject({ not_to_lab: true, not_to_lab_reason: 'Broken', confirm_interval: true })
    expect(lost.collection).toBeTruthy()
  })
})

describe('sheet helpers', () => {
  it('sums a sheet up in a line', () => {
    expect(sheetSummary({ rows: 0, drawn: 0, deferred: 0 })).toBe('0 donors')
    expect(sheetSummary({ rows: 12, drawn: 10, deferred: 2 })).toBe('12 donors · 10 drawn · 2 deferred')
    expect(sheetSummary({ rows: 1, drawn: 1, deferred: 0 })).toBe('1 donor · 1 drawn · 0 deferred')
  })

  it('counts whole days since the drive', () => {
    expect(daysSinceDrive(HELD_ON, NOW)).toBe(7)
  })
})

describe('the paper records service', () => {
  it('reaches each route with the right verb and body', async () => {
    const { bloodCenterService } = await import('~/api/bloodcenter/BloodCenterService')
    const request = vi.fn(async () => ({}))
    ;(bloodCenterService as any).request = request

    await bloodCenterService.paperSheets({ page: 2 })
    await bloodCenterService.paperSheetOptions()
    await bloodCenterService.createPaperSheet({ drive_name: 'X' })
    await bloodCenterService.paperSheet(7)
    await bloodCenterService.deletePaperSheet(7)
    await bloodCenterService.registerPaperDonor({ first_name: 'A' })
    await bloodCenterService.recordPaperDonation(7, { outcome: 'accepted' })
    await bloodCenterService.removePaperDonation(7, 41, { reason: 'Wrong donor' })

    expect(request.mock.calls).toEqual([
      ['/blood-center/paper-sheets', 'GET', { page: 2 }],
      ['/blood-center/paper-sheets/options', 'GET'],
      ['/blood-center/paper-sheets', 'POST', { drive_name: 'X' }],
      ['/blood-center/paper-sheets/7', 'GET'],
      ['/blood-center/paper-sheets/7', 'DELETE'],
      ['/blood-center/paper-sheets/donors', 'POST', { first_name: 'A' }],
      ['/blood-center/paper-sheets/7/donations', 'POST', { outcome: 'accepted' }],
      ['/blood-center/paper-sheets/7/donations/41', 'DELETE', { reason: 'Wrong donor' }],
    ])
  })
})

describe('the paper records pages', () => {
  const list = source('app/pages/blood-center/paper-records/index.vue')
  const sheet = source('app/pages/blood-center/paper-records/[id].vue')
  const form = source('app/components/BloodCenter/PaperDonationForm.vue')
  const donor = source('app/components/BloodCenter/QuickDonorForm.vue')
  const donations = source('app/pages/blood-center/donations.vue')
  const drives = source('app/pages/blood-center/drives.vue')

  it('are gated on the paper ability the server checks', () => {
    expect(list).toContain("requires: 'donations.record_paper'")
    expect(sheet).toContain("requires: 'donations.record_paper'")
  })

  it('are reached from the Donations list and from a drive already held', () => {
    expect(donations).toContain("const canRecordPaper = computed(() => can('donations.record_paper'))")
    expect(donations).toContain('to="/blood-center/paper-records"')
    expect(donations).toContain("v-if=\"row.source === 'paper'\"")
    expect(drives).toContain(':to="`/blood-center/paper-records?drive=${drive.id}`"')
    expect(list).toContain('if (route.query.drive) openNewSheet(route.query.drive)')
  })

  it('finds the donor through the counter\'s own search and exact lookup', () => {
    expect(form).toContain('bloodCenterService.searchCounterDonors(q)')
    expect(form).toContain("bloodCenterService.lookupDonor({ type: 'donor_code', value: result.donor_code })")
    expect(form).toContain('<BloodCenterPriorDeferralNotice')
  })

  it('asks before saving a draw too close to another', () => {
    expect(form).toContain("err?.data?.code === 'interval_conflict'")
    expect(form).toContain('@click="save(true)"')
  })

  it('registers a new donor through the paper route, with the Donors page helpers', () => {
    expect(donor).toContain('bloodCenterService.registerPaperDonor(registerPayload(form))')
  })

  it('never shows a name the viewer may not see', () => {
    expect(sheet).toContain('row.donor && !row.donor.blinded')
    expect(sheet).toContain('Identity hidden')
  })
})
