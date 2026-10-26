<template>
  <Teleport to="body">
    <div class="onsite-overlay" role="dialog" aria-modal="true" aria-labelledby="onsite-title">
      <section class="onsite" @keydown.esc="requestClose">
        <header class="onsite__header">
          <div class="onsite__heading">
            <p class="onsite__eyebrow">Blood Donor's Health Questionnaire · answered onsite</p>
            <h2 id="onsite-title" class="onsite__title">{{ form?.donor?.full_name || donorName }}</h2>
          </div>

          <div class="onsite__header-side">
            <p v-if="form && !recorded" class="onsite__progress" aria-live="polite">
              {{ answeredCount }} of {{ questions.length }} answered
            </p>
            <button type="button" class="onsite__close" aria-label="Close" @click="requestClose">
              <AssetIcon name="x" :size="16" />
            </button>
          </div>
        </header>

        <!-- Done: nothing the donor answered stays on the screen they hand back. -->
        <div v-if="recorded" class="onsite__done">
          <AssetIcon name="circle-check-big" :size="36" />
          <h3 class="onsite__done-title">Thank you. Your answers have been recorded.</h3>
          <p class="onsite__done-text">Please hand the device back to the staff member.</p>
          <button type="button" class="onsite__btn onsite__btn--primary" @click="finish">Done</button>
        </div>

        <p v-else-if="loading" class="onsite__state">Loading the questionnaire…</p>

        <div v-else-if="loadError" class="onsite__state">
          <p class="onsite__alert" role="alert">{{ loadError }}</p>
          <button type="button" class="onsite__btn" @click="load">Try again</button>
        </div>

        <form v-else-if="form" class="onsite__body" novalidate @submit.prevent="submit">
          <p class="onsite__intro">
            Please answer every question truthfully. Your answers are confidential and are read by the
            screening physician before you donate.
          </p>

          <!--
            Already answered and still valid: answering again replaces it, which
            is right only when the donor's health has changed since.
          -->
          <p v-if="hasCurrent" class="onsite__banner">
            This donor already answered the current questionnaire on {{ longDate(form.current.screened_on) }}
            ({{ form.current.completed_via === 'counter' ? 'onsite' : 'in the Donor Portal' }}), valid until
            {{ longDate(form.current.valid_until) }}. Answer again only if their health details have changed.
          </p>

          <fieldset class="onsite__group">
            <legend class="onsite__legend">About you</legend>
            <div class="onsite__fields">
              <label class="onsite__field">
                <span class="onsite__label">Weight <span class="onsite__optional">kg, optional</span></span>
                <input v-model.number="vitals.weight" type="number" inputmode="numeric" min="20" max="400" class="onsite__input">
              </label>
              <label class="onsite__field">
                <span class="onsite__label">Date of last donation <span class="onsite__optional">if any</span></span>
                <DatePicker v-model="vitals.lastDonationDate" :max="today" aria-label="Last donation date" />
              </label>
              <label v-if="vitals.lastDonationDate" class="onsite__field">
                <span class="onsite__label">Where was it? <span class="onsite__optional">optional</span></span>
                <input v-model="vitals.lastDonationVenue" type="text" maxlength="150" class="onsite__input">
              </label>
            </div>
            <p v-if="vitalsHint" class="onsite__hint">{{ vitalsHint }}</p>
          </fieldset>

          <section v-for="section in form.sections" :key="section.key" class="onsite__group">
            <h3 class="onsite__legend">{{ section.title }}</h3>

            <ol class="onsite__questions">
              <li
                v-for="q in section.questions"
                :id="`onsite-${q.code}`"
                :key="q.code"
                class="onsite__question"
                :class="{ 'onsite__question--missing': attempted && answers[q.code] === undefined }"
              >
                <p class="onsite__q-text"><span class="onsite__q-no">{{ q.number }}.</span> {{ q.text }}</p>

                <div class="onsite__answers" role="radiogroup" :aria-label="`Question ${q.number}`">
                  <button
                    type="button"
                    role="radio"
                    class="onsite__answer"
                    :class="{ 'onsite__answer--on': answers[q.code] === true }"
                    :aria-checked="answers[q.code] === true"
                    @click="answers[q.code] = true"
                  >
                    {{ q.kind === 'acknowledgement' ? 'Yes, I understand' : 'Yes' }}
                  </button>
                  <button
                    type="button"
                    role="radio"
                    class="onsite__answer"
                    :class="{ 'onsite__answer--on': answers[q.code] === false }"
                    :aria-checked="answers[q.code] === false"
                    @click="answers[q.code] = false"
                  >
                    No
                  </button>
                  <!--
                    Only where the server says this donor need not answer. Sent
                    as no answer at all: "No" from someone the question was never
                    meant for would be a falsehood in the record.
                  -->
                  <button
                    v-if="q.required === false"
                    type="button"
                    role="radio"
                    class="onsite__answer"
                    :class="{ 'onsite__answer--on': answers[q.code] === null }"
                    :aria-checked="answers[q.code] === null"
                    @click="answers[q.code] = null"
                  >
                    Not applicable to me
                  </button>
                </div>

                <label v-if="q.code === lastMenstrualCode && answers[q.code] !== null && answers[q.code] !== undefined" class="onsite__field onsite__field--inline">
                  <span class="onsite__label">Last menstrual period</span>
                  <DatePicker v-model="vitals.lastMenstrualPeriod" :max="today" aria-label="Last menstrual period" />
                </label>
              </li>
            </ol>
          </section>

          <fieldset class="onsite__group">
            <legend class="onsite__legend">Donor's informed consent</legend>
            <label v-for="(statement, i) in form.consent?.statements || []" :key="i" class="onsite__consent">
              <input v-model="consentTicked[i]" type="checkbox">
              <span>{{ statement }}</span>
            </label>
          </fieldset>

          <footer class="onsite__footer">
            <p v-if="submitError" class="onsite__alert" role="alert">{{ submitError }}</p>
            <p v-else-if="attempted && !complete" class="onsite__alert" role="status">
              <template v-if="unansweredCount">
                {{ unansweredCount }} question{{ unansweredCount === 1 ? '' : 's' }} still to answer.
              </template>
              <template v-else>Please accept every consent statement.</template>
            </p>

            <div class="onsite__actions">
              <button type="button" class="onsite__btn" :disabled="submitting" @click="requestClose">Cancel</button>
              <button type="submit" class="onsite__btn onsite__btn--primary" :disabled="submitting">
                {{ submitting ? 'Submitting…' : 'Submit questionnaire' }}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import DatePicker from '~/components/common/DatePicker.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

