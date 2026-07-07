<template>
  <div class="eligibility-page">
    <div class="header-row fade-in" style="--delay: 0ms">
      <h1 class="page-title">Eligibility Screening</h1>
      <p class="page-subtitle">Complete this quick survey to check whether you're currently eligible to donate blood.</p>
    </div>

    <!-- Info banner -->
    <div class="info-banner fade-in" style="--delay: 50ms">
      <span class="info-banner__icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#1565C0" stroke-width="2" />
          <path d="M12 8h.01M11 12h1v5h1" stroke="#1565C0" stroke-width="2" stroke-linecap="round" />
        </svg>
      </span>
      <p class="info-banner__text">
        This screening is valid for 90 days. Once you pass, a QR code will be generated for you to present at the donation center.
      </p>
    </div>

    <!-- Step indicator -->
    <div class="step-indicator fade-in" style="--delay: 100ms">
      <template v-for="(step, idx) in steps" :key="step.number">
        <div class="step">
          <span
            class="step__circle"
            :class="{
              'step__circle--active': step.number === currentStep,
              'step__circle--done': step.number < currentStep,
            }"
          >{{ step.number }}</span>
        </div>
        <div
          v-if="idx < steps.length - 1"
          class="step__line"
          :class="{ 'step__line--active': step.number < currentStep }"
        />
      </template>
    </div>

    <div class="main-grid">
      <!-- Left column: questions -->
      <div class="col-left">
        <div class="panel fade-in" style="--delay: 150ms">
          <div class="panel-header panel-header--simple">
            <h2 class="panel-title">Section 1 · General Health</h2>
          </div>
          <div class="question-list">
            <div v-for="q in section1" :key="q.id" class="question-row">
              <p class="question-row__text">{{ q.text }}</p>
              <div class="answer-toggle">
                <button
                  type="button"
                  class="answer-btn answer-btn--yes"
                  :class="{ 'answer-btn--active': q.answer === true }"
                  @click="q.answer = true"
                >Yes</button>
                <button
                  type="button"
                  class="answer-btn answer-btn--no"
                  :class="{ 'answer-btn--active': q.answer === false }"
                  @click="q.answer = false"
                >No</button>
              </div>
            </div>
          </div>
        </div>

        <div class="panel fade-in" style="--delay: 200ms">
          <div class="panel-header panel-header--simple">
            <h2 class="panel-title">Section 2 · Medical History</h2>
          </div>
          <div class="question-list">
            <div v-for="q in section2" :key="q.id" class="question-row">
              <p class="question-row__text">{{ q.text }}</p>
              <div class="answer-toggle">
                <button
                  type="button"
                  class="answer-btn answer-btn--yes"
                  :class="{ 'answer-btn--active': q.answer === true }"
                  @click="q.answer = true"
                >Yes</button>
                <button
                  type="button"
                  class="answer-btn answer-btn--no"
                  :class="{ 'answer-btn--active': q.answer === false }"
                  @click="q.answer = false"
                >No</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right column: vitals + result -->
      <div class="col-right">
        <div class="panel fade-in" style="--delay: 150ms">
          <div class="panel-header panel-header--simple">
            <h2 class="panel-title">Vital Information</h2>
          </div>
          <div class="form-body">
            <div class="form-grid">
              <div class="form-field">
                <label class="form-label">Age</label>
                <input v-model.number="vitals.age" type="number" min="0" class="form-input" placeholder="28">
              </div>
              <div class="form-field">
                <label class="form-label">Weight (kg)</label>
                <input v-model.number="vitals.weight" type="number" min="0" class="form-input" placeholder="60">
              </div>
              <div class="form-field form-field--full">
                <label class="form-label">Blood Pressure</label>
                <div class="bp-input">
                  <input v-model="vitals.bpSystolic" type="text" class="form-input" placeholder="120">
                  <span class="bp-sep">/</span>
                  <input v-model="vitals.bpDiastolic" type="text" class="form-input" placeholder="80">
                </div>
              </div>
              <div class="form-field form-field--full">
                <label class="form-label">Last Meal</label>
                <input v-model="vitals.lastMeal" type="date" class="form-input">
              </div>
            </div>
          </div>
        </div>

        <!-- Result preview -->
        <div class="panel fade-in result-panel" :class="resultPanelClass" style="--delay: 200ms">
          <div class="panel-header panel-header--simple">
            <h2 class="panel-title">Screening result preview</h2>
          </div>
          <div class="result-body">
            <p class="result-body__label">Result of your current answers</p>
            <p class="result-body__value" :class="resultTextClass">{{ resultLabel }}</p>
            <p class="result-body__note">
              This is a preliminary result based on your answers. Final eligibility is confirmed by staff at the donation center.
            </p>
          </div>
        </div>

        <button
          type="button"
          class="btn-primary btn-block btn-submit fade-in"
          style="--delay: 250ms"
          :disabled="submitting || !allAnswered"
          @click="handleSubmit"
        >
          {{ submitting ? 'Submitting...' : 'Submit screening' }}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" class="btn-submit__icon">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'dashboard' })

