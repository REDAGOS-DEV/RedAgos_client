Exit code: 0
Wall time: 2.1 seconds
Output:
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
        <div>
          <h1 class="page-title">Here's your donor overview</h1>
          <p class="page-subtitle">Everything you need to track your journey, all in one place.</p>
        </div>
        <div class="header-actions">
              <span v-if="eligibilityStatus === 'eligible'" class="icon-btn__dot" />
          <NuxtLink to="/donor/appointments" class="btn-primary">
            <AssetIcon name="calendar" :size="15" />
            Book Appointment
          </NuxtLink>
        </div>
      </div>

      <!-- Eligibility banner -->
      <div v-if="eligibilityStatus === 'eligible'" class="banner fade-in" style="--delay: 60ms">
        <AssetIcon name="check-circle" :size="16" class="banner-icon" />
        <p class="banner-text">
          Eligibility screening is valid. Present your QR code at the blood center on arrival.
        </p>
        <NuxtLink to="/donor/eligibility" class="banner-link">View QR</NuxtLink>
      </div>
      <div v-else-if="eligibilityStatus === 'deferred'" class="banner banner--warning fade-in" style="--delay: 60ms">
        <AssetIcon name="alert" :size="16" class="banner-icon" />
        <p class="banner-text">
          Your eligibility screening is deferred. Please contact the blood center for more information.
        </p>
        <NuxtLink to="/donor/eligibility" class="banner-link">View Details</NuxtLink>
      </div>

      <!-- Onboarding checklist, only shown to new donors na wala pa na-complete ang core flow -->
      <div v-if="showOnboarding" class="onboarding-card fade-in" style="--delay: 80ms">
        <div class="onboarding-card__header">
          <div>
            <p class="onboarding-card__title">Get started with RedAgos</p>
            <p class="onboarding-card__subtitle">{{ completedSteps }} of {{ onboardingSteps.length }} steps completed</p>
          </div>
          <div class="onboarding-card__progress-ring">
            <svg viewBox="0 0 36 36" class="progress-ring__svg">
              <circle class="progress-ring__bg" cx="18" cy="18" r="15.5" />
              <circle
                class="progress-ring__fill"
                cx="18" cy="18" r="15.5"
                :style="{ strokeDasharray: `${progressPercent}, 100` }"
              />
            </svg>
            <span class="progress-ring__label">{{ Math.round(progressPercent) }}%</span>
          </div>
        </div>

        <div class="onboarding-steps">
          <NuxtLink
            v-for="step in onboardingSteps"
            :key="step.key"
            :to="step.done ? undefined : step.path"
            class="onboarding-step"
            :class="{ 'onboarding-step--done': step.done, 'onboarding-step--disabled': step.done }"
          >
            <span class="onboarding-step__check">
              <AssetIcon v-if="step.done" name="check" :size="12" />
            </span>
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
            <div class="stat-card__badge" style="background:#1565C014">
              <AssetIcon name="blood-drop" :size="14" style="color:#1565C0" />
            </div>
          </div>
          <p class="stat-card__value">{{ totalDonations }}</p>
          <span class="stat-chip stat-chip--neutral">Lifetime</span>
        </div>

        <div class="stat-card fade-in" style="--delay: 150ms">
          <div class="stat-card__top">
            <p class="stat-card__label">Blood Type</p>
            <div class="stat-card__badge" style="background:#D32F2F14">
              <AssetIcon name="blood-drop" :size="14" style="color:#D32F2F" />
            </div>
          </div>
          <p class="stat-card__value" style="color:#D32F2F">{{ bloodType }}</p>
          <span class="stat-chip stat-chip--neutral">Your blood group</span>
        </div>

        <div
          class="stat-card fade-in"
          :class="{ 'stat-card--emphasized': eligibilityStatus !== 'eligible' }"
          style="--delay: 200ms"
        >
          <div class="stat-card__top">
            <p class="stat-card__label">QR Status</p>
            <div class="stat-card__badge"
              :style="{ background: eligibilityStatus === 'eligible' ? '#2E7D3214' : '#F57C0014' }">
              <AssetIcon name="shield-check" :size="14"
                :style="{ color: eligibilityStatus === 'eligible' ? '#2E7D32' : '#F57C00' }" />
            </div>
          </div>
          <p class="stat-card__value" :style="{ color: eligibilityStatus === 'eligible' ? '#2E7D32' : '#F57C00' }">
            {{ eligibilityStatus === 'eligible' ? 'Valid' : eligibilityStatus === 'deferred' ? 'Deferred' : 'Pending' }}
          </p>
          <span class="stat-chip" :class="eligibilityStatus === 'eligible' ? 'stat-chip--success' : 'stat-chip--warning'">
            {{ eligibilityStatus === 'eligible' && profile?.screening_valid_until
              ? `Until ${formatDate(profile.screening_valid_until, 'MMM D, YYYY')}`
              : 'Complete screening' }}
          </span>
        </div>

        <div class="stat-card fade-in" style="--delay: 250ms">
          <div class="stat-card__top">
            <p class="stat-card__label">Next Appointment</p>
            <div class="stat-card__badge" style="background:#42A5F514">
              <AssetIcon name="calendar" :size="14" style="color:#42A5F5" />
            </div>
          </div>
          <p class="stat-card__value" style="color:#1565C0">{{ nextApptDate }}</p>
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
                  <div
                    v-for="(m, i) in monthlyTrend"
                    :key="m.key"
                    class="chart__col"
                    tabindex="0"
                    role="button"
                    :aria-label="`${m.month}: ${m.count} donation${m.count !== 1 ? 's' : ''}`"
                    @mouseenter="hoveredMonth = i"
                    @mouseleave="hoveredMonth = null"
                    @focus="hoveredMonth = i"
                    @blur="hoveredMonth = null"
                    @click="hoveredMonth = hoveredMonth === i ? null : i"
                  >
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

                    <span class="chart__label" :class="{ 'chart__label--current': i === monthlyTrend.length - 1 }">{{ m.month }}</span>
                  </div>
                </div>
              </div>

              <div v-else class="trend-empty">
                <AssetIcon name="trending-up" :size="36" style="color:#e5e7eb" />
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
                  <div class="donation-icon" :style="{ background: d.status === 'completed' ? '#2E7D3214' : '#F57C0014' }">
                    <AssetIcon name="blood-drop" :size="15"
                      :style="{ color: d.status === 'completed' ? '#2E7D32' : '#F57C00' }" />
                  </div>
                  <div>
                    <p class="donation-title">
                      {{ d.status === 'completed' ? 'Successful Donation' : d.status === 'deferred' ? 'Deferred' : 'Pending' }}
                    </p>
                    <p class="donation-meta">
                      {{ d.blood_type }} &middot; {{ d.facility_name }} &middot; {{ d.donation_type === 'walk_in' ? 'Walk-in' : 'Booked' }}
                    </p>
                  </div>
                </div>
                <div class="donation-item__right">
                  <p class="donation-date">{{ formatDate(d.donation_date, 'MMM D, YYYY') }}</p>
                  <span class="badge capitalize" :style="{
                    background: d.status === 'completed' ? '#2E7D3214' : '#F57C0014',
                    color: d.status === 'completed' ? '#2E7D32' : '#F57C00',
                  }">
                    {{ d.status === 'completed' ? 'Completed' : d.status }}
                  </span>
                </div>
              </div>
            </div>
            <div v-else class="empty-state">
              <AssetIcon name="history" :size="36" style="color:#e5e7eb" />
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
                  <span class="appt-date-chip__day">{{ formatDate(upcomingAppointment.appointment_datetime, 'D') }}</span>
                  <span class="appt-date-chip__month">{{ formatDate(upcomingAppointment.appointment_datetime, 'MMM') }}</span>
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
              <div class="appt-notice">Present QR code on arrival</div>
            </div>
            <div v-else class="empty-state">
              <AssetIcon name="calendar" :size="36" style="color:#e5e7eb" />
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
              <div class="eligibility-status-row" :style="{
                background: eligibilityStatus === 'eligible' ? '#E8F5E9' : eligibilityStatus === 'deferred' ? '#FFEBEE' : '#FFF8E1'}">
                <AssetIcon name="shield-check" :size="18"
                  :style="{ color: eligibilityStatus === 'eligible' ? '#2E7D32' : eligibilityStatus === 'deferred' ? '#D32F2F' : '#F57C00' }" />
                <div>
                  <p class="eligibility-status capitalize"
                    :style="{ color: eligibilityStatus === 'eligible' ? '#2E7D32' : eligibilityStatus === 'deferred' ? '#D32F2F' : '#F57C00' }">
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
                  <span class="eligibility-details__value">{{ formatDate(profile.screening_date, 'MMM D, YYYY') }}</span>
                </div>
                <div class="eligibility-details__row">
                  <span class="eligibility-details__label">Blood type</span>
                  <span class="eligibility-details__value" style="color:#D32F2F">{{ bloodType }}</span>
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
                <div class="quick-action__icon" :style="{ background: `${item.color}14` }">
                  <AssetIcon :name="item.icon" :size="15" :style="{ color: item.color }" />
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
import AssetIcon from '~/components/common/AssetIcon.vue'
import { ref, reactive, computed, onMounted } from 'vue'
import { donorService } from '~/api/donor/DonorService'


