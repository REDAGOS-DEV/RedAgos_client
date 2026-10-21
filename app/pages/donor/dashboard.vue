<template>
  <div class="dashboard scope-donor-dashboard">
    <!-- Skeleton loading state -->
    <div v-if="loading" class="dashboard-inner">
      <div class="skeleton skeleton--header" />
      <div class="stats-grid">
        <div class="skeleton skeleton--card" v-for="n in 4" :key="n" />
      </div>
      <div class="main-grid">
        <div class="col-left">
          <div class="skeleton skeleton--panel" style="height:220px" />
          <div class="skeleton skeleton--panel" style="height:260px" />
        </div>
        <div class="col-right">
          <div class="skeleton skeleton--panel" style="height:160px" />
          <div class="skeleton skeleton--panel" style="height:200px" />
          <div class="skeleton skeleton--panel" style="height:180px" />
        </div>
      </div>
    </div>

    <div v-else class="dashboard-inner">
      <!--
        Hero: the donor's theme gradient with a soft glass glow. One greeting,
        one line about where they stand, and ONE next step that changes with
        their situation (screen, then book, then show QR). It replaced a plain
        title, a separate "Book Appointment" button and the eligibility banner.
      -->
      <section class="hero" :class="`hero--${heroTone}`" aria-labelledby="hero-greeting">
        <div class="hero__copy">
          <p class="hero__eyebrow">{{ todayLabel }}</p>
          <h1 id="hero-greeting" class="hero__title">{{ greeting }}</h1>
          <p class="hero__status">{{ nextStep.status }}</p>
          <NuxtLink :to="nextStep.to" class="hero__cta">
            <AssetIcon :name="nextStep.icon" :size="16" />
            {{ nextStep.label }}
            <AssetIcon name="arrow-right" :size="15" class="hero__cta-arrow" />
          </NuxtLink>
        </div>

        <!-- At a glance: blood type and QR status on frosted glass -->
        <div class="hero__glass">
          <div class="hero__fact">
            <span class="hero__fact-icon hero__fact-icon--blood"><AssetIcon name="blood-drop" :size="18" /></span>
            <span>
              <span class="hero__fact-label">Blood type</span>
              <span class="hero__fact-value">{{ bloodType }}</span>
            </span>
          </div>
          <div class="hero__fact">
            <span class="hero__fact-icon" :class="screeningDone ? 'hero__fact-icon--ok' : 'hero__fact-icon--warn'">
              <AssetIcon :name="screeningDone ? 'shield-check' : 'clock'" :size="18" />
            </span>
            <span>
              <span class="hero__fact-label">QR code</span>
              <span class="hero__fact-value">{{ screeningDone ? 'Valid' : questionnaireStatus === 'expired' ? 'Expired' : 'Not yet' }}</span>
            </span>
          </div>
          <NuxtLink to="/donor/qrcode" class="hero__qr-link">
            View QR
            <AssetIcon name="arrow-right" :size="14" />
          </NuxtLink>
        </div>
      </section>

      <!--
        A donor the blood center desk registered has no confirmed email: the
        desk typed it (no link is mailed then), or there is none. Booking, the
        check-in QR and a forgotten-password link all need one.
      -->
      <div v-if="emailPrompt" class="banner banner--warning" role="status">
        <span class="banner-icon-wrapper"><AssetIcon name="mail" :size="16" class="banner-icon" /></span>
        <p class="banner-text">
          <template v-if="emailPrompt === 'add'">
            Add your email address to book appointments online, get your check-in QR code and reset a forgotten password.
          </template>
          <template v-else-if="verifySent">
            Sent. Open the link we emailed to <strong>{{ user?.email }}</strong> to confirm it.
          </template>
          <template v-else>
            Confirm your email (<strong>{{ user?.email }}</strong>) to book appointments online, get your check-in QR code and reset a forgotten password.
          </template>
          <span v-if="verifyError" class="banner-error">{{ verifyError }}</span>
        </p>
        <NuxtLink v-if="emailPrompt === 'add'" to="/donor/profile" class="banner-link">Add email</NuxtLink>
        <button
          v-else-if="!verifySent"
          type="button"
          class="banner-link banner-link--button"
          :disabled="verifySending"
          @click="sendVerification"
        >
          {{ verifySending ? 'Sending…' : 'Send confirmation link' }}
        </button>
      </div>

      <!-- Onboarding checklist -->
      <div v-if="showOnboarding" class="onboarding-card">
        <div class="onboarding-card__header">
          <div>
            <p class="onboarding-card__title">Get started with RedAgos</p>
            <p class="onboarding-card__subtitle">{{ completedSteps }} of {{ onboardingSteps.length }} steps completed
            </p>
          </div>
          <div class="onboarding-card__progress-ring">
            <svg viewBox="0 0 36 36" class="progress-ring__svg">
              <circle class="progress-ring__bg" cx="18" cy="18" r="15.5" />
              <circle class="progress-ring__fill" cx="18" cy="18" r="15.5"
                :style="{ strokeDasharray: `${progressPercent}, 100` }" />
            </svg>
            <span class="progress-ring__label">{{ Math.round(progressPercent) }}%</span>
          </div>
        </div>

        <div class="onboarding-steps">
          <NuxtLink v-for="(step, i) in onboardingSteps" :key="step.key" :to="step.done ? undefined : step.path"
            class="onboarding-step"
            :class="{ 'onboarding-step--done': step.done, 'onboarding-step--next': step.key === nextOnboardingKey }"
            :aria-current="step.key === nextOnboardingKey ? 'step' : undefined">
            <div class="onboarding-step__check">
              <AssetIcon v-if="step.done" name="check" :size="12" />
              <span v-else>{{ i + 1 }}</span>
            </div>
            <span class="onboarding-step__label">{{ step.label }}</span>
            <span v-if="step.key === nextOnboardingKey" class="onboarding-step__next">Next</span>
          </NuxtLink>
        </div>
      </div>

      <!-- Stat cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card__top">
            <p class="stat-card__label">Total Donations</p>
            <div class="stat-card__badge stat-card__badge--primary">
              <AssetIcon name="blood-drop" :size="14" />
            </div>
          </div>
          <p class="stat-card__value">{{ totalDonations }}</p>
          <span class="stat-chip stat-chip--neutral">Lifetime</span>
        </div>

        <!-- Lives potentially helped: one whole-blood donation can help up to 3 patients. -->
        <div class="stat-card">
          <div class="stat-card__top">
            <p class="stat-card__label">Lives Helped</p>
            <div class="stat-card__badge stat-card__badge--accent">
              <AssetIcon name="heart" :size="14" />
            </div>
          </div>
          <p class="stat-card__value">{{ totalDonations * 3 }}</p>
          <span class="stat-chip stat-chip--neutral">Up to 3 per donation</span>
        </div>

        <div class="stat-card">
          <div class="stat-card__top">
            <p class="stat-card__label">Last Donation</p>
            <div class="stat-card__badge stat-card__badge--success">
              <AssetIcon name="history" :size="14" />
            </div>
          </div>
          <p class="stat-card__value stat-card__value--date">{{ lastDonationDate }}</p>
          <span class="stat-chip stat-chip--neutral truncate-chip">
            {{ lastDonation ? lastDonation.facility_name : 'No donations yet' }}
          </span>
        </div>

        <div class="stat-card">
          <div class="stat-card__top">
            <p class="stat-card__label">Next Appointment</p>
            <div class="stat-card__badge stat-card__badge--secondary">
              <AssetIcon name="calendar" :size="14" />
            </div>
          </div>
          <p class="stat-card__value text-primary">{{ nextApptDate }}</p>
          <span class="stat-chip stat-chip--neutral truncate-chip">
            {{ upcomingAppointment ? upcomingAppointment.facility_name : 'No appointment scheduled' }}
          </span>
        </div>
      </div>

      <!-- Main content grid -->
      <div class="main-grid">
        <!-- Left column -->
        <div class="col-left">
          <!-- Trend chart -->
          <div class="panel">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">Donation Trend</h2>
                <p class="panel-subtitle">Donations given over the last 12 months</p>
              </div>
              <span class="period-pill">Last 12 months</span>
            </div>

            <div class="trend-chart">
              <div v-if="hasTrendData" class="chart">
                <!-- Y axis -->
                <div class="chart__yaxis">
                  <span v-for="n in yTicks" :key="n">{{ n }}</span>
                </div>

                <!-- Bars -->
                <div class="chart__plot">
                  <div v-for="(m, i) in monthlyTrend" :key="m.key" class="chart__col" tabindex="0" role="button"
                    :aria-label="`${m.month}: ${m.count} donation${m.count !== 1 ? 's' : ''}`"
                    @mouseenter="hoveredMonth = i" @mouseleave="hoveredMonth = null" @focus="hoveredMonth = i"
                    @blur="hoveredMonth = null" @click="hoveredMonth = hoveredMonth === i ? null : i">
                    <div class="chart__tooltip" v-if="hoveredMonth === i">
                      {{ m.count }} donation{{ m.count !== 1 ? 's' : '' }}
                    </div>

                    <div class="chart__track">
                      <div class="chart__bar" :class="{
                        'chart__bar--current': i === monthlyTrend.length - 1 && m.count > 0,
                        'chart__bar--low': m.count > 0 && m.count <= lowThreshold && i !== monthlyTrend.length - 1,
                        'chart__bar--empty': m.count === 0
                      }" :style="{ height: `${barHeight(m.count)}%` }" />
                    </div>

                    <span class="chart__label" :class="{ 'chart__label--current': i === monthlyTrend.length - 1 }">{{
                      m.month }}</span>
                  </div>
                </div>
              </div>

              <div v-else class="trend-empty">
                <div class="trend-empty__icon">
                  <AssetIcon name="trending-up" :size="28" />
                </div>
                <p>Your donations will show here month by month.</p>
              </div>
            </div>
          </div>

          <!-- Recent donation history -->
          <div class="panel">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">Recent Donations</h2>
                <p class="panel-subtitle">Your latest donation activity</p>
              </div>
              <NuxtLink to="/donor/history" class="panel-link">
                View All
                <AssetIcon name="chevron-right" :size="14" />
              </NuxtLink>
            </div>

            <div v-if="recentDonations.length" class="donation-list">
              <div v-for="d in recentDonations" :key="d.id" class="donation-item">
                <div class="donation-item__left">
                  <div class="donation-icon"
                    :class="d.status === 'completed' ? 'donation-icon--success' : 'donation-icon--warning'">
                    <AssetIcon name="blood-drop" :size="15" />
                  </div>
                  <div>
                    <p class="donation-title">
                      {{ d.status === 'completed' ? 'Successful Donation' : d.status === 'deferred' ? 'Deferred' :
                        'Pending' }}
                    </p>
                    <p class="donation-meta">
                      <strong class="donation-meta__highlight">{{ d.blood_type }}</strong> &middot; {{ d.facility_name }} &middot; {{
                        d.donation_type === 'walk_in' ? 'Walk-in' : 'Booked' }}
                    </p>
                  </div>
                </div>
                <div class="donation-item__right">
                  <p class="donation-date">{{ formatDate(d.donation_date, 'MMM D, YYYY') }}</p>
                  <span class="badge capitalize"
                    :class="d.status === 'completed' ? 'badge--success' : 'badge--warning'">
                    {{ d.status === 'completed' ? 'Completed' : d.status }}
                  </span>
                </div>
              </div>
            </div>
            <div v-else class="empty-state">
              <div class="empty-state__icon">
                <AssetIcon name="history" :size="28" />
              </div>
              <p>No donations yet</p>
            </div>
          </div>
        </div>

        <!-- Right column -->
        <div class="col-right">
          <!-- Upcoming appointment -->
          <div class="panel">
            <div class="panel-header panel-header--simple">
              <h2 class="panel-title">Upcoming Appointment</h2>
              <NuxtLink to="/donor/appointments" class="panel-link-plain">Manage</NuxtLink>
            </div>

            <div v-if="upcomingAppointment" class="appt-body">
              <div class="appt-row">
                <div class="appt-date-chip">
                  <span class="appt-date-chip__day">{{ formatDate(upcomingAppointment.appointment_datetime, 'D')
                  }}</span>
                  <span class="appt-date-chip__month">{{ formatDate(upcomingAppointment.appointment_datetime, 'MMM')
                  }}</span>
                </div>
                <div class="appt-info">
                  <p class="appt-type">
                    {{ upcomingAppointment.appointment_type === 'walk_in' ? 'Walk-in Donation' : 'Booked Donation' }}
                  </p>
                  <div class="appt-meta-row">
                    <AssetIcon name="map-pin" :size="13" />
                    <span class="truncate">{{ upcomingAppointment.facility_name }}</span>
                  </div>
                  <div class="appt-meta-row">
                    <AssetIcon name="clock" :size="13" />
                    {{ formatDate(upcomingAppointment.appointment_datetime, 'h:mm A') }}
                  </div>
                </div>
              </div>
              <div class="appt-notice">
                <AssetIcon name="qr-code" :size="14" />
                Present QR code on arrival
              </div>
            </div>
            <div v-else class="empty-state">
              <div class="empty-state__icon">
                <AssetIcon name="calendar" :size="28" />
              </div>
              <p class="mb-3">Nothing booked yet</p>
              <NuxtLink to="/donor/appointments" class="btn-outline">Find a time</NuxtLink>
            </div>
          </div>

          <!-- Eligibility card -->
          <div class="panel">
            <div class="panel-header panel-header--simple">
              <h2 class="panel-title">Eligibility Status</h2>
            </div>
            <div class="eligibility-body">
              <div class="eligibility-status-row"
                :class="screeningDone ? 'eligibility-status-row--eligible' : eligibilityStatus === 'deferred' ? 'eligibility-status-row--deferred' : 'eligibility-status-row--pending'">
                <AssetIcon name="shield-check" :size="20" />
                <div>
                  <p class="eligibility-status">
                    {{ QUESTIONNAIRE_LABELS[questionnaireStatus] ?? 'Not yet answered' }}
                  </p>
                  <p v-if="profile?.screening_valid_until" class="eligibility-until">
                    Valid until {{ formatDate(profile.screening_valid_until, 'MMM D, YYYY') }}
                  </p>
                </div>
              </div>

              <div class="eligibility-details">
                <div v-if="profile?.screening_date" class="eligibility-details__row">
                  <span class="eligibility-details__label">Screening date</span>
                  <span class="eligibility-details__value">{{ formatDate(profile.screening_date, 'MMM D, YYYY') }}</span>
                </div>
              </div>

              <!-- Outline, not the old full-width red: red is the brand, not an action. -->
              <NuxtLink to="/donor/eligibility" class="btn-outline btn-outline--block">
                <AssetIcon name="clipboard-check" :size="15" />
                {{ screeningDone ? 'Retake screening' : 'Take screening' }}
              </NuxtLink>
            </div>
          </div>

          <!-- Quick actions -->
          <div class="panel">
            <div class="panel-header panel-header--simple">
              <h2 class="panel-title">Quick Actions</h2>
            </div>
            <div class="quick-actions">
              <NuxtLink v-for="item in quickActions" :key="item.path" :to="item.path" class="quick-action">
                <div class="quick-action__icon" :style="{ '--qa-color': item.color }">
                  <AssetIcon :name="item.icon" :size="15" />
                </div>
                <span class="quick-action__label">{{ item.label }}</span>
                <AssetIcon name="chevron-right" :size="14" class="quick-action__chevron" />
              </NuxtLink>
            </div>
          </div>
        </div>
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
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import { donorService } from '~/api/donor/DonorService'
import { authService } from '~/api/auth/AuthService'
import { useUser } from '~/composables/useUser'
import { useAccentTheme } from '~/composables/useAccentTheme'
import { accentTheme } from '~/utils/accentThemes'

