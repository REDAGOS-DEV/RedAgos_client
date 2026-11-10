<template>
  <Teleport to="body" :disabled="pageHidden">
    <div class="dhq-overlay" role="dialog" aria-modal="true" :aria-label="title" @click.self="requestClose">
      <section class="dhq" @keydown.esc="requestClose">
        <header class="dhq__header">
          <div class="dhq__heading">
            <p class="dhq__eyebrow">
              Blood Donor's Health Questionnaire
              <span v-if="!amendable" class="dhq__chip">Donor's answers are read only</span>
            </p>
            <h2 class="dhq__title">{{ title }}</h2>
            <!--
              The single most important line here. The staff's own vitals form
              lives a few centimetres away on the same page, and the two records
              mean different things.
            -->
            <p class="dhq__notice">{{ data?.notice }}</p>
          </div>

          <div class="dhq__header-actions">
            <button type="button" class="dhq__btn" @click="$emit('print')">Print</button>
            <button type="button" class="dhq__btn dhq__btn--icon" aria-label="Close" @click="requestClose">×</button>
          </div>
        </header>

        <p v-if="data?.is_current_version === false" class="dhq__banner dhq__banner--warn">
          This donor answered version {{ data.question_version }} of the questionnaire on
          {{ longDate(data.screened_at) }}. The current DOH form has more questions.
          Ask the remaining items and record them in your own assessment.
        </p>

        <p v-if="data?.is_expired" class="dhq__banner dhq__banner--warn">
          These answers are past their validity date of {{ longDate(data.valid_until) }}.
        </p>

        <nav class="dhq__tabs">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            class="dhq__tab"
            :class="{ 'dhq__tab--active': activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </nav>

        <div class="dhq__body">
          <!-- I-A -->
          <div v-show="activeTab === 'personal'" class="dhq__panel">
            <dl class="dhq__grid">
              <div v-for="field in personalFields" :key="field.label" class="dhq__field">
                <dt class="dhq__field-label">{{ field.label }}</dt>
                <dd class="dhq__field-value" :class="{ 'dhq__field-value--absent': field.absent }">
                  {{ field.value }}
                </dd>
              </div>
            </dl>

            <p v-if="derivedNote" class="dhq__footnote">{{ derivedNote }}</p>
          </div>

          <!-- I-B -->
          <div v-show="activeTab === 'history'" class="dhq__panel">
            <section v-for="section in data?.sections || []" :key="section.key" class="dhq__section">
              <h3 class="dhq__section-title">{{ section.title }}</h3>

              <ol class="dhq__questions">
                <li
                  v-for="question in section.questions"
                  :key="question.code"
                  class="dhq__question"
                  :class="{
                    'dhq__question--flagged': question.flagged,
                    'dhq__question--na': !question.applicable,
                  }"
                >
                  <span class="dhq__question-number">{{ question.number }}.</span>
                  <span class="dhq__question-text">
                    {{ question.text }}
                    <span v-if="question.flagged" class="dhq__flag">Review</span>
                    <!-- An answer that is no longer the donor's has to say so. -->
                    <span v-if="question.amendment" class="dhq__amended">
                      Changed by {{ question.amendment.amended_by || 'staff' }}.
                      Donor answered: {{ question.amendment.donor_answer_label }}
                    </span>
                  </span>

                  <div
                    v-if="amendable && question.applicable"
                    class="dhq__choice"
                    role="radiogroup"
                    :aria-label="`Question ${question.number}`"
                  >
                    <button
                      v-for="option in ANSWER_OPTIONS"
                      :key="option.label"
                      type="button"
                      role="radio"
                      class="dhq__choice-btn"
                      :class="{ 'dhq__choice-btn--on': shownAnswer(question) === option.value }"
                      :aria-checked="shownAnswer(question) === option.value"
                      @click="choose(question, option.value)"
                    >
                      {{ option.label }}
                    </button>
                  </div>
                  <span v-else class="dhq__answer" :class="answerClass(question)">{{ question.answer_label }}</span>
                </li>
              </ol>
            </section>
          </div>

          <!-- I-C -->
          <div v-show="activeTab === 'consent'" class="dhq__panel">
            <template v-if="data?.consent?.captured">
              <p class="dhq__consent-date">
                Consented on {{ longDate(data.consent.consented_on) }}
                <span class="dhq__consent-version">version {{ data.consent.version }}</span>
              </p>

              <ul class="dhq__statements">
                <li v-for="(statement, i) in data.consent.statements" :key="i">{{ statement }}</li>
              </ul>

              <p v-if="data.consent.note" class="dhq__banner dhq__banner--warn">{{ data.consent.note }}</p>
            </template>

            <!--
              Never a blank date. A questionnaire with no consent has to say so
              outright, or it reads as one that was given.
            -->
            <p v-else class="dhq__banner dhq__banner--warn">{{ data?.consent?.note }}</p>

            <dl class="dhq__grid dhq__grid--contact">
              <div class="dhq__field">
                <dt class="dhq__field-label">Contact person (other relative/s)</dt>
                <dd class="dhq__field-value" :class="{ 'dhq__field-value--absent': !personal.contact_person_name }">
                  {{ personal.contact_person_name || 'Not provided' }}
                </dd>
              </div>
              <div class="dhq__field">
                <dt class="dhq__field-label">Contact number</dt>
                <dd class="dhq__field-value" :class="{ 'dhq__field-value--absent': !personal.contact_person_number }">
                  {{ formatPhoneNumber(personal.contact_person_number) || 'Not provided' }}
                </dd>
              </div>
              <div class="dhq__field dhq__field--wide">
                <dt class="dhq__field-label">Address</dt>
                <dd class="dhq__field-value" :class="{ 'dhq__field-value--absent': !personal.contact_person_address }">
                  {{ personal.contact_person_address || 'Not provided' }}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <footer v-if="editCount" class="dhq__save">
          <p v-if="saveError" class="dhq__save-error" role="alert">{{ saveError }}</p>
          <div class="dhq__save-actions">
            <button type="button" class="dhq__btn" :disabled="saving" @click="clearEdits">Discard</button>
            <button type="button" class="dhq__btn dhq__btn--primary" :disabled="saving" @click="saveEdits">
              {{ saving ? 'Saving…' : `Save ${editCount} change${editCount === 1 ? '' : 's'}` }}
            </button>
          </div>
        </footer>
      </section>

      <!-- Closing with changes unsaved: the drawer's own confirm, over it. -->
      <div v-if="discarding" class="dhq-confirm" @click.self="discarding = false">
        <div
          v-focus-trap
          class="dhq-confirm__card"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="dhq-discard-title"
          @dialog-escape="discarding = false"
        >
          <h3 id="dhq-discard-title" class="dhq-confirm__title">Discard the changed answers?</h3>
          <div class="dhq-confirm__actions">
            <button type="button" class="dhq__btn" @click="discarding = false">Keep editing</button>
            <button type="button" class="dhq__btn dhq__btn--danger" @click="discardAndClose">Discard</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
