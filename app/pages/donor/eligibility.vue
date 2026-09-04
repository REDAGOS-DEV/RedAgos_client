Exit code: 0
Wall time: 2.1 seconds
Output:
<template>
    <div class="eligibility-page">
        <!-- Skeleton loading state -->
        <div v-if="loading" class="skeleton-wrap">
            <div class="skeleton skeleton--header" />
            <div class="skeleton skeleton--banner" />
            <div class="skeleton skeleton--steps" />
            <div class="skeleton-main-grid">
                <div class="skeleton-col">
                    <div class="skeleton skeleton--panel" style="height:280px" />
                    <div class="skeleton skeleton--panel" style="height:280px" />
                </div>
                <div class="skeleton-col">
                    <div class="skeleton skeleton--panel" style="height:240px" />
                    <div class="skeleton skeleton--panel" style="height:140px" />
                    <div class="skeleton skeleton--button" />
                </div>
            </div>
        </div>

        <template v-else>
            <div class="header-row">
                <h1 class="page-title">Check your donation readiness</h1>
                <p class="page-subtitle">Complete the short health assessment below to determine whether you're currently eligible to donate blood.</p>
            </div>

            <!-- Info banner -->
            <div class="info-banner">
                <span class="info-banner__icon">
                    <AssetIcon name="info" :size="16" class="banner-icon" />
                </span>
                <p class="info-banner__text">
                    This screening is valid for 90 days. Once you pass, a QR code will be generated for you to present at
                    the donation center.
                </p>
            </div>

            <!-- Current eligibility state -->
            <div v-if="statusBanner" class="status-banner" :class="`status-banner--${statusBanner.tone}`">
                <span class="status-banner__icon">
                    <AssetIcon :name="statusBanner.icon" :size="16" />
                </span>
                <div class="status-banner__body">
                    <p class="status-banner__title">{{ statusBanner.title }}</p>
                    <p v-if="statusBanner.detail" class="status-banner__detail">{{ statusBanner.detail }}</p>
                    <ul v-if="statusBanner.reasons.length" class="status-banner__reasons">
                        <li v-for="reason in statusBanner.reasons" :key="reason.code">{{ reason.message }}</li>
                    </ul>
                </div>
            </div>

            <!-- Step indicator -->
            <div v-if="sections.length" class="step-indicator">
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
                    <div v-if="loadError" class="panel">
                        <div class="panel-header panel-header--simple">
                            <h2 class="panel-title">Questionnaire unavailable</h2>
                        </div>
                        <div class="form-body">
                            <p class="load-error__text">{{ loadError }}</p>
                            <button type="button" class="btn-primary btn-block load-error__retry" @click="load">
                                Try again
                            </button>
                        </div>
                    </div>

                    <div v-for="(section, idx) in sections" :key="section.key" class="panel">
                        <div class="panel-header panel-header--simple">
                            <h2 class="panel-title">Section {{ idx + 1 }} - {{ section.title }}</h2>
                        </div>
                        <div class="question-list">
                            <div v-for="q in section.questions" :key="q.code" class="question-card">
                                <p class="question-card__text">{{ q.number }}. {{ q.text }}</p>
                                <div class="answer-toggle">
                                    <button type="button" class="answer-btn answer-btn--yes"
                                        :class="{ 'answer-btn--active': answers[q.code] === true }"
                                        @click="answers[q.code] = true">Yes</button>
                                    <button type="button" class="answer-btn answer-btn--no"
                                        :class="{ 'answer-btn--active': answers[q.code] === false }"
                                        @click="answers[q.code] = false">No</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right column: vitals + result -->
                <div class="col-right">
                    <div class="panel">
                        <div class="panel-header panel-header--simple">
                            <h2 class="panel-title">Vital Information</h2>
                        </div>
                        <div class="form-body">
                            <div class="form-stack">
                                <div class="form-field">
                                    <label class="form-label">Age</label>
                                    <input v-model.number="vitals.age" type="number" min="0" class="form-input"
                                        :class="{ 'form-input--locked': prefilled.age }" :readonly="prefilled.age"
                                        placeholder="29">
                                    <p v-if="prefilled.age" class="form-hint">
                                        From your profile, computed from your birth date.
                                    </p>
                                </div>

                                <div class="form-field">
                                    <label class="form-label">Weight (kg)</label>
                                    <input v-model.number="vitals.weight" type="number" min="0" class="form-input"
                                        placeholder="72">
                                </div>
                                <div class="form-field">
                                    <label class="form-label">Blood type (if known)</label>
                                    <div class="select-wrap">
                                        <select v-model="vitals.bloodType" class="form-input form-input--select"
                                            :class="{ 'form-input--locked': prefilled.bloodType }"
                                            :disabled="prefilled.bloodType">
                                            <option value="">Select</option>
                                            <option v-for="bt in bloodTypeOptions" :key="bt" :value="bt">{{ bt }}</option>
                                        </select>
                                        <AssetIcon name="chevron-down" :size="16" class="select-wrap__icon" />
                                    </div>
                                    <p v-if="prefilled.bloodType" class="form-hint">
                                        From your profile. Change it in Profile settings.
                                    </p>
                                </div>

                                <div class="form-field">
                                    <label class="form-label">Last blood donation date</label>
                                    <input v-model="vitals.lastDonationDate" type="date" class="form-input">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Result preview -->
                    <div class="panel">
                        <div class="panel-header panel-header--simple">
                            <h2 class="panel-title">Screening result preview</h2>
                        </div>
                        <div class="result-body">
                            <div class="result-box result-box--pending">
                                <p class="result-box__label">Based on your answers</p>
                                <p class="result-box__value result-box__value--pending">{{ resultLabel }}</p>
                            </div>

                            <p class="result-body__note">
                                Final eligibility is confirmed upon submission. If you pass, a QR code will be generated
                                automatically for your next donation.
                            </p>
                        </div>
                    </div>

                    <button type="button" class="btn-primary btn-block btn-submit"
                        :disabled="submitting || !allAnswered" @click="handleSubmit()">
                        <span>{{ submitting ? 'Submitting...' : 'Submit screening' }}</span>
                        <AssetIcon name="arrow-right" :size="16" class="btn-submit__icon" />
                    </button>

                    <div v-if="submitError" class="submit-error">
                        <p class="submit-error__text">{{ submitError }}</p>
                        <button v-if="canForceResubmit" type="button" class="btn-outline btn-block"
                            :disabled="submitting" @click="handleSubmit(true)">
                            Re-screen anyway
                        </button>
                    </div>

                </div>
            </div>
        </template>

        <!-- Success modal, makita rani if ang result sa eligibility screening kay "eligible" -->
        <Teleport to="body">
            <Transition name="modal-fade">
                <div v-if="showPassedModal" class="modal-backdrop" @click.self="showPassedModal = false">
                    <div class="modal-card" role="dialog" v-focus-trap aria-modal="true" aria-labelledby="epm-title">
                        <div class="modal-check">
                            <AssetIcon name="check" :size="26" />
                        </div>

                        <h2 id="epm-title" class="modal-title">Eligibility screening passed!</h2>
                        <p class="modal-subtitle">
                            {{ qrCodeDataUrl
                                ? 'Your QR code has been generated. Present it at the blood center to proceed with your next test.'
                                : 'Verify your email address to receive your check-in QR code.' }}
                        </p>

                        <div v-if="qrCodeDataUrl" class="modal-qr-wrap">
                            <img
                                :src="qrCodeDataUrl"
                                alt="Donor eligibility QR code"
                                class="modal-qr-image"
                            >
                        </div>

                        <p v-if="qrCodeDataUrl" class="modal-validity">
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
definePageMeta({
  middleware: 'auth',
  layout: 'donordashboard',
  keepalive: true,
})

