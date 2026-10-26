import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { eligibilityBadge, startDonationBlock } from '~/utils/donorRecords'

/**
 * The Donation page's two ways in, and the questionnaire each one brings.
 *
 * Asserted against the source, as the other counter specs are: the project has
 * no component-testing harness, and what these guard is that the safeguards
 * are present at all -- the walk-in search goes through the exact lookup, the
 * physician cannot accept without a questionnaire, the printed form carries no
 * review markers, and the onsite form does not keep the answers on screen.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

// Line endings normalised: a Windows checkout (core.autocrlf) writes CRLF.
function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8').replace(/\r\n/g, '\n')
}

describe('the Donation page', () => {
  const page = source('app/pages/blood-center/donation.vue')

  it('is called Donation counter, as the sidebar names it', () => {
    expect(page).toContain('<h1 class="collection__title">Donation counter</h1>')
  })

  it('keeps the old address as a redirect, so a bookmark still lands', () => {
    const old = source('app/pages/blood-center/collection.vue')

    expect(old).toContain("redirect: '/blood-center/donation'")
    expect(old).not.toContain('useDonationTransaction')
  })

  // The counter identifies nobody itself (project owner, 2026-10-24): the QR
  // is scanned on Donations, a walk-in starts from Donor Management.
  it('neither scans nor searches, and says where a visit starts', () => {
    expect(page).not.toContain('<BloodCenterQrScanner')
    expect(page).not.toContain('searchCounterDonors')
    expect(page).toContain('No donor at the counter')
    expect(page).toContain('<NuxtLink to="/blood-center/donations" class="btn btn--primary">')
  })

  it('takes a QR verified on Donations once, from memory', () => {
    expect(page).toContain('const handed = handoff.value')
    expect(page).toContain("handoff.value = null\n    adoptArrival(handed.data, 'qr')")
  })

  it('goes back to Donations after a visit', () => {
    expect(page).toMatch(/function finishVisit\(\) \{[\s\S]*?navigateTo\('\/blood-center\/donations'\)/)
  })

  // The onsite DHQ is optional (project owner, 2026-10-17): with none on file,
  // the physician confirms the donor answered the paper form, and the
  // screening records it.
  it('accepts a donor without a questionnaire on file only on the paper DHQ, and records it', () => {
    expect(page).toContain(':disabled="busy || !vitalsComplete || (needsQuestionnaire && !dhqOnPaper)"')
    expect(page).toContain("const needsQuestionnaire = computed(() => !dhqOnFile.value && correcting.value !== 'screening')")
    expect(page).toContain('<input v-model="dhqOnPaper" type="checkbox"')
    expect(page).toContain('if (needsQuestionnaire.value && dhqOnPaper.value) payload.dhq_on_paper = true')
  })

  it('gates printing and the onsite form on their own abilities', () => {
    expect(page).toContain("const canPrintQuestionnaire = computed(() => can('donors.print_questionnaire'))")
    expect(page).toContain("const canRecordQuestionnaire = computed(() => can('donors.record_questionnaire'))")
    expect(page).toContain('v-if="canPrintQuestionnaire && questionnaireMeta?.available"')
    // The physician's review drawer is still the physician's alone.
    expect(page).toContain('v-if="canReadQuestionnaire && questionnaireOpen && questionnaire"')
  })

  it('takes the onsite questionnaire only against an open donation', () => {
    expect(page).toContain(':disabled="!donation || isClosed"')
  })

  it('prints the scanned questionnaire on its own page', () => {
    expect(page).toContain('`/blood-center/dhq-print/${donor.value.uuid}?${query}`')
    expect(page).toContain("query.set('screening_id', String(questionnaireMeta.value.screening_id))")
  })
})

describe('the printed questionnaire', () => {
  const sheet = source('app/components/BloodCenter/DonorQuestionnaireSheet.vue')
  const printPage = source('app/pages/blood-center/dhq-print/[uuid].vue')

  it('is opened only with the print ability', () => {
    expect(printPage).toContain("requires: 'donors.print_questionnaire'")
  })

  it('carries the answers and none of the review aids', () => {
    expect(sheet).not.toContain('flagged')
    expect(sheet).not.toContain('computed_assessment')
  })

  it('never prints an unasked question as a No', () => {
    expect(sheet).toContain('!question.applicable || question.answer === null')
  })

  it('says where the answers came from', () => {
    expect(sheet).toContain('Completed onsite at the counter')
    expect(sheet).toContain('Completed by the donor in the Donor Portal')
  })
})

describe('the onsite questionnaire', () => {
  const onsite = source('app/components/BloodCenter/OnsiteQuestionnaire.vue')

  it('sends "not applicable" as no answer rather than a No', () => {
    expect(onsite).toContain('.filter((q) => answers[q.code] !== undefined && answers[q.code] !== null)')
  })

  it('sends the vitals only with a weight, which the server requires with them', () => {
    expect(onsite).toContain("if (vitals.weight !== null && vitals.weight !== '') {")
  })

  it('clears the answers once recorded, before the device goes back to staff', () => {
    expect(onsite).toContain('recorded.value = result?.data ?? { available: true }\n    clearAnswers()')
    expect(onsite).toContain('Please hand the device back to the staff member.')
  })
})

describe('Start donation from Donor Management', () => {
  const page = source('app/pages/blood-center/donation.vue')
  const donors = source('app/pages/blood-center/donors.vue')

  it('links each donor to the counter, for those who can use it and bring a donor up there', () => {
    expect(donors).toContain("const canStartDonation = computed(() => can('appointments.verify') && can(COLLECTION_ABILITIES))")
    expect(donors).toContain("return { path: '/blood-center/donation', query: { donor: donorUuid } }")
    expect(donors).toContain(':to="counterLink(donor.uuid)"')
    expect(donors).toContain(':to="counterLink(profile.uuid)"')
  })

  it('offers it only for an eligible donor, saying why not otherwise', () => {
    expect(donors).toContain('v-if="!startDonationBlock(donor.eligibility)"')
    expect(donors).toContain('v-if="!startDonationBlock(profile.eligibility)"')
    expect(donors).toContain(':title="startDonationBlock(donor.eligibility)"')

    expect(startDonationBlock(eligibilityBadge({ eligibility: 'eligible' }))).toBeNull()
    expect(startDonationBlock(eligibilityBadge({ eligibility: 'waiting', next_eligible_date: '2026-12-12' })))
      .toBe('Not yet eligible: eligible from 12-Dec-2026')
    expect(startDonationBlock(eligibilityBadge({ eligibility: 'deferred', deferral: { kind: 'temporary', recorded_on: '2026-10-18', ends_on: '2026-11-17' } })))
      .toBe('Not eligible: temporarily deferred until 17-Nov-2026')
    expect(startDonationBlock(eligibilityBadge({ eligibility: 'in_progress' }))).toBe('A visit is already open at your centre')
  })

  it('brings that donor up as the scan would, then drops them from the address', () => {
    expect(page).toContain("const uuid = typeof route.query.donor === 'string' ? route.query.donor.trim() : ''")
    expect(page).toContain('await bringUp(uuid)')
    expect(page).toContain('router.replace({ query: rest })')
  })
})

describe('Donor Management across the blood centres', () => {
  const donors = source('app/pages/blood-center/donors.vue')

  it('lists every donor and marks those another centre knows', () => {
    expect(donors).toContain("otherCentre: row.scope === 'cross_facility',")
    expect(donors).toContain('<span v-if="donor.otherCentre" class="donor-cell__other"')
    expect(donors).toContain("'Every donor in RedAgos, at any blood centre.'")
  })

  it("keeps email, export and reminders to this centre's own donors", () => {
    expect(donors).toContain(':disabled="!donor.email || donor.otherCentre"')
    expect(donors).toContain(`title="Export your centre's donors (CSV)"`)
  })
})