const route = useRoute()

const loading = ref(true)

// ── Hero ──
const { user } = useUser()
const { current: accentKey } = useAccentTheme()

// ── Email prompt ──
// 'add' with no address, 'confirm' with an unconfirmed one, null otherwise.
// A self-registered donor never sees it: they confirmed before signing in.
const emailPrompt = computed(() => {
  if (!user.value) return null
  if (!user.value.email) return 'add'
  return user.value.email_verified ? null : 'confirm'
})
const verifySending = ref(false)
const verifySent = ref(false)
const verifyError = ref('')

async function sendVerification() {
  if (verifySending.value) return
  verifySending.value = true
  verifyError.value = ''
  try {
    await authService.resendVerificationEmail()
    verifySent.value = true
  } catch (err) {
    verifyError.value = err?.status === 429
      ? 'Too many requests. Please wait a few minutes and try again.'
      : (err?.message || 'Could not send the link. Please try again.')
  } finally {
    verifySending.value = false
  }
}
// Dark or white hero text, per theme (see utils/accentThemes.ts).
const heroTone = computed(() => accentTheme(accentKey.value).headerText)

const greeting = computed(() => {
  const h = new Date().getHours()
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  const first = user.value?.full_name?.split(' ')[0]
  const name = first ? first.charAt(0).toUpperCase() + first.slice(1) : ''
  return name ? `${part}, ${name}!` : `${part}!`
})