const router = useRouter()
const submitting = ref(false)

// Step indicator: kini nga page kay part sa multi-step donor flow
// (1: Screening, 2: Vitals review, 3: ID/QR, 4: Confirmation) — i-adjust
// ang currentStep base sa tinuod nga flow sa registration/booking.
const steps = [{ number: 1 }, { number: 2 }, { number: 3 }, { number: 4 }]
const currentStep = ref(1)

// disqualifyIfAnswer: true  -> answering "Yes" flags the applicant
//                      false -> answering "No" flags the applicant
//                      null  -> informational only, does not affect result
const section1 = reactive([
  { id: 'gh_1', text: 'Are you currently feeling well and in good health today?', answer: null, disqualifyIfAnswer: false },
  { id: 'gh_2', text: 'Do you have a fever, cold, or flu symptoms in the last 7 days?', answer: null, disqualifyIfAnswer: true },
  { id: 'gh_3', text: 'Are you taking any prescription medications currently?', answer: null, disqualifyIfAnswer: null },
  { id: 'gh_4', text: 'Have you donated blood in the last 90 days?', answer: null, disqualifyIfAnswer: true },
])

const section2 = reactive([
  { id: 'mh_1', text: 'Have you been diagnosed with HIV, Hepatitis B, or Hepatitis C?', answer: null, disqualifyIfAnswer: true },
  { id: 'mh_2', text: 'Have you had surgery or received a blood transfusion in the last 12 months?', answer: null, disqualifyIfAnswer: true },
  { id: 'mh_3', text: 'Have you traveled internationally within the last 3 months?', answer: null, disqualifyIfAnswer: null },
  { id: 'mh_4', text: 'Have you weighed under 50 kg (110 lbs) at any time?', answer: null, disqualifyIfAnswer: true },
])

const vitals = reactive({
  age: null,
  weight: null,
  bpSystolic: '',
  bpDiastolic: '',
  lastMeal: '',
})

const allQuestions = computed(() => [...section1, ...section2])

const allAnswered = computed(() => allQuestions.value.every(q => q.answer !== null))

const isFlagged = computed(() => {
  const questionFlag = allQuestions.value.some(
    q => q.disqualifyIfAnswer !== null && q.answer === q.disqualifyIfAnswer
  )
  const weightFlag = vitals.weight !== null && vitals.weight !== '' && Number(vitals.weight) < 50
  const ageFlag = vitals.age !== null && vitals.age !== '' && Number(vitals.age) < 18
  return questionFlag || weightFlag || ageFlag
})

const resultLabel = computed(() => {
  if (!allAnswered.value) return 'Answer all questions to see your result'
  return isFlagged.value ? 'Not eligible' : 'Likely eligible'
})

const resultPanelClass = computed(() => {
  if (!allAnswered.value) return 'result-panel--pending'
  return isFlagged.value ? 'result-panel--danger' : 'result-panel--success'
})

const resultTextClass = computed(() => {
  if (!allAnswered.value) return 'result-body__value--pending'
  return isFlagged.value ? 'result-body__value--danger' : 'result-body__value--success'
})

