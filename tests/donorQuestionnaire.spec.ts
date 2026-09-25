import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

/**
 * How the counter renders a donor's questionnaire.
 *
 * The three rules worth locking in are all about not overstating what the
 * record says. An unanswered or inapplicable question must never read as "No".
 * A questionnaire with no consent must say so rather than showing a blank date.
 * And a superseded form must announce itself, because the nurse is about to ask
 * the questions it never contained.
 *
 * Asserted against the component source rather than a mounted tree: the project
 * has no component-testing harness, and what these guard is the presence of the
 * safeguards themselves, which a refactor could quietly drop.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

function component(name: string): string {
  return readFileSync(path.join(root, 'app/components/BloodCenter', name), 'utf8')
}

const drawer = component('DonorQuestionnaire.vue')
const summary = component('DonorQuestionnaireSummary.vue')

describe('the questionnaire drawer', () => {
  it('takes every answer label from the server rather than deciding locally', () => {
    // The server knows whether a question was put to this donor at all. A
    // client that rendered `answer ? 'Yes' : 'No'` would turn both "not
    // answered" and "not applicable" into a No.
    expect(drawer).toContain('question.answer_label')
    expect(drawer).not.toMatch(/answer\s*\?\s*'Yes'\s*:\s*'No'/)
  })

  it('styles a not-applicable answer apart from a No', () => {
    expect(drawer).toContain('dhq__answer--na')
    expect(drawer).toContain("if (!question.applicable) return 'dhq__answer--na'")
    // A null answer is not a No either.
    expect(drawer).toContain("if (question.answer === null) return 'dhq__answer--na'")
  })

  it('renders a missing consent as an explicit negative, never as a blank date', () => {
    // The worst failure available in this feature is a gap that reads as a
    // consent that was given.
    expect(drawer).toContain('data?.consent?.captured')
    expect(drawer).toContain('data?.consent?.note')
    expect(drawer).toMatch(/v-else[^>]*class="dhq__banner dhq__banner--warn"/)
  })

  it('announces a superseded questionnaire version', () => {
    expect(drawer).toContain("data?.is_current_version === false")
    expect(drawer).toContain('The current DOH form has more questions')
  })

  it('says plainly that it is not the on-site screening', () => {
    // The staff's own vitals form sits centimetres away on the same page.
    expect(drawer).toContain('Read only')
    expect(drawer).toContain("data?.notice")
  })

  it('carries no inputs and no write actions', () => {
    // It is a document. Anything editable here would be mistaken for the
    // staff's own assessment.
    expect(drawer).not.toMatch(/<input(?![^>]*type="?checkbox)/)
    expect(drawer).not.toContain('v-model')
    expect(drawer).not.toMatch(/@click="submit|@click="save/)
  })

  it('prints a field the donor never supplied as absent rather than empty', () => {
    expect(drawer).toContain('Not provided')
    expect(drawer).toContain('dhq__field-value--absent')
  })

  it('marks the derived Section I-A figures as derived', () => {
    // Type of donor, times donated and last donation date come from donation
    // records. Nothing may read them as something the donor ticked.
    expect(drawer).toContain("donor_type_source !== 'derived_from_records'")
    expect(drawer).toContain('taken from donation records, not declared by the donor')
  })
})

describe('the questionnaire summary strip', () => {
  it('reports a missing consent on the strip itself', () => {
    expect(summary).toContain('meta.consent_captured')
    expect(summary).toContain('No consent on file')
  })

  it('flags a superseded form without opening the drawer', () => {
    expect(summary).toContain('meta.is_current_version === false')
    expect(summary).toContain('Superseded form')
  })

  it('tints itself when anything wants a second look', () => {
    expect(summary).toContain('needsAttention')
    expect(summary).toContain('dhq-strip--attention')
  })

  it('offers a re-check for the donor answering at the counter', () => {
    // The miss path: no QR, so the donor fills it in on their phone while staff
    // wait. Without this they would have to re-scan or reload.
    expect(summary).toContain("$emit('refresh')")
    expect(summary).toContain('Check again')
  })

  it('carries no accent stripe, matching the donor bar it sits under', () => {
    // collection.vue's .donor-bar explains why that pinned band has none: the
    // white stage cards below have to come forward.
    expect(summary).not.toContain('border-left-width: 3px')
    expect(summary).not.toMatch(/border-left:\s*[34]px/)
  })
})

describe('the prior-deferral notice', () => {
  const notice = component('PriorDeferralNotice.vue')

  it('never renders the deferral reason', () => {
    // The reason is clinical detail and lives behind the donor's history. What
    // check-in needs is that a decision exists and when it was made.
    //
    // Asserted against the bindings rather than the source text, because the
    // component's own comment explains the absence and says the word.
    expect(notice).not.toContain('deferral_reason')
    expect(notice).not.toMatch(/\{\{[^}]*reason[^}]*\}\}/)
    expect(notice).not.toMatch(/deferral\.reason/)
  })

  it('states a fact and offers no action', () => {
    // It blocks nothing and must not look like it does. No buttons, no links.
    expect(notice).not.toContain('<button')
    expect(notice).not.toContain('NuxtLink')
    expect(notice).toContain('Review their record before proceeding')
  })

  it('carries no accent stripe, matching the band it sits in', () => {
    expect(notice).not.toContain('border-left-width: 3px')
    expect(notice).not.toMatch(/border-left:\s*[34]px/)
  })

  it('takes its wording from the server label rather than hardcoding the outcomes', () => {
    // Three deferral values share this banner; naming them here would mean a
    // fourth silently rendering as a blank.
    expect(notice).toContain('outcome_label')
    expect(notice).not.toContain('permanently_deferred')
    expect(notice).not.toContain('indefinite_deferral')
  })
})
