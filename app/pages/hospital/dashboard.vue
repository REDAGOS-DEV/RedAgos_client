<template>
  <div class="dashboard scope-hospital-dashboard">
    <div class="dashboard-inner">
      <PageHeader title="Blood Bank Dashboard" :subtitle="hospitalPageSubtitle('dashboard', can)">
        <template #actions>
          <NuxtLink to="/hospital/bloodrequests/newrequest" class="ui-btn ui-btn--primary">
            <AssetIcon name="plus" :size="15" />
            New Blood Request
          </NuxtLink>
        </template>
      </PageHeader>

      <p v-if="loadError" class="load-error" role="alert">
        <AssetIcon name="circle-alert" :size="15" />
        <span>{{ loadError }}</span>
      </p>

      <!-- What waits now, first on every dashboard. -->
      <NeedsYou :tasks="needsYou" :loaded="!loading && !loadError" class="needs-you" />

      <LowStockBanner :cells="lowStock" to="/hospital/stock-thresholds" class="low-stock-banner" />

      <!--
        The summary as two chart cards (project owner, 2026-11-26, option A):
        where the patient requests stand, and what the shelf holds by blood type.
      -->
      <HospitalDashboardSummary
        :loading="loading"
        :show-requests="can('hospital.requests.view')"
        :show-stock="can('hospital.inventory.view')"
        :pending="pendingCount"
        :in-progress="approvedCount"
        :fulfilled-today="completedToday"
        :units-available="unitsAvailable"
        :untagged-after="untaggedCrossmatched"
        :untagged-before="untaggedAssigned"
        :thresholds="thresholds"
      />

      <!-- The shelf by blood type is the Blood bank card's chart now; the type cards stay on Blood Bank Inventory (2026-11-26). -->

      <!--
        The two trend charts side by side (2026-11-26), so both read at a glance:
        what was asked of blood centers, and what moved on the shelf.
      -->
      <div class="chart-row">
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
              <span v-if="loading" class="sk sk--figure" />
              <p v-else class="trend-stat__value">{{ trendTotal }}</p>
            </div>
            <div class="trend-stat">
              <p class="trend-stat__label">Avg. Daily Requests</p>
              <span v-if="loading" class="sk sk--figure" />
              <p v-else class="trend-stat__value">{{ trendAverage }}</p>
            </div>
            <div class="trend-stat">
              <p class="trend-stat__label">Peak Day</p>
              <span v-if="loading" class="sk sk--figure" />
              <p v-else class="trend-stat__value trend-stat__value--sm">{{ trendPeak }}</p>
            </div>
            <div class="trend-stat">
              <p class="trend-stat__label">Growth</p>
              <span v-if="loading" class="sk sk--figure" />
              <p v-else class="trend-stat__value" :class="trendGrowthClass">{{ trendGrowthLabel }}</p>
            </div>
          </div>

          <div class="trend-body">
            <SkeletonChart v-if="loading" />
            <svg v-else-if="chartPoints.length" class="trend-svg" viewBox="0 0 640 200" preserveAspectRatio="none"
              role="img" aria-label="Blood request trend chart">
              <line v-for="g in gridLines" :key="g" x1="0" :x2="640" :y1="g" :y2="g" class="trend-grid" />
              <line x1="0" x2="640" :y1="TREND_BASE" :y2="TREND_BASE" class="trend-base" />
              <g v-for="(pt, i) in chartPoints" :key="i" class="trend-col" :class="{ 'trend-col--on': hoveredPoint === i }">
                <!-- The whole period is the target, not only its bar. -->
                <rect :x="pt.x - pt.slot / 2" y="0" :width="pt.slot" :height="TREND_BASE" class="trend-hit" />
                <rect
                  :x="pt.x - pt.w / 2"
                  :y="pt.value ? pt.y : TREND_BASE - 2"
                  :width="pt.w"
                  :height="pt.value ? TREND_BASE - pt.y : 2"
                  rx="3"
                  class="trend-bar"
                  :class="{ 'trend-bar--zero': !pt.value, 'trend-bar--animate': chartAnimateKey }"
                />
                <rect :x="pt.x - pt.slot / 2" y="0" :width="pt.slot" :height="TREND_BASE" fill="transparent"
                  tabindex="0" role="button" :aria-label="`${pt.label}: ${pt.value} requests`"
                  @mouseenter="hoveredPoint = i" @mouseleave="hoveredPoint = null"
                  @focus="hoveredPoint = i" @blur="hoveredPoint = null" />
              </g>
            </svg>
            <EmptyState v-else icon="trending-up" title="No trend yet" description="Not enough data yet to show a request trend." compact />

            <div v-if="hoveredPoint !== null" class="trend-tooltip"
              :style="{ left: `calc(20px + (100% - 40px) * ${tooltipLeft / 100})` }">
              <span class="trend-tooltip__value">{{ chartPoints[hoveredPoint].value }} requests</span>
              <span class="trend-tooltip__label">{{ chartPoints[hoveredPoint].label }}</span>
            </div>

            <div v-if="chartPoints.length" class="trend-labels" :style="{ '--trend-n': chartPoints.length }">
              <span v-for="pt in chartPoints" :key="pt.label">{{ pt.label }}</span>
            </div>
          </div>
        </SectionCard>

        <!-- What moved on the shelf, day by day (project owner, 2026-11-26: a dashboard is its charts). -->
        <SectionCard v-if="can('hospital.inventory.view')" title="Bag Movements" subtitle="Stocked in, transfused and lost, the last 14 days" flush>
          <template #actions>
            <NuxtLink to="/hospital/request-history" class="panel-link">
              View history
              <AssetIcon name="chevron-right" :size="14" />
            </NuxtLink>
          </template>
          <HospitalBagMovementsChart ref="bagMovements" />
        </SectionCard>
      </div>

      <!-- Main content -->
      <div class="main-grid">
        <!-- Left column -->
        <div class="col-left">
          <!-- What runs out of date this week, and the bags to use first (2026-11-26). -->
          <SectionCard v-if="can('hospital.inventory.view')" title="Expiring Soon" subtitle="Available bags by the day they expire, the next 7 days" flush>
            <template #actions>
              <NuxtLink to="/hospital/inventory?status=available" class="panel-link">
                Open inventory
                <AssetIcon name="chevron-right" :size="14" />
              </NuxtLink>
            </template>
            <HospitalExpiringSoonChart ref="expiringSoon" />
          </SectionCard>

          <!-- Recent blood requests -->
          <SectionCard title="Recent Blood Requests" subtitle="Latest requests submitted from your facility" flush>
            <template #actions>
              <NuxtLink to="/hospital/bloodrequests" class="panel-link">
                View All
                <AssetIcon name="chevron-right" :size="14" />
              </NuxtLink>
            </template>

            <SkeletonList v-if="loading" class="dash-skeleton" :rows="4" />
            <div v-else-if="recentRequests.length" class="request-table">
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
          <!-- The types that would run out first at the recent rate of use (2026-11-27). -->
          <ShortestCover v-if="can('hospital.inventory.view')" />

          <!-- Today's activities -->
          <SectionCard title="Today's Activities" flush>
            <SkeletonList v-if="loading" class="dash-skeleton" :rows="2" />
            <div v-else-if="activities.length" class="timeline">
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
            <SkeletonList v-if="loading" class="dash-skeleton" :rows="2" />
            <div v-else-if="notifications.length" class="notif-list">
              <div v-for="(n, i) in notifications" :key="i" class="notif-row">
                <div class="notif-row__icon" :style="{ background: `${toneColor(n.tone)}14` }">
                  <AssetIcon :name="n.icon" :size="14" :style="{ color: toneColor(n.tone) }" />
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

      <!--
        Quick actions as one panel, like the KPI panels (2026-11-26): the main
        action filled, the others plain, split by hairlines; the arrow moves
        on hover.
      -->
      <section class="qa" aria-labelledby="qa-title">
        <header class="qa__head">
          <h2 id="qa-title" class="qa__title">
            <span class="qa__title-icon" aria-hidden="true"><AssetIcon name="bolt" :size="15" /></span>
            Quick actions
          </h2>
          <span class="qa__note">Jump straight to the work</span>
        </header>
        <div class="qa__grid" :style="{ '--qa-cols': quickActions.length }">
          <NuxtLink
            v-for="item in quickActions"
            :key="item.path"
            :to="item.path"
            class="qa-tile"
            :class="{ 'qa-tile--primary': item.primary }"
          >
            <span class="qa-tile__icon" aria-hidden="true">
              <AssetIcon :name="item.icon" :size="18" />
            </span>
            <span class="qa-tile__body">
              <span class="qa-tile__title">{{ item.title }}</span>
              <span class="qa-tile__desc">{{ item.description }}</span>
            </span>
            <AssetIcon name="arrow-right" :size="16" class="qa-tile__go" />
          </NuxtLink>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import SkeletonList from '~/components/ui/SkeletonList.vue'
