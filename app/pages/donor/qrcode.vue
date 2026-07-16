<template>
  <div class="qr-page">
    <div v-if="loading" class="loading-wrap">
      <div class="spinner" />
    </div>

    <div v-else class="qr-page-inner">
      <div class="header-row fade-in" style="--delay: 0ms">
        <h1 class="page-title">QR Code</h1>
        <p class="page-subtitle">Here is your full QR Code that you can download and present during your visit.</p>
      </div>

      <div class="main-grid">
        <!-- Left: QR card -->
        <div class="panel qr-panel fade-in" style="--delay: 50ms">
          <template v-if="canShowQr">
            <h2 class="qr-panel__title">Donor Eligibility QR</h2>
            <p class="qr-panel__subtitle">Present this to blood center staff upon arrival.</p>

            <div class="qr-image-wrap">
              <img v-if="qrCodeDataUrl" :src="qrCodeDataUrl" alt="Donor eligibility QR code" class="qr-image">
              <div v-else class="qr-image qr-image--placeholder">
                <div class="spinner spinner--sm" />
              </div>
            </div>

            <div class="qr-details">
              <div class="qr-details__row">
                <span class="qr-details__label">Donor name</span>
                <span class="qr-details__value">{{ profile?.full_name || '—' }}</span>
              </div>
              <div class="qr-details__row">
                <span class="qr-details__label">Donor ID</span>
                <span class="qr-details__value">{{ profile?.donor_id || '—' }}</span>
              </div>
              <div class="qr-details__row">
                <span class="qr-details__label">Blood type</span>
                <span class="qr-details__value">{{ profile?.blood_type || '—' }}</span>
              </div>
              <div class="qr-details__row">
                <span class="qr-details__label">Screening date</span>
                <span class="qr-details__value">{{ formatDate(profile?.screening_date) }}</span>
              </div>
              <div class="qr-details__row">
                <span class="qr-details__label">Valid until</span>
                <span class="qr-details__value qr-details__value--success">{{ formatDate(profile?.screening_valid_until) }}</span>
              </div>
              <div class="qr-details__row">
                <span class="qr-details__label">QR status</span>
                <span class="qr-details__value qr-details__value--success">Valid</span>
              </div>
            </div>

            <div class="qr-actions">
              <button type="button" class="btn-primary" :disabled="!qrCodeDataUrl" @click="downloadQr">
                <AssetIcon name="download" :size="16" />
                Download
              </button>
              <button type="button" class="btn-outline" :disabled="!qrCodeDataUrl" @click="shareQr">
                <AssetIcon name="share" :size="16" />
                Share
              </button>
            </div>
          </template>

          <template v-else>
            <div class="qr-empty">
              <AssetIcon name="qr-code" :size="40" style="color:#e5e7eb" />
              <p class="qr-empty__title">
                {{ eligibilityStatus === 'deferred' ? 'Your screening was deferred' : 'No QR code yet' }}
              </p>
              <p class="qr-empty__sub">
                {{ eligibilityStatus === 'deferred'
                  ? "Please contact the blood center for more information, then retake the screening once you're cleared."
                  : 'Take the eligibility screening first. Your QR code is generated automatically once you pass.' }}
              </p>
              <NuxtLink to="/donor/eligibility" class="btn-primary">
                {{ eligibilityStatus === 'deferred' ? 'Retake Screening' : 'Take Screening' }}
              </NuxtLink>
            </div>
          </template>
        </div>

        <!-- Right: how to use -->
        <div class="panel steps-panel fade-in" style="--delay: 100ms">
          <h2 class="steps-panel__title">How to use QR code</h2>

          <div class="steps-list">
            <div v-for="(step, i) in steps" :key="step.title" class="step-row">
              <div class="step-row__marker">
                <span class="step-dot" :class="{ 'step-dot--done': step.done }" />
                <span v-if="i < steps.length - 1" class="step-line" />
              </div>
              <div class="step-row__body">
                <p class="step-row__title">{{ step.title }}</p>
                <p class="step-row__desc">{{ step.desc }}</p>
              </div>
            </div>
          </div>

          <div class="warning-banner">
            <AssetIcon name="alert" :size="16" class="warning-banner__icon" />
            <p class="warning-banner__text">
              This QR code is personal and tied to your eligibility screening result. Do not share your QR code with others.
              <template v-if="profile?.screening_valid_until">
                It expires on {{ formatDate(profile.screening_valid_until) }} - retake the screening to generate a new one.
              </template>
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { ref, computed, onMounted } from 'vue'

