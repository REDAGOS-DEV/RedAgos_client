import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  ABO_GROUPS,
  bloodTypeCode,
  bloodTypeCodeFor,
  resolveBloodTypeId,
  splitBloodTypeCode,
} from '~/utils/bloodType'
import { atTimeOn, normalizeBarcode, phlebotomyProblems, timeNow } from '~/utils/phlebotomy'
import {
  SEROLOGY_MARKERS,
  blankPanel,
  panelComplete,
  reactiveMarkers,
  serologyPayload,
} from '~/utils/serology'

/**
 * Section II of the DOH donor form: "For Technical Management Use Only".
 *
 * The phlebotomist's box at the counter, and the Testing department's
 * Immunohematology and Serology tables on their own page. What is locked in
 * here is what a quiet refactor could lose: that ABO + Rh resolve to exactly
 * one stored row and never a guess, that a scanned and a typed barcode are the
 * same number, that a reactive panel is never sent without a confirmation, and
 * that the preliminary fingerprick typing never pre-fills the real one.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8')
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((code, i) => ({ id: i + 1, code, label: code }))

describe('ABO + Rh over the combined blood type codes', () => {
  it('resolves all eight combinations to their own row', () => {
    for (const abo of ABO_GROUPS) {
      for (const rh of ['positive', 'negative'] as const) {
        const code = `${abo}${rh === 'positive' ? '+' : '-'}`
        const id = resolveBloodTypeId(BLOOD_TYPES, abo, rh)

        expect(id, code).toBe(BLOOD_TYPES.find((t) => t.code === code)!.id)
      }
    }
  })

  it('resolves nothing until both rows are chosen', () => {
    expect(resolveBloodTypeId(BLOOD_TYPES, 'A', '')).toBeNull()
    expect(resolveBloodTypeId(BLOOD_TYPES, '', 'positive')).toBeNull()
    expect(bloodTypeCode('O', null)).toBeNull()
  })

  it('never picks a nearby row for a combination the centre has not set up', () => {
    const withoutONegative = BLOOD_TYPES.filter((t) => t.code !== 'O-')

    expect(resolveBloodTypeId(withoutONegative, 'O', 'negative')).toBeNull()
  })

  it('splits a stored code back into the two form rows', () => {
    expect(splitBloodTypeCode('AB-')).toEqual({ abo: 'AB', rh: 'negative' })
    expect(splitBloodTypeCode('o+')).toEqual({ abo: 'O', rh: 'positive' })
    // AB must not be read as A with a stray B.
    expect(splitBloodTypeCode('AB+').abo).toBe('AB')
    expect(splitBloodTypeCode('XX-TEST')).toEqual({ abo: '', rh: '' })
    expect(splitBloodTypeCode(null)).toEqual({ abo: '', rh: '' })
  })

  it('reads the code for an id, and nothing for an unknown one', () => {
    expect(bloodTypeCodeFor(BLOOD_TYPES, 7)).toBe('O+')
    expect(bloodTypeCodeFor(BLOOD_TYPES, 99)).toBeNull()
    expect(bloodTypeCodeFor(BLOOD_TYPES, null)).toBeNull()
  })
})

describe('the phlebotomist box', () => {
  const day = new Date(2026, 8, 26, 12, 0, 0)
  const later = new Date(2026, 8, 26, 18, 0, 0)

  function box(overrides: Record<string, unknown> = {}) {
    return {
      blood_bag_type: 'double',
      donation_barcode: 'SEG-0001',
      started_time: '09:00',
      ended_time: '09:12',
      volume_ml: 450,
      ...overrides,
    } as any
  }

  it('normalises a scanned barcode the way the server stores it', () => {
    // A scanner appends a carriage return; staff type in lower case.
    expect(normalizeBarcode(' abc 123\r')).toBe('ABC123')
    expect(normalizeBarcode('seg-0001\t')).toBe('SEG-0001')
    expect(normalizeBarcode(undefined)).toBe('')
  })

  it('puts the two times on the visit day', () => {
    const iso = atTimeOn(day, '09:05')!
    const at = new Date(iso)

    expect(at.getFullYear()).toBe(2026)
    expect(at.getMonth()).toBe(8)
    expect(at.getDate()).toBe(26)
    expect(at.getHours()).toBe(9)
    expect(at.getMinutes()).toBe(5)
  })

  it('refuses a time that is not a clock time', () => {
    expect(atTimeOn(day, '')).toBeNull()
    expect(atTimeOn(day, '25:00')).toBeNull()
    expect(atTimeOn(day, '9')).toBeNull()
  })

  it('formats "Now" as a clock time', () => {
    expect(timeNow(new Date(2026, 0, 1, 7, 4))).toBe('07:04')
  })

  it('is ready when every line of the box is filled', () => {
    expect(phlebotomyProblems(box(), day, later)).toEqual([])
  })

  it('names each missing line', () => {
    const problems = phlebotomyProblems(box({ blood_bag_type: '', donation_barcode: '  ', started_time: '', ended_time: '' }), day, later)

    expect(problems).toContain('Choose the blood bag.')
    expect(problems).toContain('Scan or type the donation barcode.')
    expect(problems).toContain('Record the time started.')
    expect(problems).toContain('Record the time ended.')
  })

  it('refuses a draw that ends before it started, or in the future', () => {
    expect(phlebotomyProblems(box({ started_time: '09:30', ended_time: '09:10' }), day, later))
      .toContain('The time ended cannot be before the time started.')

    expect(phlebotomyProblems(box({ ended_time: '19:00' }), day, later))
      .toContain('The time ended cannot be in the future.')
  })

  it('keeps the volume bounds the server enforces', () => {
    expect(phlebotomyProblems(box({ volume_ml: 50 }), day, later)).toContain('Record a volume between 100 and 1000 mL.')
  })
})

describe('the serology panel', () => {
  const allClear = Object.fromEntries(SEROLOGY_MARKERS.map((m) => [m.value, 'non_reactive'])) as any

  it('is exactly the five markers the Testing department records', () => {
    expect(SEROLOGY_MARKERS.map((m) => m.value)).toEqual(['hiv', 'hbsag', 'hcv', 'syphilis', 'malaria'])
  })

  it('starts blank, so every reading is a deliberate choice', () => {
    const panel = blankPanel()

    expect(Object.values(panel).every((v) => v === '')).toBe(true)
    expect(panelComplete(panel)).toBe(false)
  })

  it('is complete only with a reading for every marker', () => {
    expect(panelComplete(allClear)).toBe(true)
    expect(panelComplete({ ...allClear, malaria: '' })).toBe(false)
  })

  it('names the reactive markers in the form order', () => {
    expect(reactiveMarkers({ ...allClear, syphilis: 'reactive', hiv: 'reactive' })).toEqual(['HIV', 'Syphilis'])
    expect(reactiveMarkers(allClear)).toEqual([])
  })

  it('never sends a confirmation with a clear panel', () => {
    expect(serologyPayload(allClear, true)).toEqual(allClear)
  })

  it('always says whether a reactive panel was confirmed', () => {
    const reactive = { ...allClear, hbsag: 'reactive' }

    expect(serologyPayload(reactive, false)).toEqual({ ...reactive, confirm_reactive: false })
    expect(serologyPayload(reactive, true)).toEqual({ ...reactive, confirm_reactive: true })
  })
})

describe('the Testing page', () => {
  const page = source('app/pages/blood-center/testing.vue')

  it('is shared by TTI Testing and Immunohematology, each seeing only its own section', () => {
    expect(page).toContain("requires: ['lab.record_serology', 'lab.record_immunohematology']")
    expect(page).toMatch(/<div v-if="canType" class="results__section results__section--typing">[\s\S]*?Immunohematology/)
    expect(page).toMatch(/<div v-if="canSerology" class="results__section results__section--serology">[\s\S]*?Serology/)
  })

  it('records both sections from one card with one Save button', () => {
    expect(page.match(/@click="submitResults"/g)).toHaveLength(1)
    expect(page).toContain("{{ busy ? 'Saving…' : 'Save' }}")
    // Half a section is never sent.
    expect(page).toContain('&& !serologyUnfinished.value')
  })

  it('saves a panel straight away, with no run', () => {
    expect(page).not.toContain('serology_run_id')
    expect(page).not.toContain('SerologyRun')
    expect(page).toContain('const panel = serologyPayload(readings, confirmed, markers.value)')
  })

  it('records ABO and Rh only, with no reverse group or antibody screen', () => {
    expect(page).toContain('forward_group: forwardGroup.value')
    expect(page).toContain("const typingForm = reactive({ blood_type_id: null, notes: '' })")
    expect(page).not.toContain('typingForm.reverse_group')
    expect(page).not.toContain('typingForm.antibody_screen')
  })

  it('never saves over a saved result: typing becomes a correction, serology is corrected on Serology Results', () => {
    expect(page).toMatch(/function requestTypingCorrection\(\) \{[\s\S]*?subject: 'immunohematology'/)
    expect(page).toContain('if (correcting && !refused) requestTypingCorrection()')
    expect(page).toContain(':subject="correction.subject"')
    // A saved panel is only shown here, with the way to where it is changed.
    expect(page).toContain('if (selected.value.serology) return null')
    expect(page).toContain(':disabled="locked || busy || Boolean(selected?.serology)"')
    expect(page).toContain('const locked = computed(() => !selected.value || isFinal.value)')
    expect(page).toContain('/blood-center/serology-results?donation=${selected.id}')
  })

  it('confirms a reactive panel before saving it', () => {
    // A reactive marker rejects the donation, defers the donor and refers
    // them. The dialog is the only way to send confirm_reactive: true.
    expect(page).toContain('const reactiveToSave = computed(() => serologyToRecord.value && pendingReactive.value.length > 0)')
    expect(page).toMatch(/if \(reactiveToSave\.value\) \{\s*confirmingReactive\.value = true\s*return/)
    expect(page).toContain('saveResults(false)')
    expect(page).toMatch(/function confirmReactive\(\)\s*\{\s*saveResults\(true\)/)
    expect(page).toContain('const panel = serologyPayload(readings, confirmed, markers.value)')
  })

  it('never pre-fills the typing from the fingerprick or the donor profile', () => {
    expect(page).toContain('typingForm.blood_type_id = payload.immunohematology?.blood_type_id ?? null')
    expect(page).not.toMatch(/typingForm\.blood_type_id\s*=.*fingerprick/)
    expect(page).not.toMatch(/typingForm\.blood_type_id\s*=.*donor\?\.blood_type/)
  })

  it('keeps the referral list behind its own ability, on its own page', () => {
    const referrals = source('app/pages/blood-center/counselling-referrals.vue')
    const nav = source('app/composables/useBloodCenterNav.ts')

    expect(referrals).toContain("requires: 'lab.referrals'")
    expect(nav).toMatch(/label: 'Counselling Referrals', path: '\/blood-center\/counselling-referrals'[^}]*requires: 'lab\.referrals'/)
    // The testing page only links to it, and only for its holder.
    expect(page).toContain("can('lab.referrals')")
    expect(page).toMatch(/v-if="isReactive && canSeeReferrals" to="\/blood-center\/counselling-referrals"/)
  })
})

describe('the Processing page', () => {
  const page = source('app/pages/blood-center/laboratory.vue')

  it('is Processing\'s own page and no longer records a test result', () => {
    expect(page).toContain("requires: 'lab.record_components'")
    expect(page).not.toContain('recordTestResult')
    expect(page).not.toContain('resultForm')
  })

  it('treats a result recorded before the panel as unfinished', () => {
    expect(page).toContain("if (row.test_result?.is_legacy) return 'Needs serology from Testing'")
  })

  it('shows its cards before a unit is picked, locked, with the list as tall as the bench and counts on the chips (project owner, 2026-10-22)', () => {
    expect(page).not.toContain('Pick a unit to start')
    expect(page).toContain('<fieldset v-else-if="!hasComponents" class="bags" :disabled="!selected">')
    expect(page).toContain("{{ selected ? donorTitle(selected.donor, selected.collection?.donation_barcode, selected.id) : '—' }}")
    expect(page).toContain('align-items: stretch;')
    // Each chip's count is its list's paginated total, one row asked for.
    expect(page).toContain('per_page: 1')
  })
})

describe('the counter', () => {
  const page = source('app/pages/blood-center/donation.vue')

  it('sends the whole phlebotomist box, with the barcode normalised', () => {
    expect(page).toContain('blood_bag_type: collectionForm.blood_bag_type')
    expect(page).toContain('donation_barcode: normalizeBarcode(collectionForm.donation_barcode)')
    expect(page).toContain('started_at: atTimeOn(day, collectionForm.started_time)')
    expect(page).toContain('ended_at: atTimeOn(day, collectionForm.ended_time)')
  })

  it('never sends a phlebotomist: that is whoever is signed in', () => {
    expect(page).not.toMatch(/collected_by\s*:/)
  })

  it('does not let a scanner\'s Enter submit half a record', () => {
    expect(page).toContain('@keydown.enter.prevent')
  })

  it('carries the valid-ID lookup\'s deferral into the visit', () => {
    expect(page).toContain('found.prior_deferral ?? null')
  })

  it('opens for any of the three counter roles', () => {
    expect(page).toContain("requires: ['donations.register', 'donations.screen', 'donations.collect']")
  })

  it('shows each stage\'s form only to the role that performs it', () => {
    expect(page).toContain("const canRegister = computed(() => can('donations.register'))")
    expect(page).toContain("const canScreen = computed(() => can('donations.screen'))")
    expect(page).toContain("const canCollect = computed(() => can('donations.collect'))")
    expect(page).toContain('v-if="canRegister" type="button" class="btn btn--primary" :disabled="busy" @click="openDonation"')
    expect(page).toContain(`v-else-if="stage === 'screening' && !canScreen"`)
    expect(page).toContain(`v-else-if="stage === 'collection' && !canCollect"`)
  })

  it('keeps the questionnaire with the physician', () => {
    expect(page).toContain("const canReadQuestionnaire = computed(() => can('donors.view_questionnaire'))")
    expect(page).toContain('v-if="donor && canReadQuestionnaire"')
    expect(page).toContain('v-if="canReadQuestionnaire && questionnaireOpen && questionnaire"')
  })
})

describe('navigation', () => {
  const nav = source('app/composables/useBloodCenterNav.ts')

  it('gives the laboratory one testing page and Processing its own, each gated on its own write', () => {
    expect(nav).toContain("export const TESTING_ABILITIES = ['lab.record_serology', 'lab.record_immunohematology'] as const")
    // One page, one link for both tests, gated on either department's write.
    expect(nav).toMatch(/label: 'Blood Testing', path: '\/blood-center\/testing'[^}]*requires: TESTING_ABILITIES/)
    expect(nav).not.toContain('/blood-center/testing?test=')
    expect(nav).not.toContain('/blood-center/immunohematology')
    expect(nav).toMatch(/label: 'Component Processing', path: '\/blood-center\/laboratory'[^}]*requires: 'lab\.record_components'/)
  })

  it('offers the corrections page to every role that may ask for one', () => {
    expect(nav).toMatch(/label: 'Corrections', path: '\/blood-center\/corrections'[^}]*requires: 'corrections\.request'/)
    expect(source('app/pages/blood-center/corrections.vue')).toContain("requires: 'corrections.request'")
  })

  /*
   * A nav item gated differently from its page either hides a page the user
   * may open or offers one that bounces them. Both of these did the latter.
   */
  it('gates the Donation link exactly as the Donation page is gated', () => {
    expect(nav).toContain("export const COLLECTION_ABILITIES = ['donations.register', 'donations.screen', 'donations.collect'] as const")
    expect(nav).toMatch(/label: 'Donation Counter', path: '\/blood-center\/donation'[^}]*requires: COLLECTION_ABILITIES/)
  })

  it('gates the fulfillment link on the ability the fulfillment page requires', () => {
    const page = source('app/pages/blood-center/fulfillment.vue')

    expect(page).toContain("requires: 'requests.release'")
    expect(nav).toMatch(/label: 'Request Fulfillment'[^}]*requires: 'requests\.release'/)
  })

  it('opens the donor list to Recruitment as a contact list', () => {
    const page = source('app/pages/blood-center/donors.vue')

    expect(page).toContain("requires: 'donors.view_contact'")
    expect(nav).toMatch(/label: 'Donor Management'[^}]*requires: 'donors\.view_contact'/)
    expect(page).toContain("const canViewHistory = computed(() => can('donors.view_clinical'))")
  })
})

