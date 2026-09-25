<template>
  <Teleport to="body">
    <div class="dhq-overlay" role="dialog" aria-modal="true" :aria-label="title" @click.self="$emit('close')">
      <section class="dhq" @keydown.esc="$emit('close')">
        <header class="dhq__header">
          <div class="dhq__heading">
            <p class="dhq__eyebrow">
              Blood Donor's Health Questionnaire
              <span class="dhq__chip">Donor's answers are read only</span>
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
            <button type="button" class="dhq__btn" @click="print">Print</button>
            <button type="button" class="dhq__btn dhq__btn--icon" aria-label="Close" @click="$emit('close')">×</button>
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

        <!--
          The four boxes printed in the top margin of the donor's sheet, in the
          same place here. Unlike everything below them these are the officer's
          to fill: they are asked in person at the counter and typed in, which
          is why the one editable block in this document sits above the tabs
          rather than inside the donor's own declaration.

          They are saved with the screening, not on their own — they describe
          the visit the screening records, and a set of answers with no
          screening behind them would belong to nothing.
        -->
        <fieldset class="dhq__intake" :disabled="!canEditIntake">
          <legend class="dhq__intake-legend">
            Ask the donor
            <span class="dhq__intake-tag">Staff</span>
          </legend>

          <div class="dhq__intake-grid">
            <label v-for="field in intakeFields" :key="field.key" class="dhq__intake-field">
              <span class="dhq__intake-label">{{ field.label }}</span>
              <input
                :value="intake[field.key]"
                type="text"
                class="dhq__intake-input"
                maxlength="255"
                @input="$emit('update-intake', field.key, $event.target.value)"
              >
            </label>
          </div>

          <p class="dhq__intake-hint">
            <template v-if="canEditIntake">
              Saved when you record the screening.
            </template>
            <template v-else>
              Open the donation first — these are recorded against this visit.
            </template>
          </p>
        </fieldset>

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
                  </span>
                  <span class="dhq__answer" :class="answerClass(question)">{{ question.answer_label }}</span>
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
                  {{ personal.contact_person_number || 'Not provided' }}
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
      </section>
    </div>
  </Teleport>
</template>

<script setup>
/**
 * The donor's questionnaire, as a document.
 *
 * Deliberately reads nothing like the staff's own screening form, which sits on
 * the same page: numbered rows, answer pills, no inputs and no write buttons
 * anywhere. Everything here was declared by the donor in the app; the blood
 * centre decides what it means.
 */

const props = defineProps({
  data: { type: Object, default: null },
  // The four margin boxes, held by the counter so the screening form and this
  // drawer cannot drift apart.
  intake: { type: Object, required: true },
  // They describe a visit, so there has to be one to record them against.
  canEditIntake: { type: Boolean, default: false },
})

const intakeFields = [
  { key: 'sleep', label: 'Sleep' },
  { key: 'meal', label: 'Meal' },
  { key: 'meds', label: 'Meds' },
  { key: 'allergies', label: 'Allergies' },
]

// `update-intake` rather than writing into the prop: the counter owns this
// state, because the screening form has to send it and both have to agree.
defineEmits(['close', 'update-intake'])

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
    ['Contact number', p.contact_number],
    ['Telephone no.', p.telephone_no],
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

function print() {
  window.print()
}

onMounted(() => {
  document.body.style.overflow = 'hidden'
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
  font-size: 0.7rem;
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
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--rb-text-primary);
}

