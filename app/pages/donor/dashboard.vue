<template>
  <div class="dashboard scope-donor-dashboard fyp-dashboard" :style="isDark ? { backgroundColor: '#0F172A' } : undefined">
    <div v-if="loading" class="dashboard-inner fyp-inner" aria-busy="true" aria-label="Loading your feed">
      <div class="skeleton skeleton--header" />
      <div class="fyp-skeleton-post skeleton" />
      <div class="fyp-skeleton-post skeleton" />
    </div>
    <div v-else class="dashboard-inner fyp-inner">
      <header class="fyp-header">
        <div>
          <p class="fyp-eyebrow">{{ todayLabel }} · {{ bloodType !== '-' ? `Type ${bloodType}` : 'Blood donor community' }}</p>
          <h1>For you<span>.</span></h1>
          <p class="fyp-subtitle">Stories, nearby drives, and ways to make a difference.</p>
        </div>
        <NuxtLink :to="nextStep.to" class="fyp-header-cta">
          <AssetIcon :name="nextStep.icon" :size="17" /> {{ nextStep.label }}
        </NuxtLink>
      </header>

      <nav class="fyp-tabs" aria-label="Feed categories">
        <span class="fyp-tab fyp-tab--active">For you</span>
        <NuxtLink to="/donor/appointments" class="fyp-tab">Blood drives</NuxtLink>
        <NuxtLink to="/donor/history" class="fyp-tab">My impact</NuxtLink>
      </nav>

      <div class="fyp-layout">
        <main class="fyp-feed" aria-label="For you feed">
          <article class="fyp-post fyp-feature-post">
            <div class="fyp-post-meta">
              <span class="fyp-avatar fyp-avatar--brand"><AssetIcon name="heart" :size="18" /></span>
              <div><strong>RedAgos Community</strong><span> · A little good goes a long way</span></div>
              <span class="fyp-badge">YOUR IMPACT</span>
            </div>
            <div class="fyp-impact-art"><span class="fyp-art-drop"><AssetIcon name="blood-drop" :size="42" /></span><span class="fyp-art-heart">♥</span></div>
            <div class="fyp-post-copy">
              <h2>{{ totalDonations ? 'You showed up. That matters.' : 'Your first donation can change everything.' }}</h2>
              <p>{{ totalDonations ? `You’ve donated ${totalDonations} ${totalDonations === 1 ? 'time' : 'times'}—each whole blood donation may help up to three people.` : 'One donation can help up to three people. Take the first step when you’re ready.' }}</p>
              <div class="fyp-post-actions"><span><AssetIcon name="heart" :size="16" /> {{ totalDonations * 3 }} lives potentially helped</span><NuxtLink to="/donor/history">See your journey <AssetIcon name="arrow-right" :size="14" /></NuxtLink></div>
            </div>
          </article>

          <section class="fyp-section-heading"><div><h2>Happening near you</h2><p>Upcoming blood drives from our centers</p></div><NuxtLink to="/donor/appointments">See all <AssetIcon name="arrow-right" :size="14" /></NuxtLink></section>
          <article v-for="drive in featuredDrives" :key="drive.id" class="fyp-post fyp-drive-post">
            <div class="fyp-post-meta">
              <span class="fyp-avatar"><AssetIcon name="map-pin" :size="17" /></span>
              <div><strong>{{ drive.facility_name || drive.organizer || 'Blood center' }}</strong><span> · Community blood drive</span></div>
            </div>
            <div class="fyp-drive-art"><div class="fyp-drive-art__label"><AssetIcon name="calendar" :size="15" /> UPCOMING DRIVE</div><div class="fyp-drive-art__title">{{ drive.name }}</div><div class="fyp-drive-art__date">{{ formatDate(drive.date || drive.event_date, 'MMM D, YYYY') }}</div></div>
            <div class="fyp-post-copy">
              <p class="fyp-drive-location"><AssetIcon name="map-pin" :size="15" /> {{ drive.location || drive.address || 'Location details available when booking' }}</p>
              <div class="fyp-post-actions"><span class="fyp-open-pill">{{ drive.status || 'Open' }}<template v-if="drive.total_slots"> · {{ Math.max(drive.total_slots - (drive.registered || 0), 0) }} spots left</template></span><NuxtLink to="/donor/appointments">Find a spot <AssetIcon name="arrow-right" :size="14" /></NuxtLink></div>
            </div>
          </article>
          <div v-if="!featuredDrives.length" class="fyp-post fyp-empty-drives"><span class="fyp-avatar"><AssetIcon name="calendar" :size="18" /></span><div><strong>No upcoming drives posted yet</strong><p>Check back soon, or book at a blood center.</p></div><NuxtLink to="/donor/appointments">Browse centers <AssetIcon name="arrow-right" :size="14" /></NuxtLink></div>

          <article v-if="recentDonations.length" class="fyp-post fyp-recent-post">
            <div class="fyp-post-meta"><span class="fyp-avatar fyp-avatar--soft"><AssetIcon name="history" :size="17" /></span><div><strong>Your donor story</strong><span> · {{ formatDate(recentDonations[0].donation_date, 'MMM D, YYYY') }}</span></div></div>
            <div class="fyp-post-copy"><h2>{{ recentDonations[0].status === 'completed' ? 'A moment worth remembering ❤️' : 'Your donation activity' }}</h2><p>{{ recentDonations[0].status === 'completed' ? `You donated at ${recentDonations[0].facility_name || 'your blood center'}. Thank you for being there for someone.` : `Your latest donation is ${recentDonations[0].status}. View your full donation history for details.` }}</p><div class="fyp-post-actions"><span><AssetIcon name="blood-drop" :size="15" /> {{ recentDonations[0].blood_type || bloodType }}</span><NuxtLink to="/donor/history">Donation history <AssetIcon name="arrow-right" :size="14" /></NuxtLink></div></div>
          </article>
        </main>

        <aside class="fyp-sidebar">
          <section class="fyp-side-card fyp-next-card"><span class="fyp-side-kicker">YOUR NEXT STEP</span><h2>{{ nextStep.status }}</h2><NuxtLink :to="nextStep.to" class="fyp-side-button"><AssetIcon :name="nextStep.icon" :size="16" /> {{ nextStep.label }}</NuxtLink></section>
          <section class="fyp-side-card"><h2>Your donor profile</h2><div class="fyp-profile-row"><span class="fyp-profile-blood">{{ bloodType }}</span><div><strong>Blood type</strong><span>{{ bloodType === '-' ? 'Add to your profile' : 'In your profile' }}</span></div><NuxtLink to="/donor/profile" aria-label="Edit profile"><AssetIcon name="chevron-right" :size="16" /></NuxtLink></div><div class="fyp-profile-row"><span class="fyp-profile-icon"><AssetIcon :name="screeningDone ? 'shield-check' : 'clock'" :size="17" /></span><div><strong>Eligibility screening</strong><span>{{ QUESTIONNAIRE_LABELS[questionnaireStatus] ?? 'Not yet answered' }}</span></div><NuxtLink to="/donor/eligibility" aria-label="View eligibility"><AssetIcon name="chevron-right" :size="16" /></NuxtLink></div></section>
          <section class="fyp-side-card fyp-links-card"><h2>Keep in touch</h2><NuxtLink to="/donor/appointments"><AssetIcon name="calendar" :size="16" /> Book an appointment <AssetIcon name="chevron-right" :size="15" /></NuxtLink><NuxtLink to="/donor/qrcode"><AssetIcon name="qr-code" :size="16" /> Your donor QR <AssetIcon name="chevron-right" :size="15" /></NuxtLink><NuxtLink to="/donor/help"><AssetIcon name="help-circle" :size="16" /> Donor help <AssetIcon name="chevron-right" :size="15" /></NuxtLink></section>
        </aside>
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
import { bookingCatalogService } from '~/api/booking-catalog/BookingCatalogService'
import { useUser } from '~/composables/useUser'
import { useAccentTheme } from '~/composables/useAccentTheme'
import { useDarkMode } from '~/composables/useDarkMode'
import { accentTheme } from '~/utils/accentThemes'

