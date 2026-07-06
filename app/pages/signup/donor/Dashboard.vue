<template>
  <div class="dashboard">
    <div v-if="loading" class="loading-wrap">
      <div class="spinner" />
    </div>

    <div v-else class="dashboard-inner">
      <!-- Top header row -->
      <div class="header-row fade-in" style="--delay: 0ms">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Track your donations, eligibility, and upcoming appointments.</p>
        </div>
        <div class="header-actions">
          <button class="bell-btn">
            <AssetIcon name="bell" :size="16" />
            <span v-if="eligibilityStatus === 'eligible'" class="bell-dot" />
          </button>
          <NuxtLink to="/book-appointment" class="btn-primary">
            <AssetIcon name="calendar" :size="16" />
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
        <NuxtLink to="/eligibility" class="banner-link">View QR</NuxtLink>
      </div>

      <!-- Stat cards -->
      <div class="stats-grid">
        <div class="stat-card stat-card--hero fade-in" style="--delay: 100ms">
          <div class="stat-card__top">
            <p class="stat-card__label stat-card__label--light">Total Donations</p>
            <div class="stat-card__badge stat-card__badge--light">
              <AssetIcon name="arrow-up-right" :size="14" style="color: white" />
            </div>
          </div>
          <div>
            <p class="stat-card__value stat-card__value--hero">{{ totalDonations }}</p>
            <div class="stat-card__meta">
              <AssetIcon name="trending-up" :size="14" style="color: rgba(255,255,255,0.6)" />
              <p class="stat-card__meta-text stat-card__meta-text--light">Lifetime contributions</p>
            </div>
          </div>
          <span class="deco-circle deco-circle--1" />
          <span class="deco-circle deco-circle--2" />
        </div>

        <div class="stat-card fade-in" style="--delay: 150ms">
          <div class="stat-card__top">
            <p class="stat-card__label">Blood Type</p>
            <div class="stat-card__badge" style="background:#D32F2F15">
              <AssetIcon name="blood-drop" :size="14" style="color:#D32F2F" />
            </div>
          </div>
          <div>
            <p class="stat-card__value" style="color:#D32F2F">{{ bloodType }}</p>
            <p class="stat-card__meta-text">Your blood group</p>
          </div>
        </div>

        <div class="stat-card fade-in" style="--delay: 200ms">
          <div class="stat-card__top">
            <p class="stat-card__label">QR Status</p>
            <div
              class="stat-card__badge"
              :style="{ background: eligibilityStatus === 'eligible' ? '#E8F5E9' : '#FFF3E0' }"
            >
              <AssetIcon name="shield-check" :size="14" :style="{ color: eligibilityStatus === 'eligible' ? '#2E7D32' : '#F57C00' }" />
            </div>
          </div>
          <div>
            <p class="stat-card__value" :style="{ color: eligibilityStatus === 'eligible' ? '#2E7D32' : '#F57C00' }">
              {{ eligibilityStatus === 'eligible' ? 'Valid' : eligibilityStatus === 'deferred' ? 'Deferred' : 'Pending' }}
            </p>
            <p class="stat-card__meta-text">
              {{ eligibilityStatus === 'eligible' && profile?.screening_valid_until
                ? `Until ${formatDate(profile.screening_valid_until, 'MMM D, YYYY')}`
                : 'Complete screening' }}
            </p>
          </div>
        </div>

        <div class="stat-card fade-in" style="--delay: 250ms">
          <div class="stat-card__top">
            <p class="stat-card__label">Next Appointment</p>
            <div class="stat-card__badge" style="background:#E3F2FD">
              <AssetIcon name="calendar" :size="14" style="color:#42A5F5" />
            </div>
          </div>
          <div>
            <p class="stat-card__value" style="color:#1565C0">{{ nextApptDate }}</p>
            <p class="stat-card__meta-text">
              {{ upcomingAppointment ? upcomingAppointment.facility_name : 'No appointment scheduled' }}
            </p>
          </div>
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
                <p class="panel-subtitle">Your donation activity over time</p>
              </div>
            </div>
            <div class="trend-chart">
              <svg v-if="trendPoints.length" viewBox="0 0 300 100" preserveAspectRatio="none" class="trend-svg">
                <polyline
                  :points="trendPolyline"
                  fill="none"
                  stroke="#1565C0"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="trend-line"
                />
                <polygon :points="trendAreaPolygon" fill="url(#trendGradient)" class="trend-area" />
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#1565C0" stop-opacity="0.25" />
                    <stop offset="100%" stop-color="#1565C0" stop-opacity="0" />
                  </linearGradient>
                </defs>
                <circle
                  v-for="(p, i) in trendPoints"
                  :key="i"
                  :cx="p.x"
                  :cy="p.y"
                  r="2.5"
                  fill="#1565C0"
                  class="trend-dot"
                  :style="{ '--dot-delay': `${400 + i * 60}ms` }"
                />
              </svg>
              <div v-else class="trend-empty">
                <AssetIcon name="trending-up" :size="40" style="color:#e5e7eb" />
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
              <NuxtLink to="/donation-history" class="panel-link">
                View All <AssetIcon name="chevron-right" :size="14" />
              </NuxtLink>
            </div>

            <div v-if="recentDonations.length" class="donation-list">
              <div v-for="d in recentDonations" :key="d.id" class="donation-item">
                <div class="donation-item__left">
                  <div
                    class="donation-icon"
                    :style="{ background: d.status === 'completed' ? '#E8F5E9' : '#FFF3E0' }"
                  >
                    <AssetIcon name="blood-drop" :size="16" :style="{ color: d.status === 'completed' ? '#2E7D32' : '#F57C00' }" />
                  </div>
                  <div>
                    <p class="donation-title">
                      {{ d.status === 'completed' ? 'Successful Donation' : d.status === 'deferred' ? 'Deferred' : 'Pending' }}
                    </p>
                    <p class="donation-meta">
                      {{ d.blood_type }} · {{ d.facility_name }} · {{ d.donation_type === 'walk_in' ? 'Walk-in' : 'Booked' }}
                    </p>
                  </div>
                </div>
                <div class="donation-item__right">
                  <p class="donation-date">{{ formatDate(d.donation_date, 'MMM D, YYYY') }}</p>
                  <span
                    class="badge capitalize"
                    :style="{
                      background: d.status === 'completed' ? '#E8F5E9' : '#FFF3E0',
                      color: d.status === 'completed' ? '#2E7D32' : '#F57C00',
                    }"
                  >
                    {{ d.status === 'completed' ? 'Completed' : d.status }}
                  </span>
                </div>
              </div>
            </div>
            <div v-else class="empty-state">
              <AssetIcon name="history" :size="40" style="color:#e5e7eb" />
              <p>No donations yet</p>
            </div>
          </div>
        </div>

        <!-- Right column -->
        <div class="col-right">
          <!-- Upcoming appointment -->
          <div class="panel fade-in" style="--delay: 300ms">
            <div class="panel-header">
              <h2 class="panel-title">Upcoming Appointment</h2>
              <NuxtLink to="/book-appointment" class="panel-link-plain">Manage</NuxtLink>
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
                    <AssetIcon name="map-pin" :size="14" />
                    <span class="truncate">{{ upcomingAppointment.facility_name }}</span>
                  </div>
                  <div class="appt-meta-row">
                    <AssetIcon name="clock" :size="14" />
                    {{ formatDate(upcomingAppointment.appointment_datetime, 'h:mm A') }}
                  </div>
                </div>
              </div>
              <div class="appt-notice">Present QR code on arrival</div>
            </div>
            <div v-else class="empty-state">
              <AssetIcon name="calendar" :size="40" style="color:#e5e7eb" />
              <p class="mb-3">No upcoming appointments</p>
              <NuxtLink to="/book-appointment" class="btn-primary btn-primary--sm">Book Now</NuxtLink>
            </div>
          </div>

          <!-- Eligibility card -->
          <div class="panel fade-in" style="--delay: 350ms">
            <div class="panel-header panel-header--simple">
              <h2 class="panel-title">Eligibility Status</h2>
            </div>
            <div class="eligibility-body">
              <div
                class="eligibility-status-row"
                :style="{
                  background: eligibilityStatus === 'eligible' ? '#E8F5E9' : eligibilityStatus === 'deferred' ? '#FFEBEE' : '#FFF8E1'
                }"
              >
                <AssetIcon
                  name="shield-check"
                  :size="20"
                  :style="{ color: eligibilityStatus === 'eligible' ? '#2E7D32' : eligibilityStatus === 'deferred' ? '#D32F2F' : '#F57C00' }"
                />
                <div>
                  <p
                    class="eligibility-status capitalize"
                    :style="{ color: eligibilityStatus === 'eligible' ? '#2E7D32' : eligibilityStatus === 'deferred' ? '#D32F2F' : '#F57C00' }"
                  >
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

              <NuxtLink to="/eligibility" class="btn-danger">
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
              <NuxtLink
                v-for="item in quickActions"
                :key="item.path"
                :to="item.path"
                class="quick-action"
              >
                <div class="quick-action__icon" :style="{ background: `${item.color}12` }">
                  <AssetIcon :name="item.icon" :size="16" :style="{ color: item.color }" />
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