definePageMeta({
  middleware: 'auth',
  layout: 'donordashboard',
})

const loading = ref(true)
const profile = ref(null)
const eligibilityStatus = ref('pending') // 'eligible' | 'deferred' | 'pending'
const upcomingAppointment = ref(null)
const qrCodeDataUrl = ref('')

// The QR only exists once the donor has taken the eligibility screening AND
// passed it (eligible) — pending/deferred donors get the empty state instead.
const canShowQr = computed(() => eligibilityStatus.value === 'eligible' && !!profile.value?.qr_token)

const steps = computed(() => [
  {
    title: 'Complete eligibility screening',
    desc: 'Take the online questionnaire on the donor portal. If you pass, the system automatically generates your QR code.',
    done: eligibilityStatus.value === 'eligible',
  },
  {
    title: 'Book your appointment',
    desc: 'Choose a blood center or mobile drive, select your preferred date and time slot, and confirm your booking.',
    done: !!upcomingAppointment.value,
  },
  {
    title: 'Arrive at the blood center',
    desc: 'Present this QR code to the blood center staff upon arrival. They will scan it to verify your eligibility screening status.',
    done: false,
  },
  {
    title: 'Proceed to physical screening',
    desc: 'After QR verification, the blood center nurse or med tech will conduct a final on-site physical screening (blood pressure, hemoglobin, weight, etc.).',
    done: false,
  },
  {
    title: 'Donate blood',
    desc: 'If you pass the physical screening, you will proceed to donation. The staff records your donation in the system.',
    done: false,
  },
])

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function generateQrImage() {
  if (!profile.value?.qr_token) return
  try {
    // Encode the backend-issued token, not raw donor data — the blood center
    // scans this and looks the token up server-side to verify eligibility.
    qrCodeDataUrl.value = await QRCode.toDataURL(profile.value.qr_token, {
      width: 220,
      margin: 1,
      color: { dark: '#1f2937', light: '#ffffff' },
    })
  } catch (err) {
    console.error('Failed to render QR code image:', err)
  }
}

function downloadQr() {
  if (!qrCodeDataUrl.value) return
  const link = document.createElement('a')
  link.href = qrCodeDataUrl.value
  link.download = `donor-qr-${profile.value?.donor_id || 'code'}.png`
  link.click()
}

async function shareQr() {
  if (!qrCodeDataUrl.value) return
  try {
    if (navigator.share) {
      const blob = await (await fetch(qrCodeDataUrl.value)).blob()
      const file = new File([blob], 'donor-qr.png', { type: 'image/png' })
      await navigator.share({ title: 'My Donor Eligibility QR', files: [file] })
    } else {
      await navigator.clipboard.writeText(qrCodeDataUrl.value)
    }
  } catch (err) {
    console.error('Failed to share QR code:', err)
  }
}

onMounted(async () => {
  try {
    // Backend contract: GET /api/donor/qr-code
    // Response: { profile: { full_name, donor_id, blood_type, screening_date,
    //   screening_valid_until, qr_token }, eligibility_status, upcoming_appointment }
    // qr_token is only present/non-null when eligibility_status === 'eligible'.
    const data = await $fetch('/api/donor/qr-code')
    profile.value = data.profile ?? null
    eligibilityStatus.value = data.eligibility_status ?? 'pending'
    upcomingAppointment.value = data.upcoming_appointment ?? null
  } catch (err) {
    // NOTE: sa dev/UI stage pa lang, wala pay live nga /api/donor/qr-code endpoint,
    // so mag-fail gyud ni nga call. Mag-fallback ra sa 'pending' (empty state)
    // aron dili mag-crash ang template samtang wala pa naka-connect ang backend.
    console.error('Failed to load QR code data (expected while backend is not yet wired up):', err)
  } finally {
    loading.value = false
    if (canShowQr.value) await generateQrImage()
  }
})
</script>

<style scoped>
.qr-page {
  --primary: #1565c0;
  --accent: #d32f2f;
  --success: #2e7d32;
  --warning: #f57c00;
  --text-primary: #1f2937;
  --text-secondary: #9ca3af;
  max-width: 1152px;
  margin: 0 auto;
  padding: 24px 32px 60px;
  background: #F5F7FA;
}

/* Loading */
.loading-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60vh;
}

.spinner {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border: 4px solid #e3ebf6;
  border-top-color: var(--primary);
  animation: spin 0.8s linear infinite;
}