const todayLabel = computed(() =>
  new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }))

// The one next step for this donor, most urgent first.
const nextStep = computed(() => {
  if (eligibilityStatus.value === 'deferred') {
    return {
      status: 'Your screening was deferred. Check the details before booking.',
      label: 'View screening result',
      icon: 'clipboard-check',
      to: '/donor/eligibility',
    }
  }
  if (!screeningDone.value) {
    const expired = questionnaireStatus.value === 'expired'
    return {
      status: expired
        ? 'Your eligibility screening has expired. Retake it to donate again.'
        : 'Start with a quick eligibility screening. It takes about 5 minutes.',
      label: expired ? 'Retake screening' : 'Take eligibility screening',
      icon: 'clipboard-check',
      to: '/donor/eligibility',
    }
  }
  if (upcomingAppointment.value) {
    return {
      status: `You are booked for ${nextApptDate.value} at ${upcomingAppointment.value.facility_name}. Show your QR code on arrival.`,
      label: 'Show my QR code',
      icon: 'qr-code',
      to: '/donor/qrcode',
    }
  }
  return {
    status: 'You are eligible to donate. Pick a blood center and a time that suits you.',
    label: 'Book a donation',
    icon: 'calendar',
    to: '/donor/appointments',
  }
})

// Core donor data
const profile = ref(null)
const eligibilityStatus = ref('pending')

// Whether the questionnaire is answered and still stands. Every submission is
// recorded `pending` until the centre decides, so eligibility_status never
// reports it done — this is what the checklist and QR badge read instead.
const questionnaireStatus = ref('not_answered')
const screeningDone = computed(() => questionnaireStatus.value === 'answered')

const QUESTIONNAIRE_LABELS = {
  not_answered: 'Not yet answered',
  answered: 'Answered',
  expired: 'Needs answering again',
}
const bloodType = ref('-')
const totalDonations = ref(0)
const upcomingAppointment = ref(null)
const recentDonations = ref([])
// Hero shows blood type and QR status, so the stat cards show the history.
const lastDonation = computed(() => recentDonations.value.find(d => d.status === 'completed') ?? null)
const lastDonationDate = computed(() => (lastDonation.value ? formatDate(lastDonation.value.donation_date, 'MMM D, YYYY') : '-'))
const monthlyTrend = ref([])

// Trend chart state
const hoveredMonth = ref(null)
const lowThreshold = 1

const maxTrendCount = computed(() => {
  const max = Math.max(0, ...monthlyTrend.value.map(m => m.count))
  return max > 0 ? max : 1
})

const hasTrendData = computed(() => monthlyTrend.value.some(m => m.count > 0))

const yTicks = computed(() => {
  const max = maxTrendCount.value
  return [max, Math.round(max * 0.75), Math.round(max * 0.5), Math.round(max * 0.25), 0]
})

function barHeight(count) {
  return Math.round((count / maxTrendCount.value) * 100)
}