definePageMeta({ layout: 'dashboard' })

const loading = ref(true)
const user = ref(null)
const profile = ref(null)
const appointments = ref([])
const donations = ref([])

// --- Date formatting helper (no external date library required) ---
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function formatDate(value, pattern) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  const day = date.getDate()
  const month = MONTHS[date.getMonth()]
  const year = date.getFullYear()
  let hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12

  switch (pattern) {
    case 'D': return String(day)
    case 'MMM': return month
    case 'MMM D': return `${month} ${day}`
    case 'MMM D, YYYY': return `${month} ${day}, ${year}`
    case 'h:mm A': return `${hours}:${minutes} ${ampm}`
    default: return date.toLocaleDateString()
  }
}

// --- Data loading ---
// TODO: wire up to your real API / composables, e.g.:
// const { data } = await useFetch('/api/donor/dashboard')
async function load() {
  loading.value = true
  try {
    // Placeholder mock data — replace with real API calls
    user.value = { id: 'u1', full_name: 'Lusi Santos' }
    profile.value = {
      blood_type: 'O+',
      total_donations: 4,
      eligibility_status: 'eligible',
      screening_valid_until: '2026-04-30',
      screening_date: '2026-01-05',
    }
    appointments.value = [
      {
        id: 'a1',
        status: 'confirmed',
        appointment_datetime: '2026-04-20T10:00:00',
        appointment_type: 'walk_in',
        facility_name: 'Sub-National Blood Center',
      },
    ]
    donations.value = [
      { id: 'd1', status: 'completed', donation_date: '2026-01-10', blood_type: 'O+', facility_name: 'Sub-National Blood Center', donation_type: 'walk_in' },
      { id: 'd2', status: 'completed', donation_date: '2025-07-08', blood_type: 'O+', facility_name: 'PRC Davao', donation_type: 'walk_in' },
      { id: 'd3', status: 'completed', donation_date: '2025-02-14', blood_type: 'O+', facility_name: 'Ateneo de Davao', donation_type: 'walk_in' },
      { id: 'd4', status: 'completed', donation_date: '2024-09-02', blood_type: 'O+', facility_name: 'SM Lanang Premier', donation_type: 'walk_in' },
    ]
  } finally {
    loading.value = false
  }
}

