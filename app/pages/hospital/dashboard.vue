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
          <div class="skeleton skeleton--panel" style="height:340px" />
          <div class="skeleton skeleton--panel" style="height:260px" />
        </div>
        <div class="col-right">
          <div class="skeleton skeleton--panel" style="height:280px" />
          <div class="skeleton skeleton--panel" style="height:220px" />
          <div class="skeleton skeleton--panel" style="height:200px" />
        </div>
      </div>
      <div class="skeleton skeleton--panel" style="height:120px" />
    </div>

    <div v-else class="dashboard-inner">
      <!-- Header -->
      <header class="header-row fade-in" style="--delay: 0ms">
        <div>
          <h1 class="page-title">Hospital Blood Bank Dashboard</h1>
          <p class="page-subtitle">Manage blood requests, monitor request status, and check blood availability.</p>
        </div>
        <div class="header-actions">
          <NuxtLink to="/hospital/bloodrequests/newrequest" class="btn-primary">
            <AssetIcon name="plus" :size="16" />
            New Blood Request
          </NuxtLink>
        </div>
      </header>

      <!-- Summary KPI cards -->
      <div class="stats-grid">
        <div class="stat-card fade-in" style="--delay: 60ms">
          <div class="stat-card__top">
            <div class="stat-card__icon" style="background:#1565C014">
              <AssetIcon name="blood-drop" :size="16" style="color:#1565C0" />
            </div>
            <span class="stat-card__label">Available Blood Units</span>
          </div>
          <p class="stat-card__value">{{ unitsAvailable }}</p>
          <p class="stat-card__helper">Across all compatible blood types</p>
        </div>

        <div class="stat-card fade-in" style="--delay: 110ms">
          <div class="stat-card__top">
            <div class="stat-card__icon" style="background:#F57C0014">
              <AssetIcon name="clock" :size="16" style="color:#F57C00" />
            </div>
            <span class="stat-card__label">Pending Requests</span>
          </div>
          <p class="stat-card__value" style="color:#F57C00">{{ pendingCount }}</p>
          <p class="stat-card__helper">Awaiting Blood Center approval</p>
        </div>

        <div class="stat-card fade-in" style="--delay: 160ms">
          <div class="stat-card__top">
            <div class="stat-card__icon" style="background:#2E7D3214">
              <AssetIcon name="check-circle" :size="16" style="color:#2E7D32" />
            </div>
            <span class="stat-card__label">Approved Requests</span>
          </div>
          <p class="stat-card__value" style="color:#2E7D32">{{ approvedCount }}</p>
          <p class="stat-card__helper">Ready for processing</p>
        </div>

        <div class="stat-card fade-in" style="--delay: 210ms">
          <div class="stat-card__top">
            <div class="stat-card__icon" style="background:#1565C014">
              <AssetIcon name="trending-up" :size="16" style="color:#1565C0" />
            </div>
            <span class="stat-card__label">Completed Requests Today</span>
          </div>
          <p class="stat-card__value">{{ completedToday }}</p>
          <p class="stat-card__helper">Successfully fulfilled today</p>
        </div>
      </div>

      <!-- Main content -->
      <div class="main-grid">
        <!-- Left column -->
        <div class="col-left">
          <!-- Blood request trend -->
          <section class="panel fade-in" style="--delay: 260ms">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">Blood Request Trend</h2>
                <p class="panel-subtitle">Requests submitted over time</p>
              </div>
              <div class="segmented" role="tablist" aria-label="Trend period">
                <button type="button" role="tab" :aria-selected="trendPeriod === 'weekly'"
                  class="segmented__btn" :class="{ 'segmented__btn--active': trendPeriod === 'weekly' }"
                  @click="trendPeriod = 'weekly'">Weekly</button>
                <button type="button" role="tab" :aria-selected="trendPeriod === 'monthly'"
                  class="segmented__btn" :class="{ 'segmented__btn--active': trendPeriod === 'monthly' }"
                  @click="trendPeriod = 'monthly'">Monthly</button>
                <button type="button" role="tab" :aria-selected="trendPeriod === 'yearly'"
                  class="segmented__btn" :class="{ 'segmented__btn--active': trendPeriod === 'yearly' }"
                  @click="trendPeriod = 'yearly'">Yearly</button>
              </div>
            </div>

            <!-- Trend summary stats -->
            <div class="trend-stats">
              <div class="trend-stat">
                <p class="trend-stat__label">Total Requests</p>
                <p class="trend-stat__value">{{ trendTotal }}</p>
              </div>
              <div class="trend-stat">
                <p class="trend-stat__label">Avg. Daily Requests</p>
                <p class="trend-stat__value">{{ trendAverage }}</p>
              </div>
              <div class="trend-stat">
                <p class="trend-stat__label">Peak Day</p>
                <p class="trend-stat__value trend-stat__value--sm">{{ trendPeak }}</p>
              </div>
              <div class="trend-stat">
                <p class="trend-stat__label">Growth</p>
                <p class="trend-stat__value" :class="trendGrowthClass">{{ trendGrowthLabel }}</p>
              </div>
            </div>

            <div class="trend-body">
              <svg v-if="chartPoints.length" class="trend-svg" viewBox="0 0 640 200" preserveAspectRatio="none"
                role="img" aria-label="Blood request trend chart">
                <line v-for="g in gridLines" :key="g" x1="0" :x2="640" :y1="g" :y2="g" class="trend-grid" />
                <path :d="areaPath" class="trend-area" :class="{ 'trend-area--animate': chartAnimateKey }" />
                <path :d="linePath" class="trend-line" :class="{ 'trend-line--animate': chartAnimateKey }" />
                <g v-for="(pt, i) in chartPoints" :key="i">
                  <circle :cx="pt.x" :cy="pt.y" r="3.5" class="trend-dot"
                    :class="{ 'trend-dot--active': hoveredPoint === i }" />
                  <rect :x="pt.x - 18" y="0" width="36" height="200" fill="transparent"
                    tabindex="0" role="button" :aria-label="`${pt.label}: ${pt.value} requests`"
                    @mouseenter="hoveredPoint = i" @mouseleave="hoveredPoint = null"
                    @focus="hoveredPoint = i" @blur="hoveredPoint = null" />
                </g>
              </svg>
              <div v-else class="trend-empty">
                <AssetIcon name="trending-up" :size="36" style="color:#e5e7eb" />
                <p>Not enough data yet to show a request trend.</p>
              </div>

              <div v-if="hoveredPoint !== null" class="trend-tooltip"
                :style="{ left: tooltipLeft + '%' }">
                <span class="trend-tooltip__value">{{ chartPoints[hoveredPoint].value }} requests</span>
                <span class="trend-tooltip__label">{{ chartPoints[hoveredPoint].label }}</span>
              </div>

              <div class="trend-labels">
                <span v-for="pt in chartPoints" :key="pt.label">{{ pt.label }}</span>
              </div>
            </div>
          </section>

          <!-- Recent blood requests -->
          <section class="panel fade-in" style="--delay: 300ms">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">Recent Blood Requests</h2>
                <p class="panel-subtitle">Latest requests submitted from your facility</p>
              </div>
              <NuxtLink to="/hospital/bloodrequests" class="panel-link">
                View All
                <AssetIcon name="chevron-right" :size="14" />
              </NuxtLink>
            </div>

            <div v-if="recentRequests.length" class="request-table">
              <div class="request-table__head">
                <span>Reference</span>
                <span>Blood type</span>
                <span>Units</span>
                <span>Component</span>
                <span>Date</span>
                <span>Status</span>
                <span class="sr-only">Actions</span>
              </div>
              <div v-for="req in recentRequests" :key="req.id" class="request-row">
                <span class="request-row__ref">{{ req.reference_number }}</span>
                <span class="request-row__type">
                  <span class="type-chip">{{ req.blood_type }}</span>
                </span>
                <span>{{ req.quantity }}</span>
                <span class="request-row__component">{{ req.component_name }}</span>
                <span class="request-row__date">{{ req.date_label }}</span>
                <span>
                  <span class="badge" :style="{
                    background: statusMap[req.status]?.bg || '#f1f5f9',
                    color: statusMap[req.status]?.color || '#64748b',
                  }">{{ statusMap[req.status]?.label || req.status }}</span>
                </span>
                <span>
                  <NuxtLink :to="`/hospital/bloodrequests/${req.id}`" class="row-link">View Details</NuxtLink>
                </span>
              </div>
            </div>
            <div v-else class="empty-state">
              <AssetIcon name="inbox" :size="36" style="color:#e5e7eb" />
              <p>No blood requests submitted today.</p>
              <p class="empty-state__hint">New requests you submit will appear here.</p>
            </div>
          </section>
        </div>

        <!-- Right column -->
        <div class="col-right">
          <!-- Blood availability -->
          <section class="panel fade-in" style="--delay: 260ms">
            <div class="panel-header panel-header--simple">
              <h2 class="panel-title">Blood Availability</h2>
              <NuxtLink to="/hospital/availability" class="panel-link-plain">View Availability</NuxtLink>
            </div>

            <div v-if="bloodAvailability.length" class="availability-list">
              <div v-for="(item, i) in bloodAvailability" :key="item.blood_type" class="availability-row">
                <div class="availability-row__top">
                  <span class="availability-row__type">{{ item.blood_type }}</span>
                  <span class="availability-row__units">{{ item.units }} units</span>
                  <span class="status-dot" :class="`status-dot--${item.status}`">{{ statusLabel[item.status] }}</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" :class="`progress-fill--${item.status}`"
                    :style="{ width: (progressReady ? availabilityPercent(item) : 0) + '%', transitionDelay: (i * 60) + 'ms' }" />
                </div>
              </div>
            </div>
            <div v-else class="empty-state">
              <AssetIcon name="blood-drop" :size="36" style="color:#e5e7eb" />
              <p>No blood availability data available.</p>
              <p class="empty-state__hint">Stock levels from the Blood Center will show here.</p>
            </div>
          </section>

          <!-- Today's activities -->
          <section class="panel fade-in" style="--delay: 310ms">
            <div class="panel-header panel-header--simple">
              <h2 class="panel-title">Today's Activities</h2>
            </div>

            <div v-if="activities.length" class="timeline">
              <div v-for="(item, i) in activities" :key="i" class="timeline-row">
                <div class="timeline-row__rail">
                  <span class="timeline-dot" />
                  <span v-if="i !== activities.length - 1" class="timeline-line" />
                </div>
                <div class="timeline-row__body">
                  <p class="timeline-time">{{ item.time }}</p>
                  <p class="timeline-label">{{ item.label }}</p>
                </div>
              </div>
            </div>
            <div v-else class="empty-state empty-state--sm">
              <AssetIcon name="calendar" :size="30" style="color:#e5e7eb" />
              <p>No activities recorded today.</p>
            </div>
          </section>

          <!-- Recent notifications -->
          <section class="panel fade-in" style="--delay: 360ms">
            <div class="panel-header panel-header--simple">
              <h2 class="panel-title">Recent Notifications</h2>
            </div>

            <div v-if="notifications.length" class="notif-list">
              <div v-for="(n, i) in notifications" :key="i" class="notif-row">
                <div class="notif-row__icon" :style="{ background: `${n.color}14` }">
                  <AssetIcon :name="n.icon" :size="14" :style="{ color: n.color }" />
                </div>
                <div class="notif-row__body">
                  <p class="notif-row__message">{{ n.message }}</p>
                  <p class="notif-row__time">{{ n.time }}</p>
                </div>
              </div>
            </div>
            <div v-else class="empty-state empty-state--sm">
              <AssetIcon name="bell" :size="30" style="color:#e5e7eb" />
              <p>No urgent notifications.</p>
            </div>
          </section>
        </div>
      </div>

      <!-- Quick actions -->
      <section class="quick-section fade-in" style="--delay: 400ms">
        <h2 class="quick-section__title">Quick Actions</h2>
        <div class="quick-grid">
          <NuxtLink v-for="item in quickActions" :key="item.path" :to="item.path" class="quick-card">
            <div class="quick-card__icon" :style="{ background: `${item.color}14` }">
              <AssetIcon :name="item.icon" :size="20" :style="{ color: item.color }" />
            </div>
            <div class="quick-card__body">
              <p class="quick-card__title">{{ item.title }}</p>
              <p class="quick-card__desc">{{ item.description }}</p>
            </div>
            <AssetIcon name="chevron-right" :size="16" class="quick-card__chevron" />
          </NuxtLink>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { hospitalService } from '~/api/hospital/HospitalService'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard' })

