Exit code: 0
Wall time: 5.3 seconds
Output:
<template>
  <div class="qr-page">
    <div v-if="loading" class="qr-page-inner">
      <div class="header-row fade-in" style="--delay: 0ms">
        <div class="skeleton skeleton-line" style="width:120px;height:20px" />
        <div class="skeleton skeleton-line" style="width:320px;height:13px;margin-top:8px" />
      </div>

      <div class="main-grid">
        <!-- QR skeleton -->
        <div class="panel qr-panel fade-in" style="--delay: 50ms">
          <div class="skeleton skeleton-line" style="width:160px;height:15px" />
          <div class="skeleton skeleton-line" style="width:220px;height:12.5px;margin-top:10px;margin-bottom:20px" />

          <div class="qr-image-wrap">
            <div class="skeleton" style="width:200px;height:200px;border-radius:8px" />
          </div>

          <div class="qr-details">
            <div v-for="n in 6" :key="n" class="qr-details__row">
              <div class="skeleton skeleton-line" style="width:90px;height:11px" />
              <div class="skeleton skeleton-line" style="width:70px;height:11px" />
            </div>
          </div>

          <div class="qr-actions">
            <div class="skeleton skeleton-btn" />
            <div class="skeleton skeleton-btn" />
          </div>
        </div>

        <!-- Steps skeleton -->
        <div class="panel steps-panel fade-in" style="--delay: 100ms">
          <div class="skeleton skeleton-line" style="width:150px;height:15px;margin-bottom:20px" />

          <div class="steps-list">
            <div v-for="n in 5" :key="n" class="step-row">
              <div class="step-row__marker">
                <span class="skeleton" style="width:14px;height:14px;border-radius:999px" />
                <span v-if="n < 5" class="step-line" />
              </div>
              <div class="step-row__body" style="width:100%">
                <div class="skeleton skeleton-line" style="width:70%;height:13px" />
                <div class="skeleton skeleton-line" style="width:95%;height:11px;margin-top:8px" />
              </div>
            </div>
          </div>

          <div class="skeleton" style="width:100%;height:56px;border-radius:12px;margin-top:4px" />
        </div>
      </div>
    </div>

    <div v-else class="qr-page-inner">
      <div class="header-row fade-in" style="--delay: 0ms">
        <h1 class="page-title">Quick check-in</h1>
        <p class="page-subtitle">Access your personal QR Code for faster check-in during appointments and donation visits.</p>
      </div>

      <div class="main-grid">
        <!-- Left: QR card -->
        <div class="panel qr-panel fade-in" style="--delay: 50ms">
          <template v-if="canShowQr">
            <h2 class="qr-panel__title">Donor Eligibility QR</h2>
            <p class="qr-panel__subtitle">Present this to blood center staff upon arrival.</p>

            <div class="qr-image-wrap">
              <img :src="qrCodeDataUrl" alt="Donor eligibility QR code" class="qr-image">
            </div>
          </template>

          <div v-else class="qr-empty">
            <AssetIcon name="qr-code" :size="40" style="color:#e5e7eb" />
            <p class="qr-empty__title">{{ qrEmptyCopy.title }}</p>
            <p class="qr-empty__sub">{{ qrEmptyCopy.sub }}</p>
            <button v-if="qrState === 'ready'" type="button" class="btn-primary" :disabled="minting"
              @click="mintQrCode">
              {{ minting ? 'Generating…' : (hasActiveToken ? 'Generate new code' : 'Generate QR code') }}
            </button>

            <button v-else-if="qrState === 'unverified'" type="button" class="btn-primary"
              :disabled="resending" @click="resendVerification">
              {{ resending ? 'Sending...' : 'Resend verification email' }}
            </button>

            <NuxtLink v-else-if="qrEmptyCopy.action" :to="qrEmptyCopy.action.to" class="btn-primary">
              {{ qrEmptyCopy.action.label }}
            </NuxtLink>

            <p v-if="resendMessage" class="qr-resend-note">{{ resendMessage }}</p>
          </div>

          <p v-if="qrError" class="qr-error">{{ qrError }}</p>


          <!-- Ipakita basta naa nay screening, bisan walay QR image nga na-mint -->
          <div v-if="profile?.screening_date" class="qr-details">
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
              <span class="qr-details__label">Screening valid until</span>
              <span class="qr-details__value" :class="statusValueClass">{{ formatDate(profile?.screening_valid_until) }}</span>
            </div>
            <div class="qr-details__row">
              <span class="qr-details__label">QR status</span>
              <span class="qr-details__value" :class="statusValueClass">{{ qrStatusLabel }}</span>
            </div>
          </div>

          <div v-if="canShowQr" class="qr-actions">
            <button type="button" class="btn-primary" :disabled="!qrCodeDataUrl" @click="downloadQr">
              <AssetIcon name="download" :size="16" />
              Download
            </button>
            <button type="button" class="btn-outline" :disabled="!qrCodeDataUrl" @click="shareQr">
              <AssetIcon name="share" :size="16" />
              Share
            </button>
            <button type="button" class="btn-outline" :disabled="minting" @click="mintQrCode">
              <AssetIcon name="refresh-cw" :size="16" />
              {{ minting ? 'Generating…' : 'New code' }}
            </button>
          </div>
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
              <template v-if="hasActiveToken">
                Your current code expires on {{ formatDate(qrValidUntil) }} — refresh it from this page to get a new one.
              </template>
              <template v-else-if="profile?.screening_valid_until">
                Once issued, a code stays valid for {{ qrValidDays }} days, separate from your screening, which is valid until {{ formatDate(profile.screening_valid_until) }}.
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
import { donorService } from '~/api/donor/DonorService'
import { authService } from '~/api/auth/AuthService'
import QRCode from 'qrcode'
import { ref, computed, onMounted, onActivated } from 'vue'


