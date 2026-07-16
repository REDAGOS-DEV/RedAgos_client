<template>
    <div class="eligibility-page">
        <div class="header-row fade-in" style="--delay: 0ms">
            <h1 class="page-title">Eligibility Screening</h1>
            <p class="page-subtitle">Complete this quick survey to check whether you're currently eligible to donate
                blood.</p>
        </div>

        <!-- Info banner -->
        <div class="info-banner fade-in" style="--delay: 50ms">
            <span class="info-banner__icon">
                <AssetIcon name="info" :size="16" class="banner-icon" />
            </span>
            <p class="info-banner__text">
                This screening is valid for 90 days. Once you pass, a QR code will be generated for you to present at
                the donation center.
            </p>
        </div>

        <!-- Step indicator -->
        <div class="step-indicator fade-in" style="--delay: 100ms">
            <template v-for="(step, idx) in steps" :key="step.number">
                <span class="step__circle" :class="{ 'step__circle--filled': step.number <= currentStep }">{{
                    step.number }}</span>
                <div v-if="idx < steps.length - 1" class="step__line"
                    :class="{ 'step__line--active': step.number < currentStep }" />
            </template>
        </div>

        <div class="main-grid">
            <!-- Left column: questions -->
            <div class="col-left">
                <div class="panel fade-in" style="--delay: 150ms">
                    <div class="panel-header panel-header--simple">
                        <h2 class="panel-title">Section 1 - General Health</h2>
                    </div>
                    <div class="question-list">
                        <div v-for="q in section1" :key="q.id" class="question-card">
                            <p class="question-card__text">{{ q.number }}. {{ q.text }}</p>
                            <div class="answer-toggle">
                                <button type="button" class="answer-btn answer-btn--yes"
                                    :class="{ 'answer-btn--active': q.answer === true }"
                                    @click="q.answer = true">Yes</button>
                                <button type="button" class="answer-btn answer-btn--no"
                                    :class="{ 'answer-btn--active': q.answer === false }"
                                    @click="q.answer = false">No</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="panel fade-in" style="--delay: 200ms">
                    <div class="panel-header panel-header--simple">
                        <h2 class="panel-title">Section 2 - Medical History</h2>
                    </div>
                    <div class="question-list">
                        <div v-for="q in section2" :key="q.id" class="question-card">
                            <p class="question-card__text">{{ q.number }}. {{ q.text }}</p>
                            <div class="answer-toggle">
                                <button type="button" class="answer-btn answer-btn--yes"
                                    :class="{ 'answer-btn--active': q.answer === true }"
                                    @click="q.answer = true">Yes</button>
                                <button type="button" class="answer-btn answer-btn--no"
                                    :class="{ 'answer-btn--active': q.answer === false }"
                                    @click="q.answer = false">No</button>
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
                        <div class="form-stack">
                            <div class="form-field">
                                <label class="form-label">Age</label>
                                <input v-model.number="vitals.age" type="number" min="0" class="form-input"
                                    placeholder="29">
                            </div>
                            <div class="form-field">
                                <label class="form-label">Weight (kg)</label>
                                <input v-model.number="vitals.weight" type="number" min="0" class="form-input"
                                    placeholder="72">
                            </div>
                            <div class="form-field">
                                <label class="form-label">Blood type (if known)</label>
                                <div class="select-wrap">
                                    <select v-model="vitals.bloodType" class="form-input form-input--select">
                                        <option value="">Select</option>
                                        <option v-for="bt in bloodTypeOptions" :key="bt" :value="bt">{{ bt }}</option>
                                    </select>
                                    <AssetIcon name="chevron-down" :size="16" class="select-wrap__icon" />
                                </div>
                            </div>
                            <div class="form-field">
                                <label class="form-label">Last blood donation date</label>
                                <input v-model="vitals.lastDonationDate" type="date" class="form-input">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Result preview -->
                <div class="panel fade-in" style="--delay: 200ms">
                    <div class="panel-header panel-header--simple">
                        <h2 class="panel-title">Screening result preview</h2>
                    </div>
                    <div class="result-body">
                        <div class="result-box" :class="resultPanelClass">
                            <p class="result-box__label">Based on your answers</p>
                            <p class="result-box__value" :class="resultTextClass">{{ resultLabel }}</p>
                        </div>
                        <p class="result-body__note">
                            Final eligibility is confirmed upon submission. If you pass, a QR code will be generated
                            automatically for your next donation.
                        </p>
                    </div>
                </div>

                <button type="button" class="btn-primary btn-block btn-submit fade-in" style="--delay: 250ms"
                    :disabled="submitting || !allAnswered" @click="handleSubmit">
                    <span>{{ submitting ? 'Submitting...' : 'Submit screening' }}</span>
                    <AssetIcon name="arrow-right" :size="16" class="btn-submit__icon" />
                </button>
            </div>
        </div>

        <!-- Success modal: shown only when the submitted screening comes back eligible -->
        <Teleport to="body">
            <Transition name="modal-fade">
                <div v-if="showPassedModal" class="modal-backdrop" @click.self="showPassedModal = false">
                    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="epm-title">
                        <div class="modal-check">
                            <AssetIcon name="check" :size="26" />
                        </div>

                        <h2 id="epm-title" class="modal-title">Eligibility screening passed!</h2>
                        <p class="modal-subtitle">
                            Your QR code has been generated. Present it at the blood center
                            to proceed with your next test.
                        </p>

                        <div class="modal-qr-wrap">
                            <img
                                v-if="qrCodeDataUrl"
                                :src="qrCodeDataUrl"
                                alt="Donor eligibility QR code"
                                class="modal-qr-image"
                            >
                            <div v-else class="modal-qr-image modal-qr-image--placeholder">
                                <div class="modal-spinner" />
                            </div>
                        </div>

                        <p class="modal-validity">
                            Valid for {{ qrValidityDays }} days · Expires {{ formattedQrExpiry }}
                        </p>

                        <div class="modal-actions">
                            <button type="button" class="btn-outline" @click="goToFullQr">
                                View full QR
                            </button>
                            <button type="button" class="btn-primary" @click="goToBookAppointment">
                                Book Appointment
                                <AssetIcon name="arrow-right" :size="16" />
                            </button>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'