/**
 * The donor's questionnaire, as a document.
 *
 * Deliberately reads nothing like the staff's own screening form, which sits on
 * the same page: numbered rows, answer pills and no text inputs. Everything here
 * was declared by the donor; the blood centre decides what it means.
 *
 * One exception (project owner, 2026-11-06): while the donor is at screening the
 * physician can change Section I-B's Yes and No. A changed row goes on saying
 * what the donor declared. Personal data and consent stay read-only.
 */
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { formatPhoneNumber } from '~/utils/phone'
import { usePageHidden } from '~/composables/useKeptAlive'

const pageHidden = usePageHidden()

const props = defineProps({
  data: { type: Object, default: null },
  donorUuid: { type: String, default: '' },
  canAmend: { type: Boolean, default: false },
})

// `print` opens the A4 sheet the desk prints, so paper from either reads alike.
// `amended` hands over the document as the server now has it.
const emit = defineEmits(['close', 'print', 'amended'])

const ANSWER_OPTIONS = [
  { label: 'Yes', value: true },
  { label: 'No', value: false },
]

// Lapsed answers are not corrected: the donor answers the form again.
const amendable = computed(() => props.canAmend && !props.data?.is_expired)

// Unsaved changes, by question code.
const edits = reactive({})
const editCount = computed(() => Object.keys(edits).length)
const saving = ref(false)
const saveError = ref('')
const discarding = ref(false)