const nextApptDate = computed(() => {
  if (!upcomingAppointment.value) return '-'
  return formatDate(upcomingAppointment.value.appointment_datetime, 'MMM D')
})


const quickActions = [
  { path: '/donor/appointments', icon: 'calendar', color: '#1565C0', label: 'Book Appointment' },
  { path: '/donor/history', icon: 'history', color: '#2E7D32', label: 'Donation History' },
  { path: '/donor/eligibility', icon: 'shield-check', color: '#F57C00', label: 'Eligibility Screening' },
  { path: '/donor/qrcode', icon: 'qr-code', color: '#D32F2F', label: 'My QR Code' },
]

// --- Onboarding checklist ---
const onboardingSteps = computed(() => [
  {
    key: 'screening',
    label: 'Complete eligibility screening',
    path: '/donor/eligibility',
    // Recording a collection uses the questionnaire up, so questionnaire_status
    // reads `expired` right after a donation. A donation still proves this step
    // was done; the banner and QR card keep reading screeningDone for the next visit.
    done: screeningDone.value || totalDonations.value > 0,
  },
  {
    key: 'appointment',
    label: 'Book your first appointment',
    path: '/donor/appointments',
    done: !!upcomingAppointment.value || totalDonations.value > 0,
  },
  {
    key: 'check-in',
    label: 'Check in at blood center',
    path: '/donor/qrcode',
    // `confirmed` is what the counter writes when it scans the donor's QR.
    // Recording the collection then closes the appointment, dropping it out of
    // upcoming_appointment, so a donation also means the check-in happened.
    done: upcomingAppointment.value?.status === 'confirmed' || totalDonations.value > 0,
  },
  {
    key: 'donation',
    label: 'Complete your first donation',
    path: '/donor/appointments',
    done: totalDonations.value > 0,
  },
  {
    key: 'profile',
    label: 'Complete your profile details',
    path: '/donor/profile',
    done: !!(profile.value?.blood_type && profile.value?.contact_number),
  },
])

// The first unfinished step is the one to highlight.
const nextOnboardingKey = computed(() => onboardingSteps.value.find(s => !s.done)?.key ?? null)
const completedSteps = computed(() => onboardingSteps.value.filter(s => s.done).length)
const progressPercent = computed(() => (completedSteps.value / onboardingSteps.value.length) * 100)
const showOnboarding = computed(() => completedSteps.value < onboardingSteps.value.length)

function formatDate(value, fmt) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'

  const day = d.getDate()
  const monthShort = d.toLocaleDateString('en-US', { month: 'short' })
  const year = d.getFullYear()
  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12

  switch (fmt) {
    case 'D':
      return String(day)
    case 'MMM':
      return monthShort
    case 'MMM D':
      return `${monthShort} ${day}`
    case 'MMM D, YYYY':
      return `${monthShort} ${day}, ${year}`
    case 'h:mm A':
      return `${hours}:${minutes} ${ampm}`
    default:
      return d.toLocaleDateString()
  }
}

let loadedOnce = false

// Route returns and tab returns can overlap, so only the newest response is
// applied: a slower, older one must not roll the progress back.
let latestRequest = 0

async function load({ silent = false } = {}) {
  const request = ++latestRequest
  if (!silent) loading.value = true
  try {
    const data = await donorService.dashboard()
    if (request !== latestRequest) return
    profile.value = data.profile ?? null
    eligibilityStatus.value = data.eligibility_status ?? 'pending'
    questionnaireStatus.value = data.questionnaire_status ?? 'not_answered'
    bloodType.value = data.blood_type ?? '-'
    totalDonations.value = data.total_donations ?? 0
    upcomingAppointment.value = data.upcoming_appointment ?? null
    recentDonations.value = data.recent_donations ?? []
    monthlyTrend.value = data.monthly_trend ?? []
  } catch (err) {
    console.error('Failed to load donor dashboard data:', err)
  } finally {
    if (request === latestRequest) {
      loading.value = false
      loadedOnce = true
    }
  }
}

function isOnDashboard() {
  return route.path === '/donor/dashboard'
}

/*
 * The same silent refresh when the donor comes back to the tab — say,
 * unlocking their phone after giving blood with the dashboard still open.
 * Navigating back is covered by the route watcher below.
 */
function onVisibilityChange() {
  if (!document.hidden && isOnDashboard() && loadedOnce) load({ silent: true })
}

onMounted(() => {
  load()
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

/*
 * `route` is the app-wide reactive current route, so this watcher keeps
 * firing even while this page sits deactivated inside <KeepAlive> — unlike
 * `onActivated`, it doesn't depend on Vue matching this component back into
 * the keep-alive cache to notice the return trip. Any step completed on
 * another page (screening, booking, profile edits) shows up here the moment
 * the donor navigates back, without a full reload.
 */
watch(() => route.path, () => {
  if (isOnDashboard() && loadedOnce) load({ silent: true })
})
</script>

<style scoped>
.dashboard {
  --primary: var(--rb-primary);
  --secondary: color-mix(in srgb, var(--rb-primary) 65%, white);
  --accent: #d32f2f;
  --success: #2e7d32;
  --warning: #f57c00;
  --text-primary: #1f2937;
  --text-secondary: #9ca3af;
  --border: #eef0f3;
  --card-bg: #ffffff;

  font-family: inherit;
  max-width: 1400px;
  background: var(--rb-page-bg);
  margin: 0 auto;
  padding: 24px 32px 40px;
  transition: background-color 0.2s ease;
}

.text-primary { color: var(--primary) !important; }
.text-success { color: var(--success) !important; }
.text-warning { color: var(--warning) !important; }
.font-extrabold { font-weight: 800; }

.skeleton {
  background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 37%, #e2e8f0 63%);
  background-size: 400% 100%;
  border-radius: 12px;
  animation: shimmer 1.4s ease infinite;
}
.skeleton--header { height: 44px; max-width: 320px; }
.skeleton--card { height: 112px; }
.skeleton--panel { border-radius: 14px; }

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none !important; }
}