async function handleSubmit() {
  submitting.value = true
  try {
    // Backend contract: POST /api/eligibility/screening
    // Body: { answers: [{ id, answer }], vitals, result: 'eligible' | 'not_eligible' }
    // Response: mag-generate ug QR code kung eligible ang result
    await $fetch('/api/eligibility/screening', {
      method: 'POST',
      body: {
        answers: allQuestions.value.map(q => ({ id: q.id, answer: q.answer })),
        vitals: { ...vitals },
        result: isFlagged.value ? 'not_eligible' : 'eligible',
      },
    })
    router.push('/signup/donor/MyQRCode')
  } catch (err) {
    console.error('Failed to submit screening:', err)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.eligibility-page {
  --primary: #1565c0;
  --accent: #d32f2f;
  --success: #2e7d32;
  --warning: #f57c00;
  --text-primary: #1f2937;
  --text-secondary: #9ca3af;
  max-width: 1152px;
  margin: 0 auto;
  padding: 24px 32px 40px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.header-row { display: flex; flex-direction: column; }
.page-title { font-size: 20px; font-weight: 700; color: var(--text-primary); margin: 0; }
.page-subtitle { font-size: 13px; color: var(--text-secondary); margin: 2px 0 0; }

.fade-in {
  animation: fadeInUp 0.5s ease both;
  animation-delay: var(--delay, 0ms);
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Info banner */
.info-banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: #eaf3fc;
  border: 1px solid #d3e6fa;
  border-radius: 10px;
  padding: 12px 16px;
}
.info-banner__icon { flex-shrink: 0; margin-top: 1px; }
.info-banner__text { font-size: 12.5px; color: #1f4e79; margin: 0; line-height: 1.5; }

/* Step indicator */
.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 4px 0;
}
.step__circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: #e5e7eb;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 700;
}
.step__circle--active { background: var(--primary); color: white; }
.step__circle--done { background: var(--success); color: white; }
.step__line {
  width: 64px;
  height: 2px;
  background: #e5e7eb;
  margin: 0 4px;
}
.step__line--active { background: var(--success); }

.main-grid { display: grid; grid-template-columns: 1fr 340px; gap: 20px; align-items: start; }
.col-left, .col-right { display: flex; flex-direction: column; gap: 20px; }

.panel {
  background: white;
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);
  border: 1px solid #eef0f3;
  overflow: hidden;
}
.panel-header--simple { padding: 16px 20px; border-bottom: 1px solid #f3f4f6; }
.panel-title { font-weight: 700; font-size: 14px; color: var(--text-primary); margin: 0; }

/* Questions */
.question-list { padding: 4px 20px 8px; }
.question-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid #f9fafb;
}
.question-row:last-child { border-bottom: none; }
.question-row__text { font-size: 13px; color: var(--text-primary); margin: 0; flex: 1; }

.answer-toggle { display: flex; gap: 8px; flex-shrink: 0; }
.answer-btn {
  width: 56px;
  padding: 7px 0;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  color: var(--text-secondary);
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}
.answer-btn--yes.answer-btn--active { background: var(--success); border-color: var(--success); color: white; }
.answer-btn--no.answer-btn--active { background: var(--accent); border-color: var(--accent); color: white; }
.answer-btn:hover:not(.answer-btn--active) { background: #f3f4f6; }

/* Forms */
.form-body { padding: 20px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-field--full { grid-column: 1 / -1; }
.form-label { display: block; font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px; }
.form-input {
  width: 100%; padding: 9px 12px; border-radius: 8px;
  border: 1px solid #e5e7eb; font-size: 13px; color: var(--text-primary);
  background: white; transition: border-color 0.15s ease;
}
.form-input:focus { outline: none; border-color: var(--primary); }

.bp-input { display: flex; align-items: center; gap: 8px; }
.bp-sep { color: var(--text-secondary); font-weight: 700; }

/* Result panel */
.result-panel--pending { background: #f9fafb; }
.result-panel--success { background: #f2f9f2; border-color: #cfe8cf; }
.result-panel--danger { background: #fdf2f2; border-color: #f3cccc; }

.result-body { padding: 4px 20px 20px; }
.result-body__label { font-size: 12px; color: var(--text-secondary); margin: 0 0 4px; }
.result-body__value { font-size: 18px; font-weight: 700; margin: 0 0 8px; }
.result-body__value--pending { color: var(--text-secondary); }
.result-body__value--success { color: var(--success); }
.result-body__value--danger { color: var(--accent); }
.result-body__note { font-size: 11.5px; color: var(--text-secondary); margin: 0; line-height: 1.5; }

/* Buttons */
.btn-primary {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 12px 16px; border-radius: 10px; font-size: 13.5px; font-weight: 700;
  color: white; background: var(--primary); border: none; cursor: pointer;
  transition: opacity 0.15s ease;
}
.btn-primary:hover:not(:disabled) { opacity: 0.92; }
.btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-block { width: 100%; }
.btn-submit__icon { flex-shrink: 0; }

@media (max-width: 900px) {
  .main-grid { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .eligibility-page { padding: 16px 16px 32px; }
  .form-grid { grid-template-columns: 1fr; }
  .step__line { width: 32px; }
  .question-row { flex-direction: column; align-items: flex-start; gap: 8px; }
}
</style>