function shownAnswer(question) {
  return question.code in edits ? edits[question.code] : question.answer
}

function choose(question, answer) {
  if (answer === question.answer) delete edits[question.code]
  else edits[question.code] = answer
}

function clearEdits() {
  for (const code of Object.keys(edits)) delete edits[code]
  saveError.value = ''
}

async function saveEdits() {
  saving.value = true
  saveError.value = ''

  try {
    const result = await bloodCenterService.amendQuestionnaireAnswers(props.donorUuid, {
      screening_id: props.data.screening_id,
      answers: Object.entries(edits).map(([code, answer]) => ({ code, answer })),
    })

    emit('amended', result?.data ?? props.data)
    clearEdits()
  } catch (err) {
    saveError.value = err?.data?.message || err?.message || 'The answers could not be saved. Try again.'
  } finally {
    saving.value = false
  }
}

function requestClose() {
  if (editCount.value) {
    discarding.value = true
    return
  }

  emit('close')
}

function discardAndClose() {
  clearEdits()
  discarding.value = false
  emit('close')
}

const activeTab = ref('personal')

const tabs = [
  { key: 'personal', label: 'I-A Personal data' },
  { key: 'history', label: 'I-B Donor history' },
  { key: 'consent', label: 'I-C Consent' },
]

const personal = computed(() => props.data?.personal_data || {})

const title = computed(() => {
  const p = personal.value
  const name = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ')

  return name || p.donor_code || 'Donor questionnaire'
})

/**
 * Section I-A in the order the printed form asks for it.
 *
 * A field the donor never supplied prints as "Not provided" rather than as a
 * blank, which on a form reads as a line nobody filled in.
 */
const personalFields = computed(() => {
  const p = personal.value
  const missing = new Set(p.missing_fields || [])

  const rows = [
    ['Donor ID', p.donor_code],
    ['Last name', p.last_name],
    ['First name', p.first_name],
    ['Middle name', p.middle_name],
    ['Age', p.age],
    ['Sex', p.sex],
    ['Date of birth', p.date_of_birth],
    ['Civil status', p.civil_status_label],
    ['Home address', p.home_address],
    ['Office address', p.office_address],
    ['Preferred mailing address', p.preferred_mailing_address],
    ['Contact number', formatPhoneNumber(p.contact_number)],
    ['Telephone no.', formatPhoneNumber(p.telephone_no)],
    ['E-mail address', p.email],
    ['Occupation', p.occupation],
    ['Nationality', p.nationality],
    ['Religion', p.religion],
    ['Blood type', p.blood_type],
    ['Type of donor', p.donor_type_label],
    ['No. of times donated', p.times_donated],
    ['Date of last donation', p.last_donation?.date],
    ['Venue of last donation', p.last_donation?.declared_venue],
  ]

  return rows.map(([label, value]) => ({
    label,
    value: value === null || value === undefined || value === '' ? 'Not provided' : value,
    absent: value === null || value === undefined || value === '',
  }))
})

// Says which of the I-A boxes the system worked out rather than the donor
// ticking, so nobody reads a derived figure as a declaration.
const derivedNote = computed(() => {
  if (personal.value.donor_type_source !== 'derived_from_records') return ''

  return 'Type of donor, number of times donated and date of last donation are taken from donation records, not declared by the donor.'
})

function answerClass(question) {
  if (!question.applicable) return 'dhq__answer--na'
  if (question.answer === null) return 'dhq__answer--na'
  if (question.flagged) return 'dhq__answer--flagged'

  return question.answer ? 'dhq__answer--yes' : 'dhq__answer--no'
}