onMounted(load)

const firstName = computed(() => user.value?.full_name?.split(' ')[0] || 'Donor')
const bloodType = computed(() => profile.value?.blood_type || '—')
const totalDonations = computed(() =>
  profile.value?.total_donations || donations.value.filter(d => d.status === 'completed').length || 0
)
const eligibilityStatus = computed(() => profile.value?.eligibility_status || 'pending')
const upcomingAppointment = computed(() =>
  appointments.value.find(a => a.status === 'scheduled' || a.status === 'confirmed')
)
const nextApptDate = computed(() =>
  upcomingAppointment.value ? formatDate(upcomingAppointment.value.appointment_datetime, 'MMM D') : '—'
)
const recentDonations = computed(() => donations.value.slice(0, 4))

// --- Trend chart (lightweight inline SVG, no external chart library needed) ---
const trendPoints = computed(() => {
  const completed = [...donations.value]
    .filter(d => d.status === 'completed')
    .sort((a, b) => new Date(a.donation_date) - new Date(b.donation_date))
  if (completed.length < 2) return []

  const width = 300
  const height = 100
  const padding = 10
  return completed.map((_, i) => ({
    x: padding + (i * (width - padding * 2)) / (completed.length - 1),
    y: height - padding - ((i + 1) / completed.length) * (height - padding * 2),
  }))
})
const trendPolyline = computed(() => trendPoints.value.map(p => `${p.x},${p.y}`).join(' '))
const trendAreaPolygon = computed(() => {
  if (!trendPoints.value.length) return ''
  const first = trendPoints.value[0]
  const last = trendPoints.value[trendPoints.value.length - 1]
  return `${first.x},100 ${trendPolyline.value} ${last.x},100`
})

const quickActions = [
  { label: 'Book Appointment', path: '/book-appointment', icon: 'calendar', color: '#1565C0' },
  { label: 'Donation History', path: '/donation-history', icon: 'history', color: '#42A5F5' },
  { label: 'Update Profile', path: '/profile', icon: 'user-circle', color: '#6B7280' },
]
</script>