.dashboard-inner {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

/* Header Section */
/* ── Hero ── */
.hero {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 24px;
  padding: 28px 32px;
  border-radius: 22px;
  background:
    radial-gradient(60% 120% at 100% 0%, rgba(255, 255, 255, 0.45), transparent 60%),
    linear-gradient(120deg, var(--rb-grad-from, #E5EFFC) 0%, var(--rb-grad-to, #ADCCEF) 100%);
  box-shadow: 0 18px 40px -26px rgba(var(--rb-primary-rgb), 0.55);
  --hero-text: #0B1F3A;
  --hero-text-2: #2B3E58;
}
/* Two soft discs: the glass glow, like the landing page. */
.hero::before,
.hero::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}
.hero::before {
  width: 260px;
  height: 260px;
  right: 16%;
  top: -140px;
  background: rgba(255, 255, 255, 0.28);
}
.hero::after {
  width: 180px;
  height: 180px;
  left: -60px;
  bottom: -110px;
  background: rgba(255, 255, 255, 0.22);
}
/* Deep gradients (headerText 'light') put white text on their dark end. */
.hero--light {
  --hero-text: #FFFFFF;
  --hero-text-2: rgba(255, 255, 255, 0.88);
  background:
    radial-gradient(60% 120% at 100% 0%, rgba(255, 255, 255, 0.18), transparent 60%),
    linear-gradient(120deg, var(--rb-grad-to) 0%, var(--rb-grad-from) 100%);
}

.hero__copy { position: relative; z-index: 1; min-width: 0; }
.hero__eyebrow {
  margin: 0 0 6px;
  font-size: var(--rb-fs-small);
  font-weight: 600;
  color: var(--hero-text-2);
}
.hero__title {
  margin: 0 0 6px;
  font-size: var(--rb-fs-display);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.15;
  color: var(--hero-text);
}
.hero__status {
  max-width: 52ch;
  margin: 0 0 18px;
  font-size: var(--rb-fs-body);
  line-height: 1.55;
  color: var(--hero-text-2);
}
.hero__cta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 20px;
  border-radius: 999px;
  background: var(--rb-primary);
  color: #FFFFFF;
  font-size: var(--rb-fs-body);
  font-weight: 700;
  text-decoration: none;
  box-shadow: 0 10px 22px -12px rgba(var(--rb-primary-rgb), 0.9);
  transition: background-color 0.15s ease, transform 0.15s ease;
}
.hero__cta:hover { background: var(--rb-primary-hover); }
.hero__cta:active { transform: scale(0.98); }
.hero__cta:focus-visible { outline: 2px solid var(--hero-text); outline-offset: 3px; }
.hero__cta-arrow { transition: transform 0.2s ease; }
.hero__cta:hover .hero__cta-arrow { transform: translateX(3px); }
.hero--light .hero__cta { background: #FFFFFF; color: var(--rb-primary); }
.hero--light .hero__cta:hover { background: #F1F5F9; }

/* Frosted glass card with two facts. */
.hero__glass {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 10px;
  min-width: 220px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.55);
  -webkit-backdrop-filter: blur(16px) saturate(160%);
  backdrop-filter: blur(16px) saturate(160%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}
.hero__fact { display: flex; align-items: center; gap: 12px; }
.hero__fact-icon {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: #FFFFFF;
}
.hero__fact-icon--blood { color: #C62828; }
.hero__fact-icon--ok { color: #2E7D32; }
.hero__fact-icon--warn { color: #B45309; }
.hero__fact-label { display: block; font-size: var(--rb-fs-caption); font-weight: 600; color: #475569; }
.hero__fact-value { display: block; font-size: 17px; font-weight: 800; color: #0B1F3A; }

.stat-card__value--date { font-size: 20px; }

/* Dark mode: a deep tint of the theme instead of a bright pastel block. */
:global(.dark .scope-donor-dashboard .hero) {
  --hero-text: #F1F5F9;
  --hero-text-2: #CBD5E1;
  background:
    radial-gradient(60% 120% at 100% 0%, color-mix(in srgb, var(--rb-grad-to, #ADCCEF) 22%, transparent), transparent 60%),
    linear-gradient(120deg, color-mix(in srgb, var(--rb-grad-to, #ADCCEF) 30%, #111A2E) 0%, color-mix(in srgb, var(--rb-grad-from, #E5EFFC) 12%, #111A2E) 100%);
  box-shadow: 0 18px 40px -26px rgba(0, 0, 0, 0.7);
}
:global(.dark .scope-donor-dashboard .hero::before),
:global(.dark .scope-donor-dashboard .hero::after) { background: rgba(255, 255, 255, 0.05); }
:global(.dark .scope-donor-dashboard .hero__glass) {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(15, 23, 42, 0.45);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
:global(.dark .scope-donor-dashboard .hero__fact-icon) { background: rgba(255, 255, 255, 0.08); }
:global(.dark .scope-donor-dashboard .hero__fact-label) { color: #94A3B8; }
:global(.dark .scope-donor-dashboard .hero__fact-value) { color: #F1F5F9; }

@media (max-width: 760px) {
  .hero { grid-template-columns: 1fr; padding: 22px 20px; }
  .hero__glass { grid-template-columns: 1fr 1fr; min-width: 0; }
  .hero__cta { width: 100%; justify-content: center; }
}
@media (prefers-reduced-transparency: reduce) {
  .hero__glass { background: rgba(255, 255, 255, 0.9); }
}
@media (prefers-reduced-motion: reduce) {
  .hero__cta, .hero__cta-arrow { transition: none; }
}

.header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 4px;
  width: 100%;
}

.header-titles {
  flex: 1;
  min-width: 0;
}

.page-title {
  font-size: var(--rb-fs-title);
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.15;
}

.page-subtitle {
  font-size: var(--rb-fs-body);
  color: var(--text-secondary);
  margin: 6px 0 0;
}

.header-actions {
  display: flex;
  align-items: center;
  position: relative;
  flex-shrink: 0;
}

.icon-btn__dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--accent);
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  z-index: 2;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 20px;
  border-radius: 12px;
  font-size: var(--rb-fs-small);
  font-weight: 700;
  color: white;
  background: var(--primary);
  transition: background-color 0.15s ease;
  border: none;
  cursor: pointer;
  text-decoration: none;
}

.btn-primary:hover {
  background: var(--rb-primary-hover);
}

.btn-primary--sm {
  padding: 9px 18px;
  font-size: var(--rb-fs-caption);
  border-radius: 10px;
}

/* Secondary action: outlined in the theme colour. */
.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  padding: 0 18px;
  border-radius: 999px;
  border: 1px solid rgba(var(--rb-primary-rgb), 0.4);
  background: transparent;
  color: var(--rb-primary-text);
  font-size: var(--rb-fs-small);
  font-weight: 700;
  text-decoration: none;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.btn-outline:hover { background: rgba(var(--rb-primary-rgb), 0.07); border-color: var(--rb-primary); }
.btn-outline:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.btn-outline--block { display: flex; width: 100%; }

.btn-danger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  font-size: var(--rb-fs-small);
  font-weight: 700;
  padding: 12px;
  border-radius: 10px;
  background: var(--accent);
  color: white;
  text-decoration: none;
  transition: background-color 0.15s ease;
}

.btn-danger:hover {
  background: #b71c1c;
}

/* Custom Banners */
.banner {
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 14px;
  padding: 12px 18px;
  position: relative;
  overflow: hidden;
}

.banner--success {
  background: rgba(46, 125, 50, 0.06);
  border: 1px solid rgba(46, 125, 50, 0.22);
  color: var(--success);
}

.banner--warning {
  background: rgba(245, 124, 0, 0.07);
  border: 1px solid rgba(245, 124, 0, 0.22);
  color: #B45309;
}

.banner-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  flex-shrink: 0;
}

.banner--success .banner-icon-wrapper { background: rgba(46, 125, 50, 0.12); }
.banner--warning .banner-icon-wrapper { background: rgba(245, 124, 0, 0.12); }

.banner-icon { color: currentColor; flex-shrink: 0; display: block; }
.banner-text { font-size: var(--rb-fs-small); font-weight: 400; line-height: 1.55; margin: 0; color: #475569; }

.banner-link {
  margin-left: auto;
  font-size: var(--rb-fs-small);
  font-weight: 600;
  text-decoration: none;
  color: currentColor;
  flex-shrink: 0;
  transition: opacity 0.15s ease;
}

.banner-link:hover { opacity: 0.8; text-decoration: underline; }

.banner-link--button {
  padding: 0;
  border: 0;
  background: none;
  font-family: inherit;
  cursor: pointer;
}
.banner-link--button:disabled { opacity: 0.6; cursor: default; text-decoration: none; }
.banner-link:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; border-radius: 4px; }

.banner-error { display: block; margin-top: 2px; font-weight: 600; color: #B42318; }

@media (max-width: 560px) {
  .banner { flex-wrap: wrap; }
  .banner-link { margin-left: 40px; }
}

/*
 * Onboarding card — deliberately neutral (same surface/border/shadow as
 * .stat-card and .panel) rather than a solid brand-color block. Color here
 * is now reserved for the progress ring fill and the "done" checkmarks, so
 * it reads as one signal instead of competing with the rest of the page.
 */
.onboarding-card {
  position: relative;
  overflow: hidden;
  background: var(--card-bg);
  border-radius: 18px;
  border: 1px solid var(--border);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  padding: 22px 24px;
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.onboarding-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.onboarding-card__title { font-size: var(--rb-fs-section); font-weight: 800; margin: 0; color: var(--text-primary); }
.onboarding-card__subtitle { font-size: var(--rb-fs-small); color: var(--text-secondary); margin: 4px 0 0; }

.onboarding-card__progress-ring {
  position: relative;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
}

.progress-ring__svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.progress-ring__bg { fill: none; stroke: var(--border); stroke-width: 3.5; }
.progress-ring__fill {
  fill: none;
  stroke: var(--primary);
  stroke-width: 3.5;
  stroke-linecap: round;
  transition: stroke-dasharray 0.5s ease;
}

.progress-ring__label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--rb-fs-caption);
  font-weight: 800;
  color: var(--text-primary);
}

.onboarding-steps {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}
@media (max-width: 1180px) {
  .onboarding-steps { grid-template-columns: 1fr; }
}

.onboarding-step {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--rb-surface-hover, #f8fafc);
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-size: var(--rb-fs-small);
  font-weight: 600;
  text-decoration: none;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.onboarding-step:not(.onboarding-step--disabled):hover {
  background: rgba(var(--rb-primary-rgb), 0.06);
  border-color: rgba(var(--rb-primary-rgb), 0.28);
}

.onboarding-step--done {
  opacity: 0.65;
  background: transparent;
}

/* The next thing to do: theme-tinted, with a "Next" tag. */
.onboarding-step--next {
  background: rgba(var(--rb-primary-rgb), 0.07);
  border-color: rgba(var(--rb-primary-rgb), 0.35);
  color: var(--rb-primary-text);
}
.onboarding-step--next .onboarding-step__check {
  background: var(--rb-primary);
  border-color: var(--rb-primary);
  color: #fff;
}
.onboarding-step__next {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--rb-primary);
  color: #fff;
  font-size: var(--rb-fs-caption);
  font-weight: 700;
}

.onboarding-step__check {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1.5px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: var(--rb-fs-caption);
  font-weight: 800;
  color: var(--text-secondary);
}

.onboarding-step--done .onboarding-step__check {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.onboarding-step__label { flex: 1; white-space: normal; word-break: break-word; }
.onboarding-step__arrow { flex-shrink: 0; opacity: 0.8; }

/* Stat Cards */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-card {
  background: var(--card-bg);
  border-radius: 18px;
  padding: 18px 20px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
  transition: border-color 0.15s ease;
}

.stat-card:hover {
  border-color: var(--rb-border-hover, #e2e8f0);
}

.stat-card--emphasized {
  border-color: rgba(245, 124, 0, 0.5);
}

.stat-card__top { display: flex; align-items: center; justify-content: space-between; }
.stat-card__label {
  font-size: var(--rb-fs-caption);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  margin: 0;
}

.stat-card__badge {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-card__badge--primary { background: rgba(var(--rb-primary-rgb), 0.08); color: var(--primary); }
.stat-card__badge--secondary { background: color-mix(in srgb, var(--rb-primary-text) 10%, transparent); color: #0288d1; }
.stat-card__badge--accent { background: rgba(211, 47, 47, 0.08); color: var(--accent); }
.stat-card__badge--success { background: rgba(46, 125, 50, 0.08); color: var(--success); }
.stat-card__badge--warning { background: rgba(245, 124, 0, 0.08); color: var(--warning); }

.stat-card__value-group { display: flex; align-items: baseline; gap: 8px; }
.stat-card__value {
  font-size: 28px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
  line-height: 1;
  letter-spacing: -0.03em;
}

.blood-type-tag {
  font-size: var(--rb-fs-caption);
  font-weight: 800;
  text-transform: uppercase;
  padding: 3px 7px;
  border-radius: 6px;
  background: #f1f5f9;
  color: var(--text-secondary);
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  max-width: 100%;
  font-size: var(--rb-fs-caption);
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
}

.stat-chip--neutral { background: #f1f5f9; color: var(--text-secondary); }
.stat-chip--success { background: rgba(46, 125, 50, 0.1); color: var(--success); }
.stat-chip--warning { background: rgba(245, 124, 0, 0.1); color: var(--warning); }

.truncate-chip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Layout Structure */
.main-grid {
  display: grid;
  /* minmax(0, …), not bare fr: a bare fr track never shrinks below its
     content, so the 12-column trend chart widened the whole page on phones
     and the area past the viewport showed through as a strip on the right. */
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  gap: 22px;
}

.col-left, .col-right { display: flex; flex-direction: column; gap: 22px; }

/* Panels */
.panel {
  background: var(--card-bg);
  border-radius: 18px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  border: 1px solid var(--border);
  overflow: hidden;
  transition: border-color 0.15s ease;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border);
}

.panel-header--simple { padding: 18px 22px; }

.panel-title {
  font-weight: 800;
  font-size: var(--rb-fs-section);
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.01em;
}

.panel-subtitle { font-size: var(--rb-fs-caption); color: var(--text-secondary); margin: 3px 0 0; }

.period-pill {
  font-size: var(--rb-fs-caption);
  font-weight: 800;
  color: var(--primary);
  background: rgba(var(--rb-primary-rgb), 0.08);
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid rgba(var(--rb-primary-rgb), 0.12);
  white-space: nowrap;
  flex-shrink: 0;
}

.panel-link, .panel-link-plain {
  font-size: var(--rb-fs-caption);
  font-weight: 800;
  color: var(--primary);
  display: flex;
  align-items: center;
  gap: 4px;
  text-decoration: none;
  transition: color 0.15s ease;
}

.panel-link:hover, .panel-link-plain:hover { color: var(--rb-primary-hover); text-decoration: underline; }

/* Chart */
.trend-chart { padding: 22px 22px 24px; }
.chart { display: flex; gap: 14px; height: 165px; }

.chart__yaxis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-size: var(--rb-fs-caption);
  font-weight: 700;
  color: var(--text-secondary);
  padding-bottom: 24px;
  text-align: right;
  width: 20px;
}

.chart__plot { flex: 1; min-width: 0; display: flex; align-items: flex-end; gap: 8px; }

.chart__col {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  cursor: pointer;
  outline: none;
  padding: 0 2px;
}

.chart__tooltip {
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
  background: #0f172a;
  border-radius: 6px;
  padding: 4px 9px;
  font-size: var(--rb-fs-caption);
  font-weight: 700;
  color: white;
  white-space: nowrap;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.chart__track {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(241, 245, 249, 0.8);
  border-radius: 8px;
  padding: 3px;
  transition: background 0.2s ease;
}

.chart__col:hover .chart__track { background: rgba(226, 232, 240, 0.9); }

.chart__bar {
  width: 100%;
  max-width: 16px;
  border-radius: 6px;
  background: #cbd5e1;
  transition: height 0.4s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s ease;
}

.chart__bar--current {
  background: var(--primary);
}

.chart__bar--low { background: var(--warning); }
.chart__bar--empty { background: transparent; }

.chart__label { margin-top: 8px; font-size: var(--rb-fs-caption); font-weight: 700; color: var(--text-secondary); }
.chart__label--current { color: var(--primary); font-weight: 800; }

.trend-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  color: var(--text-secondary);
  font-size: var(--rb-fs-small);
  font-weight: 600;
}

.trend-empty__icon, .empty-state__icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
}

/* Donation Activity List */
.donation-list { display: flex; flex-direction: column; }

.donation-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 22px;
  border-bottom: 1px solid var(--border);
  transition: background 0.15s ease;
}

.donation-item:last-child { border-bottom: none; }
.donation-item:hover { background: rgba(248, 250, 252, 0.85); }

.donation-item__left { display: flex; align-items: center; gap: 14px; }

.donation-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.donation-icon--success { background: rgba(46, 125, 50, 0.08); color: var(--success); }
.donation-icon--warning { background: rgba(245, 124, 0, 0.08); color: var(--warning); }

.donation-title { font-size: var(--rb-fs-body); font-weight: 800; color: var(--text-primary); margin: 0; }
.donation-meta { font-size: var(--rb-fs-caption); color: var(--text-secondary); margin: 3px 0 0; }
.donation-meta__highlight { color: var(--text-primary); font-weight: 800; }
.donation-item__right { text-align: right; flex-shrink: 0; }
.donation-date { font-size: var(--rb-fs-caption); font-weight: 700; color: var(--text-secondary); margin: 0; }

.badge {
  font-size: var(--rb-fs-caption);
  font-weight: 800;
  padding: 3px 9px;
  border-radius: 999px;
  display: inline-block;
  margin-top: 4px;
}

.badge--success { background: rgba(46, 125, 50, 0.1); color: var(--success); }
.badge--warning { background: rgba(245, 124, 0, 0.1); color: var(--warning); }
.capitalize { text-transform: capitalize; }

.empty-state {
  padding: 36px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: var(--text-secondary);
  font-size: var(--rb-fs-small);
}

/* Appointment Widget Details */
.appt-body { padding: 22px; }
.appt-row { display: flex; align-items: center; gap: 16px; }

.appt-date-chip {
  width: 58px;
  height: 58px;
  border-radius: 12px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--primary);
}

.appt-date-chip__day { color: white; font-weight: 800; font-size: 22px; line-height: 1; }
.appt-date-chip__month { color: rgba(255, 255, 255, 0.85); font-size: var(--rb-fs-caption); text-transform: uppercase; font-weight: 800; margin-top: 2px; }

.appt-info { flex: 1; min-width: 0; }
.appt-type { font-weight: 800; font-size: var(--rb-fs-body); margin: 0; color: var(--text-primary); }

.appt-meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
  font-size: var(--rb-fs-caption);
  color: var(--text-secondary);
}

.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.appt-notice {
  margin-top: 18px;
  border-radius: 12px;
  padding: 10px 14px;
  font-size: var(--rb-fs-caption);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(var(--rb-primary-rgb), 0.05);
  color: var(--primary);
  border: 1px dashed rgba(var(--rb-primary-rgb), 0.25);
}

/* Eligibility Body */
.eligibility-body { padding: 22px; }

.eligibility-status-row {
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 14px;
  padding: 14px;
  margin-bottom: 18px;
}

.eligibility-status-row--eligible {
  background: rgba(46, 125, 50, 0.06);
  color: var(--success);
  border: 1px solid rgba(46, 125, 50, 0.18);
}

.eligibility-status-row--deferred {
  background: rgba(211, 47, 47, 0.06);
  color: var(--accent);
  border: 1px solid rgba(211, 47, 47, 0.18);
}

.eligibility-status-row--pending {
  background: rgba(245, 124, 0, 0.06);
  color: var(--warning);
  border: 1px solid rgba(245, 124, 0, 0.18);
}

.eligibility-status { font-size: var(--rb-fs-body); font-weight: 800; margin: 0; }
.eligibility-until { font-size: var(--rb-fs-caption); opacity: 0.85; margin: 2px 0 0; }

.eligibility-details {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: var(--rb-fs-small);
  margin-bottom: 18px;
  padding: 0 4px;
}

.eligibility-details__row { display: flex; justify-content: space-between; align-items: center; }
.eligibility-details__label { color: var(--text-secondary); font-weight: 600; }
.eligibility-details__value { font-weight: 800; color: var(--text-primary); }

/* Quick Actions List */
.quick-actions { padding: 10px; display: flex; flex-direction: column; gap: 4px; }

.quick-action {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  border-radius: 12px;
  text-decoration: none;
  transition: background-color 0.15s ease;
}

.quick-action:hover { background: #f1f5f9; }

.quick-action__icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(15, 23, 42, 0.04);
  color: var(--qa-color, var(--primary));
}

.quick-action__label { font-size: var(--rb-fs-small); font-weight: 700; color: var(--text-primary); flex: 1; }
.quick-action__chevron { color: #cbd5e1; transition: color 0.15s ease; }
.quick-action:hover .quick-action__chevron { color: var(--primary); }

.quick-actions { padding: 10px; display: flex; flex-direction: column; gap: 4px; }

.quick-action {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  border-radius: 12px;
  text-decoration: none;
  transition: background-color 0.15s ease;
}

.quick-action:hover { background: #f1f5f9; }
.quick-action:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

.quick-action__icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--qa-color) 10%, transparent);
  color: var(--qa-color, var(--rb-primary));
}

.quick-action__label { font-size: var(--rb-fs-small); font-weight: 700; color: var(--text-primary); flex: 1; }
.quick-action__chevron { color: #cbd5e1; transition: color 0.15s ease; }
.quick-action:hover .quick-action__chevron { color: var(--rb-primary); }

:global(.dark .dashboard .quick-action:hover) { background: #263449; }
:global(.dark .dashboard .quick-action__icon) { background: color-mix(in srgb, var(--qa-color) 18%, transparent); }

/* "View QR" on the hero's glass card */
.hero__qr-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.75);
  color: var(--rb-primary-text);
  font-size: var(--rb-fs-small);
  font-weight: 700;
  text-decoration: none;
  transition: background-color 0.15s ease;
}
.hero__qr-link:hover { background: #fff; }
.hero__qr-link:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
:global(.dark .dashboard .hero__qr-link) { background: rgba(15, 23, 42, 0.45); }

/* Responsive Overrides */
@media (max-width: 1024px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .main-grid { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 640px) {
  .dashboard {
    padding: 16px 16px 36px;
  }

  .header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .header-titles {
    flex: 1;
    min-width: 0;
  }

  .header-actions {
    padding-right: 4px; /* Safety distance para sa red dot */
    margin-top: 2px;
  }

  /* Compact button icon style sa mobile */
  .btn-primary {
    padding: 10px;
    border-radius: 12px;
  }

  /* I-hide ang button text sa mobile */
  .btn-primary .btn-text {
    display: none;
  }

  .page-title {
    font-size: var(--rb-fs-title);
  }

  .page-subtitle {
    font-size: var(--rb-fs-small);
  }

  .onboarding-card {
    padding: 18px 20px;
  }

.onboarding-card__header {
    flex-direction: row; 
    align-items: center; 
    justify-content: space-between; 
    gap: 12px;
  }

  .onboarding-steps {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .skeleton--card { height: 96px; }

  /* Twelve month columns have to fit a phone-width card once the grid lets
     them shrink, so tighten only the chart's own gutters and labels here. */
  .chart { gap: 8px; }
  .chart__plot { gap: 3px; }
  .chart__col { min-width: 0; padding: 0; }
  .chart__label { font-size: var(--rb-fs-caption); }

  /* 2x2 nga gagmay nga cards imbes upat ka taas nga card */
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .stat-card {
    padding: 12px 12px 12px 14px;
    gap: 6px;
    border-radius: 12px;
  }

  .stat-card__top { gap: 6px; }

  /* Wraps to a second line rather than cutting the word off. */
  .stat-card__label {
    min-width: 0;
    font-size: var(--rb-fs-caption);
    letter-spacing: 0.03em;
    line-height: 1.3;
  }

  .stat-card__badge {
    width: 26px;
    height: 26px;
    border-radius: 8px;
  }

  .stat-card__value { font-size: 21px; }

  .stat-card__value-group { gap: 6px; }

  .blood-type-tag {
    font-size: var(--rb-fs-caption);
    padding: 2px 5px;
  }

  .stat-chip {
    max-width: 100%;
    font-size: var(--rb-fs-caption);
    padding: 2px 8px;
    line-height: 1.35;
    white-space: normal;
  }
}

/* High-Contrast Dark Mode Enhancements */
:global(.dark .scope-donor-dashboard) {
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --border: #334155;
  --card-bg: #1e293b;
  background: #0f172a;
}

:global(.dark .scope-donor-dashboard .panel-header) {
  background: #1e293b;
}

:global(.dark .scope-donor-dashboard .stat-card) { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25); }
:global(.dark .scope-donor-dashboard .stat-card:hover) { border-color: #475569; }

:global(.dark .scope-donor-dashboard .banner--success) {
  background: rgba(76, 175, 80, 0.10);
  border-color: rgba(76, 175, 80, 0.24);
  color: #81c784;
}

:global(.dark .scope-donor-dashboard .banner--success .banner-text) { color: #CBD5E1; }
:global(.dark .scope-donor-dashboard .banner--success .banner-link) { color: #81c784; }

:global(.dark .scope-donor-dashboard .banner--warning) { color: #FFB74D; }
:global(.dark .scope-donor-dashboard .banner--warning .banner-text) { color: #CBD5E1; }
:global(.dark .scope-donor-dashboard .banner-error) { color: #F97066; }
:global(.dark .scope-donor-dashboard .text-success) { color: #4caf50 !important; }

:global(.dark .scope-donor-dashboard .stat-chip--success) {
  background: rgba(76, 175, 80, 0.2);
  color: #81c784;
}

:global(.dark .scope-donor-dashboard .stat-chip--neutral),
:global(.dark .scope-donor-dashboard .blood-type-tag),
:global(.dark .scope-donor-dashboard .trend-empty__icon),
:global(.dark .scope-donor-dashboard .empty-state__icon) {
  background: #334155;
  color: #94a3b8;
}

:global(.dark .scope-donor-dashboard .chart__track) { background: rgba(15, 23, 42, 0.6); }
:global(.dark .scope-donor-dashboard .chart__col:hover .chart__track) { background: rgba(51, 65, 85, 0.8); }
:global(.dark .scope-donor-dashboard .chart__bar) { background: #475569; }
:global(.dark .scope-donor-dashboard .donation-item:hover) { background: rgba(51, 65, 85, 0.3); }
:global(.dark .scope-donor-dashboard .quick-action:hover) { background: #334155; }
:global(.dark .scope-donor-dashboard .quick-action__icon) { background: rgba(255, 255, 255, 0.05); }
/* background-image, not the `background` shorthand: the shorthand resets
   background-size to `auto`, which collapses the 400%-wide gradient to the
   element width and leaves the shimmer keyframes with zero travel. */
:global(.dark .scope-donor-dashboard .skeleton) { background-image: linear-gradient(90deg, #1e293b 25%, #334155 37%, #1e293b 63%); }

.btn-primary:focus-visible,
.btn-danger:focus-visible {
  outline: 2px solid var(--rb-primary);
  outline-offset: 2px;
}
</style>