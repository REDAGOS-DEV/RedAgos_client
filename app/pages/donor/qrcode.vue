<template>
  <div class="qr-page">
    <div v-if="loading" class="qr-page-inner" aria-busy="true">
      <div class="header-row">
        <div class="skeleton skeleton-line" style="width:160px;height:20px" />
        <div class="skeleton skeleton-line" style="width:320px;height:13px;margin-top:8px" />
      </div>
      <div class="main-grid">
        <div class="skeleton skeleton--pass" />
        <div class="skeleton skeleton--steps" />
      </div>
    </div>

    <div v-else class="qr-page-inner">
      <div class="header-row">
        <h1 class="page-title">Quick check-in</h1>
        <p class="page-subtitle">Show this pass at the blood center so staff can check you in quickly.</p>
      </div>

      <div class="main-grid">
        <!-- Left: the check-in pass -->
        <article class="pass" aria-label="Donor check-in pass">
          <header class="pass__head">
            <p class="pass__brand">
              <span class="pass__logo"><AssetIcon name="blood-drop" :size="14" /></span>
              Donor check-in pass
            </p>
            <div class="pass__who">
              <div class="pass__who-text">
                <p class="pass__name">{{ displayName }}</p>
                <p class="pass__id">{{ profile?.donor_id || '-' }}</p>
              </div>
              <div v-if="profile?.blood_type" class="pass__blood">
                <span class="pass__blood-type">{{ profile.blood_type }}</span>
                <span class="pass__blood-label">Blood type</span>
              </div>
            </div>
          </header>

          <div class="pass__code">
            <template v-if="canShowQr">
              <div class="pass__qr">
                <img :src="qrCodeDataUrl" alt="Donor eligibility QR code" class="qr-image">
              </div>
              <p class="pass__hint">Present this to blood center staff when you arrive.</p>
            </template>

            <div v-else class="qr-empty">
              <span class="qr-empty__frame" aria-hidden="true">
                <AssetIcon name="qr-code" :size="34" />
              </span>
              <p class="qr-empty__title">{{ qrEmptyCopy.title }}</p>
              <p class="qr-empty__sub">{{ qrEmptyCopy.sub }}</p>
              <button v-if="qrState === 'ready'" type="button" class="btn-primary" :disabled="minting"
                @click="mintQrCode">
                <AssetIcon name="qr-code" :size="16" />
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
          </div>

          <!-- Ipakita basta naa nay screening, bisan walay QR image nga na-mint -->
          <template v-if="profile?.screening_date">
            <div class="pass__tear" aria-hidden="true" />
            <dl class="pass__facts">
              <div>
                <dt>Screened</dt>
                <dd>{{ formatDate(profile?.screening_date) }}</dd>
              </div>
              <div>
                <dt>Valid until</dt>
                <dd :class="statusValueClass">{{ formatDate(profile?.screening_valid_until) }}</dd>
              </div>
              <div>
                <dt>QR code</dt>
                <dd :class="{ 'pass__fact--muted': !hasActiveToken }">{{ qrStatusLabel }}</dd>
              </div>
            </dl>
          </template>

          <div v-if="canShowQr" class="pass__actions">
            <button type="button" class="pass__action" :disabled="!qrCodeDataUrl" @click="downloadQr">
              <AssetIcon name="download" :size="16" />
              Download
            </button>
            <button type="button" class="pass__action" :disabled="!qrCodeDataUrl" @click="shareQr">
              <AssetIcon name="share" :size="16" />
              Share
            </button>
            <button type="button" class="pass__action" :disabled="minting" @click="mintQrCode">
              <AssetIcon name="refresh-cw" :size="16" />
              {{ minting ? 'Generating…' : 'New code' }}
            </button>
          </div>
        </article>

        <!-- Right: how to use -->
        <section class="steps-panel" aria-labelledby="steps-title">
          <div class="steps-panel__head">
            <h2 id="steps-title" class="steps-panel__title">How your visit goes</h2>
            <span class="steps-panel__count">{{ stepsDone }} of {{ steps.length }} done</span>
          </div>

          <!-- The journey as one row of icons; only the next step gets words. -->
          <ol class="journey">
            <li
              v-for="step in steps"
              :key="step.title"
              class="journey__stop"
              :class="`journey__stop--${step.state}`"
              :aria-current="step.state === 'current' ? 'step' : undefined"
            >
              <span class="journey__icon">
                <AssetIcon :name="step.state === 'done' ? 'check' : step.icon" :size="18" />
              </span>
              <span class="journey__label">{{ step.short }}</span>
              <span class="visually-hidden">{{ step.state === 'done' ? '(done)' : step.state === 'current' ? '(next)' : '' }}</span>
            </li>
          </ol>

          <div v-if="currentStep" class="journey-next">
            <span class="journey-next__icon"><AssetIcon :name="currentStep.icon" :size="20" /></span>
            <div>
              <p class="journey-next__eyebrow">Next step</p>
              <p class="journey-next__title">{{ currentStep.title }}</p>
              <p class="journey-next__desc">{{ currentStep.desc }}</p>
            </div>
          </div>
          <div v-else class="journey-next journey-next--done">
            <span class="journey-next__icon"><AssetIcon name="check" :size="20" /></span>
            <div>
              <p class="journey-next__title">All steps done for this visit</p>
              <p class="journey-next__desc">Thank you for donating. Your record is in Donation History.</p>
            </div>
          </div>

          <!-- Every step in full, for anyone who wants to read ahead -->
          <details class="journey-all">
            <summary>See what happens at each step</summary>
            <ol class="journey-all__list">
              <li v-for="step in steps" :key="step.title">
                <p class="journey-all__title">{{ step.title }}</p>
                <p class="journey-all__desc">{{ step.desc }}</p>
              </li>
            </ol>
          </details>

          <div class="privacy-note">
            <span class="privacy-note__icon"><AssetIcon name="shield" :size="16" /></span>
            <p class="privacy-note__text">
              <strong>Keep this code to yourself.</strong>
              It is tied to your own screening answers.
              <template v-if="hasActiveToken">
                Your current code expires on {{ formatDate(qrValidUntil) }}. You can get a new one from this page.
              </template>
              <template v-else-if="profile?.screening_valid_until && !donationIntervalActive">
                Once issued, a code stays valid for {{ qrValidDays }} days, separate from your screening, which is valid until {{ formatDate(profile.screening_valid_until) }}.
              </template>
            </p>
          </div>
        </section>
      </div>
    </div>
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
import { authService } from '~/api/auth/AuthService'
import QRCode from 'qrcode'
import { ref, computed, onMounted, onActivated, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const loading = ref(true)
const profile = ref(null)
// Kung na-answer na ba ang questionnaire ug valid pa ba -- dili kung
// pwede na ba mo-donate. Ang blood center ang mo-desisyon ana, didto sa
// counter, base sa ilang kaugalingong assessment.
const questionnaireStatus = ref('not_answered') // 'not_answered' | 'answered' | 'expired'
const appointments = ref([])
const qrCodeDataUrl = ref('')
const qrValidUntil = ref(null)
const qrValidDays = ref(14)
const hasActiveToken = ref(false)
// Waiting period human sa last donation. Gikan ra gyud sa API (GET /qr-code o
// ang donation_interval_active error sa /refresh) — dili i-compute sa client.
const donationIntervalActive = ref(false)
const nextEligibleDate = ref(null) // 'YYYY-MM-DD'
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
// Dili ipakita ang QR (ug ang Download/Share/New code) during waiting period
// o kung wala nay active token, bisan naa pay stale nga image sa memory.
const canShowQr = computed(() =>
  !!qrCodeDataUrl.value && hasActiveToken.value && !donationIntervalActive.value
)

// 'YYYY-MM-DD' i-parse as date-only (local), dili as UTC, para dili mo-display
// ug usa ka adlaw nga sayo.
function formatDateOnly(value) {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  const d = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const nextEligibleLabel = computed(() => formatDateOnly(nextEligibleDate.value))

const qrState = computed(() => {
  if (donationIntervalActive.value) return 'waiting'
  // Wala nay 'deferred' nga state. Ang donor dili na i-hukman sa iyang
  // kaugalingong mga tubag, so ang tanan nga kompleto nga questionnaire
  // makakuha og QR code.
  if (questionnaireStatus.value === 'expired') return 'expired'
  if (questionnaireStatus.value !== 'answered') return 'pending'
  return emailVerified.value ? 'ready' : 'unverified'
})

const qrEmptyCopy = computed(() => {
  switch (qrState.value) {
    case 'waiting':
      return {
        title: 'You recently donated',
        sub: nextEligibleLabel.value
          ? `You can take the eligibility screening and generate a new QR code on ${nextEligibleLabel.value}.`
          : 'You can take the eligibility screening and generate a new QR code once your waiting period ends.',
        action: null,
      }
    case 'ready':
      return {
        title: 'Your questionnaire is submitted',
        sub: hasActiveToken.value
          ? `You have an active check-in code, valid until ${formatDate(qrValidUntil.value)}.`
          : 'Generate your check-in QR code to present at the blood center.',
        action: null,
      }
    case 'unverified':
      return {
        title: 'Verify your email address',
        sub: 'Your questionnaire is submitted. Confirm your email address to receive your check-in QR code.',
        action: null,
      }
    case 'expired':
      return {
        title: 'Your questionnaire needs answering again',
        sub: 'Complete the health questionnaire again to restore your check-in code.',
        action: { label: 'Answer questionnaire', to: '/donor/eligibility' },
      }
    default:
      return {
        title: 'No QR code yet',
        sub: 'Complete the health questionnaire first. Your QR code is generated as soon as you submit it.',
        action: { label: 'Answer questionnaire', to: '/donor/eligibility' },
      }
  }
})

// The server keeps names as typed ("yana cruz"); show them capitalised.
const displayName = computed(() =>
  (profile.value?.full_name || 'Donor').replace(/(^|[\s-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase())
)

const qrStatusLabel = computed(() =>
  hasActiveToken.value ? `Until ${formatDate(qrValidUntil.value)}` : 'Not issued yet'
)

const statusValueClass = computed(() =>
  questionnaireStatus.value === 'answered' ? 'qr-details__value--success' : ''
)


// Ang appointment nga sakop sa karon nga donation cycle:
//   confirmed -> na-scan na ang QR, naa na sa blood center
//   scheduled -> naka-book, wala pa niabot
//   completed -> nahuman na ang donation (sukad sa karon nga screening ra,
//                para dili maihap ang daan nga donation). Dili na kinahanglan
//                'answered' ang questionnaire: gi-invalidate na siya sa server
//                pag-record sa collection, pero ang screening_date naa gihapon.
function byDate(a, b) {
  return new Date(a.appointment_datetime) - new Date(b.appointment_datetime)
}

const cycleAppointment = computed(() => {
  const list = appointments.value

  const confirmed = list.find(a => a.status === 'confirmed')
  if (confirmed) return confirmed

  const scheduled = list.filter(a => a.status === 'scheduled').sort(byDate)[0]
  if (scheduled) return scheduled

  const since = profile.value?.screening_date
  if (!since) return null

  return list
    .filter(a => a.status === 'completed' && new Date(a.appointment_datetime) >= new Date(since))
    .sort(byDate)
    .at(-1) ?? null
})

const STEP_COPY = [
  {
    title: 'Complete the health questionnaire',
    short: 'Questionnaire',
    icon: 'clipboard-check',
    desc: 'Answer it on the donor portal the day before your appointment. Your QR code is generated as soon as you submit it.',
  },
  {
    title: 'Book your appointment',
    short: 'Book',
    icon: 'calendar-check',
    desc: 'Choose a blood center or mobile drive, select your preferred date and time slot, and confirm your booking.',
  },
  {
    title: 'Arrive at the blood center',
    short: 'Arrive',
    icon: 'hospital',
    desc: 'Present this QR code to the blood center staff upon arrival. They will scan it to verify your eligibility screening status.',
  },
  {
    title: 'Proceed to physical screening',
    short: 'Screening',
    icon: 'stethoscope',
    desc: 'After QR verification, the blood center nurse or med tech will conduct a final on-site physical screening (blood pressure, hemoglobin, weight, etc.).',
  },
  {
    title: 'Donate blood',
    short: 'Donate',
    icon: 'droplets',
    desc: 'If you pass the physical screening, you will proceed to donation. The staff records your donation in the system.',
  },
]

// Ang state sa matag step: 'done', 'current' (ang una nga wala pa nahuman),
// o 'upcoming'.
const steps = computed(() => {
  const status = cycleAppointment.value?.status
  const done = [
    // Human sa donation 'expired' na ang questionnaire, pero na-answer gihapon
    // siya para niini nga cycle.
    questionnaireStatus.value === 'answered' || status === 'completed',
    !!cycleAppointment.value,
    status === 'confirmed' || status === 'completed',
    status === 'completed',
    status === 'completed',
  ]
  const current = done.indexOf(false)

  return STEP_COPY.map((copy, i) => ({
    ...copy,
    state: done[i] ? 'done' : i === current ? 'current' : 'upcoming',
  }))
})

const currentStep = computed(() => steps.value.find(step => step.state === 'current') ?? null)

const stepsDone = computed(() => steps.value.filter(step => step.state === 'done').length)

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

function clearStoredQr() {
  if (!import.meta.client) return
  try {
    sessionStorage.removeItem(QR_STORAGE_KEY)
  } catch (err) {
    console.error('Failed to clear cached QR code:', err)
  }
}

// I-drop ang daan nga QR sa memory ug sa sessionStorage para dili na makita
// o magamit.
function dropLocalQr() {
  qrCodeDataUrl.value = ''
  clearStoredQr()
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
  if (donationIntervalActive.value) return

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

    if (code === 'donation_interval_active') {
      // Stale screen: ang server na ang nag-ingon nga naa pa sa waiting period.
      // Gamita ang next_eligible_date gikan sa response, dili generic error.
      donationIntervalActive.value = true
      nextEligibleDate.value = err?.data?.next_eligible_date ?? nextEligibleDate.value
      hasActiveToken.value = false
      dropLocalQr()
      qrError.value = ''
    } else if (code === 'email_unverified') {
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
    //   screening_valid_until, qr_token }, questionnaire_status, qr_valid_until,
    //   qr_valid_days, has_active_token, email_verified }
    // NOTE: kanunay null ang profile.qr_token — tinuyo na sa server.
    const data = await donorService.qrCode()

    profile.value = data?.profile ?? null
    questionnaireStatus.value = data?.questionnaire_status ?? 'not_answered'
    qrValidUntil.value = data?.qr_valid_until ?? null
    qrValidDays.value = data?.qr_valid_days ?? qrValidDays.value
    hasActiveToken.value = !!data?.has_active_token
    donationIntervalActive.value = !!data?.donation_interval_active
    nextEligibleDate.value = data?.next_eligible_date ?? null
    emailVerified.value = !!data?.email_verified

    // Ang page kay keepalive, so basin naa pay QR image sa memory gikan sa
    // miaging mint. Kung wala nay active token (o naa sa waiting period), i-drop.
    if (!hasActiveToken.value || donationIntervalActive.value) dropLocalQr()

    // I-restore ang na-mint na nga code para dili ma-invalidate ang na-download
    // na nga PNG matag balik sa page. Ang server gihapon ang authority kung
    // naa pa bay buhi nga token.
    const stored = readStoredQr(profile.value?.donor_id)
    if (stored && hasActiveToken.value && !donationIntervalActive.value
      && stored.validUntil === qrValidUntil.value) {
      await renderQr(stored.token)
    }

    await loadAppointments()
  } catch (err) {
    console.error('Failed to load QR code data:', err)
  } finally {
    loading.value = false
    loadedOnce = true
  }
}

// Ang appointments kay para ra sa progress sa "How to use" steps. Kung
// mapakyas, ang questionnaire step ra ang mahibal-an, dili ma-block ang QR.
// Ang request number kay para dili ma-overwrite sa mas daan nga response ang
// mas bag-o, kay mahimong magdungan ang load() ug ang poll.
let appointmentsRequest = 0

async function loadAppointments({ keepOnError = false } = {}) {
  const request = ++appointmentsRequest
  try {
    const list = await donorService.appointments()
    if (request !== appointmentsRequest) return
    appointments.value = Array.isArray(list) ? list : (list?.data ?? [])
  } catch (err) {
    console.error('Failed to load appointments for QR steps:', err)
    // Sa poll, ayaw i-reset sa [] tungod lang sa usa ka napakyas nga request,
    // kay mobalik ang progress bisan wala may nausab sa server.
    if (!keepOnError && request === appointmentsRequest) appointments.value = []
  }
}

// Ang pag-scan sa QR sa blood center mo-usab sa appointment gikan sa
// `scheduled` ngadto sa `confirmed` samtang bukas pa ni nga page sa phone sa
// donor. I-poll ang GET /donors/appointments para mo-update ang steps nga dili
// na kinahanglan mobiya ug mobalik. Ang API gihapon ang tinubdan sa status —
// walay gi-compute dinhi.
//
// Mo-poll ra samtang ni nga page ang naa sa screen ug visible ang tab. Ang
// route ang gibantayan, dili onActivated/onDeactivated — tan-awa ang
// DashboardPage para sa rason.
const QR_PAGE_PATH = '/donor/qrcode'
const APPOINTMENT_POLL_MS = 20_000
let pollTimer = null

function isPageActive() {
  return route.path === QR_PAGE_PATH && !document.hidden
}

function startPolling() {
  if (pollTimer || !isPageActive()) return
  pollTimer = setInterval(() => {
    if (isPageActive()) loadAppointments({ keepOnError: true })
    else stopPolling()
  }, APPOINTMENT_POLL_MS)
}

function stopPolling() {
  clearInterval(pollTimer)
  pollTimer = null
}

// Pagbalik sa tab (e.g. gi-unlock ang phone), i-refresh dayon kay basin
// na-scan na samtang naka-hide.
function onVisibilityChange() {
  if (!isPageActive()) return stopPolling()
  loadAppointments({ keepOnError: true })
  startPolling()
}

onMounted(() => {
  load()
  document.addEventListener('visibilitychange', onVisibilityChange)
  startPolling()
})
onActivated(() => {
  if (loadedOnce) load({ silent: true })
})
watch(() => route.path, (path) => {
  if (path === QR_PAGE_PATH) startPolling()
  else stopPolling()
})
onBeforeUnmount(() => {
  stopPolling()
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

</script>

<style scoped>
.qr-page {
  --primary: var(--rb-primary);
  --success: #2e7d32;
  --text-primary: #1f2937;
  --text-secondary: #94A3B8;
  --border: #eef0f3;
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 32px 60px;
  background: var(--rb-page-bg);
}

.qr-page-inner { display: flex; flex-direction: column; gap: 24px; }

.header-row { display: flex; flex-direction: column; }

.page-title {
  font-size: var(--rb-fs-title);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.page-subtitle { font-size: var(--rb-fs-small); color: var(--text-secondary); margin: 2px 0 0; }

.main-grid {
  display: grid;
  grid-template-columns: minmax(0, 400px) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

/* ── The pass ── */
.pass {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 24px;
  background: white;
  box-shadow: 0 24px 48px -32px rgba(15, 23, 42, 0.45);
}

.pass__head {
  padding: 20px 22px 18px;
  border-radius: 23px 23px 0 0;
  background: linear-gradient(135deg, var(--rb-grad-from, #E3F2FD), var(--rb-grad-to, #BBDEFB));
  color: #0F172A;
}

.pass__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.8;
}

.pass__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  background: #fff;
  color: #C62828;
}

.pass__who {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
}

.pass__who-text { min-width: 0; }

.pass__name {
  margin: 0;
  overflow: hidden;
  font-family: var(--rb-font-sans);
  font-size: var(--rb-fs-title);
  font-weight: 800;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pass__id {
  margin: 3px 0 0;
  font-size: var(--rb-fs-small);
  font-weight: 600;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
  opacity: 0.75;
}

.pass__blood {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  padding: 6px 12px 7px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.75);
}

.pass__blood-type { font-family: var(--rb-font-sans); font-size: 20px; font-weight: 800; line-height: 1.1; color: #B71C1C; }
.pass__blood-label { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #64748B; }

.pass__code {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 22px 22px;
  text-align: center;
}

.pass__qr {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 10px 24px -18px rgba(15, 23, 42, 0.5);
}

.qr-image { display: block; width: 200px; height: 200px; }

.pass__hint { margin: 12px 0 0; font-size: var(--rb-fs-small); color: #64748B; }

/* Empty state, framed like the QR it is waiting for */
.qr-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; }

.qr-empty__frame {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 120px;
  margin-bottom: 8px;
  border: 2px dashed rgba(var(--rb-primary-rgb), 0.35);
  border-radius: 22px;
  background: rgba(var(--rb-primary-rgb), 0.05);
  color: var(--rb-primary-text);
}

.qr-empty__title { margin: 0; font-size: var(--rb-fs-section); font-weight: 700; color: var(--text-primary); }

.qr-empty__sub {
  max-width: 280px;
  margin: 0 0 12px;
  font-size: var(--rb-fs-small);
  line-height: 1.5;
  color: #64748B;
}

.qr-error {
  margin: 12px 0 0;
  font-size: var(--rb-fs-small);
  font-weight: 500;
  line-height: 1.5;
  color: #C62828;
}

.qr-resend-note { margin: 12px 0 0; font-size: var(--rb-fs-small); line-height: 1.5; color: #64748B; }

/* Perforation, with notches cut into the card's sides */
.pass__tear {
  position: relative;
  margin: 0 22px;
  border-top: 2px dashed var(--border);
}

.pass__tear::before,
.pass__tear::after {
  content: '';
  position: absolute;
  top: -11px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--rb-page-bg, #F5F7FA);
  box-shadow: inset 0 0 0 1px var(--border);
}

.pass__tear::before { left: -33px; clip-path: inset(0 0 0 50%); }
.pass__tear::after { right: -33px; clip-path: inset(0 50% 0 0); }

.pass__facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
  padding: 18px 22px;
}

.pass__facts dt {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.pass__facts dd {
  margin: 3px 0 0;
  font-size: var(--rb-fs-small);
  font-weight: 700;
  line-height: 1.35;
  color: var(--text-primary);
}

.qr-details__value--success { color: var(--success); }
.pass__facts dd.pass__fact--muted { color: #64748B; }

.pass__actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 0 22px 22px;
}

.pass__action {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 6px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: #fff;
  color: #334155;
  font-size: var(--rb-fs-caption);
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.pass__action :deep(svg) { color: var(--rb-primary-text); }
.pass__action:hover:not(:disabled) { border-color: rgba(var(--rb-primary-rgb), 0.4); background: rgba(var(--rb-primary-rgb), 0.05); }
.pass__action:disabled { opacity: 0.5; cursor: not-allowed; }
.pass__action:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

/* ── Steps ── */
.steps-panel {
  padding: 22px 24px 24px;
  border: 1px solid var(--border);
  border-radius: 22px;
  background: white;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.steps-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.steps-panel__title {
  margin: 0;
  font-size: var(--rb-fs-section);
  font-weight: 700;
  color: var(--text-primary);
}

.steps-panel__count {
  flex: none;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(var(--rb-primary-rgb), 0.08);
  color: var(--rb-primary-text);
  font-size: var(--rb-fs-caption);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* Journey: five icon stops on one line */
.journey {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}

.journey__stop {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

/* Connector from the previous stop */
.journey__stop + .journey__stop::before {
  content: '';
  position: absolute;
  top: 21px;
  right: calc(50% + 28px);
  width: calc(100% - 56px);
  height: 2px;
  border-radius: 999px;
  background: #e5e7eb;
}

.journey__stop--done::before,
.journey__stop--current::before { background: var(--rb-primary) !important; }

.journey__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: #f1f5f9;
  color: #94A3B8;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.journey__stop--done .journey__icon { background: rgba(var(--rb-primary-rgb), 0.12); color: var(--rb-primary-text); }

.journey__stop--current .journey__icon {
  background: var(--rb-primary);
  color: #fff;
  box-shadow: 0 0 0 5px rgba(var(--rb-primary-rgb), 0.14);
}

.journey__label { font-size: var(--rb-fs-caption); font-weight: 600; color: var(--text-secondary); }
.journey__stop--done .journey__label { color: #475569; }
.journey__stop--current .journey__label { color: var(--rb-primary-text); font-weight: 700; }

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* The one step with words */
.journey-next {
  display: flex;
  gap: 14px;
  margin-top: 20px;
  padding: 16px 18px;
  border: 1px solid rgba(var(--rb-primary-rgb), 0.25);
  border-radius: 18px;
  background: rgba(var(--rb-primary-rgb), 0.05);
}

.journey-next__icon {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--rb-primary);
  color: #fff;
}

.journey-next--done { border-color: #CFE3D0; background: #F1F7F1; }
.journey-next--done .journey-next__icon { background: var(--success); }

.journey-next__eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--rb-primary-text);
}

.journey-next__title { margin: 2px 0 0; font-size: var(--rb-fs-section); font-weight: 700; color: var(--text-primary); }
.journey-next__desc { margin: 4px 0 0; font-size: var(--rb-fs-small); line-height: 1.55; color: #475569; }

/* All steps, folded away */
.journey-all { margin-top: 12px; }

.journey-all summary {
  display: inline-flex;
  padding: 6px 2px;
  font-size: var(--rb-fs-small);
  font-weight: 600;
  color: var(--rb-primary-text);
  cursor: pointer;
}

.journey-all summary:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; border-radius: 6px; }

.journey-all__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 8px 0 0;
  padding: 0 0 0 20px;
}

.journey-all__title { margin: 0; font-size: var(--rb-fs-small); font-weight: 700; color: var(--text-primary); }
.journey-all__desc { margin: 2px 0 0; font-size: var(--rb-fs-small); line-height: 1.5; color: #64748B; }

@media (prefers-reduced-motion: reduce) {
  .journey__icon { transition: none; }
}

@media (max-width: 480px) {
  .journey__icon { width: 38px; height: 38px; border-radius: 12px; }
  .journey__stop + .journey__stop::before { top: 18px; right: calc(50% + 24px); width: calc(100% - 48px); }
  .journey__label { font-size: 11px; }
  .journey-next { padding: 14px; }
}

.privacy-note {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: 16px;
  background: #f8fafc;
}

.privacy-note__icon {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: rgba(var(--rb-primary-rgb), 0.1);
  color: var(--rb-primary-text);
}

.privacy-note__text { margin: 0; font-size: var(--rb-fs-small); line-height: 1.55; color: #475569; }
.privacy-note__text strong { color: var(--text-primary); }

/* Buttons */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 11px 22px;
  border-radius: 999px;
  font-size: var(--rb-fs-small);
  font-weight: 700;
  color: white;
  background: var(--primary);
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: background-color 0.15s ease;
}

.btn-primary:hover:not(:disabled) { background: var(--rb-primary-hover); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary:active:not(:disabled) { transform: translateY(1px); }

.btn-primary:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

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
.skeleton--pass { height: 520px; border-radius: 24px; }
.skeleton--steps { height: 460px; border-radius: 22px; }

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
  .pass__action, .btn-primary { transition: none; }
}

@media (max-width: 960px) {
  .main-grid { grid-template-columns: minmax(0, 1fr); }
  .pass { max-width: 440px; width: 100%; justify-self: center; }
}

@media (max-width: 640px) {
  .qr-page { padding: 16px 16px 40px; }
  .steps-panel { padding: 18px 16px; }
}

@media (max-width: 380px) {
  .pass__facts { grid-template-columns: 1fr 1fr; }
}

/* ============ Dark mode ============ */
:global(.dark .qr-page) {
  --text-primary: var(--ink-text, #F1F5F9);
  --text-secondary: var(--ink-text-2, #94A3B8);
  --border: var(--ink-border, #334155);
  background: var(--ink-page, #0F172A);
}

:global(.dark .qr-page .pass),
:global(.dark .qr-page .steps-panel) { background: var(--ink-surface, #1E293B); border-color: var(--ink-border, #334155); }

:global(.dark .qr-page .pass__head) {
  background: linear-gradient(135deg, color-mix(in srgb, var(--rb-primary) 45%, var(--ink-surface, #1E293B)), color-mix(in srgb, var(--rb-primary) 18%, var(--ink-surface, #1E293B)));
  color: var(--ink-text, #F1F5F9);
}
:global(.dark .qr-page .pass__blood) { background: rgba(var(--ink-page-rgb, 15, 23, 42), 0.45); }
:global(.dark .qr-page .pass__blood-type) { color: #EF9A9A; }
:global(.dark .qr-page .pass__blood-label) { color: var(--ink-text-3, #CBD5E1); }
/* The QR itself stays on white so scanners can read it */
:global(.dark .qr-page .pass__qr) { border-color: var(--ink-border, #334155); }
:global(.dark .qr-page .pass__tear::before),
:global(.dark .qr-page .pass__tear::after) { background: var(--ink-page, #0F172A); }
:global(.dark .qr-page .pass__action) { background: var(--ink-hover, #263449); border-color: var(--ink-border, #334155); color: var(--ink-text-4, #E2E8F0); }
:global(.dark .qr-page .pass__action:hover:not(:disabled)) { background: var(--ink-border, #334155); }
:global(.dark .qr-page .pass__hint),
:global(.dark .qr-page .qr-empty__sub),
:global(.dark .qr-page .pass__facts dd.pass__fact--muted) { color: var(--ink-text-2, #94A3B8); }
:global(.dark .qr-page .qr-details__value--success) { color: #81C784; }
:global(.dark .qr-page .qr-empty__frame) { background: color-mix(in srgb, var(--rb-primary-text) 8%, transparent); border-color: color-mix(in srgb, var(--rb-primary-text) 35%, transparent); }

:global(.dark .qr-page .journey__stop + .journey__stop::before) { background: var(--ink-border, #334155); }
:global(.dark .qr-page .journey__icon) { background: var(--ink-hover, #263449); color: var(--ink-muted, #64748B); }
:global(.dark .qr-page .journey__stop--done .journey__icon) { background: color-mix(in srgb, var(--rb-primary-text) 16%, transparent); color: var(--rb-primary-text); }
:global(.dark .qr-page .journey__stop--current .journey__icon) { background: var(--rb-primary); color: #fff; }
:global(.dark .qr-page .journey__stop--done .journey__label) { color: var(--ink-text-3, #CBD5E1); }
:global(.dark .qr-page .journey-next) { background: color-mix(in srgb, var(--rb-primary-text) 8%, transparent); border-color: color-mix(in srgb, var(--rb-primary-text) 25%, transparent); }
:global(.dark .qr-page .journey-next--done) { background: rgba(102, 187, 106, 0.1); border-color: rgba(102, 187, 106, 0.3); }
:global(.dark .qr-page .journey-next__desc),
:global(.dark .qr-page .journey-all__desc) { color: var(--ink-text-2, #94A3B8); }
:global(.dark .qr-page .steps-panel__count) { background: color-mix(in srgb, var(--rb-primary-text) 14%, transparent); }

:global(.dark .qr-page .privacy-note) { background: var(--ink-inset, #172033); }
:global(.dark .qr-page .privacy-note__icon) { background: color-mix(in srgb, var(--rb-primary-text) 16%, transparent); }
:global(.dark .qr-page .privacy-note__text) { color: var(--ink-text-3, #CBD5E1); }

:global(.dark .qr-page .skeleton) {
  background: linear-gradient(90deg, var(--ink-hover, #263449) 25%, var(--ink-border, #334155) 37%, var(--ink-hover, #263449) 63%);
  background-size: 400% 100%;
}
</style>