import AssetIcon from '~/components/common/AssetIcon.vue'
import { donorService } from '~/api/donor/DonorService'
import QRCode from 'qrcode'


const router = useRouter()
const submitting = ref(false)
const loading = ref(true)
const loadError = ref('')

// Modal + QR state shown after an eligible result
const showPassedModal = ref(false)
const qrCodeDataUrl = ref('')
const qrExpiresOn = ref(null)
const qrValidityDays = ref(14)

// Questionnaire served by the backend. Ang wording ug ang scoring flags kay
// naa na sa server, so ang client dili na mag-hardcode og questions.
const sections = ref([])
const questionVersion = ref(null)
const answers = reactive({})

const bloodTypeOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const vitals = reactive({
    age: null,
    weight: null,
    bloodType: '',
    lastDonationDate: '',
})

// Gi-track kung asa nga fields gikan sa profile, kay kato ra ang i-lock. Kung
// wala nag-return og value ang server, editable gihapon para sa donor.
const prefilled = reactive({
    age: false,
    bloodType: false,
})

// current eligibility state sa donor gikan sa server.
const eligibility = ref(null)

const submitError = ref('')
const canForceResubmit = ref(false)


// Step indicator: one step per served section, then Vital Information, then
// Ready to submit. Auto-advances as the user finishes each card.
const steps = computed(() =>
    Array.from({ length: sections.value.length + 2 }, (_, i) => ({ number: i + 1 }))
)