.dhq__notice {
  margin: 0.3rem 0 0;
  max-width: 60ch;
  font-size: 0.8rem;
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
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.dhq__btn:hover { background: var(--rb-surface-hover); }
.dhq__btn--icon { font-size: 1.1rem; line-height: 1; padding: 0.3rem 0.55rem; }

.dhq__banner {
  margin: 0.75rem 1.2rem 0;
  padding: 0.6rem 0.8rem;
  border-radius: 8px;
  font-size: 0.82rem;
  line-height: 1.45;
}

.dhq__banner--warn {
  background: rgba(var(--rb-warning-rgb), 0.12);
  color: var(--rb-warning-text);
  border: 1px solid rgba(var(--rb-warning-rgb), 0.3);
}

/* --- The officer's own block, above the donor's declaration --- */
/*
 * Marked out from everything below it. The rest of this drawer is a document
 * the donor authored days ago; this is the one part the counter writes, and a
 * staff member must never be in doubt about which they are looking at.
 */
.dhq__intake {
  margin: 0.9rem 1.2rem 0;
  padding: 0.75rem 0.85rem 0.8rem;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface-alt);
}

.dhq__intake[disabled] { opacity: 0.6; }

.dhq__intake-legend {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0 0.35rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.dhq__intake-tag {
  padding: 0.05rem 0.35rem;
  border-radius: 4px;
  background: rgba(var(--rb-primary-rgb), 0.12);
  color: var(--rb-primary-text);
  letter-spacing: 0.04em;
}

.dhq__intake-grid {
  display: grid;
  gap: 0.6rem;
  grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
}

.dhq__intake-field { display: flex; flex-direction: column; gap: 0.25rem; }

.dhq__intake-label {
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--rb-text-primary);
}

.dhq__intake-input {
  width: 100%;
  padding: 0.42rem 0.6rem;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 0.83rem;
}

.dhq__intake-input:focus-visible {
  outline: 2px solid var(--rb-primary);
  outline-offset: 1px;
  border-color: var(--rb-primary);
}

.dhq__intake-hint {
  margin: 0.55rem 0 0;
  font-size: 0.76rem;
  color: var(--rb-text-secondary);
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
  font-size: 0.82rem;
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
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.dhq__field-value { margin: 0.15rem 0 0; font-size: 0.87rem; color: var(--rb-text-primary); }
.dhq__field-value--absent { color: var(--rb-text-secondary); font-style: italic; }

.dhq__footnote {
  margin: 1.2rem 0 0;
  font-size: 0.76rem;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}

.dhq__section { margin-bottom: 1.4rem; }

.dhq__section-title {
  margin: 0 0 0.5rem;
  font-size: 0.72rem;
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
  font-size: 0.85rem;
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
  font-size: 0.68rem;
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
  font-size: 0.76rem;
  font-weight: 600;
  white-space: nowrap;
}

.dhq__answer--yes { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); border-color: transparent; }
.dhq__answer--no { color: var(--rb-text-secondary); }
.dhq__answer--flagged { background: rgba(var(--rb-warning-rgb), 0.16); color: var(--rb-warning-text); border-color: transparent; }
/* Never mistakable for "No": a question nobody put to this donor is not one
   they answered. */
.dhq__answer--na { font-style: italic; color: var(--rb-text-secondary); }

.dhq__consent-date { margin: 0 0 0.75rem; font-size: 0.9rem; font-weight: 600; color: var(--rb-text-primary); }
.dhq__consent-version { margin-left: 0.4rem; font-weight: 400; font-size: 0.78rem; color: var(--rb-text-secondary); }

.dhq__statements { margin: 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.6rem; }
.dhq__statements li { font-size: 0.84rem; line-height: 1.5; color: var(--rb-text-primary); }

@media (max-width: 640px) {
  .dhq { width: 100%; }
  .dhq__question { grid-template-columns: 1.4rem minmax(0, 1fr); }
  .dhq__answer { grid-column: 2; justify-self: start; margin-top: 0.3rem; }
}

/* Staff keep a paper copy, so the drawer prints as the document it is. */
@media print {
  .dhq-overlay { position: static; background: none; }
  .dhq { width: 100%; height: auto; border: none; }
  .dhq__header-actions,
  .dhq__tabs { display: none; }
  .dhq__intake { border-color: #000; background: none; }
  .dhq__panel { display: block !important; }
  .dhq__body { overflow: visible; }
}
</style>