definePageMeta({
  layout: 'donordashboard',
  middleware: 'auth',
})

const router = useRouter()
const submitting = ref(false)

// Modal + QR state shown after an eligible result
const showPassedModal = ref(false)
const qrCodeDataUrl = ref('')
const qrExpiresOn = ref(null)
const qrValidityDays = ref(14)

// Step indicator: 1 = General Health, 2 = Medical History, 3 = Vital Information,
// 4 = Ready to submit. Auto-advances as the user finishes each card — dili na
// static, mo-progress base sa gi-answeran na sa user.
const steps = [{ number: 1 }, { number: 2 }, { number: 3 }, { number: 4 }]

const section1 = reactive([
    { id: 'gh_1', number: 1, text: 'Are you currently feeling well and in good health today?', answer: null, disqualifyIfAnswer: false },
    { id: 'gh_2', number: 2, text: 'Do you have a fever, cold, or flu symptoms in the last 7 days?', answer: null, disqualifyIfAnswer: true },
    { id: 'gh_3', number: 3, text: 'Are you taking any prescription medications currently?', answer: null, disqualifyIfAnswer: null },
    { id: 'gh_4', number: 4, text: 'Have you donated blood in the last 90 days?', answer: null, disqualifyIfAnswer: true },
])

const section2 = reactive([
    { id: 'mh_1', number: 5, text: 'Have you ever been diagnosed with HIV, Hepatitis B, or Hepatitis C?', answer: null, disqualifyIfAnswer: true },
    { id: 'mh_2', number: 6, text: 'Have you had surgery or a blood transfusion in the last 12 months?', answer: null, disqualifyIfAnswer: true },
    { id: 'mh_3', number: 7, text: 'Have you traveled outside the country in the last 6 months?', answer: null, disqualifyIfAnswer: null },
    { id: 'mh_4', number: 8, text: 'Do you weigh at least 50 kilograms?', answer: null, disqualifyIfAnswer: false },
])

const bloodTypeOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const vitals = reactive({
    age: null,
    weight: null,
    bloodType: '',
    lastDonationDate: '',
})

const allQuestions = computed(() => [...section1, ...section2])

const allAnswered = computed(() => allQuestions.value.every(q => q.answer !== null))

const currentStep = computed(() => {
    const section1Done = section1.every(q => q.answer !== null)
    const section2Done = section2.every(q => q.answer !== null)
    const vitalsDone = vitals.age && vitals.weight && vitals.bloodType && vitals.lastDonationDate
    if (!section1Done) return 1
    if (!section2Done) return 2
    if (!vitalsDone) return 3
    return 4
})

const isFlagged = computed(() => {
    const questionFlag = allQuestions.value.some(
        q => q.disqualifyIfAnswer !== null && q.answer === q.disqualifyIfAnswer
    )
    const weightFlag = vitals.weight !== null && vitals.weight !== '' && Number(vitals.weight) < 50
    const ageFlag = vitals.age !== null && vitals.age !== '' && Number(vitals.age) < 18
    let recentDonationFlag = false
    if (vitals.lastDonationDate) {
        const daysSince = (Date.now() - new Date(vitals.lastDonationDate).getTime()) / (1000 * 60 * 60 * 24)
        recentDonationFlag = daysSince < 90
    }
    return questionFlag || weightFlag || ageFlag || recentDonationFlag
})

const resultLabel = computed(() => {
    if (!allAnswered.value) return 'Answer all questions to see your result'
    return isFlagged.value ? 'Not eligible' : 'Likely eligible'
})

const resultPanelClass = computed(() => {
    if (!allAnswered.value) return 'result-box--pending'
    return isFlagged.value ? 'result-box--danger' : 'result-box--success'
})

const resultTextClass = computed(() => {
    if (!allAnswered.value) return 'result-box__value--pending'
    return isFlagged.value ? 'result-box__value--danger' : 'result-box__value--success'
})

const formattedQrExpiry = computed(() => {
    if (!qrExpiresOn.value) return '—'
    const d = new Date(qrExpiresOn.value)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
})

function goToFullQr() {
    showPassedModal.value = false
    router.push('/signup/donor/MyQRCode')
}

function goToBookAppointment() {
    showPassedModal.value = false
    router.push('/signup/donor/Appointments')
}