const loading = ref(true)
const profile = ref(null)
const eligibilityStatus = ref('pending') // 'eligible' | 'deferred' | 'expired' | 'pending'
const upcomingAppointment = ref(null)
const qrCodeDataUrl = ref('')
const qrValidUntil = ref(null)
const qrValidDays = ref(14)
const hasActiveToken = ref(false)
const emailVerified = ref(false)
const minting = ref(false)
const qrError = ref('')
const resending = ref(false)
const resendMessage = ref('')

async function resendVerification() {
  resending.value = true
  resendMessage.value = ''

  try {
    // POST /api/email/verification-notification (throttle:3,10)
    // 204 ang balik — walay body. Ang link sa email padulong sa
    // /auth/verify-email sa frontend, dala ang signed nga query string.
    await authService.resendVerificationEmail()
    resendMessage.value = 'Verification email sent. Check your inbox, then reload this page.'
  } catch (err) {
    console.error('Failed to resend verification email:', err)
    resendMessage.value = err?.status === 429
      ? 'Too many requests. Please wait a few minutes before trying again.'
      : err?.message || 'Could not send the verification email. Please try again.'
  } finally {
    resending.value = false
  }
}

const QR_STORAGE_KEY = 'donor-qr-code'


// Ang plaintext token kay dili ma-return sa GET /donors/qr-code — gi-hash ra
// siya sa server. Naa ra siya sa screening submission ug sa qr-code/refresh,
// so naa lang QR image kung na-mint na sa maong step.
const canShowQr = computed(() => !!qrCodeDataUrl.value)

const qrState = computed(() => {
  if (eligibilityStatus.value === 'deferred') return 'deferred'
  if (eligibilityStatus.value === 'expired') return 'expired'
  if (eligibilityStatus.value !== 'eligible') return 'pending'
  return emailVerified.value ? 'ready' : 'unverified'
})

const qrEmptyCopy = computed(() => {
  switch (qrState.value) {
    case 'ready':
      return {
        title: 'Your screening passed',
        sub: hasActiveToken.value
          ? `You have an active check-in code, valid until ${formatDate(qrValidUntil.value)}.`
          : 'Generate your check-in QR code to present at the blood center.',
        action: null,
      }
    case 'unverified':
      return {
        title: 'Verify your email address',
        sub: 'Your screening passed. Confirm your email address to receive your check-in QR code.',
        action: null,
      }
    case 'deferred':
      return {
        title: 'Your screening was deferred',
        sub: "Please contact the blood center for more information, then retake the screening once you're cleared.",
        action: { label: 'Retake Screening', to: '/donor/eligibility' },
      }
    case 'expired':
      return {
        title: 'Your screening has expired',
        sub: 'Complete the eligibility questionnaire again to restore your check-in code.',
        action: { label: 'Retake Screening', to: '/donor/eligibility' },
      }
    default:
      return {
        title: 'No QR code yet',
        sub: 'Take the eligibility screening first. Your QR code is generated automatically once you pass.',
        action: { label: 'Take Screening', to: '/donor/eligibility' },
      }
  }
})

const qrStatusLabel = computed(() =>
  hasActiveToken.value ? `Active until ${formatDate(qrValidUntil.value)}` : 'Not issued'
)

const statusValueClass = computed(() =>
  eligibilityStatus.value === 'eligible' ? 'qr-details__value--success' : ''
)


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
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function readStoredQr(donorId) {
  if (!import.meta.client || !donorId) return null

  try {
    const raw = sessionStorage.getItem(QR_STORAGE_KEY)
    if (!raw) return null

    const stored = JSON.parse(raw)

    // Gi-check ang donor_id aron dili makita sa laing account ang QR sa nauna
    // nga naka-login sa parehas nga browser.
    return stored?.donorId === donorId ? stored : null
  } catch {
    return null
  }
}

function storeQr(donorId, data) {
  if (!import.meta.client || !donorId) return

  try {
    sessionStorage.setItem(QR_STORAGE_KEY, JSON.stringify({
      donorId,
      token: data?.qr_token,
      validUntil: data?.qr_valid_until,
    }))
  } catch (err) {
    console.error('Failed to cache QR code:', err)
  }
}