import SkeletonChart from '~/components/ui/SkeletonChart.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import LowStockBanner from '~/components/common/LowStockBanner.vue'
import NeedsYou from '~/components/common/NeedsYou.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import SectionCard from '~/components/ui/SectionCard.vue'
import ShortestCover from '~/components/Hospital/ShortestCover.vue'
import HospitalBagMovementsChart from '~/components/Hospital/BagMovementsChart.vue'
import HospitalDashboardSummary from '~/components/Hospital/DashboardSummary.vue'
import HospitalExpiringSoonChart from '~/components/Hospital/ExpiringSoonChart.vue'
import StatusBadge from '~/components/ui/StatusBadge.vue'
import EmptyState from '~/components/ui/EmptyState.vue'
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { hospitalService } from '~/api/hospital/HospitalService'
import { hospitalPageSubtitle } from '~/utils/hospitalPageSubtitles'
import { onPageReturn } from '~/composables/useKeptAlive'

const { can } = useUser()

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard', keepalive: true })

const router = useRouter()
const goTo = (path) => router.push(path)

const loading = ref(true)
const chartAnimateKey = ref(false)

// Core KPI data (populated via animated counters)
const unitsAvailable = ref(0)
const pendingCount = ref(0)
const approvedCount = ref(0)
const completedToday = ref(0)
const untaggedCrossmatched = ref(0)
const untaggedAssigned = ref(0)