const router = useRouter()
const goTo = (path) => router.push(path)

const loading = ref(true)
const progressReady = ref(false)
const chartAnimateKey = ref(false)

// Core KPI data (populated via animated counters)
const unitsAvailable = ref(0)
const pendingCount = ref(0)
const approvedCount = ref(0)
const completedToday = ref(0)

// Widgets data
const recentRequests = ref([])
const bloodAvailability = ref([])
const activities = ref([])
const notifications = ref([])
const weeklyTrend = ref([])
const monthlyTrend = ref([])
const yearlyTrend = ref([])

const unreadNotifications = computed(() => notifications.value.length)

// ---------- Animated counters ----------
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function animateCounter(targetRef, endValue, duration = 800) {
  const end = Number(endValue) || 0
  if (prefersReducedMotion()) {
    targetRef.value = end
    return
  }
  const start = 0
  const startTime = performance.now()
  function tick(now) {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    targetRef.value = Math.round(start + (end - start) * eased)
    if (progress < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

// ---------- Status maps ----------
const statusMap = {
  pending: { label: 'Pending', bg: '#F57C0014', color: '#F57C00' },
  approved: { label: 'Approved', bg: '#2E7D3214', color: '#2E7D32' },
  processing: { label: 'Processing', bg: '#1565C014', color: '#1565C0' },
  ready: { label: 'Ready for Pickup', bg: '#5E35B114', color: '#5E35B1' },
  completed: { label: 'Completed', bg: '#2E7D3214', color: '#2E7D32' },
  rejected: { label: 'Rejected', bg: '#D32F2F14', color: '#D32F2F' },
  cancelled: { label: 'Cancelled', bg: '#94A3B814', color: '#64748B' },
}

const statusLabel = {
  healthy: 'Healthy',
  low: 'Low',
  critical: 'Critical',
}

function availabilityPercent(item) {
  if (!item.max) return 0
  return Math.min(100, Math.round((item.units / item.max) * 100))
}

// ---------- Trend chart ----------
const trendPeriod = ref('weekly')
const hoveredPoint = ref(null)

const gridLines = [20, 65, 110, 155]

const trendSource = computed(() => {
  if (trendPeriod.value === 'weekly') return weeklyTrend.value
  if (trendPeriod.value === 'monthly') return monthlyTrend.value
  return yearlyTrend.value
})

const chartPoints = computed(() => {
  const source = trendSource.value
  if (!source.length) return []

  const chartWidth = 640
  const chartHeight = 176
  const padX = 20
  const padTop = 16
  const values = source.map(s => s.value)
  const maxVal = Math.max(...values, 1)

  const step = source.length > 1 ? (chartWidth - padX * 2) / (source.length - 1) : 0

  return source.map((d, i) => ({
    x: padX + i * step,
    y: padTop + (chartHeight - padTop) * (1 - d.value / maxVal),
    value: d.value,
    label: d.label,
  }))
})

// ---------- Trend summary stats ----------
const trendTotal = computed(() => trendSource.value.reduce((sum, d) => sum + (Number(d.value) || 0), 0))

const trendAverage = computed(() => {
  const source = trendSource.value
  if (!source.length) return 0
  return Math.round((trendTotal.value / source.length) * 10) / 10
})

const trendPeak = computed(() => {
  const source = trendSource.value
  if (!source.length) return '—'
  const max = source.reduce((best, d) => (d.value > best.value ? d : best), source[0])
  return `${max.label} (${max.value})`
})

const trendGrowth = computed(() => {
  const source = trendSource.value
  if (source.length < 2) return null
  const first = Number(source[0].value) || 0
  const last = Number(source[source.length - 1].value) || 0
  if (first === 0) return last > 0 ? 100 : 0
  return Math.round(((last - first) / first) * 1000) / 10
})

const trendGrowthLabel = computed(() => {
  if (trendGrowth.value === null) return '—'
  const sign = trendGrowth.value > 0 ? '+' : ''
  return `${sign}${trendGrowth.value}%`
})

const trendGrowthClass = computed(() => {
  if (trendGrowth.value === null) return ''
  if (trendGrowth.value > 0) return 'trend-stat__value--up'
  if (trendGrowth.value < 0) return 'trend-stat__value--down'
  return ''
})

const tooltipLeft = computed(() => {
  if (hoveredPoint.value === null || !chartPoints.value.length) return 0
  return (chartPoints.value[hoveredPoint.value].x / 640) * 100
})

function buildSmoothPath(points) {
  if (points.length < 2) return points.length === 1 ? `M ${points[0].x} ${points[0].y}` : ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }
  return d
}

const linePath = computed(() => buildSmoothPath(chartPoints.value))

const areaPath = computed(() => {
  const pts = chartPoints.value
  if (pts.length < 2) return ''
  const base = buildSmoothPath(pts)
  const last = pts[pts.length - 1]
  const first = pts[0]
  return `${base} L ${last.x} 200 L ${first.x} 200 Z`
})

// ---------- Quick actions ----------
const quickActions = [
  {
    path: '/hospital/newrequest',
    icon: 'file-plus',
    color: '#1565C0',
    title: 'Create Blood Request',
    description: 'Submit a new request to the Blood Center',
  },
  {
    path: '/hospital/availability',
    icon: 'search',
    color: '#2E7D32',
    title: 'Search Blood Availability',
    description: 'Check current stock by blood type',
  },
  {
    path: '/hospital/bloodrequests',
    icon: 'truck',
    color: '#5E35B1',
    title: 'Track Requests',
    description: 'Follow the status of active requests',
  },
]

onMounted(async () => {
  try {
    // // Dev note: dashboard() kay mag-return unta og
    // // { units_available, pending_requests, approved_requests, completed_today,
    // //   recent_requests, blood_availability, activities, notifications,
    // //   weekly_trend, monthly_trend, yearly_trend }
    // // gikan sa GET /hospital/dashboard endpoint.
    // // Hospital side dili mo-manage og inventory/fulfillment — read-only ra sila
    // // sa availability data gikan sa Blood Center.
    const data = await hospitalService.dashboard()

    recentRequests.value = data.recent_requests ?? []
    bloodAvailability.value = data.blood_availability ?? []
    activities.value = data.activities ?? []
    notifications.value = data.notifications ?? []
    weeklyTrend.value = data.weekly_trend ?? []
    monthlyTrend.value = data.monthly_trend ?? []
    yearlyTrend.value = data.yearly_trend ?? []

    loading.value = false

    await nextTick()
    // Trigger entrance animations once the real content is in the DOM
    chartAnimateKey.value = true
    animateCounter(unitsAvailable, data.units_available ?? 0)
    animateCounter(pendingCount, data.pending_requests ?? 0)
    animateCounter(approvedCount, data.approved_requests ?? 0)
    animateCounter(completedToday, data.completed_today ?? 0)
    requestAnimationFrame(() => { progressReady.value = true })
  } catch (err) {
    console.error('Failed to load hospital dashboard data:', err)

    loading.value = false
  }
})
</script>

<style scoped>
.dashboard {
  --primary: #1565c0;
  --primary-hover: #0d47a1;
  --light-blue: #42a5f5;
  --bg: #f7f9fc;
  --surface: #ffffff;
  --border: #e5eaf0;
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --text-muted: #94a3b8;
  --danger: #d32f2f;
  --warning: #f57c00;
  --success: #2e7d32;
  --info: #0288d1;
  --purple: #5e35b1;
  font-family: var(--rb-font-sans);
  max-width: 1400px;
  background: var(--bg);
  margin: 0 auto;
  padding: 24px 32px 40px;
  transition: background-color 0.2s ease;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* Skeleton */
.skeleton {
  background: linear-gradient(90deg, #eef1f5 25%, #f6f8fa 37%, #eef1f5 63%);
  background-size: 400% 100%;
  border-radius: 18px;
  animation: shimmer 1.4s ease infinite;
}
.skeleton--header { height: 48px; max-width: 360px; }
.skeleton--card { height: 128px; }
.skeleton--panel { border-radius: 18px; }

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}


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
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  margin: 0;
}

.page-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 4px 0 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon-btn {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
}
.icon-btn:hover { color: var(--primary); border-color: var(--primary); transform: translateY(-1px); }
.icon-btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.icon-btn__dot {
  position: absolute;
  top: 7px;
  right: 8px;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--danger);
  border: 1.5px solid var(--surface);
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 18px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  color: white;
  background: var(--primary);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  transition: background 0.15s ease, transform 0.15s ease;
  border: none;
  cursor: pointer;
  text-decoration: none;
}
.btn-primary:hover { background: var(--primary-hover); transform: translateY(-1px); }
.btn-primary:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }

/* Stat cards */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.stat-card {
  background: var(--surface);
  border-radius: 18px;
  padding: 22px 24px 20px;
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.05);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background-color 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
}

.stat-card__top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.stat-card__icon {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stat-card__label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
}
.stat-card__value {
  font-size: 42px;
  font-weight: 800;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
  margin: 4px 0 0;
  line-height: 1;
}
.stat-card__helper {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  margin: 6px 0 0;
}

/* Layout */
.main-grid {
  display: grid;
  grid-template-columns: 7fr 3fr;
  gap: 20px;
}
.col-left, .col-right {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Panels */
.panel {
  background: var(--surface);
  border-radius: 18px;
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.05);
  border: 1px solid var(--border);
  overflow: hidden;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
}
.panel-header--simple { padding: 20px 24px; }
.panel-title {
  font-weight: 700;
  font-size: 18px;
  color: var(--text-primary);
  margin: 0;
}

.panel-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 3px 0 0;
}
.panel-link {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
  display: flex;
  align-items: center;
  gap: 2px;
  text-decoration: none;
  border-radius: 4px;
  flex-shrink: 0;
}

.panel-link:hover { text-decoration: underline; }
.panel-link:focus-visible, .panel-link-plain:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.panel-link-plain {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
  text-decoration: none;
  border-radius: 4px;
}