/**
 * The questionnaire, answered onsite on the counter's device.
 *
 * For the walk-in, who has no sign-in to answer it in the Donor Portal. Staff
 * hand the device over; the donor answers the same questions the app would
 * have asked and accepts the same consent. The server holds the submission to
 * the app's rules. When it is recorded the screen shows a thank-you and
 * nothing else, so the answers are not on view when the device comes back.
 */

const props = defineProps({
  donorUuid: { type: String, required: true },
  donorName: { type: String, default: '' },
})

const emit = defineEmits(['close', 'recorded'])

const form = ref(null)
const loading = ref(false)
const loadError = ref('')
const submitting = ref(false)
const submitError = ref('')
const attempted = ref(false)
const recorded = ref(null)
const force = ref(false)

const answers = reactive({})
const consentTicked = reactive({})
const vitals = reactive({ weight: null, lastDonationDate: '', lastDonationVenue: '', lastMenstrualPeriod: '' })

const today = new Date().toISOString().slice(0, 10)

const questions = computed(() => (form.value?.sections ?? []).flatMap((s) => s.questions))

// `null` is an answer here ("not applicable to me"); only `undefined` is not.
const unansweredCount = computed(() => questions.value.filter((q) => answers[q.code] === undefined).length)
const answeredCount = computed(() => questions.value.length - unansweredCount.value)

const allConsented = computed(() => {
  const statements = form.value?.consent?.statements ?? []
  return statements.every((_, i) => consentTicked[i])
})

const complete = computed(() => questions.value.length > 0 && unansweredCount.value === 0 && allConsented.value)

const hasCurrent = computed(() => Boolean(form.value?.current?.available && form.value.current.is_current_version))

// The female-donors section's first question carries the form's LMP line.
const lastMenstrualCode = computed(() =>
  form.value?.sections?.find((s) => s.key === 'female_donors')?.questions?.[0]?.code ?? '')

const vitalsHint = computed(() =>
  (vitals.lastDonationDate || vitals.lastMenstrualPeriod) && !vitals.weight
    ? 'Dates are sent with a weight. Without one, the physician records it at screening.'
    : '')

const dirty = computed(() => answeredCount.value > 0 || Object.values(consentTicked).some(Boolean))