const allQuestions = computed(() => sections.value.flatMap(section => section.questions))

const allAnswered = computed(() =>
    allQuestions.value.length > 0 && allQuestions.value.every(q => answers[q.code] !== undefined)
)

const currentStep = computed(() => {
    const unfinished = sections.value.findIndex(
        section => section.questions.some(q => answers[q.code] === undefined)
    )
    if (unfinished !== -1) return unfinished + 1

    const vitalsDone = vitals.age && vitals.weight && vitals.bloodType && vitals.lastDonationDate
    if (!vitalsDone) return sections.value.length + 1

    return sections.value.length + 2
})

// Ang disqualification flags kay wala gi-serve sa /eligibility/questions, tinuyo
// gyud, kay ang server ra ang mo-score. So walay verdict nga ma-compute diri.
const resultLabel = computed(() =>
    allAnswered.value ? 'Ready to submit' : 'Answer all questions to see your result'
)

function formatDate(value) {
    if (!value) return '-'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return '-'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formattedQrExpiry = computed(() => formatDate(qrExpiresOn.value))

// Ang tanan nga branching kay diri ra, dili sa template. Ang `null` return it
// means nga walay banner nga i-render.
const statusBanner = computed(() => {
    const current = eligibility.value
    if (!current) return null

    const reasons = current.deferral_reasons || []

    switch (current.eligibility_status) {
        case 'eligible':
            return {
                tone: 'success',
                icon: 'circle-check-big',
                title: `You already have a valid screening, good until ${formatDate(current.screening_valid_until)}.`,
                detail: 'Re-screen only if your health details have changed since then.',
                reasons: [],
            }
        case 'deferred':
            return {
                tone: 'danger',
                icon: 'octagon-alert',
                title: 'Your last screening was deferred.',
                detail: current.next_eligible_date
                    ? `You may be eligible again on ${formatDate(current.next_eligible_date)}.`
                    : '',
                reasons,
            }
        case 'expired':
            return {
                tone: 'warning',
                icon: 'clock',
                title: `Your previous screening expired on ${formatDate(current.screening_valid_until)}.`,
                detail: 'Complete the questionnaire again to refresh your eligibility.',
                reasons: [],
            }
        default:
            // 'pending' — igo na ang static info banner para sa wala pa na-screen.
            return null
    }
})


function goToFullQr() {
    showPassedModal.value = false
    router.push('/donor/qrcode')
}

function goToBookAppointment() {
    showPassedModal.value = false
    router.push('/donor/appointments')
}


function handleSubmitError(err) {
    const code = err?.data?.code

    // Parehas 409 ang duha, so ang `code` ra ang balo kung unsa.
    if (code === 'screening_already_valid') {
        const until = formatDate(err?.data?.screening_valid_until)
        submitError.value = `${err.message} Your current screening is valid until ${until}.`
        canForceResubmit.value = true
        return
    }

    if (code === 'questionnaire_version_stale') {
        submitError.value = err.message
        // Kuhaon ang bag-ong version aron mo-trabaho ang sunod nga submit.
        load()
        return
    }

    if (err?.status === 429) {
        submitError.value = 'Too many screening attempts. Please wait a while before trying again.'
        return
    }

    submitError.value = err?.message || 'Failed to submit your screening. Please try again.'
    console.error('Failed to submit screening:', err)
}

async function handleSubmit(force = false) {
    submitting.value = true
    submitError.value = ''
    canForceResubmit.value = false

    try {
        const payload = {
            question_version: questionVersion.value,
            answers: allQuestions.value.map(q => ({ code: q.code, answer: answers[q.code] })),
        }

        // `vitals.weight` kay required_with:vitals, so kung walay weight, i-omit
        // gyud ang tibuok `vitals` object imbes mo-send og null — 422 na kadto.
        if (vitals.weight !== null && vitals.weight !== '') {
            payload.vitals = { weight: Number(vitals.weight) }

            if (vitals.lastDonationDate) {
                payload.vitals.last_donation_date = vitals.lastDonationDate
            }
        }

        if (force) {
            payload.force = true
        }

        const data = await donorService.submitEligibilityScreening(payload)

        // I-refresh ang status banner aron mo-reflect na sa bag-ong screening.
        await loadStatus()

        if (data?.result === 'eligible') {
            qrExpiresOn.value = data?.qr_valid_until ?? null
            qrValidityDays.value = data?.qr_valid_days ?? qrValidityDays.value
            qrCodeDataUrl.value = ''

            // Walay qr_token kung wala pa ma-verify ang email sa donor.
            if (data?.qr_token) {
                qrCodeDataUrl.value = await QRCode.toDataURL(data.qr_token, {
                    width: 220,
                    margin: 1,
                    color: { dark: '#1f2937', light: '#ffffff' },
                })
            }

            showPassedModal.value = true
            return
        }

        // Deferred: ang status banner sa taas mao nay mo-explain sa mga reasons.
        if (import.meta.client) {
            window.scrollTo({ top: 0, behavior: 'smooth' })
        }
    } catch (err) {
        handleSubmitError(err)
    } finally {
        submitting.value = false
    }
}


async function load() {
    loading.value = true
    loadError.value = ''
    try {
        // GET /api/donors/eligibility/questions
        // Response: { version, sections: [{ key, title, questions: [{ code, number, text }] }] }
        const data = await donorService.eligibilityQuestions()

        questionVersion.value = data?.version ?? null
        sections.value = (data?.sections || []).map(section => ({
            key: section.key,
            title: section.title,
            questions: section.questions || [],
        }))

        // Limpyohan ang answers aron walay stale nga code nga mabilin after reload
        Object.keys(answers).forEach(code => delete answers[code])
    } catch (err) {
        console.error('Failed to load eligibility questions:', err)
        loadError.value = err?.message || 'Unable to load the screening questionnaire.'
    } finally {
        loading.value = false
    }
}

async function loadPrefill() {
    try {
        // GET /api/donors/eligibility/prefill
        // Response: { blood_type, age, last_donation_date } — tanan pwede null
        const data = await donorService.eligibilityPrefill()

        if (data?.age != null && vitals.age === null) {
            vitals.age = data.age
            prefilled.age = true
        }

        if (data?.blood_type && !vitals.bloodType) {
            vitals.bloodType = data.blood_type
            prefilled.bloodType = true
        }

        // Editable ni gihapon: ang gi-submit kay declared_last_donation_date,
        // lahi sa record sa server, so pwede i-correct sa donor.
        if (data?.last_donation_date && !vitals.lastDonationDate) {
            vitals.lastDonationDate = data.last_donation_date
        }
    } catch (err) {
        // Convenience ra ni. Kung mapakyas, manual gihapon ma-fill sa donor,
        // so dili ni angay mo-block sa screening.
        console.error('Failed to load eligibility prefill:', err)
    }
}


async function loadStatus() {
    try {
        // GET /api/donors/eligibility
        // Response: { eligibility_status, screening_date, screening_valid_until,
        //             deferral_reasons: [{ code, message }], last_donation_date,
        //             next_eligible_date, questionnaire_version }
        eligibility.value = await donorService.eligibilityStatus()
    } catch (err) {
        // Informational ra ang banner, so dili ni angay mo-block sa form.
        console.error('Failed to load eligibility status:', err)
    }
}

// Gi-keepalive ni nga page, so mabuhi ang mga tubag sa donor sa questionnaire
// kung mo-navigate siya palayo. Ang load() mo-wipe sa `answers` ug ang
// loadPrefill() mo-touch sa vitals, so ang status banner ra ang i-refresh matag
// balik — dili nato guboon ang wala pa ma-submit nga screening.
let loadedOnce = false

onMounted(async () => {
    await Promise.all([load(), loadPrefill(), loadStatus()])
    loadedOnce = true
})

onActivated(() => {
    if (loadedOnce) loadStatus()
})
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
    background: var(--rb-page-bg);
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

/* Skeleton loading */
.skeleton-wrap {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.skeleton {
    background: linear-gradient(90deg, #eef1f5 25%, #f6f8fa 37%, #eef1f5 63%);
    background-size: 400% 100%;
    border-radius: 14px;
    animation: shimmer 1.4s ease infinite;
}

.skeleton--header {
    height: 40px;
    max-width: 300px;
}

.skeleton--banner {
    height: 52px;
    border-radius: 10px;
}

.skeleton--steps {
    height: 30px;
    max-width: 420px;
    border-radius: 999px;
}

.skeleton-main-grid {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 20px;
    align-items: start;
}

.skeleton-col {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.skeleton--panel {
    border-radius: 14px;
}

.skeleton--button {
    height: 46px;
    border-radius: 10px;
}

@keyframes shimmer {
    0% { background-position: 100% 50%; }
    100% { background-position: 0 50%; }
}

@media (prefers-reduced-motion: reduce) {
    .skeleton { animation: none !important; }
}

@media (max-width: 900px) {
    .skeleton-main-grid {
        grid-template-columns: 1fr;
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

/* Current eligibility state */
.status-banner {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    border-radius: 10px;
    padding: 12px 16px;
    border: 1px solid transparent;
}

.status-banner__icon {
    flex-shrink: 0;
    margin-top: 1px;
}

.status-banner__body {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.status-banner__title {
    font-size: 12.5px;
    font-weight: 700;
    margin: 0;
    line-height: 1.5;
}

.status-banner__detail {
    font-size: 12.5px;
    margin: 0;
    line-height: 1.5;
    opacity: 0.9;
}

.status-banner__reasons {
    margin: 2px 0 0;
    padding-left: 18px;
    font-size: 12.5px;
    line-height: 1.6;
}

.status-banner--success {
    background: #eaf6ea;
    border-color: #cfe8cf;
    color: var(--success);
}

.status-banner--warning {
    background: #fff4e5;
    border-color: #ffe0b2;
    color: #a65b00;
}

.status-banner--danger {
    background: #fbeaea;
    border-color: #f5cccc;
    color: var(--accent);
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

.load-error__text {
    font-size: 12.5px;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.6;
}

.load-error__retry {
    margin-top: 16px;
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

.form-input--locked {
    background: #f3f4f6;
    color: var(--text-secondary);
    cursor: not-allowed;
}

.form-hint {
    font-size: 11.5px;
    color: var(--text-secondary);
    margin: 6px 0 0;
    line-height: 1.5;
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

.submit-error {
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: #fbeaea;
    border: 1px solid #f5cccc;
    border-radius: 10px;
    padding: 12px 14px;
}

.submit-error__text {
    font-size: 12.5px;
    color: var(--accent);
    margin: 0;
    line-height: 1.5;
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
    border-radius: 14px;
    padding: 28px 24px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    box-shadow: 0 8px 28px rgba(15, 23, 42, 0.16);
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
:global(.dark .eligibility-page) {
    --text-primary: #F1F5F9;
    --text-secondary: #94A3B8;
    background: #0F172A;
}

:global(.dark .panel),
:global(.dark .modal-card),
:global(.dark .modal-qr-wrap) {
    background: #1E293B;
    border-color: #334155;
}
:global(.dark .modal-title) {
    color: #F1F5F9;
}

:global(.dark .modal-subtitle) {
    color: #94A3B8;
}

:global(.dark .modal-validity) {
    color: #F1F5F9;
}

:global(.dark .modal-check) {
    background: rgba(102, 187, 106, 0.16);
    color: #66BB6A;
}

:global(.dark .modal-actions .btn-primary) {
    background: #1565C0;
}

:global(.dark .submit-error) {
    background: rgba(239, 83, 80, 0.14);
    border-color: rgba(239, 83, 80, 0.3);
}

:global(.dark .submit-error__text) {
    color: #EF9A9A;
}

:global(.dark .status-banner--success) {
    background: rgba(102, 187, 106, 0.14);
    border-color: rgba(102, 187, 106, 0.3);
    color: #A5D6A7;
}

:global(.dark .status-banner--warning) {
    background: rgba(245, 124, 0, 0.14);
    border-color: rgba(245, 124, 0, 0.3);
    color: #FFCC80;
}

:global(.dark .status-banner--danger) {
    background: rgba(239, 83, 80, 0.14);
    border-color: rgba(239, 83, 80, 0.3);
    color: #EF9A9A;
}

:global(.dark .panel-header--simple) { border-color: #334155; }

:global(.dark .info-banner) {
    background: rgba(66,165,245,0.14);
    border-color: rgba(66,165,245,0.3);
}
:global(.dark .info-banner__text),
:global(.dark .banner-icon) { color: #90CAF9; }

:global(.dark .step__circle) { background: #263449; }
:global(.dark .step__line) { background: #334155; }

:global(.dark .question-card) { background: #172033; }

:global(.dark .answer-btn) {
    background: #1E293B;
    border-color: #334155;
    color: #F1F5F9;
}
:global(.dark .answer-btn:hover:not(.answer-btn--active)) { background: #263449; }
:global(.dark .answer-btn--yes.answer-btn--active) { background: rgba(102,187,106,0.16); }
:global(.dark .answer-btn--no.answer-btn--active) { background: rgba(239,83,80,0.16); }

:global(.dark .form-input) {
    background: #0F172A;
    border-color: #334155;
    color: #F1F5F9;
}

:global(.dark .form-input--locked) {
    background: #172033;
    color: #94A3B8;
}

:global(.dark .result-box--pending) { background: #263449; }
:global(.dark .result-box--success) { background: rgba(102,187,106,0.16); }
:global(.dark .result-box--danger) { background: rgba(239,83,80,0.16); }

:global(.dark .btn-outline) {
    background: #263449;
    color: #E2E8F0;
}
:global(.dark .btn-outline:hover) { background: #334155; }

:global(.dark .modal-qr-image--placeholder) { background: #172033; }

:global(.dark .skeleton) {
    background: linear-gradient(90deg, #1E293B 25%, #263449 37%, #1E293B 63%);
}

.btn-primary:focus-visible,
.btn-outline:focus-visible,
.answer-btn:focus-visible {
  outline: 2px solid var(--rb-primary, #1565C0);
  outline-offset: 2px;
}
</style>