const loading = ref(true)

// Core donor data
const profile = ref(null)
const eligibilityStatus = ref('pending') // 'eligible' | 'deferred' | 'pending'
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

// once everything is complete, mawala nani sya.
const showOnboarding = computed(() => completedSteps.value < onboardingSteps.value.length)

// 'D', 'MMM', 'MMM D', 'MMM D, YYYY', 'h:mm A'
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

onMounted(async () => {
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
  }
})
</script>

<style scoped>
.dashboard {
  --primary: #1565c0;
  --secondary: #42a5f5;
  --accent: #d32f2f;
  --success: #2e7d32;
  --warning: #f57c00;
  --text-primary: #1f2937;
  --text-secondary: #94a3b8;
  --border: #eef1f5;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  max-width: 1200px;
  background: #F7F8FA;
  margin: 0 auto;
  padding: 24px 32px 40px;
  transition: background-color 0.2s ease;
}

/* Skeleton loading */
.skeleton {
  background: linear-gradient(90deg, #eef1f5 25%, #f6f8fa 37%, #eef1f5 63%);
  background-size: 400% 100%;
  border-radius: 14px;
  animation: shimmer 1.4s ease infinite;
}

.skeleton--header { height: 44px; max-width: 320px; }
.skeleton--card { height: 108px; }
.skeleton--panel { border-radius: 14px; }

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

/* Entrance animation */
.fade-in {
  animation: fadeInUp 0.45s ease both;
  animation-delay: var(--delay, 0ms);
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .fade-in, .skeleton { animation: none !important; }
}

.dashboard-inner {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Header */
.header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.page-title {
  font-size: 21px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  margin: 0;
}

.page-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 3px 0 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}


.icon-btn:hover {
  background: #f8fafc;
  border-color: #e2e8f0;
}

.icon-btn:focus-within {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.icon-btn a {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #64748b;
}

.icon-btn__dot {
  position: absolute;
  top: 7px;
  right: 8px;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--accent);
  border: 1.5px solid white;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 15px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: white;
  background: var(--primary);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  transition: opacity 0.15s ease, transform 0.15s ease;
  border: none;
  cursor: pointer;
  text-decoration: none;
}

.btn-primary:hover {
  opacity: 0.92;
  transform: translateY(-1px);
}

.btn-primary:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.btn-primary--sm {
  padding: 8px 18px;
  font-size: 12px;
  border-radius: 10px;
}

.btn-danger {
  display: block;
  width: 100%;
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  padding: 10px;
  border-radius: 10px;
  background: var(--accent);
  color: white;
  text-decoration: none;
  transition: opacity 0.15s ease;
}

.btn-danger:hover {
  opacity: 0.92;
}

.btn-danger:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Banner */
.banner {
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 12px;
  padding: 12px 14px;
  background: #e8f5e9;
  border: 1px solid #a5d6a7;
}

.banner-icon {
  color: var(--success);
  flex-shrink: 0;
}

.banner-text {
  font-size: 12px;
  font-weight: 500;
  color: var(--success);
  margin: 0;
}

.banner-link {
  margin-left: auto;
  font-size: 12px;
  font-weight: 700;
  text-decoration: underline;
  color: var(--success);
  flex-shrink: 0;
}

/* Onboarding checklist */
.onboarding-card {
  background: linear-gradient(135deg, #1565C0 0%, #0D47A1 100%);
  border-radius: 14px;
  padding: 18px 20px;
  color: white;
  box-shadow: 0 4px 16px rgba(21, 101, 192, 0.18);
}

.onboarding-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.onboarding-card__title {
  font-size: 14.5px;
  font-weight: 700;
  margin: 0;
}

.onboarding-card__subtitle {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
  margin: 2px 0 0;
}

.onboarding-card__progress-ring {
  position: relative;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}

.progress-ring__svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.progress-ring__bg {
  fill: none;
  stroke: rgba(255, 255, 255, 0.25);
  stroke-width: 3;
}

.progress-ring__fill {
  fill: none;
  stroke: white;
  stroke-width: 3;
  stroke-linecap: round;
  transition: stroke-dasharray 0.4s ease;
}

.progress-ring__label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
}

.onboarding-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.onboarding-step {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  color: white;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s ease;
}

.onboarding-step:hover {
  background: rgba(255, 255, 255, 0.2);
}

.onboarding-step--done {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.6);
}