const route = useRoute()

const loading = ref(true)

// ── Hero ──
const { user } = useUser()
const { isDark } = useDarkMode()
const { current: accentKey } = useAccentTheme()
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
const bloodDrives = ref([])
const featuredDrives = computed(() => bloodDrives.value.slice(0, 4))
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
    const [data, drives] = await Promise.all([
      donorService.dashboard(),
      bookingCatalogService.bloodDrives().catch((err) => {
        console.error('Failed to load donor feed blood drives:', err)
        return []
      }),
    ])
    if (request !== latestRequest) return
    bloodDrives.value = Array.isArray(drives) ? drives : []
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
  max-width: none;
  min-height: calc(100vh - 4rem);
}
:global(html.dark) .fyp-dashboard {
  max-width: none;
  min-height: calc(100vh - 4rem);
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

/* Donor FYP feed */
.fyp-dashboard { max-width: none; }
.fyp-inner { gap: 20px; max-width: 1160px; margin: 0 auto; }
.fyp-skeleton-post { min-height: 260px; border-radius: 18px; }
.fyp-header { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 12px 2px 4px; }
.fyp-eyebrow { color: var(--rb-primary); font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; margin: 0 0 8px; }
.fyp-header h1 { color: var(--text-primary); font-size: clamp(30px, 4vw, 42px); line-height: 1.05; letter-spacing: -.04em; margin: 0; font-weight: 850; }
.fyp-header h1 span { color: var(--rb-primary); }
.fyp-subtitle { color: var(--text-secondary); margin: 8px 0 0; font-size: 15px; }
.fyp-header-cta,.fyp-side-button { display: inline-flex; align-items: center; justify-content: center; gap: 9px; border-radius: 999px; padding: 12px 18px; background: var(--rb-primary); color: white; text-decoration: none; font-weight: 800; font-size: 13px; box-shadow: 0 8px 20px rgba(var(--rb-primary-rgb),.2); }
.fyp-header-cta:hover,.fyp-side-button:hover { filter: brightness(.95); }
.fyp-tabs { display: flex; align-items: center; gap: 28px; border-bottom: 1px solid var(--border); }
.fyp-tab { color: var(--text-secondary); text-decoration: none; padding: 12px 2px 13px; font-size: 14px; font-weight: 750; border-bottom: 2px solid transparent; }
.fyp-tab--active { color: var(--rb-primary); border-color: var(--rb-primary); }
.fyp-layout { display: grid; grid-template-columns: minmax(0, 1fr) 310px; gap: 24px; align-items: start; }
.fyp-feed { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
.fyp-post,.fyp-side-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 18px; overflow: hidden; box-shadow: 0 5px 22px rgba(15,23,42,.035); }
.fyp-post-meta { min-height: 64px; display: flex; align-items: center; gap: 11px; padding: 13px 18px; color: var(--text-secondary); font-size: 12px; }
.fyp-post-meta strong { color: var(--text-primary); font-size: 13px; }
.fyp-post-meta > div { flex: 1; min-width: 0; }
.fyp-avatar { width: 38px; height: 38px; flex: 0 0 38px; display: grid; place-items: center; border-radius: 50%; color: var(--rb-primary); background: color-mix(in srgb,var(--rb-primary) 10%,white); }
.fyp-avatar--brand { color: white; background: linear-gradient(145deg,#ed5656,#a90e31); }
.fyp-avatar--soft { color: #16855b; background: #e7f7ef; }
.fyp-badge { color: var(--rb-primary); font-size: 10px; font-weight: 850; letter-spacing: .08em; }
.fyp-impact-art { min-height: 190px; display: grid; place-items: center; position: relative; overflow: hidden; background: radial-gradient(circle at 52% 55%,#fff 0,#ffe8eb 33%,#f6bac5 100%); }
.fyp-impact-art::before,.fyp-impact-art::after { content: ''; position: absolute; border: 1px solid rgba(173,20,55,.12); border-radius: 50%; width: 230px; height: 230px; }
.fyp-impact-art::after { width: 310px; height: 310px; }
.fyp-art-drop { z-index: 1; display: grid; place-items: center; width: 90px; height: 90px; border-radius: 28px 28px 32px 32px; color: white; background: linear-gradient(145deg,#df3452,#a20f35); transform: rotate(-8deg); box-shadow: 0 15px 35px rgba(142,12,43,.25); }
.fyp-art-heart { position: absolute; z-index: 2; left: calc(50% + 24px); top: calc(50% + 23px); color: #fff; font-size: 28px; text-shadow: 0 2px 8px rgba(100,0,30,.35); }
.fyp-post-copy { padding: 17px 19px 16px; }
.fyp-post-copy h2 { color: var(--text-primary); font-size: 18px; margin: 0 0 6px; letter-spacing: -.02em; }
.fyp-post-copy p { color: var(--text-secondary); font-size: 13px; line-height: 1.55; margin: 0; }
.fyp-post-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid var(--border); margin-top: 15px; padding-top: 13px; color: var(--text-secondary); font-size: 12px; font-weight: 750; }
.fyp-post-actions > span,.fyp-post-actions > a,.fyp-section-heading > a { display: inline-flex; align-items: center; gap: 7px; }
.fyp-post-actions > a,.fyp-section-heading > a { color: var(--rb-primary); text-decoration: none; font-weight: 800; white-space: nowrap; }
.fyp-section-heading { display: flex; align-items: end; justify-content: space-between; gap: 12px; padding: 8px 2px 0; }
.fyp-section-heading h2 { color: var(--text-primary); font-size: 20px; letter-spacing: -.02em; margin: 0; }
.fyp-section-heading p { color: var(--text-secondary); font-size: 12px; margin: 4px 0 0; }
.fyp-section-heading > a { font-size: 12px; }
.fyp-drive-art { min-height: 166px; padding: 20px 22px; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 8px; color: white; background: radial-gradient(ellipse at 88% 5%,rgba(255,255,255,.26),transparent 37%), linear-gradient(120deg,#99223e,#da5263 58%,#f08982); }
.fyp-drive-post:nth-of-type(odd) .fyp-drive-art { background: radial-gradient(ellipse at 88% 5%,rgba(255,255,255,.28),transparent 38%), linear-gradient(120deg,#6c315b,#a54672 60%,#db8a8b); }
.fyp-drive-art__label { display: inline-flex; align-items: center; gap: 7px; font-size: 10px; font-weight: 850; letter-spacing: .1em; opacity: .9; }
.fyp-drive-art__title { font-size: clamp(20px,3vw,26px); line-height: 1.1; font-weight: 850; letter-spacing: -.03em; max-width: 80%; }
.fyp-drive-art__date { font-size: 13px; font-weight: 700; opacity: .92; }
.fyp-drive-location { display: flex; align-items: center; gap: 8px; margin: 0 !important; color: var(--text-primary) !important; }
.fyp-open-pill { color: #16855b; background: #e7f7ef; border-radius: 999px; padding: 6px 10px; }
.fyp-empty-drives { min-height: 100px; padding: 18px; display: flex; align-items: center; gap: 12px; }
.fyp-empty-drives > div { flex: 1; }
.fyp-empty-drives strong { color: var(--text-primary); font-size: 13px; }
.fyp-empty-drives p { color: var(--text-secondary); font-size: 12px; margin: 4px 0 0; }
.fyp-empty-drives > a { display: inline-flex; align-items: center; gap: 6px; color: var(--rb-primary); font-size: 12px; font-weight: 800; text-decoration: none; white-space: nowrap; }
.fyp-recent-post .fyp-post-copy { padding-top: 4px; }
.fyp-sidebar { display: flex; flex-direction: column; gap: 14px; }
.fyp-side-card { padding: 18px; }
.fyp-side-card h2 { color: var(--text-primary); font-size: 15px; margin: 0 0 14px; }
.fyp-next-card { color: white; background: linear-gradient(145deg,#92213e,#ce4458); border: 0; }
.fyp-side-kicker { font-size: 10px; letter-spacing: .1em; font-weight: 850; color: rgba(255,255,255,.76); }
.fyp-next-card h2 { color: white; font-size: 17px; line-height: 1.35; margin: 9px 0 16px; }
.fyp-next-card .fyp-side-button { background: white; color: #a01c39; box-shadow: none; padding: 10px 13px; font-size: 12px; }
.fyp-profile-row { display: flex; align-items: center; gap: 11px; padding: 11px 0; border-top: 1px solid var(--border); }
.fyp-profile-blood,.fyp-profile-icon { width: 36px; height: 36px; border-radius: 11px; display: grid; place-items: center; flex: 0 0 36px; background: color-mix(in srgb,var(--rb-primary) 9%,white); color: var(--rb-primary); font-size: 13px; font-weight: 850; }
.fyp-profile-icon { color: #138658; background: #e7f7ef; }
.fyp-profile-row > div { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.fyp-profile-row strong { color: var(--text-primary); font-size: 12px; }
.fyp-profile-row span:not(.fyp-profile-blood):not(.fyp-profile-icon) { color: var(--text-secondary); font-size: 11px; }
.fyp-profile-row > a { color: var(--text-secondary); }
.fyp-links-card { padding-bottom: 9px; }
.fyp-links-card a { display: flex; align-items: center; gap: 10px; padding: 10px 0; color: var(--text-primary); text-decoration: none; font-size: 12px; font-weight: 700; border-top: 1px solid var(--border); }
.fyp-links-card a svg:last-child { margin-left: auto; color: var(--text-secondary); }
.fyp-links-card a svg:first-child { color: var(--rb-primary); }
:global(.dark .fyp-dashboard) .fyp-impact-art { background: radial-gradient(circle at 52% 55%,#47303a 0,#46232f 40%,#2b1722 100%); }
:global(.dark .fyp-dashboard) .fyp-avatar { background: color-mix(in srgb,var(--rb-primary) 22%,#1e293b); }
:global(.dark .fyp-dashboard) .fyp-avatar--brand { background: linear-gradient(145deg,#ed5656,#a90e31); }
:global(.dark .fyp-dashboard) .fyp-avatar--soft { color: #74d8a7; background: #18372e; }
:global(.dark .fyp-dashboard) .fyp-open-pill { color: #8be0b4; background: #18372e; }
@media (max-width: 900px) { .fyp-layout { grid-template-columns: minmax(0,1fr) 270px; gap: 16px; } }
@media (max-width: 760px) { .fyp-layout { grid-template-columns: 1fr; } .fyp-sidebar { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); } .fyp-next-card { grid-column: 1 / -1; } }
@media (max-width: 560px) {
  .fyp-header { align-items: flex-start; flex-direction: column; }
  .fyp-header-cta { padding: 10px 14px; }
  .fyp-tabs { gap: 21px; }
  .fyp-tab { font-size: 13px; }
  .fyp-sidebar { display: flex; }
  .fyp-impact-art { min-height: 155px; }
  .fyp-drive-art { min-height: 145px; }
  .fyp-post-meta { padding: 12px 14px; }
  .fyp-post-copy { padding: 14px; }
  .fyp-post-actions { align-items: flex-start; font-size: 11px; }
  .fyp-empty-drives { flex-wrap: wrap; }
  .fyp-empty-drives > a { margin-left: 50px; }
}
</style>