.panel-link-plain:hover { text-decoration: underline; }

/* Segmented control */
.segmented {
  display: inline-flex;
  background: #f1f5f9;
  border-radius: 10px;
  padding: 3px;
  flex-shrink: 0;
}
.segmented__btn {
  border: none;
  background: transparent;
  padding: 6px 12px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-secondary);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.segmented__btn--active {
  background: var(--surface);
  color: var(--primary);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}
.segmented__btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }

/* Trend summary stats */
.trend-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  padding: 16px 24px 0;
}
.trend-stat {
  background: #f8fafc;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 12px;
}
.trend-stat__label {
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-muted);
  margin: 0 0 4px;
}
.trend-stat__value {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  font-variant-numeric: tabular-nums;
}
.trend-stat__value--sm { font-size: 13.5px; }
.trend-stat__value--up { color: var(--success); }
.trend-stat__value--down { color: var(--danger); }

/* Trend chart */
.trend-body {
  position: relative;
  padding: 18px 24px 20px;
}
.trend-svg {
  width: 100%;
  height: 176px;
  overflow: visible;
}
.trend-grid { stroke: var(--border); stroke-width: 1; }
.trend-area { fill: rgba(21, 101, 192, 0.08); }
.trend-line {
  fill: none;
  stroke: var(--primary);
  stroke-width: 2.5;
  stroke-linecap: round;
}
.trend-line--animate {
  stroke-dasharray: 1400;
  stroke-dashoffset: 1400;
  animation: drawLine 0.9s ease forwards;
}
@keyframes drawLine {
  to { stroke-dashoffset: 0; }
}
.trend-area--animate {
  animation: fadeInArea 0.9s ease forwards;
}
@keyframes fadeInArea {
  from { opacity: 0; }
  to { opacity: 1; }
}
.trend-dot {
  fill: var(--surface);
  stroke: var(--primary);
  stroke-width: 2;
  transition: r 0.15s ease;
}
.trend-dot--active { r: 5.5; fill: var(--primary); }