.onboarding-step--disabled {
  cursor: default;
  pointer-events: none;
}

.onboarding-step__check {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  border: 1.5px solid rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.onboarding-step--done .onboarding-step__check {
  background: white;
  color: #1565C0;
  border-color: white;
}

.onboarding-step__arrow {
  opacity: 0.6;
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.stat-card {
  background: white;
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background-color 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
  border-color: #e2e8f0;
}

/* Emphasized stat card */
.stat-card--emphasized {
  border-color: #F57C0040;
  box-shadow: 0 0 0 1px #F57C0020, 0 4px 14px rgba(245, 124, 0, 0.08);
}

.stat-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stat-card__label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  margin: 0;
}

.stat-card__badge {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-card__value {
  font-size: 24px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
  line-height: 1;
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  max-width: 100%;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 999px;
}

.stat-chip--neutral {
  background: #f1f5f9;
  color: #64748b;
}

.stat-chip--success {
  background: #2E7D3214;
  color: var(--success);
}

.stat-chip--warning {
  background: #F57C0014;
  color: var(--warning);
}

.truncate-chip {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Layout */
.main-grid {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 20px;
}

.col-left,
.col-right {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Panels */
.panel {
  background: white;
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
  border: 1px solid var(--border);
  overflow: hidden;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 18px;
  border-bottom: 1px solid var(--border);
}

.panel-header--simple {
  padding: 15px 18px;
}

.panel-title {
  font-weight: 700;
  font-size: 13.5px;
  color: var(--text-primary);
  margin: 0;
}

.panel-subtitle {
  font-size: 11.5px;
  color: var(--text-secondary);
  margin: 2px 0 0;
}

.period-pill {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  background: #f1f5f9;
  padding: 5px 10px;
  border-radius: 999px;
  flex-shrink: 0;
}

.panel-link {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
  display: flex;
  align-items: center;
  gap: 2px;
  text-decoration: none;
  border-radius: 4px;
}

.panel-link:hover { text-decoration: underline; }

.panel-link:focus-visible,
.panel-link-plain:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.panel-link-plain {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
  text-decoration: none;
  border-radius: 4px;
}

.panel-link-plain:hover { text-decoration: underline; }

/* Trend chart */
.trend-chart {
  padding: 14px 18px 18px;
}

.chart {
  display: flex;
  gap: 8px;
  height: 150px;
}

.chart__yaxis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-size: 10.5px;
  color: var(--text-secondary);
  padding-bottom: 20px;
  text-align: right;
  width: 20px;
}

.chart__plot {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: 6px;
}

.chart__col {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  cursor: pointer;
  border-radius: 6px;
}

.chart__col:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.chart__tooltip {
  position: absolute;
  top: -26px;
  left: 50%;
  transform: translateX(-50%);
  background: #1f2937;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  color: white;
  white-space: nowrap;
  z-index: 2;
}

.chart__track {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.chart__bar {
  width: 60%;
  max-width: 16px;
  border-radius: 4px 4px 0 0;
  background: #dce3ee;
  transition: height 0.4s ease, background 0.2s ease;
}

.chart__bar--current {
  background: var(--primary);
}

.chart__bar--low {
  background: var(--warning);
}

.chart__bar--empty {
  background: #eef1f5;
}

.chart__label {
  margin-top: 6px;
  font-size: 10.5px;
  color: var(--text-secondary);
}

.chart__label--current {
  color: var(--primary);
  font-weight: 700;
}

.trend-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 22px;
  color: var(--text-secondary);
  font-size: 12.5px;
}

/* Donation list */
.donation-list {
  display: flex;
  flex-direction: column;
}

.donation-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  border-bottom: 1px solid #fafbfc;
}

.donation-item:last-child { border-bottom: none; }

.donation-item__left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.donation-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.donation-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.donation-meta {
  font-size: 11.5px;
  color: var(--text-secondary);
  margin: 2px 0 0;
}

.donation-item__right {
  text-align: right;
  flex-shrink: 0;
}

.donation-date {
  font-size: 11.5px;
  color: var(--text-secondary);
  margin: 0;
}

.badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  display: inline-block;
  margin-top: 4px;
}

.capitalize { text-transform: capitalize; }

.empty-state {
  padding: 28px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}

/* Appointment */
.appt-body { padding: 18px; }

.appt-row {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.appt-date-chip {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--primary);
}

.appt-date-chip__day {
  color: white;
  font-weight: 800;
  font-size: 18px;
  line-height: 1;
}

.appt-date-chip__month {
  color: rgba(255, 255, 255, 0.7);
  font-size: 9.5px;
  text-transform: uppercase;
  font-weight: 700;
}

.appt-info { flex: 1; min-width: 0; }

.appt-type {
  font-weight: 700;
  font-size: 13.5px;
  margin: 0;
  color: var(--text-primary);
}

.appt-meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
  font-size: 11.5px;
  color: var(--text-secondary);
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.appt-notice {
  margin-top: 14px;
  border-radius: 10px;
  padding: 9px 14px;
  font-size: 11.5px;
  font-weight: 600;
  text-align: center;
  background: #e3f2fd;
  color: var(--primary);
}

/* Eligibility */
.eligibility-body { padding: 18px; }

.eligibility-status-row {
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 14px;
}

.eligibility-status {
  font-size: 13.5px;
  font-weight: 700;
  margin: 0;
}

.eligibility-until {
  font-size: 11.5px;
  color: #6b7280;
  margin: 2px 0 0;
}

.eligibility-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
  margin-bottom: 14px;
}

