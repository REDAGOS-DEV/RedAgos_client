import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  DEFERRAL_STATUS_FILTERS,
  DEFERRAL_TYPES,
  addDaysIso,
  deferralKindBadge,
  deferralPayload,
  deferralStatusBadge,
} from '~/utils/deferrals'
import {
  OTHER_DEFERRAL,
  deferralChoiceComplete,
  deferralCodeOptions,
  isValidDeferralCode,
  nextDeferralCode,
  normaliseDeferralCode,
  sortDeferralCodes,
} from '~/utils/deferralCodes'
import { eligibilityBadge } from '~/utils/donorRecords'

/**
 * The Deferrals page under Donor (project owner, 2026-10-18): deferrals the
 * screening physician records on a donor by hand, outside a visit, and lifts.
 *
 * What is locked in: the page and its nav link ask for the same ability; the
 * form sends a deferral code (project owner, 2026-10-24) or Other's typed
 * reason, and an Until date only with a temporary deferral; the picker lists
 * codes alone; the record shows the code with its reason folded; and the
 * Donors list says when a hand-recorded deferral ends.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8')
}

const form = {
  donorUuid: 'd-1',
  outcome: 'temporarily_deferred',
  code: 'R1',
  otherReason: '',
  from: '2026-10-18',
  until: '2026-11-17',
}

describe('deferral helpers', () => {
  it('offers the three DOH deferrals, mildest first, and the three statuses', () => {
    expect(DEFERRAL_TYPES.map((t) => t.value)).toEqual(['temporarily_deferred', 'indefinite_deferral', 'permanently_deferred'])
    expect(DEFERRAL_STATUS_FILTERS.map((s) => s.value)).toEqual(['active', 'expired', 'lifted'])
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

  it('sends the deferral code, never the reason, and Until only with a temporary deferral', () => {
    expect(deferralPayload(form)).toEqual({
      donor_uuid: 'd-1',
      outcome: 'temporarily_deferred',
      deferral_code: 'R1',
      deferred_on: '2026-10-18',
      ends_on: '2026-11-17',
    })
    expect(deferralPayload({ ...form, outcome: 'permanently_deferred' })).not.toHaveProperty('ends_on')
  })

  it('sends Other as the reason typed, with no code', () => {
    const payload = deferralPayload({ ...form, code: OTHER_DEFERRAL, otherReason: '  Awaiting cardiology review ' })
    expect(payload.other_reason).toBe('Awaiting cardiology review')
    expect(payload).not.toHaveProperty('deferral_code')
  })
})

describe('deferral codes', () => {
  const codes = [
    { id: 1, code: 'R1', reason: 'Recent tattoo/piercing', retired: false },
    { id: 2, code: 'R10', reason: 'Recent travel to a malaria area', retired: false },
    { id: 3, code: 'R2-Low', reason: 'Low haemoglobin', retired: false },
    { id: 4, code: 'R3', reason: 'Recent illness or fever', retired: true },
  ]

  it('lists the active codes alone, never their reason, then Other', () => {
    expect(deferralCodeOptions(codes)).toEqual([
      { value: 'R1', label: 'R1' },
      { value: 'R10', label: 'R10' },
      { value: 'R2-Low', label: 'R2-Low' },
      { value: OTHER_DEFERRAL, label: 'Other' },
    ])
  })

  it('needs the words typed when Other is picked', () => {
    expect(deferralChoiceComplete('R1', '')).toBe(true)
    expect(deferralChoiceComplete('', '')).toBe(false)
    expect(deferralChoiceComplete(OTHER_DEFERRAL, '  ')).toBe(false)
    expect(deferralChoiceComplete(OTHER_DEFERRAL, 'Awaiting review')).toBe(true)
  })

  it('suggests the next R code, counting retired ones, and sorts as people count', () => {
    expect(nextDeferralCode(codes)).toBe('R11')
    expect(nextDeferralCode([])).toBe('R1')
    expect(sortDeferralCodes(codes).map((c) => c.code)).toEqual(['R1', 'R2-Low', 'R3', 'R10'])
  })

  it('checks a code as the server does, keeping its case', () => {
    expect(normaliseDeferralCode(' R2-Low ')).toBe('R2-Low')
    expect(isValidDeferralCode('R2-High')).toBe(true)
    expect(isValidDeferralCode('t-2')).toBe(true)
    expect(isValidDeferralCode('R 14!')).toBe(false)
    expect(isValidDeferralCode('')).toBe(false)
    expect(isValidDeferralCode('R'.repeat(17))).toBe(false)
  })

  it('lists, adds and changes them through the centre-scoped routes', async () => {
    const { bloodCenterService } = await import('~/api/bloodcenter/BloodCenterService')
    const request = vi.fn(async () => ({}))
    ;(bloodCenterService as any).request = request

    await bloodCenterService.deferralCodes()
    await bloodCenterService.deferralCodes({ include_retired: true })
    await bloodCenterService.addDeferralCode({ code: 'R13', reason: 'Recent transfusion' })
    await bloodCenterService.updateDeferralCode(4, { retired: true })

    expect(request).toHaveBeenCalledWith('/blood-center/deferral-codes', 'GET', {})
    expect(request).toHaveBeenCalledWith('/blood-center/deferral-codes', 'GET', { include_retired: 1 })
    expect(request).toHaveBeenCalledWith('/blood-center/deferral-codes', 'POST', { code: 'R13', reason: 'Recent transfusion' })
    expect(request).toHaveBeenCalledWith('/blood-center/deferral-codes/4', 'PATCH', { retired: true })
  })

  it('has a page under Management, gated exactly as its nav link is', () => {
    const page = source('app/pages/blood-center/deferral-codes.vue')
    const nav = source('app/composables/useBloodCenterNav.ts')

    expect(page).toContain("requires: ['deferrals.configure', 'donors.view_clinical']")
    expect(nav).toMatch(/label: 'Deferral Codes', path: '\/blood-center\/deferral-codes'[^}]*requires: \['deferrals\.configure', 'donors\.view_clinical'\]/)
    const management = nav.slice(nav.indexOf("label: 'Management',"), nav.indexOf("label: 'Account',"))
    const donor = nav.slice(nav.indexOf("label: 'Donor',"), nav.indexOf("label: 'Collection',"))
    expect(management).toContain("label: 'Deferral Codes'")
    expect(donor).not.toContain("label: 'Deferral Codes'")
  })

  it('records every deferral by code, and shows the code with the reason folded', () => {
    const counter = source('app/pages/blood-center/donation.vue')
    const paper = source('app/components/BloodCenter/PaperDonationForm.vue')
    const deferrals = source('app/pages/blood-center/deferrals.vue')

    expect(counter).toContain('deferralChoicePayload(screeningForm.deferral_code, screeningForm.other_reason)')
    expect(counter).not.toContain('deferral_reason: \'\'')
    expect(paper).toContain('v-model="form.deferral_code"')
    expect(paper).toContain('v-model="form.other_reason"')
    expect(source('app/components/BloodCenter/DeferralFormDialog.vue')).toContain('v-model="form.otherReason"')
    expect(deferrals).toContain('<DeferralCodeTag :code="row.reason_code" :reason="row.reason" />')
    expect(source('app/components/BloodCenter/DeferralCodeTag.vue')).toContain('v-if="shown" class="dct__reason"')
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

    // A counter or paper screening's deferral is lifted the same way (project owner, 2026-10-25).
    await bloodCenterService.liftDeferral(9, 'Rechecked', 'screening')
    expect(request).toHaveBeenCalledWith('/blood-center/deferrals/9/lift', 'POST', { reason: 'Rechecked', source: 'screening' })
  })
})

describe('one deferral form for the Deferrals page and the counter', () => {
  const dialog = source('app/components/BloodCenter/DeferralFormDialog.vue')
  const deferrals = source('app/pages/blood-center/deferrals.vue')
  const counter = source('app/pages/blood-center/donation.vue')

  it('is the shared component on both pages, never a copy', () => {
    expect(deferrals).toContain('<DeferralFormDialog')
    expect(counter).toContain('<BloodCenterDeferralFormDialog')
    expect(deferrals).not.toContain('id="d-reason"')
    expect(counter).not.toContain('id="screening-deferral-code"')
  })

  it('at the counter, fixes the donor and today, hides locked codes and pre-selects the suggestion', () => {
    expect(counter).toMatch(/<BloodCenterDeferralFormDialog[^>]*:donor="dialogDonor"[^>]*:hidden-codes="lockedCodes"[^>]*:suggested-code="suggestedCode"[^>]*fixed-from/)
    expect(dialog).toContain('<button v-if="!donor" type="button" class="btn-link" @click="form.donor = null">Change</button>')
    expect(dialog).toContain(':disabled="fixedFrom"')
    expect(dialog).toContain('if (match && !form.code) form.code = match.value')
  })

  it('waits for all six readings before accepting or deferring', () => {
    expect(counter).toContain(':disabled="busy || !vitalsComplete || (needsQuestionnaire && !dhqOnPaper)"')
    expect(counter).toContain(':disabled="busy || !vitalsComplete" :title="missingVitalsHint" @click="deferring = true"')
    // No banner: the buttons say on hover what is still missing (project owner, 2026-10-25).
    expect(counter).not.toContain('Record every vital sign first.')
    expect(counter).toContain(':title="missingVitalsHint"')
  })

  it('sends the Until date with a temporary deferral, and keeps the form open when the save is refused', () => {
    expect(counter).toContain("if (outcome === 'temporarily_deferred') payload.deferred_until = screeningForm.deferred_until")
    expect(counter).toContain('if (await recordScreening(payload)) deferring.value = false')
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
    const dialog = source('app/components/BloodCenter/DeferralFormDialog.vue')
    for (const text of ['Search donor / code…', 'All statuses', 'Refresh', 'New Deferral', 'record(s)']) {
      expect(page).toContain(text)
    }
    for (const text of ['Save Deferral', 'Ignored for permanent and indefinite deferrals.', 'Search donor…', 'Until Date']) {
      expect(dialog).toContain(text)
    }
    for (const heading of ['ID', 'Donor', 'Type', 'Reason', 'From', 'Until', 'Status', 'Actions']) {
      expect(page).toContain(`>${heading}</th>`)
    }
  })
})