async function load() {
  loading.value = true
  loadError.value = ''

  try {
    const result = await bloodCenterService.counterQuestionnaireForm(props.donorUuid)
    form.value = result?.data ?? null

    if (form.value?.prefill?.last_donation_date && !vitals.lastDonationDate) {
      vitals.lastDonationDate = form.value.prefill.last_donation_date
    }

    force.value = hasCurrent.value
  } catch (err) {
    loadError.value = err?.data?.code === 'donor_not_presented'
      ? 'Open the donation first. The questionnaire is recorded against this visit.'
      : err?.message || 'The questionnaire could not be loaded.'
  } finally {
    loading.value = false
  }
}

function payload() {
  const body = {
    question_version: form.value.version,
    answers: questions.value
      .filter((q) => answers[q.code] !== undefined && answers[q.code] !== null)
      .map((q) => ({ code: q.code, answer: answers[q.code] })),
    consent: { version: form.value.consent?.version, accepted: true },
  }

  // `vitals.weight` is required with `vitals`, so the block goes only with one.
  if (vitals.weight !== null && vitals.weight !== '') {
    body.vitals = { weight: Number(vitals.weight) }
    if (vitals.lastDonationDate) body.vitals.last_donation_date = vitals.lastDonationDate
    if (vitals.lastDonationVenue) body.vitals.last_donation_venue = vitals.lastDonationVenue
    if (vitals.lastMenstrualPeriod) body.vitals.last_menstrual_period = vitals.lastMenstrualPeriod
  }

  if (force.value) body.force = true

  return body
}

function messageFor(err) {
  switch (err?.data?.code) {
    case 'screening_already_valid':
      force.value = true
      return 'This donor already answered the current questionnaire. Submit again to replace it with these answers.'
    case 'threshold_not_met':
      return err.data.message
    case 'questionnaire_version_stale':
    case 'consent_version_stale':
      return `${err.data.message} Close this and start again.`
    case 'donor_not_presented':
      return 'Open the donation first. The questionnaire is recorded against this visit.'
    default:
      if (err?.status === 429) return 'Too many submissions just now. Wait a minute and try again.'
      return err?.message || 'The questionnaire could not be submitted. Try again.'
  }
}