<style scoped>
.dashboard {
  --primary: #1565c0;
  --secondary: #42a5f5;
  --accent: #d32f2f;
  --success: #2e7d32;
  --warning: #f57c00;
  --text-primary: #1f2937;
  --text-secondary: #9ca3af;
  max-width: 1152px;
  background: #F5F7FA;
  margin: 0 auto;
  padding: 24px 32px 40px;
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
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Entrance animation */
.fade-in {
  animation: fadeInUp 0.5s ease both;
  animation-delay: var(--delay, 0ms);
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .fade-in, .spinner, .trend-dot { animation: none !important; }
}

.dashboard-inner { display: flex; flex-direction: column; gap: 24px; }

/* Header */
.header-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-title { font-size: 24px; font-weight: 700; color: var(--text-primary); margin: 0; }
.page-subtitle { font-size: 14px; color: var(--text-secondary); margin: 2px 0 0; }
.header-actions { display: flex; align-items: center; gap: 12px; }

.bell-btn {
  position: relative;
  padding: 8px;
  border-radius: 12px;
  background: white;
  border: 1px solid #f3f4f6;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  cursor: pointer;
  transition: background 0.15s ease;
}
.bell-btn:hover { background: #f9fafb; }
.bell-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--accent);
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  color: white;
  background: var(--primary);
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  transition: opacity 0.15s ease, transform 0.15s ease;
  border: none;
  cursor: pointer;
  text-decoration: none;
}
.btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
.btn-primary--sm { padding: 8px 20px; font-size: 12px; border-radius: 12px; }

.btn-danger {
  display: block;
  width: 100%;
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  padding: 10px;
  border-radius: 12px;
  background: var(--accent);
  color: white;
  text-decoration: none;
  transition: opacity 0.15s ease;
}
.btn-danger:hover { opacity: 0.92; }

/* Banner */
.banner {
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 12px;
  padding: 14px;
  background: #e8f5e9;
  border: 1px solid #a5d6a7;
}
.banner-icon { color: var(--success); flex-shrink: 0; }
.banner-text { font-size: 12px; font-weight: 500; color: var(--success); margin: 0; }
.banner-link { margin-left: auto; font-size: 12px; font-weight: 700; text-decoration: underline; color: var(--success); flex-shrink: 0; }

/* Stats */
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.stat-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  border: 1px solid #f3f4f6;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 130px;
  position: relative;
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.06); }
.stat-card--hero { background: var(--primary); border: none; }
.stat-card__top { display: flex; align-items: center; justify-content: space-between; }
.stat-card__label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); margin: 0; }
.stat-card__label--light { color: rgba(255,255,255,0.8); }
.stat-card__badge {
  width: 28px; height: 28px; border-radius: 999px;
  display: flex; align-items: center; justify-content: center;
}
.stat-card__badge--light { background: rgba(255,255,255,0.15); }
.stat-card__value { font-size: 26px; font-weight: 800; margin: 0; line-height: 1; }
.stat-card__value--hero { color: white; font-size: 36px; }
.stat-card__meta { display: flex; align-items: center; gap: 4px; margin-top: 8px; }
.stat-card__meta-text { font-size: 11px; color: var(--text-secondary); margin: 4px 0 0; }
.stat-card__meta-text--light { color: rgba(255,255,255,0.6); margin: 0; }

.deco-circle { position: absolute; border-radius: 999px; background: rgba(255,255,255,0.08); }
.deco-circle--1 { width: 80px; height: 80px; right: -16px; bottom: -16px; }
.deco-circle--2 { width: 112px; height: 112px; right: -8px; bottom: -32px; background: rgba(255,255,255,0.05); }

/* Layout */
.main-grid { display: grid; grid-template-columns: 3fr 2fr; gap: 24px; }
.col-left, .col-right { display: flex; flex-direction: column; gap: 24px; }

/* Panels */
.panel {
  background: white;
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  border: 1px solid #f3f4f6;
  overflow: hidden;
}
.panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid #f3f4f6;
}
.panel-header--simple { padding: 16px 20px; }
.panel-title { font-weight: 700; font-size: 14px; color: var(--text-primary); margin: 0; }
.panel-subtitle { font-size: 12px; color: var(--text-secondary); margin: 2px 0 0; }
.panel-link {
  font-size: 12px; font-weight: 600; color: var(--primary);
  display: flex; align-items: center; gap: 2px; text-decoration: none;
}
.panel-link:hover { text-decoration: underline; }
.panel-link-plain { font-size: 12px; font-weight: 600; color: var(--primary); text-decoration: none; }
.panel-link-plain:hover { text-decoration: underline; }

