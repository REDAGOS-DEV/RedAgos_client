import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

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

function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8')
}

describe('the Donation page', () => {
  const page = source('app/pages/blood-center/donation.vue')

  it('is called Donation', () => {
    expect(page).toContain('<h1 class="collection__title">Donation</h1>')
  })

  it('keeps the old address as a redirect, so a bookmark still lands', () => {
    const old = source('app/pages/blood-center/collection.vue')

    expect(old).toContain("redirect: '/blood-center/donation'")
    expect(old).not.toContain('useDonationTransaction')
  })

  it('scans booked donors and searches for walk-ins by name, email or phone', () => {
    expect(page).toContain('Scan the Donor Portal QR')
    expect(page).toContain('Name, email or phone number')
    expect(page).toContain('service.searchCounterDonors(q)')
    // The old ID-only lookup is gone from the counter.
    expect(page).not.toContain("type: 'valid_id_number'")
  })

  it('adopts a chosen walk-in through the exact lookup, with its deferral and questionnaire', () => {
    expect(page).toContain("service.lookupDonor({ type: 'donor_code', value: result.donor_code })")
    expect(page).toContain('found.prior_deferral ?? null, found.health_questionnaire ?? null')
  })

  // The onsite DHQ is optional (project owner, 2026-10-17): with none on file,
  // the physician confirms the donor answered the paper form, and the
  // screening records it.
  it('accepts a donor without a questionnaire on file only on the paper DHQ, and records it', () => {
    expect(page).toContain(':disabled="busy || (needsQuestionnaire && !dhqOnPaper)"')
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