async function submit() {
  attempted.value = true
  submitError.value = ''

  if (!complete.value) {
    const first = questions.value.find((q) => answers[q.code] === undefined)
    if (first) document.getElementById(`onsite-${first.code}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }

  submitting.value = true

  try {
    const result = await bloodCenterService.recordCounterQuestionnaire(props.donorUuid, payload())
    recorded.value = result?.data ?? { available: true }
    clearAnswers()
  } catch (err) {
    submitError.value = messageFor(err)
  } finally {
    submitting.value = false
  }
}

function clearAnswers() {
  for (const key of Object.keys(answers)) delete answers[key]
  for (const key of Object.keys(consentTicked)) delete consentTicked[key]
  Object.assign(vitals, { weight: null, lastDonationDate: '', lastDonationVenue: '', lastMenstrualPeriod: '' })
}

function finish() {
  emit('recorded', recorded.value)
}

function requestClose() {
  if (recorded.value) {
    finish()
    return
  }

  if (dirty.value && !window.confirm('Discard the answers given so far?')) return

  clearAnswers()
  emit('close')
}

function longDate(value) {
  if (!value) return '—'

  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value)

  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })
}

onMounted(() => {
  document.body.style.overflow = 'hidden'
  load()
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  clearAnswers()
})
</script>

<style scoped>
.onsite-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
}

/* Handed to the donor: one wide column, large targets, nothing else on screen. */
.onsite {
  display: flex;
  flex-direction: column;
  width: min(52rem, 100%);
  height: 100%;
  background: var(--rb-surface);
  font-family: var(--rb-font-sans);
}

.onsite__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--rb-border);
}

.onsite__eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.onsite__title { margin: 0.3rem 0 0; font-size: 18px; font-weight: 700; color: var(--rb-text-primary); }

.onsite__header-side { display: flex; align-items: center; gap: 0.75rem; flex: none; }

.onsite__progress {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  font-variant-numeric: tabular-nums;
}

.onsite__close {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  cursor: pointer;
}

.onsite__close:hover { background: var(--rb-surface-hover); }

.onsite__body {
  flex: 1;
  overflow-y: auto;
  padding: 1.1rem 1.25rem 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.onsite__intro { margin: 0; max-width: 66ch; font-size: 14px; line-height: 1.5; color: var(--rb-text-secondary); }

.onsite__banner {
  margin: 0;
  padding: 0.7rem 0.85rem;
  border-radius: 10px;
  border: 1px solid rgba(var(--rb-warning-rgb), 0.35);
  background: rgba(var(--rb-warning-rgb), 0.1);
  color: var(--rb-warning-text);
  font-size: 13.5px;
  line-height: 1.45;
}

.onsite__group {
  margin: 0;
  padding: 0.9rem 1rem 1rem;
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  background: var(--rb-surface);
}

.onsite__legend {
  margin: 0 0 0.6rem;
  padding: 0 0.3rem;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.onsite__fields {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
}

.onsite__field { display: flex; flex-direction: column; gap: 0.3rem; }
.onsite__field--inline { margin-top: 0.6rem; max-width: 16rem; }

.onsite__label { font-size: 13px; font-weight: 600; color: var(--rb-text-primary); }
.onsite__optional { font-weight: 400; color: var(--rb-text-secondary); font-size: 12px; }

.onsite__input {
  width: 100%;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--rb-border-strong);
  border-radius: 9px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 15px;
}

.onsite__input:focus-visible {
  outline: 2px solid var(--rb-primary);
  outline-offset: 1px;
  border-color: var(--rb-primary);
}

.onsite__hint { margin: 0.6rem 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }

.onsite__questions { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; }

.onsite__question {
  padding: 0.8rem 0.4rem;
  border-top: 1px solid var(--rb-border);
  border-left: 3px solid transparent;
  scroll-margin: 5rem;
}

.onsite__question:first-child { border-top: none; }

.onsite__question--missing {
  border-left-color: var(--rb-accent);
  background: rgba(var(--rb-accent-rgb), 0.05);
  padding-left: 0.7rem;
}

.onsite__q-text { margin: 0; font-size: 15px; line-height: 1.5; color: var(--rb-text-primary); }
.onsite__q-no { color: var(--rb-text-secondary); font-variant-numeric: tabular-nums; margin-right: 0.2rem; }

.onsite__answers { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.6rem; }

.onsite__answer {
  min-width: 5.5rem;
  min-height: 44px;
  padding: 0.5rem 1rem;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease;
}

.onsite__answer:hover { border-color: var(--rb-border-hover); }

.onsite__answer--on {
  border-color: var(--rb-primary);
  background: var(--rb-primary);
  color: #fff;
}

.onsite__answer--on:hover { border-color: var(--rb-primary); }

.onsite__answer:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

.onsite__consent {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.55rem 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--rb-text-primary);
  cursor: pointer;
}

.onsite__consent input { width: 18px; height: 18px; margin-top: 0.15rem; flex: none; accent-color: var(--rb-primary); }

/* Stays in reach at the bottom of a long form. */
.onsite__footer {
  position: sticky;
  bottom: 0;
  margin: 0 -1.25rem;
  padding: 0.8rem 1.25rem 1rem;
  border-top: 1px solid var(--rb-border);
  background: var(--rb-surface);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.onsite__actions { display: flex; justify-content: flex-end; gap: 0.5rem; }

.onsite__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0.5rem 1.1rem;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.onsite__btn:hover:not(:disabled) { background: var(--rb-surface-hover); }
.onsite__btn:disabled { opacity: 0.55; cursor: not-allowed; }

.onsite__btn--primary { background: var(--rb-primary); border-color: var(--rb-primary); color: #fff; }
.onsite__btn--primary:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-primary) 88%, #000); }

.onsite__alert {
  margin: 0;
  padding: 0.6rem 0.8rem;
  border-radius: 10px;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.3);
  background: rgba(var(--rb-accent-rgb), 0.08);
  color: var(--rb-accent-text);
  font-size: 13.5px;
}

.onsite__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  margin: 3rem 1.25rem;
  color: var(--rb-text-secondary);
  font-size: 14px;
  text-align: center;
}

.onsite__done {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  flex: 1;
  padding: 2rem 1.25rem;
  text-align: center;
  color: var(--rb-success-text);
}

.onsite__done-title { margin: 0.4rem 0 0; font-size: 18px; font-weight: 700; color: var(--rb-text-primary); }
.onsite__done-text { margin: 0 0 0.6rem; font-size: 14px; color: var(--rb-text-secondary); }

@media (max-width: 640px) {
  .onsite__header { padding: 0.85rem 1rem; }
  .onsite__body { padding: 0.9rem 1rem 0; }
  .onsite__footer { margin: 0 -1rem; padding: 0.75rem 1rem 0.9rem; }
  .onsite__answer { flex: 1 1 auto; }
}
</style>