/* Trend chart */
.trend-chart { padding: 16px 20px 20px; }
.trend-svg { width: 100%; height: 120px; }
.trend-line {
  stroke-dasharray: 400;
  stroke-dashoffset: 400;
  animation: drawLine 1s ease forwards;
  animation-delay: 350ms;
}
@keyframes drawLine {
  to { stroke-dashoffset: 0; }
}
.trend-area { opacity: 0; animation: fadeInUp 0.6s ease forwards; animation-delay: 700ms; }
.trend-dot { opacity: 0; animation: popIn 0.3s ease forwards; animation-delay: var(--dot-delay, 0ms); }
@keyframes popIn {
  from { opacity: 0; transform: scale(0); }
  to { opacity: 1; transform: scale(1); }
}
.trend-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 24px; color: var(--text-secondary); font-size: 13px; }

/* Donation list */
.donation-list { display: flex; flex-direction: column; }
.donation-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; border-bottom: 1px solid #fafafa;
}
.donation-item:last-child { border-bottom: none; }
.donation-item__left { display: flex; align-items: center; gap: 12px; }
.donation-icon { width: 36px; height: 36px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.donation-title { font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0; }
.donation-meta { font-size: 12px; color: var(--text-secondary); margin: 2px 0 0; }
.donation-item__right { text-align: right; flex-shrink: 0; }
.donation-date { font-size: 12px; color: var(--text-secondary); margin: 0; }

.badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px; display: inline-block; margin-top: 4px; }
.capitalize { text-transform: capitalize; }

.empty-state { padding: 32px; text-align: center; color: var(--text-secondary); }
.icon-empty { width: 40px; height: 40px; margin: 0 auto 8px; color: #e5e7eb; }

/* Appointment */
.appt-body { padding: 20px; }
.appt-row { display: flex; align-items: flex-start; gap: 16px; }
.appt-date-chip {
  width: 56px; height: 56px; border-radius: 16px; flex-shrink: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: var(--primary); box-shadow: 0 1px 2px rgba(0,0,0,0.08);
}
.appt-date-chip__day { color: white; font-weight: 800; font-size: 20px; line-height: 1; }
.appt-date-chip__month { color: rgba(255,255,255,0.7); font-size: 10px; text-transform: uppercase; font-weight: 700; }
.appt-info { flex: 1; min-width: 0; }
.appt-type { font-weight: 700; font-size: 14px; margin: 0; color: var(--text-primary); }
.appt-meta-row { display: flex; align-items: center; gap: 6px; margin-top: 6px; font-size: 12px; color: var(--text-secondary); }
.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.appt-notice {
  margin-top: 16px; border-radius: 12px; padding: 10px 16px; font-size: 12px; font-weight: 600;
  text-align: center; background: #e3f2fd; color: var(--primary);
}

/* Eligibility */
.eligibility-body { padding: 20px; }
.eligibility-status-row { display: flex; align-items: center; gap: 12px; border-radius: 12px; padding: 12px; margin-bottom: 16px; }
.eligibility-status { font-size: 14px; font-weight: 700; margin: 0; }
.eligibility-until { font-size: 12px; color: #6b7280; margin: 2px 0 0; }
.eligibility-details { display: flex; flex-direction: column; gap: 8px; font-size: 12px; margin-bottom: 16px; }
.eligibility-details__row { display: flex; justify-content: space-between; }
.eligibility-details__label { color: var(--text-secondary); }
.eligibility-details__value { font-weight: 700; color: #374151; }

/* Quick actions */
.quick-actions { padding: 12px; display: flex; flex-direction: column; gap: 4px; }
.quick-action {
  display: flex; align-items: center; gap: 12px; padding: 10px 12px;
  border-radius: 12px; text-decoration: none; transition: background 0.15s ease;
}
.quick-action:hover { background: #f9fafb; }
.quick-action__icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.quick-action__label { font-size: 14px; font-weight: 600; color: #374151; flex: 1; }
.quick-action__chevron { color: #d1d5db; transition: color 0.15s ease; }
.quick-action:hover .quick-action__chevron { color: #9ca3af; }

/* Icon sizing */
.icon-xs { width: 14px; height: 14px; }
.icon-sm { width: 16px; height: 16px; }
.icon-md { width: 20px; height: 20px; flex-shrink: 0; }
.icon-white { color: white; }
.icon-white-faded { color: rgba(255,255,255,0.6); }

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
</style>