.spinner--sm {
  width: 20px;
  height: 20px;
  border-width: 3px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
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

.qr-page-inner {
  display: flex;
  flex-direction: column;
  gap: 24px;
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

/* Layout */
.main-grid {
  display: grid;
  grid-template-columns: 1fr 1.3fr;
  gap: 24px;
  align-items: start;
}

.panel {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  border: 1px solid #f3f4f6;
}

/* QR panel */
.qr-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.qr-panel__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.qr-panel__subtitle {
  font-size: 12.5px;
  color: var(--text-secondary);
  margin: 4px 0 20px;
}

.qr-image-wrap {
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #eef0f3;
  margin-bottom: 20px;
}

.qr-image {
  width: 200px;
  height: 200px;
  display: block;
}

.qr-image--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f9fafb;
}

.qr-details {
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #f3f4f6;
  margin-bottom: 20px;
}

.qr-details__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  font-size: 12.5px;
}

.qr-details__row:nth-child(odd) {
  background: #fafbfc;
}

.qr-details__label {
  color: var(--text-secondary);
}

.qr-details__value {
  font-weight: 700;
  color: var(--text-primary);
}

.qr-details__value--success {
  color: var(--success);
}

.qr-actions {
  display: flex;
  gap: 10px;
  width: 100%;
}

.qr-actions .btn-primary,
.qr-actions .btn-outline {
  flex: 1;
}

/* Empty state */
.qr-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 32px 12px;
}

.qr-empty__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 8px 0 0;
}

.qr-empty__sub {
  font-size: 12.5px;
  color: var(--text-secondary);
  margin: 0 0 16px;
  max-width: 260px;
  line-height: 1.5;
}

/* Steps panel */
.steps-panel__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 20px;
}

.steps-list {
  display: flex;
  flex-direction: column;
}

.step-row {
  display: flex;
  gap: 14px;
}

.step-row__marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}

.step-dot {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid #cbd5e1;
  background: white;
  flex-shrink: 0;
  margin-top: 2px;
}

.step-dot--done {
  border-color: var(--primary);
  background: var(--primary);
}

.step-line {
  width: 2px;
  flex: 1;
  min-height: 28px;
  background: #e5e7eb;
  margin: 2px 0;
}

.step-row__body {
  padding-bottom: 20px;
}

.step-row__title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.step-row__desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 3px 0 0;
  line-height: 1.5;
}

/* Warning banner */
.warning-banner {
  display: flex;
  gap: 10px;
  padding: 14px;
  border-radius: 12px;
  background: #fff8e1;
  border: 1px solid #ffe0a3;
  margin-top: 4px;
}

.warning-banner__icon {
  color: var(--warning);
  flex-shrink: 0;
  margin-top: 1px;
}

.warning-banner__text {
  font-size: 12px;
  color: #92650c;
  margin: 0;
  line-height: 1.6;
}

/* Buttons */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 11px 20px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  color: white;
  background: var(--primary);
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: opacity 0.15s ease;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.92;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 11px 20px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  background: #f3f4f6;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-outline:hover:not(:disabled) {
  background: #e5e7eb;
}

.btn-outline:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 900px) {
  .main-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .qr-page {
    padding: 16px 16px 40px;
  }
}

/* ============ Dark mode ============ */
:global(.dark .qr-page) {
    --text-primary: #F1F5F9;
    --text-secondary: #94A3B8;
    background: #0F172A;
}

:global(.dark .panel) {
    background: #1E293B;
    border-color: #334155;
}

:global(.dark .spinner) { border-color: #334155; border-top-color: var(--primary); }

:global(.dark .qr-image-wrap) { border-color: #334155; }
:global(.dark .qr-image--placeholder) { background: #172033; }

:global(.dark .qr-details) { border-color: #334155; }
:global(.dark .qr-details__row:nth-child(odd)) { background: #172033; }

:global(.dark .step-dot) { border-color: #475569; background: #1E293B; }
:global(.dark .step-line) { background: #334155; }

:global(.dark .warning-banner) {
    background: rgba(245,124,0,0.14);
    border-color: rgba(245,124,0,0.3);
}
:global(.dark .warning-banner__text) { color: #FFCC80; }

:global(.dark .btn-outline) {
    background: #263449;
    color: #E2E8F0;
}
:global(.dark .btn-outline:hover:not(:disabled)) { background: #334155; }
</style>