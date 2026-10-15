<template>
  <div class="dashboard scope-hospital-dashboard">
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
      <PageHeader title="Hospital Blood Bank Dashboard" subtitle="Manage blood requests, monitor request status, and check blood availability.">
        <template #actions>
          <NuxtLink to="/hospital/bloodrequests/newrequest" class="ui-btn ui-btn--primary">
            <AssetIcon name="plus" :size="15" />
            New Blood Request
          </NuxtLink>
        </template>
      </PageHeader>

      <LowStockBanner :cells="lowStock" to="/hospital/stock-thresholds" class="low-stock-banner" />

      <!-- Summary figures: each opens the page that owns the number. -->
      <StatStrip>
        <StatItem label="Available blood units" :value="unitsAvailable" hint="Across all compatible blood types" icon="blood-drop" tone="primary" to="/hospital/bloodavailability" />
        <StatItem label="Pending requests" :value="pendingCount" hint="Awaiting Blood Center approval" icon="clock" tone="warning" to="/hospital/bloodrequests" />
        <StatItem label="Approved requests" :value="approvedCount" hint="Ready for processing" icon="check-circle" tone="success" to="/hospital/bloodrequests" />
        <StatItem label="Completed requests today" :value="completedToday" hint="Successfully fulfilled today" icon="trending-up" tone="primary" to="/hospital/trackrequests" />
      </StatStrip>

      <!-- Main content -->
      <div class="main-grid">
        <!-- Left column -->
        <div class="col-left">
          <!-- Blood request trend -->
          <SectionCard title="Blood Request Trend" subtitle="Requests submitted over time" flush>
            <template #actions>
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
            </template>

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
              <EmptyState v-else icon="trending-up" title="No trend yet" description="Not enough data yet to show a request trend." compact />

              <div v-if="hoveredPoint !== null" class="trend-tooltip"
                :style="{ left: tooltipLeft + '%' }">
                <span class="trend-tooltip__value">{{ chartPoints[hoveredPoint].value }} requests</span>
                <span class="trend-tooltip__label">{{ chartPoints[hoveredPoint].label }}</span>
              </div>

              <div v-if="chartPoints.length" class="trend-labels">
                <span v-for="pt in chartPoints" :key="pt.label">{{ pt.label }}</span>
              </div>
            </div>
          </SectionCard>

          <!-- Recent blood requests -->
          <SectionCard title="Recent Blood Requests" subtitle="Latest requests submitted from your facility" flush>
            <template #actions>
              <NuxtLink to="/hospital/bloodrequests" class="panel-link">
                View All
                <AssetIcon name="chevron-right" :size="14" />
              </NuxtLink>
            </template>

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
                  <StatusBadge :tone="statusMap[req.status]?.tone || 'neutral'">{{ statusMap[req.status]?.label || req.status }}</StatusBadge>
                </span>
                <span>
                  <NuxtLink :to="`/hospital/bloodrequests/${req.id}`" class="row-link">View Details</NuxtLink>
                </span>
              </div>
            </div>
            <EmptyState v-else icon="inbox" title="No blood requests submitted today." description="New requests you submit will appear here." />
          </SectionCard>
        </div>

        <!-- Right column -->
        <div class="col-right">
          <!-- Blood availability -->
          <SectionCard title="Blood Availability" flush>
            <template #actions>
              <NuxtLink to="/hospital/bloodavailability" class="panel-link">View Availability</NuxtLink>
            </template>

            <div v-if="bloodAvailability.length" class="availability-list">
              <div v-for="(item, i) in bloodAvailability" :key="item.blood_type" class="availability-row">
                <div class="availability-row__top">
                  <span class="availability-row__type">{{ item.blood_type }}</span>
                  <span class="availability-row__units">{{ item.units }} units</span>
                  <StatusBadge :tone="availabilityTone[item.status] || 'neutral'">{{ statusLabel[item.status] }}</StatusBadge>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" :class="`progress-fill--${item.status}`"
                    :style="{ width: (progressReady ? availabilityPercent(item) : 0) + '%', transitionDelay: (i * 60) + 'ms' }" />
                </div>
              </div>
            </div>
            <EmptyState v-else icon="blood-drop" title="No blood availability data available." description="Stock levels from the Blood Center will show here." compact />
          </SectionCard>

          <!-- Today's activities -->
          <SectionCard title="Today's Activities" flush>
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
            <EmptyState v-else icon="calendar" title="No activities recorded today." compact />
          </SectionCard>

          <!-- Recent notifications -->
          <SectionCard title="Recent Notifications" flush>
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
            <EmptyState v-else icon="bell" title="No urgent notifications." compact />
          </SectionCard>
        </div>
      </div>

      <!-- Quick actions -->
      <section class="quick-section">
        <h2 class="quick-section__title">Quick Actions</h2>
        <div class="quick-grid">
          <NuxtLink v-for="item in quickActions" :key="item.path" :to="item.path" class="quick-card">
            <div class="quick-card__icon">
              <AssetIcon :name="item.icon" :size="20" />
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
import LowStockBanner from '~/components/common/LowStockBanner.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import StatStrip from '~/components/ui/StatStrip.vue'
import StatItem from '~/components/ui/StatItem.vue'
import SectionCard from '~/components/ui/SectionCard.vue'
import StatusBadge from '~/components/ui/StatusBadge.vue'
import EmptyState from '~/components/ui/EmptyState.vue'
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
// Each status as a StatusBadge tone, so the colours match every staff page.
const statusMap = {
  pending: { label: 'Pending', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  processing: { label: 'Processing', tone: 'info' },
  // The two fulfilment states the API sends once units are released.
  partial: { label: 'Partially Fulfilled', tone: 'warning' },
  fulfilled: { label: 'Fulfilled', tone: 'success' },
  ready: { label: 'Ready for Pickup', tone: 'purple' },
  completed: { label: 'Completed', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}

const availabilityTone = {
  healthy: 'success',
  low: 'warning',
  critical: 'danger',
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
    path: '/hospital/bloodrequests/newrequest',
    icon: 'file-plus',
    title: 'Create Blood Request',
    description: 'Submit a new request to the Blood Center',
  },
  {
    path: '/hospital/bloodavailability',
    icon: 'search',
    title: 'Search Blood Availability',
    description: 'Check current stock by blood type',
  },
  {
    path: '/hospital/trackrequests',
    icon: 'route',
    title: 'Track Requests',
    description: 'Follow the status of active requests',
  },
]

// Loaded on its own so the banner does not depend on the dashboard call below.
// Supplementary: a failure leaves no banner.
const lowStock = ref([])

onMounted(async () => {
  try {
    lowStock.value = (await hospitalService.stockThresholds()).low ?? []
  } catch (err) {
    console.error('Failed to load stock thresholds:', err)
  }
})

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
/* On the shared staff UI (2026-10-15): tokens only, so dark mode follows them. */
.dashboard {
  font-family: var(--rb-font-sans);
  max-width: var(--rb-content-max, 1600px);
  background: var(--rb-page-bg);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
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
  background: linear-gradient(90deg, var(--rb-surface-alt) 25%, var(--rb-surface-hover) 37%, var(--rb-surface-alt) 63%);
  background-size: 400% 100%;
  border-radius: var(--rb-radius-lg);
  animation: shimmer 1.4s ease infinite;
}
.skeleton--header { height: 48px; max-width: 360px; }
.skeleton--card { height: 96px; }

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton, .trend-line--animate, .trend-area--animate { animation: none !important; }
  .trend-line--animate { stroke-dashoffset: 0; }
  .progress-fill { transition: none; }
}