async function renderQr(token) {
  if (!token) return

  try {
    // Ang gi-encode kay ang opaque token ra — dili gyud ang vitals o answers.
    // I-scan ni sa blood center ug i-look up sa server para ma-verify.
    qrCodeDataUrl.value = await QRCode.toDataURL(token, {
      width: 220,
      margin: 1,
      color: { dark: '#1f2937', light: '#ffffff' },
    })
  } catch (err) {
    console.error('Failed to render QR code image:', err)
    qrError.value = 'Could not render the QR image. Please try again.'
  }
}

async function mintQrCode() {
  // Ang pag-mint kay mo-revoke sa daan nga token, so pahibaw-on sa donor.
  if (hasActiveToken.value) {
    const confirmed = window.confirm(
      'This replaces your current check-in code. Any copy you have saved or downloaded will stop working.'
    )
    if (!confirmed) return
  }

  minting.value = true
  qrError.value = ''

  try {
    // POST /api/donors/qr-code/refresh
    // Response: { qr_token, qr_valid_until, qr_valid_days }
    // Kausa ra ma-return ang plaintext token — hash ra ang gi-store sa server.
    const data = await donorService.refreshQrCode()

    qrValidUntil.value = data?.qr_valid_until ?? null
    qrValidDays.value = data?.qr_valid_days ?? qrValidDays.value
    hasActiveToken.value = true

    await renderQr(data?.qr_token)
    storeQr(profile.value?.donor_id, data)
  } catch (err) {
    const code = err?.data?.code

    if (code === 'email_unverified') {
      qrError.value = 'Please verify your email address before requesting a QR code.'
    } else if (code === 'screening_required') {
      qrError.value = 'You need a valid eligibility screening before a QR code can be issued.'
    } else if (err?.status === 429) {
      qrError.value = 'Too many QR code requests. Please wait a while before trying again.'
    } else {
      qrError.value = err?.message || 'Could not generate your QR code. Please try again.'
    }

    console.error('Failed to refresh QR code:', err)
  } finally {
    minting.value = false
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

// Gi-keepalive ni nga page. Tan-awa ang AppointmentsPage para sa detalye —
// ang onActivated mo-refresh sa background nga walay skeleton, ug gi-guard sa
// loadedOnce kay mo-fire sad siya human sa unang onMounted.
let loadedOnce = false

async function load({ silent = false } = {}) {
  if (!silent) loading.value = true
  try {
    // GET /api/donors/qr-code
    // Response: { profile: { full_name, donor_id, blood_type, screening_date,
    //   screening_valid_until, qr_token }, eligibility_status, qr_valid_until,
    //   qr_valid_days, has_active_token, email_verified }
    // NOTE: kanunay null ang profile.qr_token — tinuyo na sa server.
    const data = await donorService.qrCode()

    profile.value = data?.profile ?? null
    eligibilityStatus.value = data?.eligibility_status ?? 'pending'
    qrValidUntil.value = data?.qr_valid_until ?? null
    qrValidDays.value = data?.qr_valid_days ?? qrValidDays.value
    hasActiveToken.value = !!data?.has_active_token
    emailVerified.value = !!data?.email_verified

    // I-restore ang na-mint na nga code para dili ma-invalidate ang na-download
    // na nga PNG matag balik sa page. Ang server gihapon ang authority kung
    // naa pa bay buhi nga token.
    const stored = readStoredQr(profile.value?.donor_id)
    if (stored && hasActiveToken.value && stored.validUntil === qrValidUntil.value) {
      await renderQr(stored.token)
    }


    // Ang upcoming_appointment kay wala gi-serve ani nga endpoint — gikan na
    // siya sa appointments API, so null sa karon.
  } catch (err) {
    console.error('Failed to load QR code data:', err)
  } finally {
    loading.value = false
    loadedOnce = true
  }
}

onMounted(() => load())
onActivated(() => {
  if (loadedOnce) load({ silent: true })
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

.qr-error {
  margin: 12px 0 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--accent);
  text-align: center;
}

.qr-resend-note {
  margin: 12px 0 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--text-secondary);
  text-align: center;
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

/* Spinner (kept for the QR image lazy-render placeholder) */
.spinner--sm {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  border: 3px solid #e3ebf6;
  border-top-color: var(--primary);
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Skeleton */
.skeleton {
  background: linear-gradient(90deg, #eef0f3 25%, #e4e7ec 37%, #eef0f3 63%);
  background-size: 400% 100%;
  animation: skeleton-shimmer 1.4s ease infinite;
  border-radius: 6px;
}
@keyframes skeleton-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}
.skeleton-line { border-radius: 4px; }
.skeleton-btn { height: 40px; border-radius: 10px; }

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

:global(.dark .spinner--sm) { border-color: #334155; border-top-color: var(--primary); }

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

:global(.dark .skeleton) {
    background: linear-gradient(90deg, #263449 25%, #334155 37%, #263449 63%);
    background-size: 400% 100%;
}
</style>