.trend-tooltip {
  position: absolute;
  top: 6px;
  transform: translateX(-50%);
  background: var(--text-primary);
  color: white;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 11.5px;
  white-space: nowrap;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  z-index: 2;
}
.trend-tooltip__value { font-weight: 700; }
.trend-tooltip__label { color: #cbd5e1; font-size: 10.5px; }

.trend-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-muted);
}
.trend-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 30px;
  color: var(--text-secondary);
  font-size: 12.5px;
}

/* Request table */
.request-table {
  padding: 4px 0 8px;
}
.request-table__head {
  display: grid;
  grid-template-columns: 1.2fr 0.7fr 0.6fr 1fr 1fr 1fr 1fr;
  gap: 8px;
  padding: 10px 24px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-muted);
}
.request-row {
  display: grid;
  grid-template-columns: 1.2fr 0.7fr 0.6fr 1fr 1fr 1fr 1fr;
  gap: 8px;
  align-items: center;
  padding: 12px 24px;
  border-top: 1px solid var(--border);
  font-size: 13px;
  color: var(--text-primary);
  transition: background 0.15s ease;
}
.request-row:hover { background: #f8fafc; }
.request-row__ref { font-weight: 600; }
.type-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: #1565c014;
  color: var(--primary);
}
.request-row__component, .request-row__date { color: var(--text-secondary); }
.badge {
  font-size: 10.5px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  display: inline-block;
}
.row-link {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--primary);
  text-decoration: none;
}
.row-link:hover { text-decoration: underline; }