.low-stock-banner:empty { display: none; }

.dashboard-inner {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

/* Layout */
.main-grid {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 3fr);
  gap: 20px;
}
.col-left, .col-right {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

.panel-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--rb-primary-text);
  text-decoration: none;
  border-radius: 4px;
}
.panel-link:hover { text-decoration: underline; }
.panel-link:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

/* Segmented control */
.segmented {
  display: inline-flex;
  flex-shrink: 0;
  padding: 3px;
  border-radius: 10px;
  background: var(--rb-surface-alt);
}
.segmented__btn {
  padding: 6px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.segmented__btn--active {
  background: var(--rb-surface);
  color: var(--rb-primary-text);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}
.segmented__btn:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

/* Trend summary stats */
.trend-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  padding: 16px 20px 0;
}
.trend-stat {
  padding: 10px 12px;
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  background: var(--rb-surface-alt);
}
.trend-stat__label {
  margin: 0 0 4px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--rb-text-secondary);
}
.trend-stat__value {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--rb-text-primary);
  font-variant-numeric: tabular-nums;
}
.trend-stat__value--sm { font-size: 13.5px; }
.trend-stat__value--up { color: var(--rb-success); }
.trend-stat__value--down { color: var(--rb-accent); }

/* Trend chart */
.trend-body {
  position: relative;
  padding: 18px 20px 20px;
}
.trend-svg {
  width: 100%;
  height: 176px;
  overflow: visible;
}
.trend-grid { stroke: var(--rb-border); stroke-width: 1; }
.trend-area { fill: rgba(var(--rb-primary-rgb), 0.08); }
.trend-line {
  fill: none;
  stroke: var(--rb-primary);
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
.trend-area--animate { animation: fadeInArea 0.9s ease forwards; }
@keyframes fadeInArea {
  from { opacity: 0; }
  to { opacity: 1; }
}
.trend-dot {
  fill: var(--rb-surface);
  stroke: var(--rb-primary);
  stroke-width: 2;
  transition: r 0.15s ease;
}
.trend-dot--active { r: 5.5; fill: var(--rb-primary); }

.trend-tooltip {
  position: absolute;
  top: 6px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 6px 10px;
  border-radius: 8px;
  background: #0F172A;
  color: #fff;
  font-size: 11.5px;
  white-space: nowrap;
  pointer-events: none;
  transform: translateX(-50%);
}
.trend-tooltip__value { font-weight: 700; }
.trend-tooltip__label { color: #CBD5E1; font-size: 10.5px; }

.trend-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 11px;
  color: var(--rb-text-muted);
}

/* Request table */
.request-table { padding: 0 0 6px; }
.request-table__head,
.request-row {
  display: grid;
  grid-template-columns: 1.2fr 0.7fr 0.6fr 1fr 1fr 1.1fr 0.9fr;
  gap: 8px;
  align-items: center;
  padding: 10px 20px;
}
.request-table__head {
  background: var(--rb-surface-alt);
  font-size: 12px;
  font-weight: 600;
  color: var(--rb-text-secondary);
}
.request-row {
  padding-top: 12px;
  padding-bottom: 12px;
  border-top: 1px solid var(--rb-border);
  font-size: 13px;
  color: var(--rb-text-primary);
  transition: background 0.15s ease;
}
.request-row:hover { background: var(--rb-surface-hover); }
.request-row__ref { font-weight: 600; font-family: var(--rb-font-mono, ui-monospace, monospace); font-size: 12.5px; }
.type-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(var(--rb-primary-rgb), 0.1);
  color: var(--rb-primary-text);
  font-size: 11px;
  font-weight: 700;
}
.request-row__component, .request-row__date { color: var(--rb-text-secondary); }
.row-link {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--rb-primary-text);
  text-decoration: none;
}
.row-link:hover { text-decoration: underline; }