describe('the incoming request queue', () => {
  const page = source('app/pages/blood-center/bloodrequests.vue')

  it('offers reserving to whoever allocates and declining to whoever decides', () => {
    expect(page).toContain("const canAllocate = computed(() => can('requests.process'))")
    expect(page).toContain("const canDecide = computed(() => can('requests.approve'))")
    expect(page).not.toMatch(/<button(?![^>]*v-(else-)?if="canAllocate")[^>]*@click="(openMenuId = null; )?requestApprove/)
    expect(page).not.toMatch(/<button(?![^>]*v-(else-)?if="canDecide")[^>]*@click="(openMenuId = null; )?requestReject/)
  })
})

describe('the staff roster', () => {
  const page = source('app/pages/blood-center/staff.vue')

  it('takes a title, a department, a role and privileges, as the Add Staff use case lists them', () => {
    expect(page).toContain('bloodCenterService.staffRoles()')
    // Title and role are pick-or-type fields (ComboInput, which replaced the
    // unstylable <datalist>): the suggestions still come from the catalogue.
    // The title holds credentials only, with no job post beside it (project
    // owner, 2026-10-22: "ROWENA TAN, RMT").
    expect(page).toMatch(/<ComboInput\s+id="staff-title"\s+v-model="form\.credentials"\s+:options="credentialOptions"/)
    expect(page).toContain('if (response?.data?.titles?.length) credentialOptions.value = response.data.titles')
    expect(page).not.toContain('form.position')
    // The department is the system dropdown (SelectField), fed by the catalogue.
    expect(page).toMatch(/<SelectField v-model="form\.department"[\s\S]{0,160}:options="departments\.map\(group => \(\{ value: group\.department, label: group\.label \}\)\)"/)
    // Several roles per person, all from the chosen department's catalogue
    // (project owner, 2026-10-17), plus an optional custom one.
    expect(page).toMatch(/<label v-for="role in departmentRoles"[^>]*>\s*<input v-model="form\.roles" type="checkbox" :value="role\.key"/)
    expect(page).toContain('id="staff-custom-role"')
    expect(page).toContain('v-model="form.staff_privileges" type="checkbox"')
  })

  it('sends the main role, the others and a custom one', () => {
    expect(page).toContain('staff_role: main,')
    expect(page).toContain('additional_staff_roles: ordered.filter((key) => key !== main),')
    expect(page).toContain('custom_role: form.custom_role.trim() || null,')
  })

  it('keeps every ticked role in the one department', () => {
    expect(page).toContain('const keys = new Set(departmentRoles.value.map((role) => role.key))')
  })

  it('can generate the temporary password, like the super admin form', () => {
    expect(page).toContain('@click="generatePassword"')
    expect(page).toContain("const chars = [pick(upper), pick(lower), pick(digits), pick(digits)]")
  })
})

describe('corrections', () => {
  const page = source('app/pages/blood-center/corrections.vue')
  const dialog = source('app/components/BloodCenter/CorrectionRequestDialog.vue')

  it('asks with a reason and the corrected values', () => {
    expect(dialog).toContain('bloodCenterService.requestCorrection(props.donationId, { subject: props.subject, ...payload })')
    expect(dialog).toContain('reason: reason.value.trim()')
    expect(dialog).toContain(':disabled="busy || !reason.trim()"')
  })

  it('files each Issuance and Billing subject through its own route', () => {
    expect(dialog).toContain('bloodCenterService.requestUnitCorrection(String(props.targetId), payload)')
    expect(dialog).toContain('bloodCenterService.requestDispatchCorrection(Number(props.targetId), payload)')
    expect(dialog).toContain('bloodCenterService.requestPaymentCorrection(Number(props.targetId), payload)')

    const service = source('app/api/bloodcenter/BloodCenterService.ts')
    expect(service).toContain('`${this.resource}/inventory/${encodeURIComponent(unitId)}/corrections`')
    expect(service).toContain('`${this.resource}/allocations/${allocationId}/corrections`')
    expect(service).toContain('`${this.resource}/payments/${paymentId}/corrections`')
  })

  it('names every department\'s head, and tells a head their own correction applies at once', () => {
    for (const title of [
      'the Donor Screening Physician',
      'the Component Laboratory Medical Technologist',
      'the Laboratory Supervisor',
      'the Inventory Control Officer',
      'the Billing Supervisor',
    ]) {
      expect(dialog).toContain(title)
    }

    // Head by any of their roles, not only the main one.
    expect(dialog).toContain('(user.value?.staff_roles ?? []).includes(head.value.role)')
    expect(dialog).toContain('applied as soon as you send it')
    expect(dialog).not.toContain('Center Admin')
    // The consultant role was withdrawn with its department.
    expect(dialog).not.toContain('Reference Laboratory Consultant')
  })

  it('offers the Issuance and Billing corrections only to the posts the server admits', () => {
    const inventory = source('app/pages/blood-center/inventory.vue')
    expect(inventory).toContain("can('inventory.update')")
    expect(inventory).toContain("canFile('unit_details')")
    expect(inventory).toContain('subject="unit_details"')

    const fulfillment = source('app/pages/blood-center/fulfillment.vue')
    expect(fulfillment).toContain("can('corrections.request') && canFile('dispatch')")
    expect(fulfillment).toContain('subject="dispatch"')

    // Payments are corrected and voided on the statement's own page.
    const billing = source('app/pages/blood-center/statement/[id].vue')
    expect(billing).toContain("can('billing.record_payment') && can('corrections.request') && canFile('payment')")
    expect(billing).toContain('subject="payment"')
    // The payments, with their references, are behind the ability to record them.
    expect(billing).toContain("const canSeePayments = computed(() => can('billing.record_payment'))")
    expect(billing).toContain('bloodCenterService.billingPayments(')
  })

  it('sends only the fields a unit edit changes, so an expired unit is not sent a storage location', () => {
    const inventory = source('app/pages/blood-center/inventory.vue')

    expect(inventory).toContain("if (row.status !== 'expired'")
    expect(inventory).toContain('bloodCenterService.updateBloodUnit(editingBatchId.value, changes)')
  })

  it('shows what a correction is about, whether or not it is a donation', () => {
    expect(page).toContain("item.target_label || ('Donation #' + item.donation_id)")
    expect(page).toContain('record_changed:')
  })

  it('lets only the server decide who may decide', () => {
    expect(page).toContain('v-if="item.can_decide"')
    expect(page).toContain("bloodCenterService.rejectCorrection(item.id, { note })")
    expect(page).toContain(":disabled=\"busy === item.id || !(notes[item.id] || '').trim()\"")
  })

  it('is reached from every page that saves a correctable record', () => {
    // A breakdown is corrected on the Processed list (project owner, 2026-10-19).
    expect(source('app/pages/blood-center/processed.vue')).toContain("subject: 'components'")
    expect(source('app/pages/blood-center/donation.vue')).toContain('startScreeningCorrection')
    expect(source('app/pages/blood-center/donation.vue')).toContain('startCollectionCorrection')
  })
})