.empty-state {
  padding: 32px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}
.empty-state p { margin: 10px 0 0; }
.empty-state__hint {
  font-size: 11.5px !important;
  color: var(--text-muted);
  margin-top: 4px !important;
}
.empty-state--sm { padding: 24px; }

/* Blood availability */
.availability-list {
  padding: 16px 24px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.availability-row__top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.availability-row__type {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-primary);
  min-width: 32px;
}
.availability-row__units {
  font-size: 12px;
  color: var(--text-secondary);
  flex: 1;
}
.status-dot {
  font-size: 10.5px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
}
.status-dot--healthy { background: #2e7d3214; color: var(--success); }
.status-dot--low { background: #f57c0014; color: var(--warning); }
.status-dot--critical { background: #d32f2f14; color: var(--danger); }

.progress-track {
  height: 6px;
  border-radius: 999px;
  background: #f1f5f9;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: 999px;
  width: 0%;
  transition: width 0.7s cubic-bezier(0.22, 1, 0.36, 1);
}
.progress-fill--healthy { background: var(--success); }
.progress-fill--low { background: var(--warning); }
.progress-fill--critical { background: var(--danger); }

/* Timeline */
.timeline {
  padding: 16px 24px 20px;
  display: flex;
  flex-direction: column;
}
.timeline-row {
  display: flex;
  gap: 12px;
}
.timeline-row__rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 12px;
  flex-shrink: 0;
}
.timeline-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--primary);
  margin-top: 4px;
  flex-shrink: 0;
}
.timeline-line {
  flex: 1;
  width: 2px;
  background: var(--border);
  margin: 3px 0;
  min-height: 22px;
}
.timeline-row__body { padding-bottom: 16px; }
.timeline-time {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  margin: 0 0 2px;
}
.timeline-label {
  font-size: 13px;
  color: var(--text-primary);
  margin: 0;
}