/* Blood availability */
.availability-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 20px 20px;
}
.availability-row__top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.availability-row__type {
  min-width: 32px;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--rb-text-primary);
}
.availability-row__units {
  flex: 1;
  font-size: 12px;
  color: var(--rb-text-secondary);
}

.progress-track {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--rb-surface-alt);
}
.progress-fill {
  width: 0%;
  height: 100%;
  border-radius: 999px;
  transition: width 0.7s cubic-bezier(0.22, 1, 0.36, 1);
}
.progress-fill--healthy { background: var(--rb-success); }
.progress-fill--low { background: var(--rb-warning); }
.progress-fill--critical { background: var(--rb-accent); }

/* Timeline */
.timeline {
  display: flex;
  flex-direction: column;
  padding: 16px 20px 20px;
}
.timeline-row { display: flex; gap: 12px; }
.timeline-row__rail {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  align-items: center;
  width: 12px;
}
.timeline-dot {
  flex-shrink: 0;
  width: 9px;
  height: 9px;
  margin-top: 4px;
  border-radius: 999px;
  background: var(--rb-primary);
}
.timeline-line {
  flex: 1;
  width: 2px;
  min-height: 22px;
  margin: 3px 0;
  background: var(--rb-border);
}
.timeline-row__body { padding-bottom: 16px; }
.timeline-time {
  margin: 0 0 2px;
  font-size: 11px;
  font-weight: 600;
  color: var(--rb-text-muted);
}
.timeline-label {
  margin: 0;
  font-size: 13px;
  color: var(--rb-text-primary);
}

/* Notifications */
.notif-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px 14px;
}
.notif-row {
  display: flex;
  gap: 10px;
  padding: 10px 8px;
  border-radius: 12px;
  transition: background 0.15s ease;
}
.notif-row:hover { background: var(--rb-surface-hover); }
.notif-row__icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
}
.notif-row__message {
  margin: 0;
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--rb-text-primary);
}
.notif-row__time {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--rb-text-muted);
}

/* Quick actions */
.quick-section__title {
  margin: 0 0 12px;
  font-size: var(--rb-fs-section);
  font-weight: 700;
  color: var(--rb-text-primary);
}
.quick-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.quick-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border: 1px solid var(--rb-border);
  border-radius: var(--rb-radius-lg);
  background: var(--rb-surface);
  box-shadow: var(--rb-shadow-sm);
  text-decoration: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.quick-card:hover {
  border-color: rgba(var(--rb-primary-rgb), 0.35);
  box-shadow: 0 6px 18px -8px rgba(15, 23, 42, 0.18);
}
.quick-card:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.quick-card__icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(var(--rb-primary-rgb), 0.1);
  color: var(--rb-primary-text);
}
.quick-card__body { flex: 1; min-width: 0; }
.quick-card__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--rb-text-primary);
}
.quick-card__desc {
  margin: 2px 0 0;
  font-size: 12.5px;
  color: var(--rb-text-secondary);
}
.quick-card__chevron { flex-shrink: 0; color: var(--rb-text-muted); transition: color 0.15s ease; }
.quick-card:hover .quick-card__chevron { color: var(--rb-primary-text); }

/* Responsive */
@media (max-width: 1180px) {
  .quick-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
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
  .quick-grid { grid-template-columns: 1fr; }
}
</style>