function longDate(value) {
  if (!value) return '—'

  return new Date(value).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })
}

onMounted(() => {
  document.body.style.overflow = 'hidden'
})

// Released while its page is kept but not shown, or the next page could not scroll.
watch(pageHidden, (hidden) => {
  document.body.style.overflow = hidden ? '' : 'hidden'
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})
</script>

<style scoped>
.dhq-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  justify-content: flex-end;
  background: rgba(0, 0, 0, 0.35);
}

.dhq {
  display: flex;
  flex-direction: column;
  width: min(46rem, 100%);
  height: 100%;
  background: var(--rb-surface);
  border-left: 1px solid var(--rb-border-strong);
  font-family: var(--rb-font-sans);
}

.dhq__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.2rem;
  border-bottom: 1px solid var(--rb-border);
}

.dhq__eyebrow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.dhq__chip {
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  background: var(--rb-surface-alt);
  border: 1px solid var(--rb-border);
  letter-spacing: 0.04em;
}

.dhq__title {
  margin: 0.3rem 0 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--rb-text-primary);
}

.dhq__notice {
  margin: 0.3rem 0 0;
  max-width: 60ch;
  font-size: 13px;
  line-height: 1.45;
  color: var(--rb-text-secondary);
}

.dhq__header-actions { display: flex; gap: 0.35rem; flex: none; }