/** The dashboard's two KPI panels: patient requests, then the blood bank's shelf. */

// Widgets data
const recentRequests = ref([])
const activities = ref([])
const notifications = ref([])
const weeklyTrend = ref([])
const monthlyTrend = ref([])
const yearlyTrend = ref([])

const unreadNotifications = computed(() => notifications.value.length)
const loadError = ref('')

// A notification's tone, in the colours of the rest of the page.
const TONE_COLOR = { red: '#D32F2F', danger: '#D32F2F', urgent: '#D32F2F', amber: '#F57C00', warning: '#F57C00', green: '#2E7D32', success: '#2E7D32' }
const toneColor = tone => TONE_COLOR[tone] ?? '#1565C0'

// "Needs you", from the dashboard's own counts; only what has something waiting.
const taskCounts = ref({})
const TASKS = [
  { key: 'overdue_tags', label: 'tags past their deadline', detail: 'Being released. Check them in the inventory.', to: '/hospital/inventory', action: 'Open inventory', icon: 'clock', tone: 'urgent' },
  { key: 'to_receive', label: 'requests to receive', detail: 'Units are on the way from a blood center.', to: '/hospital/bloodrequests', action: 'Confirm receipt', icon: 'truck', tone: 'info' },
  { key: 'to_stock_in', label: 'bags to stock in', detail: 'Received, and waiting for a shelf.', to: '/hospital/stock-intake', action: 'Open Stock Intake', icon: 'package-check', tone: 'warning' },
  { key: 'expiring', label: 'bags expiring soon', detail: 'Within the next 3 days.', to: '/hospital/inventory', action: 'Open inventory', icon: 'triangle-alert', tone: 'warning' },
]
const needsYou = computed(() => TASKS
  .map(task => ({ ...task, count: taskCounts.value[task.key] ?? 0 }))
  .filter(task => task.count > 0))

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

// ---------- Trend chart ----------
const trendPeriod = ref('weekly')
const hoveredPoint = ref(null)

const gridLines = [20, 65, 110, 155]
// The bars' baseline in the chart's 640 × 200 drawing.
const TREND_BASE = 192

const trendSource = computed(() => {
  if (trendPeriod.value === 'weekly') return weeklyTrend.value
  if (trendPeriod.value === 'monthly') return monthlyTrend.value
  return yearlyTrend.value
})