async function handleSubmit() {
    submitting.value = true
    try {
        const result = isFlagged.value ? 'not_eligible' : 'eligible'

        // Backend contract: POST /api/eligibility/screening
        // Body: { answers: [{ id, answer }], vitals, result: 'eligible' | 'not_eligible' }
        // Response when result === 'eligible':
        //   { qr_token, screening_valid_until, qr_valid_days }
        // qr_token is the opaque value to encode in the QR — never encode raw vitals/answers.
        const data = await $fetch('/api/eligibility/screening', {
            method: 'POST',
            body: {
                answers: allQuestions.value.map(q => ({ id: q.id, answer: q.answer })),
                vitals: { ...vitals },
                result,
            },
        })

        if (result === 'not_eligible') {
            // Deferred donors just land on MyQRCode, which already renders the
            // "screening was deferred" empty state for them.
            router.push('/signup/donor/MyQRCode')
            return
        }

        qrExpiresOn.value = data?.screening_valid_until ?? null
        qrValidityDays.value = data?.qr_valid_days ?? 14

        if (data?.qr_token) {
            // QRCode is assumed globally available, same as on the MyQRCode page
            qrCodeDataUrl.value = await QRCode.toDataURL(data.qr_token, {
                width: 220,
                margin: 1,
                color: { dark: '#1f2937', light: '#ffffff' },
            })
        }

        showPassedModal.value = true
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
    background: #F5F7FA;
    flex-direction: column;
    gap: 20px;
    transition: background-color 0.2s ease;
}

.header-row {
    display: flex;
    flex-direction: column;
}

.page-title {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
}

.page-subtitle {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 2px 0 0;
}

.fade-in {
    animation: fadeInUp 0.5s ease both;
    animation-delay: var(--delay, 0ms);
}

@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(12px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
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

.info-banner__icon {
    flex-shrink: 0;
    margin-top: 1px;
}

.info-banner__text {
    font-size: 12.5px;
    color: #1f4e79;
    margin: 0;
    line-height: 1.5;
}

.banner-icon {
  color: #1f4e79;
  flex-shrink: 0;
}

/* Step indicator */
.step-indicator {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 4px 0;
}

.step__circle {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 30px;
    height: 30px;
    border-radius: 999px;
    background: #e5e7eb;
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 700;
    transition: background 0.2s ease, color 0.2s ease;
}

.step__circle--filled {
    background: var(--primary);
    color: white;
}

.step__line {
    flex: 1;
    height: 2px;
    background: #e5e7eb;
    margin: 0 8px;
    transition: background 0.2s ease;
}

.step__line--active {
    background: var(--primary);
}

.main-grid {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 20px;
    align-items: start;
}

.col-left,
.col-right {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.panel {
    background: white;
    border-radius: 14px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);
    border: 1px solid #eef0f3;
    overflow: hidden;
}

.panel-header--simple {
    padding: 16px 20px;
    border-bottom: 1px solid #f3f4f6;
}

.panel-title {
    font-weight: 700;
    font-size: 14px;
    color: var(--text-primary);
    margin: 0;
}

/* Questions */
.question-list {
    padding: 16px 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.question-card {
    background: #f5f6f8;
    border-radius: 10px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.question-card__text {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
}

.answer-toggle {
    display: flex;
    gap: 12px;
}

.answer-btn {
    min-width: 84px;
    padding: 8px 18px;
    border-radius: 8px;
    border: 1px solid #d1d5db;
    background: white;
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
}

.answer-btn--yes.answer-btn--active {
    background: #eaf6ea;
    border-color: var(--success);
    color: var(--success);
}

.answer-btn--no.answer-btn--active {
    background: #fbeaea;
    border-color: var(--accent);
    color: var(--accent);
}

.answer-btn:hover:not(.answer-btn--active) {
    background: #f3f4f6;
}

/* Forms */
.form-body {
    padding: 20px;
}

.form-stack {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.form-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 6px;
}

.form-input {
    width: 100%;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    font-size: 13.5px;
    color: var(--text-primary);
    background: white;
    transition: border-color 0.15s ease;
}

.form-input:focus {
    outline: none;
    border-color: var(--primary);
}

.select-wrap {
    position: relative;
}

.form-input--select {
    appearance: none;
    -webkit-appearance: none;
    padding-right: 32px;
    cursor: pointer;
}

.select-wrap__icon {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
}

/* Result preview */
.result-body {
    padding: 4px 20px 20px;
}

.result-box {
    border-radius: 10px;
    padding: 16px 12px;
    text-align: center;
    margin-bottom: 14px;
}

.result-box--pending {
    background: #f9fafb;
}

.result-box--success {
    background: #eaf6ea;
}

.result-box--danger {
    background: #fbeaea;
}

.result-box__label {
    font-size: 12.5px;
    font-weight: 700;
    color: var(--text-secondary);
    margin: 0 0 4px;
}

.result-box__value {
    font-size: 19px;
    font-weight: 700;
    margin: 0;
}

.result-box__value--pending {
    color: var(--text-secondary);
}

.result-box__value--success {
    color: var(--success);
}

.result-box__value--danger {
    color: var(--accent);
}

.result-body__note {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.6;
    text-align: center;
}

/* Buttons */
.btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px 16px;
    border-radius: 10px;
    font-size: 13.5px;
    font-weight: 700;
    color: white;
    background: var(--primary);
    border: none;
    cursor: pointer;
    transition: opacity 0.15s ease;
}

.btn-primary:hover:not(:disabled) {
    opacity: 0.92;
}

.btn-primary:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.btn-block {
    width: 100%;
}

.btn-submit__icon {
    flex-shrink: 0;
}

@media (max-width: 900px) {
    .main-grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 640px) {
    .eligibility-page {
        padding: 16px 16px 32px;
    }

    .step__line {
        width: 32px;
    }
}

/* Eligibility passed modal */
.modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(17, 24, 39, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 1000;
}

.modal-card {
    width: 100%;
    max-width: 380px;
    background: white;
    border-radius: 16px;
    padding: 28px 24px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.18);
}

.modal-check {
    width: 44px;
    height: 44px;
    border-radius: 999px;
    background: #e8f5e9;
    color: var(--success);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
}

.modal-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
}

.modal-subtitle {
    font-size: 12.5px;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 6px 0 20px;
    max-width: 300px;
}

.modal-qr-wrap {
    padding: 10px;
    border-radius: 12px;
    border: 1px solid #eef0f3;
    margin-bottom: 14px;
}

.modal-qr-image {
    width: 180px;
    height: 180px;
    display: block;
}

.modal-qr-image--placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f9fafb;
}