/* Notifications */
.notif-list {
  padding: 10px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.notif-row {
  display: flex;
  gap: 10px;
  padding: 10px 8px;
  border-radius: 12px;
  transition: background 0.15s ease;
}
.notif-row:hover { background: #f8fafc; }
.notif-row__icon {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.notif-row__message {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.4;
}
.notif-row__time {
  font-size: 11px;
  color: var(--text-muted);
  margin: 2px 0 0;
}

/* Quick actions */
.quick-section__title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 14px;
}
.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}
.quick-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.05);
  text-decoration: none;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
.quick-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
}
.quick-card:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.quick-card__icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.quick-card__body { flex: 1; min-width: 0; }
.quick-card__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}
.quick-card__desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 2px 0 0;
}
.quick-card__chevron { color: #d1d5db; flex-shrink: 0; transition: color 0.15s ease; }
.quick-card:hover .quick-card__chevron { color: var(--primary); }

/* Responsive */
@media (max-width: 1180px) {
  .quick-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 1024px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .main-grid { grid-template-columns: 1fr; }
  .request-table__head { display: none; }
  .request-row {
    grid-template-columns: 1fr 1fr;
    row-gap: 6px;
  }
  .trend-stats { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .dashboard { padding: 16px 16px 32px; }
  .header-row { flex-direction: column; align-items: stretch; }
  .header-actions { justify-content: flex-end; flex-wrap: wrap; }
  .quick-grid { grid-template-columns: 1fr; }
  .page-title { font-size: 22px; }
  .stat-card__value { font-size: 34px; }
}

/* ============ Dark mode ============ */
:global(.dark .dashboard) {
  --text-primary: #F1F5F9;
  --text-secondary: #94A3B8;
  --text-muted: #64748B;
  --border: #334155;
  --surface: #1E293B;
  --bg: #0F172A;
  background: #0F172A;
}
:global(.dark .stat-card),
:global(.dark .panel),
:global(.dark .quick-card),
:global(.dark .icon-btn) {
  background: #1E293B;
  border-color: #334155;
}
:global(.dark .icon-btn__dot) { border-color: #1E293B; }
:global(.dark .segmented) { background: #263449; }
:global(.dark .segmented__btn--active) { background: #1E293B; }
:global(.dark .panel-header) { border-color: #334155; }
:global(.dark .request-row) { border-color: #334155; }
:global(.dark .request-row:hover) { background: #263449; }
:global(.dark .trend-stat) { background: #263449; border-color: #334155; }
:global(.dark .trend-grid) { stroke: #334155; }
:global(.dark .trend-area) { fill: rgba(66, 165, 245, 0.12); }
:global(.dark .trend-dot) { fill: #1E293B; }
:global(.dark .trend-tooltip) { background: #0B1220; }
:global(.dark .progress-track) { background: #263449; }
:global(.dark .notif-row:hover) { background: #263449; }
:global(.dark .type-chip) { background: rgba(66,165,245,0.14); }
:global(.dark .status-dot--healthy) { background: rgba(102,187,106,0.16); }
:global(.dark .status-dot--low) { background: rgba(255,167,38,0.16); }
:global(.dark .status-dot--critical) { background: rgba(239,83,80,0.16); }
/* background-image, not the `background` shorthand: the shorthand resets
   background-size to `auto`, which collapses the 400%-wide gradient to the
   element width and leaves the shimmer keyframes with zero travel. */
:global(.dark .skeleton) {
  background-image: linear-gradient(90deg, #1E293B 25%, #263449 37%, #1E293B 63%);
}
</style>