const chartPoints = computed(() => {
  const source = trendSource.value
  if (!source.length) return []

  // A slot per period across the width, the bar in its middle (2026-11-27).
  const chartWidth = 640
  const padTop = 16
  const values = source.map(s => s.value)
  const maxVal = Math.max(...values, 1)
  const slot = chartWidth / source.length
  const w = Math.min(44, slot * 0.6)

  return source.map((d, i) => ({
    x: slot * (i + 0.5),
    y: padTop + (TREND_BASE - padTop) * (1 - d.value / maxVal),
    slot,
    w,
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

// ---------- Quick actions ----------
// The main action first and filled; Create only for a role that may raise one,
// as the New Request button on Patient Request.
const quickActions = computed(() => [
  ...(can('hospital.requests.manage')
    ? [{
        path: '/hospital/bloodrequests/newrequest',
        icon: 'file-plus',
        title: 'Create blood request',
        description: 'Ask a blood center for a patient\'s units',
        primary: true,
      }]
    : []),
  {
    path: '/hospital/bloodavailability',
    icon: 'search',
    title: 'Search blood availability',
    description: 'See which blood centers hold what you need',
  },
  {
    path: '/hospital/trackrequests',
    icon: 'route',
    title: 'Track requests',
    description: 'Follow where an active request stands',
  },
])

// Loaded on its own so the banner and the type cards do not depend on the
// dashboard call below. Supplementary: a failure leaves neither.
const thresholds = ref(null)
const thresholdsLoading = ref(true)
const lowStock = computed(() => thresholds.value?.low ?? [])

async function loadThresholds() {
  try {
    thresholds.value = await hospitalService.stockThresholds()
  } catch (err) {
    console.error('Failed to load stock thresholds:', err)
  } finally {
    thresholdsLoading.value = false
  }
}

onMounted(loadThresholds)

// `loading` is true only until the first answer, so a reload on return draws
// over the figures on screen instead of the skeleton.
async function loadDashboard() {
  loadError.value = ''
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
    activities.value = data.activities ?? []
    notifications.value = data.notifications ?? []
    weeklyTrend.value = data.weekly_trend ?? []
    monthlyTrend.value = data.monthly_trend ?? []
    yearlyTrend.value = data.yearly_trend ?? []
    taskCounts.value = data.tasks ?? {}

    loading.value = false

    await nextTick()
    // Trigger entrance animations once the real content is in the DOM
    chartAnimateKey.value = true
    animateCounter(unitsAvailable, data.units_available ?? 0)
    animateCounter(pendingCount, data.pending_requests ?? 0)
    animateCounter(approvedCount, data.approved_requests ?? 0)
    animateCounter(completedToday, data.completed_today ?? 0)
    animateCounter(untaggedCrossmatched, data.untagged_crossmatched ?? 0)
    animateCounter(untaggedAssigned, data.untagged_assigned ?? 0)
  } catch (err) {
    console.error('Failed to load hospital dashboard data:', err)
    // Said plainly: zeros here would read as a real, empty day.
    loadError.value = err?.message || 'The dashboard could not be loaded. Refresh the page to try again.'

    loading.value = false
  }
}

onMounted(loadDashboard)

// Kept alive: back here, both reload.
// Back on the page: the figures, the shelf and the movements chart, fresh.
const bagMovements = ref(null)
const expiringSoon = ref(null)
onPageReturn(() => Promise.all([loadThresholds(), loadDashboard(), bagMovements.value?.reload(), expiringSoon.value?.reload()]))
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
  .skeleton, .trend-bar--animate { animation: none !important; }
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

/* The two trend charts side by side; one alone takes the row. */
.chart-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; align-items: stretch; }
.chart-row > :only-child { grid-column: 1 / -1; }
.chart-row > * { min-width: 0; }
@media (max-width: 1100px) {
  .chart-row { grid-template-columns: minmax(0, 1fr); }
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
.trend-grid { stroke: var(--rb-border); stroke-width: 1; stroke-dasharray: 3 4; }
.trend-base { stroke: var(--rb-border-strong); stroke-width: 1; }
/* A bar per period; the hovered period lightens behind its bar. */
.trend-hit { fill: transparent; }
.trend-col--on .trend-hit { fill: var(--rb-surface-alt); }
.trend-bar { fill: var(--rb-primary); transition: opacity 0.15s ease; }
.trend-bar--zero { fill: var(--rb-border); }
.trend-col:not(.trend-col--on) .trend-bar:not(.trend-bar--zero) { opacity: 0.88; }
.trend-bar--animate { transform-box: fill-box; transform-origin: bottom; animation: growBar 0.6s cubic-bezier(.2, .8, .2, 1) both; }
@keyframes growBar { from { transform: scaleY(0); } }

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

/* A label under each bar: as many equal columns as periods. */
.trend-labels {
  display: grid;
  grid-template-columns: repeat(var(--trend-n, 7), minmax(0, 1fr));
  justify-items: center;
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

/* ── Quick actions (2026-11-26) ──
   One panel like the KPI panels: a header, then the actions split by
   hairlines. The main action is filled in the primary colour; the arrow
   slides on hover, the icon chip lifts. */
/* A heading over separate tiles with room between them (2026-11-26: joined tiles read cramped). */
.qa { display: flex; flex-direction: column; gap: 10px; }
.qa__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 2px; }
.qa__title { display: flex; align-items: center; gap: 9px; margin: 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.qa__title-icon {
  display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px;
  background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text);
}
.qa__note { font-size: 12px; color: var(--rb-text-muted); }
.qa__grid { display: grid; grid-template-columns: repeat(var(--qa-cols, 3), minmax(0, 1fr)); gap: 12px; }

.qa-tile {
  display: flex; align-items: center; gap: 14px; min-width: 0;
  padding: 18px; color: inherit; text-decoration: none;
  border: 1px solid var(--rb-border); border-radius: var(--rb-radius-lg);
  background: var(--rb-surface); box-shadow: var(--rb-shadow-sm);
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.qa-tile:hover { background: var(--rb-surface-hover); border-color: rgba(var(--rb-primary-rgb), 0.4); }
.qa-tile:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

.qa-tile__icon {
  display: grid; flex-shrink: 0; place-items: center; width: 40px; height: 40px; border-radius: 12px;
  background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text);
  transition: transform 0.2s ease;
}
.qa-tile:hover .qa-tile__icon { transform: translateY(-2px); }
.qa-tile__body { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.qa-tile__title { font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.qa-tile__desc { font-size: 12.5px; line-height: 1.4; color: var(--rb-text-secondary); }
.qa-tile__go { flex-shrink: 0; color: var(--rb-text-muted); transition: transform 0.2s ease, color 0.15s ease; }
.qa-tile:hover .qa-tile__go { transform: translateX(3px); color: var(--rb-primary-text); }

/* The main action, filled. */
.qa-tile--primary { background: var(--rb-primary); border-color: var(--rb-primary); }
.qa-tile--primary:hover { background: color-mix(in srgb, var(--rb-primary) 90%, #000); border-color: color-mix(in srgb, var(--rb-primary) 90%, #000); }
.qa-tile--primary .qa-tile__icon { background: rgba(255, 255, 255, 0.18); color: #FFFFFF; }
.qa-tile--primary .qa-tile__title { color: #FFFFFF; }
.qa-tile--primary .qa-tile__desc { color: rgba(255, 255, 255, 0.82); }
.qa-tile--primary .qa-tile__go, .qa-tile--primary:hover .qa-tile__go { color: #FFFFFF; }
.qa-tile--primary:focus-visible { box-shadow: var(--rb-focus-ring); }

@media (prefers-reduced-motion: reduce) {
  .qa-tile__icon, .qa-tile__go { transition: none; }
  .qa-tile:hover .qa-tile__icon, .qa-tile:hover .qa-tile__go { transform: none; }
}

/* Responsive */
@media (max-width: 1180px) {
  .qa__grid { grid-template-columns: minmax(0, 1fr); }
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
}

.needs-you { margin-bottom: 20px; }

.load-error { display: flex; align-items: center; gap: 8px; margin: 0 0 16px; padding: 10px 14px; border-radius: 12px; background: rgba(var(--rb-accent-rgb), 0.08); font-size: 13px; color: var(--rb-accent-text); }
.dash-skeleton { padding: 18px 20px; }
</style>