.modal-spinner {
    width: 22px;
    height: 22px;
    border-radius: 999px;
    border: 3px solid #e3ebf6;
    border-top-color: var(--primary);
    animation: modal-spin 0.8s linear infinite;
}

@keyframes modal-spin {
    to { transform: rotate(360deg); }
}

.modal-validity {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 20px;
}

.modal-actions {
    display: flex;
    gap: 10px;
    width: 100%;
}

.modal-actions .btn-primary,
.modal-actions .btn-outline {
    flex: 1;
    width: auto;
}

.btn-outline {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 11px 16px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
    background: #f3f4f6;
    border: none;
    cursor: pointer;
    transition: background 0.15s ease;
}

.btn-outline:hover {
    background: #e5e7eb;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
    transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
    opacity: 0;
}

.modal-fade-enter-active .modal-card,
.modal-fade-leave-active .modal-card {
    transition: transform 0.2s ease;
}

.modal-fade-enter-from .modal-card,
.modal-fade-leave-to .modal-card {
    transform: scale(0.96) translateY(8px);
}

/* ============ Dark mode ============ */
:global(.dark) .eligibility-page {
    --text-primary: #F1F5F9;
    --text-secondary: #94A3B8;
    background: #0F172A;
}

:global(.dark) .panel,
:global(.dark) .modal-card,
:global(.dark) .modal-qr-wrap {
    background: #1E293B;
    border-color: #334155;
}

:global(.dark) .panel-header--simple { border-color: #334155; }

:global(.dark) .info-banner {
    background: rgba(66,165,245,0.14);
    border-color: rgba(66,165,245,0.3);
}
:global(.dark) .info-banner__text,
:global(.dark) .banner-icon { color: #90CAF9; }

:global(.dark) .step__circle { background: #263449; }
:global(.dark) .step__line { background: #334155; }

:global(.dark) .question-card { background: #172033; }

:global(.dark) .answer-btn {
    background: #1E293B;
    border-color: #334155;
    color: #F1F5F9;
}
:global(.dark) .answer-btn:hover:not(.answer-btn--active) { background: #263449; }
:global(.dark) .answer-btn--yes.answer-btn--active { background: rgba(102,187,106,0.16); }
:global(.dark) .answer-btn--no.answer-btn--active { background: rgba(239,83,80,0.16); }

:global(.dark) .form-input {
    background: #0F172A;
    border-color: #334155;
    color: #F1F5F9;
}

:global(.dark) .result-box--pending { background: #263449; }
:global(.dark) .result-box--success { background: rgba(102,187,106,0.16); }
:global(.dark) .result-box--danger { background: rgba(239,83,80,0.16); }

:global(.dark) .btn-outline {
    background: #263449;
    color: #E2E8F0;
}
:global(.dark) .btn-outline:hover { background: #334155; }

:global(.dark) .modal-qr-image--placeholder { background: #172033; }
</style>