.eligibility-details__row {
  display: flex;
  justify-content: space-between;
}

.eligibility-details__label { color: var(--text-secondary); }

.eligibility-details__value {
  font-weight: 700;
  color: #374151;
}

/* Quick actions */
.quick-actions {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.quick-action {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 10px;
  border-radius: 10px;
  text-decoration: none;
  transition: background 0.15s ease;
}

.quick-action:hover { background: #f8fafc; }

.quick-action:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
  background: #f8fafc;
}

.quick-action__icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.quick-action__label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  flex: 1;
}

.quick-action__chevron {
  color: #d1d5db;
  transition: color 0.15s ease;
}

.quick-action:hover .quick-action__chevron { color: #94a3b8; }

/* Responsive */
@media (max-width: 1024px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .main-grid { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .dashboard { padding: 16px 16px 32px; }
  .header-row { flex-direction: column; align-items: stretch; }
  .header-actions { justify-content: space-between; }
}

/* ============ Dark mode ============ */
:global(.dark .dashboard) {
  --text-primary: #F1F5F9;
  --text-secondary: #94A3B8;
  --border: #334155;
  background: #0F172A;
}

:global(.dark .icon-btn),
:global(.dark .stat-card),
:global(.dark .panel) {
  background: #1E293B;
  border-color: #334155;
}

:global(.dark .icon-btn:hover),
:global(.dark .quick-action:hover),
:global(.dark .quick-action:focus-visible) {
  background: #263449;
}

:global(.dark .icon-btn a) { color: #94a3b8; }
:global(.dark .icon-btn__dot) { border-color: #1E293B; }

:global(.dark .stat-card:hover) { border-color: #475569; }

:global(.dark .stat-card--emphasized) {
  border-color: #F57C0055;
  box-shadow: 0 0 0 1px #F57C0033, 0 4px 14px rgba(245, 124, 0, 0.12);
}

:global(.dark .stat-chip--neutral),
:global(.dark .period-pill) {
  background: #243247;
  color: #94a3b8;
}

:global(.dark .panel-header) { border-color: #334155; }

:global(.dark .chart__bar) { background: #334155; }
:global(.dark .chart__bar--empty) { background: #263449; }
:global(.dark .chart__tooltip) { background: #0F172A; border: 1px solid #334155; }

:global(.dark .donation-item) { border-color: #263449; }
:global(.dark .appt-notice) { background: rgba(66,165,245,0.14); }
:global(.dark .eligibility-details__value) { color: #E2E8F0; }
:global(.dark .quick-action__label) { color: #E2E8F0; }
:global(.dark .quick-action__chevron) { color: #475569; }

:global(.dark .banner) { background: rgba(102,187,106,0.14); border-color: rgba(102,187,106,0.3); }
:global(.dark .banner--warning) { background: rgba(255,167,38,0.14); border-color: rgba(255,167,38,0.3); }

:global(.dark .onboarding-step) { background: rgba(255,255,255,0.1); }

:global(.dark .skeleton) {
  background: linear-gradient(90deg, #1E293B 25%, #263449 37%, #1E293B 63%);
}
</style>

