import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  DEFERRAL_REASONS,
  DEFERRAL_STATUS_FILTERS,
  DEFERRAL_TYPES,
  OTHER_REASON,
  addDaysIso,
  deferralKindBadge,
  deferralPayload,
  deferralStatusBadge,
} from '~/utils/deferrals'
import { eligibilityBadge } from '~/utils/donorRecords'

/**
 * The Deferrals page under Donor (project owner, 2026-10-18): deferrals the
 * screening physician records on a donor by hand, outside a visit, and lifts.
 *
 * What is locked in: the page and its nav link ask for the same ability; the
 * form sends an Until date only with a temporary deferral; "Other" saves the
 * words typed; and the Donors list says when a hand-recorded deferral ends.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8')
}

const form = {
  donorUuid: 'd-1',
  outcome: 'temporarily_deferred',
  reason: 'Low haemoglobin',
  otherReason: '',
  from: '2026-10-18',
  until: '2026-11-17',
}

describe('deferral helpers', () => {
  it('offers the three DOH deferrals, mildest first, and the three statuses', () => {
    expect(DEFERRAL_TYPES.map((t) => t.value)).toEqual(['temporarily_deferred', 'indefinite_deferral', 'permanently_deferred'])
    expect(DEFERRAL_STATUS_FILTERS.map((s) => s.value)).toEqual(['active', 'expired', 'lifted'])
  })

  it('offers the mock-up reasons', () => {
    for (const reason of ['Low haemoglobin', 'Chronic condition', 'Recent tattoo/piercing']) {
      expect(DEFERRAL_REASONS).toContain(reason)
    }
  })

  it('colours the type by how long it lasts and only an active deferral green', () => {
    expect(deferralKindBadge('temporary')).toEqual({ label: 'Temporary', tone: 'warn' })
    expect(deferralKindBadge('permanent')).toEqual({ label: 'Permanent', tone: 'crit' })
    expect(deferralStatusBadge('active').tone).toBe('ok')
    expect(deferralStatusBadge('lifted')).toEqual({ label: 'Lifted', tone: 'neutral' })
    expect(deferralStatusBadge('expired')).toEqual({ label: 'Expired', tone: 'neutral' })
  })

  it('defaults Until to thirty days on, across a month end', () => {
    expect(addDaysIso('2026-10-18', 30)).toBe('2026-11-17')
    expect(addDaysIso('2026-12-15', 30)).toBe('2027-01-14')
  })

  it('sends Until only with a temporary deferral', () => {
    expect(deferralPayload(form)).toEqual({
      donor_uuid: 'd-1',
      outcome: 'temporarily_deferred',
      reason: 'Low haemoglobin',
      deferred_on: '2026-10-18',
      ends_on: '2026-11-17',
    })
    expect(deferralPayload({ ...form, outcome: 'permanently_deferred' })).not.toHaveProperty('ends_on')
  })

  it('saves the words typed for Other', () => {
    expect(deferralPayload({ ...form, reason: OTHER_REASON, otherReason: '  Awaiting cardiology review ' }).reason)
      .toBe('Awaiting cardiology review')
  })
})

describe('the Donors list pill', () => {
  it('says when a hand-recorded temporary deferral ends', () => {
    expect(eligibilityBadge({ eligibility: 'deferred', deferral: { kind: 'temporary', recorded_on: '2026-10-18', ends_on: '2026-11-17' } }).hint)
      .toBe('Temporarily deferred until 17-Nov-2026')
  })

  it('keeps the screening wording when there is no end date', () => {
    expect(eligibilityBadge({ eligibility: 'deferred', deferral: { kind: 'temporary', recorded_on: '2026-10-18' } }).hint)
      .toBe('Temporarily deferred until screened again since 18-Oct-2026')
  })
})

describe('the deferrals service', () => {
  it('lists, records and lifts through the centre-scoped routes', async () => {
    const { bloodCenterService } = await import('~/api/bloodcenter/BloodCenterService')
    const request = vi.fn(async () => ({}))
    ;(bloodCenterService as any).request = request

    await bloodCenterService.deferrals({ status: 'active' })
    await bloodCenterService.recordDeferral({ donor_uuid: 'd-1' })
    await bloodCenterService.liftDeferral(7, 'Cleared')

    expect(request).toHaveBeenCalledWith('/blood-center/deferrals', 'GET', { status: 'active' })
    expect(request).toHaveBeenCalledWith('/blood-center/deferrals', 'POST', { donor_uuid: 'd-1' })
    expect(request).toHaveBeenCalledWith('/blood-center/deferrals/7/lift', 'POST', { reason: 'Cleared' })
  })
})

describe('the deferrals page', () => {
  const page = source('app/pages/blood-center/deferrals.vue')
  const nav = source('app/composables/useBloodCenterNav.ts')

  it('is gated on donors.view_clinical, exactly as its nav link is', () => {
    expect(page).toContain("requires: 'donors.view_clinical'")
    expect(nav).toMatch(/label: 'Deferrals', path: '\/blood-center\/deferrals'[^}]*requires: 'donors\.view_clinical'/)
  })

  it('sits under Donor, after Appointments', () => {
    const donor = nav.slice(nav.indexOf("label: 'Donor',"), nav.indexOf("label: 'Collection',"))
    expect(donor.indexOf("label: 'Appointments'")).toBeLessThan(donor.indexOf("label: 'Deferrals'"))
  })

  it('offers New Deferral and Lift only to a holder of donors.defer', () => {
    expect(page).toContain("const canDefer = computed(() => can('donors.defer'))")
    expect(page).toContain('v-if="canDefer"')
    expect(page).toContain('v-if="row.can?.lift"')
  })

  it('is built like the mock-up: search, status, refresh, table, pager, dialog', () => {
    for (const text of ['Search donor / reason…', 'All statuses', 'Refresh', 'New Deferral', 'record(s)', 'Save Deferral', 'Ignored for permanent and indefinite deferrals.']) {
      expect(page).toContain(text)
    }
    for (const heading of ['ID', 'Donor', 'Type', 'Reason', 'From', 'Until', 'Status', 'Actions']) {
      expect(page).toContain(`>${heading}</th>`)
    }
  })
})