.dhq__btn {
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  border-radius: 8px;
  padding: 0.35rem 0.7rem;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.dhq__btn:hover { background: var(--rb-surface-hover); }
.dhq__btn--icon { font-size: 18px; line-height: 1; padding: 0.3rem 0.55rem; }
.dhq__btn:disabled { opacity: 0.55; cursor: not-allowed; }
.dhq__btn--primary { background: var(--rb-primary); border-color: var(--rb-primary); color: #fff; }
.dhq__btn--primary:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-primary) 88%, #000); }
.dhq__btn--danger { background: var(--rb-accent); border-color: var(--rb-accent); color: #fff; }
.dhq__btn--danger:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-accent) 88%, #000); }

.dhq__banner {
  margin: 0.75rem 1.2rem 0;
  padding: 0.6rem 0.8rem;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.45;
}

.dhq__banner--warn {
  background: rgba(var(--rb-warning-rgb), 0.12);
  color: var(--rb-warning-text);
  border: 1px solid rgba(var(--rb-warning-rgb), 0.3);
}

.dhq__tabs {
  display: flex;
  gap: 0.25rem;
  padding: 0.75rem 1.2rem 0;
  border-bottom: 1px solid var(--rb-border);
}

.dhq__tab {
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  padding: 0.45rem 0.6rem;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  cursor: pointer;
}

.dhq__tab--active { color: var(--rb-primary-text); border-bottom-color: var(--rb-primary); }

.dhq__body { flex: 1; overflow-y: auto; padding: 1rem 1.2rem 2rem; }

.dhq__grid {
  display: grid;
  gap: 0.7rem 1.2rem;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  margin: 0;
}

.dhq__grid--contact { margin-top: 1.4rem; padding-top: 1rem; border-top: 1px solid var(--rb-border); }
.dhq__field--wide { grid-column: 1 / -1; }

.dhq__field-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.dhq__field-value { margin: 0.15rem 0 0; font-size: 14px; color: var(--rb-text-primary); }
.dhq__field-value--absent { color: var(--rb-text-secondary); font-style: italic; }

.dhq__footnote {
  margin: 1.2rem 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}

.dhq__section { margin-bottom: 1.4rem; }

.dhq__section-title {
  margin: 0 0 0.5rem;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.dhq__questions { margin: 0; padding: 0; list-style: none; }

.dhq__question {
  display: grid;
  grid-template-columns: 1.6rem minmax(0, 1fr) auto;
  gap: 0.5rem;
  align-items: baseline;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--rb-border);
  border-left: 3px solid transparent;
  font-size: 13.5px;
  line-height: 1.45;
}

.dhq__question--flagged {
  border-left-color: var(--rb-warning);
  background: rgba(var(--rb-warning-rgb), 0.06);
}

.dhq__question--na { color: var(--rb-text-secondary); }

.dhq__question-number { color: var(--rb-text-secondary); font-variant-numeric: tabular-nums; }
.dhq__question-text { color: var(--rb-text-primary); }
.dhq__question--na .dhq__question-text { color: var(--rb-text-secondary); }

.dhq__flag {
  display: inline-block;
  margin-left: 0.4rem;
  padding: 0.05rem 0.35rem;
  border-radius: 4px;
  background: rgba(var(--rb-warning-rgb), 0.18);
  color: var(--rb-warning-text);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.dhq__answer {
  justify-self: end;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface-alt);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.dhq__answer--yes { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); border-color: transparent; }
.dhq__answer--no { color: var(--rb-text-secondary); }
.dhq__answer--flagged { background: rgba(var(--rb-warning-rgb), 0.16); color: var(--rb-warning-text); border-color: transparent; }
/* Never mistakable for "No": a question nobody put to this donor is not one
   they answered. */
.dhq__answer--na { font-style: italic; color: var(--rb-text-secondary); }

.dhq__amended {
  display: block;
  margin-top: 0.2rem;
  font-size: 12px;
  font-weight: 600;
  color: var(--rb-warning-text);
}

.dhq__choice { justify-self: end; display: inline-flex; gap: 0.25rem; }

.dhq__choice-btn {
  min-width: 2.6rem;
  min-height: 30px;
  padding: 0.15rem 0.55rem;
  border: 1px solid var(--rb-border-strong);
  border-radius: 999px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.dhq__choice-btn:hover { border-color: var(--rb-border-hover); }
.dhq__choice-btn:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.dhq__choice-btn--on,
.dhq__choice-btn--on:hover { border-color: var(--rb-primary); background: var(--rb-primary); color: #fff; }

.dhq__save {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.7rem 1.2rem;
  border-top: 1px solid var(--rb-border);
  background: var(--rb-surface);
}

.dhq__save-error { margin: 0; font-size: 13px; color: var(--rb-accent-text); }
.dhq__save-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }

/* The discard confirm, over the drawer (the overlay is its containing block). */
.dhq-confirm {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: var(--rb-overlay);
}

.dhq-confirm__card {
  width: min(24rem, 100%);
  padding: 1.25rem;
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  background: var(--rb-surface);
  box-shadow: 0 12px 32px rgba(var(--rb-shadow-rgb), 0.28);
  font-family: var(--rb-font-sans);
}

.dhq-confirm__title { margin: 0 0 1rem; font-size: 16px; font-weight: 700; color: var(--rb-text-primary); }
.dhq-confirm__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.5rem; }

.dhq__consent-date { margin: 0 0 0.75rem; font-size: 14px; font-weight: 600; color: var(--rb-text-primary); }
.dhq__consent-version { margin-left: 0.4rem; font-weight: 400; font-size: 12.5px; color: var(--rb-text-secondary); }

.dhq__statements { margin: 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.6rem; }
.dhq__statements li { font-size: 13.5px; line-height: 1.5; color: var(--rb-text-primary); }

@media (max-width: 640px) {
  .dhq { width: 100%; }
  .dhq__question { grid-template-columns: 1.4rem minmax(0, 1fr); }
  .dhq__answer,
  .dhq__choice { grid-column: 2; justify-self: start; margin-top: 0.3rem; }
}

/* Staff keep a paper copy, so the drawer prints as the document it is. */
@media print {
  .dhq-overlay { position: static; background: none; }
  .dhq { width: 100%; height: auto; border: none; }
  .dhq__header-actions,
  .dhq__tabs,
  .dhq__save { display: none; }
  .dhq__panel { display: block !important; }
  .dhq__body { overflow: visible; }
}
</style>
