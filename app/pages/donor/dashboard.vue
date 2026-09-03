<template>
  <div class="dashboard">
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
      <!-- Top header row -->
      <div class="header-row fade-in" style="--delay: 0ms">
        <div class="header-titles">
          <h1 class="page-title">Here's your donor overview</h1>
          <p class="page-subtitle">Everything you need to track your journey, all in one place.</p>
        </div>
        <div class="header-actions">
          <span v-if="eligibilityStatus === 'eligible'" class="icon-btn__dot" />
          <NuxtLink to="/donor/appointments" class="btn-primary" aria-label="Book Appointment">
            <AssetIcon name="calendar" :size="16" />
            <span class="btn-text">Book Appointment</span>
          </NuxtLink>
        </div>
      </div>

      <!-- Eligibility banner -->
      <div v-if="eligibilityStatus === 'eligible'" class="banner banner--success fade-in" style="--delay: 60ms">
        <div class="banner-icon-wrapper">
          <AssetIcon name="check-circle" :size="16" class="banner-icon" />
        </div>
        <p class="banner-text">
          Eligibility screening is valid. Present your QR code at the blood center on arrival.
        </p>
        <NuxtLink to="/donor/qrcode" class="banner-link">View QR &rarr;</NuxtLink>
      </div>
      <div v-else-if="eligibilityStatus === 'deferred'" class="banner banner--warning fade-in" style="--delay: 60ms">
        <div class="banner-icon-wrapper">
          <AssetIcon name="alert" :size="16" class="banner-icon" />
        </div>
        <p class="banner-text">
          Your eligibility screening is deferred. Please contact the blood center for more information.
        </p>
        <NuxtLink to="/donor/eligibility" class="banner-link">View Details &rarr;</NuxtLink>
      </div>

      <!-- Onboarding checklist -->
      <div v-if="showOnboarding" class="onboarding-card fade-in" style="--delay: 80ms">
        <div class="onboarding-card__bg-glow" />
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
          <NuxtLink v-for="step in onboardingSteps" :key="step.key" :to="step.done ? undefined : step.path"
            class="onboarding-step" :class="{ 'onboarding-step--done': step.done }">
            <div class="onboarding-step__check">
              <AssetIcon v-if="step.done" name="check" :size="12" />
            </div>
            <span class="onboarding-step__label">{{ step.label }}</span>
            <AssetIcon v-if="!step.done" name="chevron-right" :size="14" class="onboarding-step__arrow" />
          </NuxtLink>
        </div>
      </div>

      <!-- Stat cards -->
      <div class="stats-grid">
        <div class="stat-card fade-in" style="--delay: 100ms">
          <div class="stat-card__top">
            <p class="stat-card__label">Total Donations</p>
            <div class="stat-card__badge stat-card__badge--primary">
              <AssetIcon name="blood-drop" :size="14" />
            </div>
          </div>
          <p class="stat-card__value">{{ totalDonations }}</p>
          <span class="stat-chip stat-chip--neutral">Lifetime</span>
        </div>

        <div class="stat-card stat-card--blood-type fade-in" style="--delay: 150ms">
          <div class="stat-card__top">
            <p class="stat-card__label">Blood Type</p>
            <div class="stat-card__badge stat-card__badge--accent">
              <AssetIcon name="blood-drop" :size="14" />
            </div>
          </div>
          <div class="stat-card__value-group">
            <p class="stat-card__value text-accent">{{ bloodType }}</p>
            <span class="blood-type-tag">Donor</span>
          </div>
          <span class="stat-chip stat-chip--neutral">Your blood group</span>
        </div>

        <div class="stat-card fade-in" :class="{ 'stat-card--emphasized': eligibilityStatus !== 'eligible' }"
          style="--delay: 200ms">
          <div class="stat-card__top">
            <p class="stat-card__label">QR Status</p>
            <div class="stat-card__badge"
              :class="eligibilityStatus === 'eligible' ? 'stat-card__badge--success' : 'stat-card__badge--warning'">
              <AssetIcon name="shield-check" :size="14" />
            </div>
          </div>
          <p class="stat-card__value" :class="eligibilityStatus === 'eligible' ? 'text-success' : 'text-warning'">
            {{ eligibilityStatus === 'eligible' ? 'Valid' : eligibilityStatus === 'deferred' ? 'Deferred' : 'Pending' }}
          </p>
          <span class="stat-chip"
            :class="eligibilityStatus === 'eligible' ? 'stat-chip--success' : 'stat-chip--warning'">
            {{ eligibilityStatus === 'eligible' && profile?.screening_valid_until
              ? `Until ${formatDate(profile.screening_valid_until, 'MMM D, YYYY')}`
              : 'Complete screening' }}
          </span>
        </div>

        <div class="stat-card fade-in" style="--delay: 250ms">
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
          <div class="panel fade-in" style="--delay: 300ms">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">Donation Trend</h2>
                <p class="panel-subtitle">Completed donations over the last 12 months</p>
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
                <p>Not enough data yet to show a trend</p>
              </div>
            </div>
          </div>

          <!-- Recent donation history -->
          <div class="panel fade-in" style="--delay: 350ms">
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
                      <strong class="text-accent">{{ d.blood_type }}</strong> &middot; {{ d.facility_name }} &middot; {{
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
          <div class="panel fade-in" style="--delay: 300ms">
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
              <p class="mb-3">No upcoming appointments</p>
              <NuxtLink to="/donor/appointments" class="btn-primary btn-primary--sm">Book Now</NuxtLink>
            </div>
          </div>

          <!-- Eligibility card -->
          <div class="panel fade-in" style="--delay: 350ms">
            <div class="panel-header panel-header--simple">
              <h2 class="panel-title">Eligibility Status</h2>
            </div>
            <div class="eligibility-body">
              <div class="eligibility-status-row"
                :class="eligibilityStatus === 'eligible' ? 'eligibility-status-row--eligible' : eligibilityStatus === 'deferred' ? 'eligibility-status-row--deferred' : 'eligibility-status-row--pending'">
                <AssetIcon name="shield-check" :size="20" />
                <div>
                  <p class="eligibility-status capitalize">
                    {{ eligibilityStatus }}
                  </p>
                  <p v-if="profile?.screening_valid_until" class="eligibility-until">
                    Valid until {{ formatDate(profile.screening_valid_until, 'MMM D, YYYY') }}
                  </p>
                </div>
              </div>

              <div class="eligibility-details">
                <div v-if="profile?.screening_date" class="eligibility-details__row">
                  <span class="eligibility-details__label">Screening date</span>
                  <span class="eligibility-details__value">{{ formatDate(profile.screening_date, 'MMM D, YYYY')
                  }}</span>
                </div>
                <div class="eligibility-details__row">
                  <span class="eligibility-details__label">Blood type</span>
                  <span class="eligibility-details__value text-accent font-extrabold">{{ bloodType }}</span>
                </div>
              </div>

              <NuxtLink to="/donor/eligibility" class="btn-danger">
                {{ eligibilityStatus === 'eligible' ? 'Retake Screening' : 'Take Screening' }}
              </NuxtLink>
            </div>
          </div>

          <!-- Quick actions -->
          <div class="panel fade-in" style="--delay: 400ms">
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
import { ref, reactive, computed, onMounted, onActivated } from 'vue'
import { donorService } from '~/api/donor/DonorService'

const loading = ref(true)

// Core donor data
const profile = ref(null)
const eligibilityStatus = ref('pending')
const bloodType = ref('-')
const totalDonations = ref(0)
const upcomingAppointment = ref(null)
const recentDonations = ref([])
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
    done: eligibilityStatus.value === 'eligible',
  },
  {
    key: 'appointment',
    label: 'Book your first appointment',
    path: '/donor/appointments',
    done: !!upcomingAppointment.value || totalDonations.value > 0,
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

async function load({ silent = false } = {}) {
  if (!silent) loading.value = true
  try {
    const data = await donorService.dashboard()
    profile.value = data.profile ?? null
    eligibilityStatus.value = data.eligibility_status ?? 'pending'
    bloodType.value = data.blood_type ?? '-'
    totalDonations.value = data.total_donations ?? 0
    upcomingAppointment.value = data.upcoming_appointment ?? null
    recentDonations.value = data.recent_donations ?? []
    monthlyTrend.value = data.monthly_trend ?? []
  } catch (err) {
    console.error('Failed to load donor dashboard data:', err)
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
.dashboard {
  --primary: #1565c0;
  --secondary: #42a5f5;
  --accent: #d32f2f;
  --success: #2e7d32;
  --warning: #f57c00;
  --text-primary: #0f172a;
  --text-secondary: #64748b;
  --border: #e2e8f0;
  --card-bg: #ffffff;

  font-family: 'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  max-width: 1280px;
  background: #f8fafc;
  margin: 0 auto;
  padding: 28px 32px 56px;
  transition: background-color 0.2s ease;
}

.text-primary { color: var(--primary) !important; }
.text-accent { color: var(--accent) !important; }
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
.skeleton--panel { border-radius: 16px; }

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

.fade-in {
  animation: fadeInUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: var(--delay, 0ms);
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .fade-in, .skeleton { animation: none !important; }
}

.dashboard-inner {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

/* Header Section */
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

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

.page-title {
  font-size: 26px;
  font-weight: 900;
  letter-spacing: -0.03em;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.15;
}

.page-subtitle {
  font-size: 13.5px;
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
  font-size: 13px;
  font-weight: 700;
  color: white;
  background: linear-gradient(135deg, var(--primary) 0%, #0d47a1 100%);
  box-shadow: 0 4px 14px rgba(21, 101, 192, 0.3);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  border: none;
  cursor: pointer;
  text-decoration: none;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(21, 101, 192, 0.4);
}

.btn-primary--sm {
  padding: 9px 18px;
  font-size: 12px;
  border-radius: 10px;
}

.btn-danger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  font-size: 13px;
  font-weight: 700;
  padding: 12px;
  border-radius: 11px;
  background: linear-gradient(135deg, var(--accent) 0%, #b71c1c 100%);
  color: white;
  text-decoration: none;
  box-shadow: 0 4px 14px rgba(211, 47, 47, 0.25);
  transition: all 0.2s ease;
}

.btn-danger:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(211, 47, 47, 0.35);
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
  background: rgba(46, 125, 50, 0.05);
  border: 1px solid rgba(46, 125, 50, 0.25);
  color: var(--success);
}

.banner--success::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 4px;
  background: var(--success);
}

.banner--warning {
  background: rgba(245, 124, 0, 0.05);
  border: 1px solid rgba(245, 124, 0, 0.25);
  color: var(--warning);
}

.banner--warning::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 4px;
  background: var(--warning);
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
.banner-text { font-size: 12.5px; font-weight: 600; margin: 0; color: var(--text-primary); }

.banner-link {
  margin-left: auto;
  font-size: 12px;
  font-weight: 800;
  text-decoration: none;
  color: currentColor;
  flex-shrink: 0;
  transition: opacity 0.15s ease;
}

.banner-link:hover { opacity: 0.8; text-decoration: underline; }

/* Onboarding Hero Card */
.onboarding-card {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #0d47a1 0%, #1565c0 55%, #1976d2 100%);
  border-radius: 20px;
  padding: 24px 28px;
  color: white;
  box-shadow: 0 12px 30px -4px rgba(21, 101, 192, 0.35);
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

.onboarding-card__title { font-size: 18px; font-weight: 800; margin: 0; }
.onboarding-card__subtitle { font-size: 13px; opacity: 0.85; margin: 4px 0 0; }

.onboarding-card__progress-ring {
  position: relative;
  width: 52px;
  height: 52px;
  flex-shrink: 0;
}

.progress-ring__svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.progress-ring__bg { fill: none; stroke: rgba(255, 255, 255, 0.22); stroke-width: 3.5; }
.progress-ring__fill {
  fill: none;
  stroke: white;
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
  font-size: 11px;
  font-weight: 900;
}

.onboarding-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.onboarding-step {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #ffffff;
  font-size: 12.5px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.onboarding-step:not(.onboarding-step--disabled):hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.onboarding-step--done {
  opacity: 0.7;
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
}

.onboarding-step__check {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.onboarding-step--done .onboarding-step__check {
  background: white;
  color: var(--primary);
  border-color: white;
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
  box-shadow: 0 2px 4px rgba(15, 23, 42, 0.02), 0 6px 16px rgba(15, 23, 42, 0.04);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
  transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px -4px rgba(15, 23, 42, 0.08);
  border-color: #cbd5e1;
}

.stat-card--blood-type {
  border-top: 3px solid var(--accent);
  background: linear-gradient(180deg, rgba(211, 47, 47, 0.02) 0%, var(--card-bg) 40%);
}

.stat-card--emphasized {
  border-color: rgba(245, 124, 0, 0.5);
  box-shadow: 0 0 0 1px rgba(245, 124, 0, 0.2), 0 8px 20px rgba(245, 124, 0, 0.1);
}

.stat-card__top { display: flex; align-items: center; justify-content: space-between; }
.stat-card__label {
  font-size: 11px;
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

.stat-card__badge--primary { background: rgba(21, 101, 192, 0.08); color: var(--primary); }
.stat-card__badge--secondary { background: rgba(66, 165, 245, 0.1); color: #0288d1; }
.stat-card__badge--accent { background: rgba(211, 47, 47, 0.08); color: var(--accent); }
.stat-card__badge--success { background: rgba(46, 125, 50, 0.08); color: var(--success); }
.stat-card__badge--warning { background: rgba(245, 124, 0, 0.08); color: var(--warning); }

.stat-card__value-group { display: flex; align-items: baseline; gap: 8px; }
.stat-card__value {
  font-size: 28px;
  font-weight: 900;
  color: var(--text-primary);
  margin: 0;
  line-height: 1;
  letter-spacing: -0.03em;
}

.blood-type-tag {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  padding: 3px 7px;
  border-radius: 6px;
  background: rgba(211, 47, 47, 0.1);
  color: var(--accent);
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  max-width: 100%;
  font-size: 11px;
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
  grid-template-columns: 1.55fr 1fr;
  gap: 22px;
}

.col-left, .col-right { display: flex; flex-direction: column; gap: 22px; }

/* Panels */
.panel {
  background: var(--card-bg);
  border-radius: 18px;
  box-shadow: 0 2px 4px rgba(15, 23, 42, 0.02), 0 6px 16px rgba(15, 23, 42, 0.03);
  border: 1px solid var(--border);
  overflow: hidden;
  transition: all 0.2s ease;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, #ffffff 0%, rgba(248, 250, 252, 0.6) 100%);
}

.panel-header--simple { padding: 18px 22px; }

.panel-title {
  font-weight: 800;
  font-size: 15px;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.01em;
}

.panel-subtitle { font-size: 12px; color: var(--text-secondary); margin: 3px 0 0; }

.period-pill {
  font-size: 11px;
  font-weight: 800;
  color: var(--primary);
  background: rgba(21, 101, 192, 0.08);
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid rgba(21, 101, 192, 0.12);
}

.panel-link, .panel-link-plain {
  font-size: 12px;
  font-weight: 800;
  color: var(--primary);
  display: flex;
  align-items: center;
  gap: 4px;
  text-decoration: none;
  transition: color 0.15s ease;
}

.panel-link:hover, .panel-link-plain:hover { color: #0d47a1; text-decoration: underline; }

/* Chart */
.trend-chart { padding: 22px 22px 24px; }
.chart { display: flex; gap: 14px; height: 165px; }

.chart__yaxis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-size: 10px;
  font-weight: 700;
  color: var(--text-secondary);
  padding-bottom: 24px;
  text-align: right;
  width: 20px;
}

.chart__plot { flex: 1; display: flex; align-items: flex-end; gap: 8px; }

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
  font-size: 10.5px;
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
  background: linear-gradient(180deg, var(--secondary) 0%, var(--primary) 100%);
  box-shadow: 0 3px 10px rgba(21, 101, 192, 0.35);
}

.chart__bar--low { background: linear-gradient(180deg, #ffb74d 0%, var(--warning) 100%); }
.chart__bar--empty { background: transparent; }

.chart__label { margin-top: 8px; font-size: 10.5px; font-weight: 700; color: var(--text-secondary); }
.chart__label--current { color: var(--primary); font-weight: 900; }

.trend-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 36px;
  color: var(--text-secondary);
  font-size: 13px;
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

.donation-title { font-size: 13.5px; font-weight: 800; color: var(--text-primary); margin: 0; }
.donation-meta { font-size: 12px; color: var(--text-secondary); margin: 3px 0 0; }
.donation-item__right { text-align: right; flex-shrink: 0; }
.donation-date { font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin: 0; }

.badge {
  font-size: 10px;
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
  font-size: 13px;
}

/* Appointment Widget Details */
.appt-body { padding: 22px; }
.appt-row { display: flex; align-items: center; gap: 16px; }

.appt-date-chip {
  width: 58px;
  height: 58px;
  border-radius: 16px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary) 0%, #0d47a1 100%);
  box-shadow: 0 4px 12px rgba(21, 101, 192, 0.3);
}

.appt-date-chip__day { color: white; font-weight: 900; font-size: 22px; line-height: 1; }
.appt-date-chip__month { color: rgba(255, 255, 255, 0.85); font-size: 10px; text-transform: uppercase; font-weight: 800; margin-top: 2px; }

.appt-info { flex: 1; min-width: 0; }
.appt-type { font-weight: 800; font-size: 14px; margin: 0; color: var(--text-primary); }

.appt-meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
  font-size: 12px;
  color: var(--text-secondary);
}

.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.appt-notice {
  margin-top: 18px;
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(21, 101, 192, 0.05);
  color: var(--primary);
  border: 1px dashed rgba(21, 101, 192, 0.25);
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

.eligibility-status { font-size: 14px; font-weight: 900; margin: 0; }
.eligibility-until { font-size: 11.5px; opacity: 0.85; margin: 2px 0 0; }

.eligibility-details {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 12.5px;
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
  transition: all 0.15s ease;
}

.quick-action:hover { background: #f1f5f9; transform: translateX(3px); }

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

.quick-action__label { font-size: 13px; font-weight: 700; color: var(--text-primary); flex: 1; }
.quick-action__chevron { color: #cbd5e1; transition: all 0.15s ease; }
.quick-action:hover .quick-action__chevron { color: var(--primary); transform: translateX(2px); }

/* Responsive Overrides */
@media (max-width: 1024px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .main-grid { grid-template-columns: 1fr; }
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
    font-size: 20px;
  }

  .page-subtitle {
    font-size: 12.5px;
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

  .stats-grid {
    grid-template-columns: 1fr;
  }
}

/* High-Contrast Dark Mode Enhancements */
:global(.dark .dashboard) {
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --border: #334155;
  --card-bg: #1e293b;
  background: #0f172a;
}

:global(.dark .panel-header) {
  background: linear-gradient(180deg, #1e293b 0%, rgba(15, 23, 42, 0.5) 100%);
}

:global(.dark .stat-card) { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25); }
:global(.dark .stat-card:hover) { border-color: #475569; }
:global(.dark .stat-card--blood-type) { background: linear-gradient(180deg, rgba(211, 47, 47, 0.08) 0%, var(--card-bg) 50%); }

:global(.dark .banner--success) {
  background: rgba(46, 125, 50, 0.15);
  border-color: rgba(76, 175, 80, 0.4);
  color: #81c784;
}

:global(.dark .banner--success .banner-text) { color: #f8fafc; }
:global(.dark .banner--success .banner-link) { color: #81c784; }
:global(.dark .text-success) { color: #4caf50 !important; }

:global(.dark .stat-chip--success) {
  background: rgba(76, 175, 80, 0.2);
  color: #81c784;
}

:global(.dark .stat-chip--neutral),
:global(.dark .trend-empty__icon),
:global(.dark .empty-state__icon) {
  background: #334155;
  color: #94a3b8;
}

:global(.dark .chart__track) { background: rgba(15, 23, 42, 0.6); }
:global(.dark .chart__col:hover .chart__track) { background: rgba(51, 65, 85, 0.8); }
:global(.dark .chart__bar) { background: #475569; }
:global(.dark .donation-item:hover) { background: rgba(51, 65, 85, 0.3); }
:global(.dark .quick-action:hover) { background: #334155; }
:global(.dark .quick-action__icon) { background: rgba(255, 255, 255, 0.05); }
:global(.dark .skeleton) { background: linear-gradient(90deg, #1e293b 25%, #334155 37%, #1e293b 63%); }
</style>