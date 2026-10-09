<template>
  <div class="dashboard">
    <!-- Skeleton loading state -->
    <div v-if="loading" class="dashboard-inner">
      <div class="skeleton skeleton--header" />
      <div class="stats-grid">
        <div class="skeleton skeleton--card" v-for="n in 4" :key="n" />
      </div>
      <div class="focus-grid">
        <div class="skeleton skeleton--panel" style="height:300px" />
        <div class="skeleton skeleton--panel" style="height:300px" />
      </div>
      <div class="insights-grid">
        <div class="skeleton skeleton--panel" style="height:280px" />
        <div class="skeleton skeleton--panel" style="height:280px" />
      </div>
    </div>

    <div v-else class="dashboard-inner">
      <!-- ============ HEADER ============ -->
      <div class="header-row">
        <div>
          <h1 class="page-title">Blood Center Dashboard</h1>
          <p class="page-subtitle">What needs attention today, and how stock is moving.</p>
        </div>
        <div class="header-actions">
          <button type="button" class="btn-outline" @click="exportReport" :disabled="exporting">
            <AssetIcon name="download" :size="14" />
            {{ exporting ? 'Exporting…' : 'Export Report' }}
          </button>
          <!--
            A donation needs a verified donor, a screening and a collection, so
            it is recorded at the counter rather than from a dashboard modal.
          -->
          <NuxtLink to="/blood-center/collection" class="btn-primary">
            <AssetIcon name="plus" :size="15" />
            Record Donation
          </NuxtLink>
        </div>
      </div>

      <!-- ============ KPI CARDS ============ -->
      <!-- Each card opens the page that owns the number. -->
      <div class="stats-grid">
        <NuxtLink to="/blood-center/inventory" class="stat-card">
          <div class="stat-card__top">
            <p class="stat-card__label">Total Blood Units</p>
            <div class="stat-card__badge" :style="{ background: 'rgba(var(--rb-primary-rgb), 0.08)' }">
              <AssetIcon name="droplets" :size="14" style="color: var(--rb-primary-text)" />
            </div>
          </div>
          <p class="stat-card__value" :class="{ 'stat-card__value--empty': totalUnits === null }">{{ totalUnits ?? 'No data' }}</p>
          <span class="stat-chip stat-chip--neutral">Across all components</span>
          <span v-if="weeklyChangePercent !== null" class="stat-trend" :class="weeklyChangePercent >= 0 ? 'stat-trend--up' : 'stat-trend--down'">
            <AssetIcon :name="weeklyChangePercent >= 0 ? 'arrow-up-right' : 'arrow-down-right'" :size="11" />
            {{ Math.abs(weeklyChangePercent) }}% this week
          </span>
        </NuxtLink>

        <NuxtLink to="/blood-center/collection" class="stat-card">
          <div class="stat-card__top">
            <p class="stat-card__label">Donations Today</p>
            <div class="stat-card__badge" :style="{ background: 'rgba(var(--rb-success-rgb), 0.08)' }">
              <AssetIcon name="trending-up" :size="14" style="color: var(--rb-success-text)" />
            </div>
          </div>
          <p class="stat-card__value" :class="{ 'stat-card__value--empty': donationsToday === null }">{{ donationsToday ?? 'No data' }}</p>
          <span class="stat-chip stat-chip--neutral">{{ dailyGoal !== null ? `Goal: ${dailyGoal} units/day` : 'Daily goal not set' }}</span>
          <span v-if="vsYesterdayPercent !== null" class="stat-trend" :class="vsYesterdayPercent >= 0 ? 'stat-trend--up' : 'stat-trend--down'">
            <AssetIcon :name="vsYesterdayPercent >= 0 ? 'arrow-up-right' : 'arrow-down-right'" :size="11" />
            {{ Math.abs(vsYesterdayPercent) }}% vs yesterday
          </span>
        </NuxtLink>

        <NuxtLink to="/blood-center/bloodrequests" class="stat-card">
          <div class="stat-card__top">
            <p class="stat-card__label">Pending Hospital Requests</p>
            <div class="stat-card__badge" :style="{ background: 'rgba(var(--rb-warning-rgb), 0.08)' }">
              <AssetIcon name="package" :size="14" style="color: var(--rb-warning-text)" />
            </div>
          </div>
          <p class="stat-card__value">{{ pendingRequestsCount }}</p>
          <span class="stat-chip stat-chip--neutral">{{ pendingRequestsCount ? 'Needs fulfillment' : 'Nothing waiting' }}</span>
        </NuxtLink>

        <NuxtLink to="/blood-center/inventory" class="stat-card" :class="{ 'stat-card--emphasized': criticalTypesCount > 0 }">
          <div class="stat-card__top">
            <p class="stat-card__label">Critical Blood Types</p>
            <div class="stat-card__badge" :style="{ background: 'rgba(var(--rb-accent-rgb), 0.08)' }">
              <AssetIcon name="alert" :size="14" style="color: var(--rb-accent-text)" />
            </div>
          </div>
          <!-- Red only when something is actually critical. -->
          <p class="stat-card__value" :style="criticalTypesCount ? 'color: var(--rb-accent-text)' : ''">{{ criticalTypesCount }}</p>
          <span class="stat-chip stat-chip--neutral truncate-chip">{{ criticalTypesLabel }}</span>
        </NuxtLink>
      </div>

      <!-- ============ LOW STOCK ============ -->
      <LowStockBanner :cells="lowStock" to="/blood-center/stock-thresholds" class="low-stock-banner" />

      <!-- ============ NEEDS ATTENTION + STOCK BY TYPE ============ -->
      <div class="focus-grid">
        <div class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">Needs attention</h2>
              <p class="panel-subtitle">Stock, expiry and requests that need action today.</p>
            </div>
          </div>

          <ul v-if="attentionItems.length" class="attention-list">
            <li v-for="item in attentionItems" :key="item.key" class="attention-item" :class="`attention-item--${item.tone}`">
              <span class="attention-item__icon">
                <AssetIcon :name="item.icon" :size="15" />
              </span>
              <div class="attention-item__body">
                <p class="attention-item__title">{{ item.title }}</p>
                <p class="attention-item__detail">{{ item.detail }}</p>
              </div>
              <NuxtLink :to="item.to" class="panel-link attention-item__link">
                {{ item.action }}
                <AssetIcon name="chevron-right" :size="13" />
              </NuxtLink>
            </li>
          </ul>
          <div v-else class="attention-clear">
            <AssetIcon name="shield-check" :size="20" style="color: var(--rb-success-text)" />
            <div>
              <p class="attention-clear__title">All clear</p>
              <p class="attention-clear__detail">No critical stock, expiring units or urgent requests right now.</p>
            </div>
          </div>

          <!-- Requests stay actionable here; the full list is Incoming Requests. -->
          <template v-if="waitingRequests.length">
            <div class="subsection-header">
              <p class="subsection-title">Waiting hospital requests</p>
              <NuxtLink to="/blood-center/bloodrequests" class="panel-link">
                View all ({{ requests.length }})
              </NuxtLink>
            </div>
            <div class="request-list">
              <div v-for="req in waitingRequests" :key="req.id" class="request-item">
                <div class="request-item__left">
                  <div class="hospital-avatar" :style="{ background: urgencyIconBg(req.urgency), color: urgencyIconColor(req.urgency) }">
                    {{ initials(req.hospital) }}
                  </div>
                  <div class="request-info">
                    <div class="request-info__row">
                      <p class="request-hospital">{{ req.hospital }}</p>
                      <span class="urgency-pill" :class="`urgency-pill--${req.urgency}`">{{ req.urgency }}</span>
                    </div>
                    <p class="request-meta">
                      {{ req.code }} &middot;
                      <span class="type-pill type-pill--sm">{{ req.blood_type }}</span>
                      &middot; {{ req.units }} unit{{ req.units !== 1 ? 's' : '' }} &middot; {{ req.time_ago }}
                    </p>
                  </div>
                </div>
                <div class="request-item__right">
                  <span class="status-pill status-pill--sm" :class="`status-pill--${req.status}`">
                    <span class="status-pill__dot" />
                    {{ req.status }}
                  </span>
                  <button type="button" class="btn-primary btn-primary--sm" @click="openConfirmModal(req)">
                    {{ req.status === 'processing' ? 'Fulfill' : 'Process' }}
                  </button>
                </div>
              </div>
            </div>
          </template>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">Stock by blood type</h2>
              <p class="panel-subtitle">Total units across components.</p>
            </div>
            <NuxtLink to="/blood-center/inventory" class="panel-link">Full inventory</NuxtLink>
          </div>

          <div v-if="stockTiles.length" class="stock-grid">
            <NuxtLink
              v-for="row in stockTiles"
              :key="row.blood_type"
              :to="`/blood-center/inventory?type=${encodeURIComponent(row.blood_type)}`"
              class="stock-tile"
              :class="`stock-tile--${row.status}`"
              :title="`${row.blood_type}: ${row.total} units, ${statusLabel(row.status)}`"
            >
              <span class="stock-tile__type">{{ row.blood_type }}</span>
              <span class="stock-tile__value">{{ row.total }}</span>
              <span class="stock-tile__status">{{ statusLabel(row.status) }}</span>
            </NuxtLink>
          </div>
          <div v-else class="empty-state">
            <AssetIcon name="droplets" :size="32" style="color: var(--rb-border-strong)" />
            <p>No inventory recorded yet</p>
          </div>
        </div>
      </div>

      <!-- ============ INVENTORY INSIGHTS ============ -->
      <div class="insights-grid">
        <!-- Inventory Trends (line chart) -->
        <div class="panel insight-card">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">Inventory Trends</h2>
              <p class="panel-subtitle">Monitor inventory changes over time.</p>
            </div>
            <div class="segmented-control">
              <button
                v-for="range in trendRanges"
                :key="range.value"
                type="button"
                class="segmented-control__btn"
                :class="{ 'segmented-control__btn--active': trendRange === range.value }"
                @click="trendRange = range.value"
              >
                {{ range.label }}
              </button>
            </div>
          </div>

          <div v-if="!currentTrendData.length" class="empty-state">
            <AssetIcon name="trending-up" :size="36" style="color: var(--rb-border-strong)" />
            <p>No inventory trend data available yet</p>
          </div>

          <div v-else class="chart-body">
            <div class="chart-legend">
              <span class="legend-item"><span class="legend-dot" style="background: var(--rb-primary)" />Available Units</span>
              <span class="legend-item"><span class="legend-dot" style="background: var(--rb-accent)" />Reserved Units</span>
            </div>

            <div class="line-chart-wrap" @mouseleave="hoveredPointIndex = null">
              <svg :viewBox="`0 0 ${chartWidth} ${chartHeight}`" class="line-chart" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--rb-primary)" stop-opacity="0.16" />
                    <stop offset="100%" stop-color="var(--rb-primary)" stop-opacity="0" />
                  </linearGradient>
                </defs>

                <line
                  v-for="(g, i) in gridLines"
                  :key="i"
                  :x1="chartPadding.left"
                  :x2="chartWidth - chartPadding.right"
                  :y1="g"
                  :y2="g"
                  class="chart-grid-line"
                />

                <path :d="areaPath" fill="url(#areaFill)" stroke="none" />
                <path :d="reservedPath" fill="none" stroke="var(--rb-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4 4" />
                <path :d="availablePath" fill="none" stroke="var(--rb-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

                <g v-for="(p, i) in availablePoints" :key="'a'+i">
                  <circle :cx="p.x" :cy="p.y" r="3.2" fill="var(--rb-surface)" stroke="var(--rb-primary)" stroke-width="2" />
                  <rect
                    :x="p.x - (chartWidth / availablePoints.length) / 2"
                    y="0"
                    :width="chartWidth / availablePoints.length"
                    :height="chartHeight"
                    fill="transparent"
                    class="hover-target"
                    @mouseenter="hoveredPointIndex = i"
                  />
                </g>
                <circle v-for="(p, i) in reservedPoints" :key="'r'+i" :cx="p.x" :cy="p.y" r="2.6" fill="var(--rb-surface)" stroke="var(--rb-accent)" stroke-width="2" />

                <text v-for="(p, i) in availablePoints" :key="'lbl'+i" :x="p.x" :y="chartHeight - 6" class="chart-axis-label" text-anchor="middle">{{ p.label }}</text>
              </svg>

              <div
                v-if="hoveredPointIndex !== null"
                class="chart-tooltip"
                :style="{
                  left: (availablePoints[hoveredPointIndex].x / chartWidth) * 100 + '%',
                  top: (availablePoints[hoveredPointIndex].y / chartHeight) * 100 + '%'
                }"
              >
                <p class="chart-tooltip__label">{{ availablePoints[hoveredPointIndex].label }}</p>
                <p class="chart-tooltip__row"><span class="legend-dot" style="background: var(--rb-primary)" />Available: {{ availablePoints[hoveredPointIndex].value }}</p>
                <p class="chart-tooltip__row"><span class="legend-dot" style="background: var(--rb-accent)" />Reserved: {{ reservedPoints[hoveredPointIndex].value }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Blood Component Distribution -->
        <div class="panel insight-card">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">Blood Component Distribution</h2>
              <p class="panel-subtitle">Visualize current inventory composition.</p>
            </div>
          </div>

          <div v-if="!donutTotal" class="empty-state">
            <AssetIcon name="package" :size="36" style="color: var(--rb-border-strong)" />
            <p>No component distribution data available yet</p>
          </div>

          <div v-else class="donut-body">
            <div class="donut-chart-wrap" @mouseleave="hoveredDonut = null">
              <svg viewBox="0 0 160 160" class="donut-chart">
                <circle cx="80" cy="80" :r="donutRadius" fill="none" stroke="var(--rb-surface-alt)" stroke-width="22" />
                <circle
                  v-for="seg in donutSegments"
                  :key="seg.label"
                  cx="80"
                  cy="80"
                  :r="donutRadius"
                  fill="none"
                  :stroke="seg.color"
                  stroke-width="22"
                  :stroke-dasharray="seg.dasharray"
                  :stroke-dashoffset="seg.dashoffset"
                  transform="rotate(-90 80 80)"
                  class="donut-segment"
                  :class="{ 'donut-segment--dim': hoveredDonut && hoveredDonut.label !== seg.label }"
                  @mouseenter="hoveredDonut = seg"
                />
              </svg>
              <div class="donut-center">
                <p class="donut-center__value">{{ hoveredDonut ? hoveredDonut.pct + '%' : donutTotal }}</p>
                <p class="donut-center__label">{{ hoveredDonut ? hoveredDonut.label : 'Total Units' }}</p>
              </div>
            </div>

            <div class="donut-legend">
              <div v-for="seg in donutSegments" :key="seg.label" class="donut-legend__row" @mouseenter="hoveredDonut = seg" @mouseleave="hoveredDonut = null">
                <span class="legend-dot" :style="{ background: seg.color }" />
                <span class="donut-legend__label">{{ seg.label }}</span>
                <span class="donut-legend__value">{{ seg.pct }}% &middot; {{ seg.value }} units</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ============ RECENT ACTIVITY ============ -->
      <div class="activity-grid">
      <!-- ============ RECENT DONATION ACTIVITY ============ -->
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Recent donations</h2>
            <p class="panel-subtitle">Latest donations recorded at this center.</p>
          </div>
          <!--
            "View History" pointed at /blood-center/donations, which has no
            page — the link 404'd. There is no donation-history screen to send
            people to yet, and Donor Management is not one, so nothing is
            offered here. Restore it with the page, not before.
          -->
        </div>

        <div v-if="donationActivity.length" class="timeline">
          <div v-for="item in donationActivity.slice(0, 5)" :key="item.id" class="timeline-item">
            <div class="timeline-item__marker">
              <AssetIcon name="droplets" :size="13" style="color: var(--rb-primary-text)" />
            </div>
            <div class="timeline-item__body">
              <div class="timeline-item__row">
                <p class="timeline-item__name">{{ item.donor_name }}</p>
                <span v-if="item.verified" class="verified-badge">
                  <AssetIcon name="check-circle" :size="11" />
                  Verified
                </span>
              </div>
              <p class="timeline-item__meta">
                {{ item.type }} &middot; {{ item.volume }} &middot; {{ item.time }}
              </p>
            </div>
            <span class="status-pill status-pill--sm" :class="`status-pill--${item.status}`">
              <span class="status-pill__dot" />
              {{ item.status }}
            </span>
          </div>
        </div>
        <div v-else class="empty-state">
          <AssetIcon name="droplets" :size="36" style="color: var(--rb-border-strong)" />
          <p>No donations recorded yet today</p>
        </div>
      </div>

      <!-- ============ RECENT SYSTEM ACTIVITY ============ -->
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">System activity</h2>
            <p class="panel-subtitle">Audit trail of actions across the system.</p>
          </div>
        </div>

        <div v-if="systemActivity.length" class="activity-feed">
          <div v-for="item in systemActivity.slice(0, 5)" :key="item.id" class="activity-feed__item">
            <div class="activity-feed__icon" :style="{ background: `rgba(var(--rb-${item.tone}-rgb), 0.08)` }">
              <AssetIcon :name="item.icon" :size="14" :style="{ color: `var(--rb-${item.tone})` }" />
            </div>
            <div class="activity-feed__body">
              <p class="activity-feed__title">{{ item.title }}</p>
              <p class="activity-feed__desc">{{ item.description }}</p>
            </div>
            <span class="activity-feed__time">{{ item.time }}</span>
          </div>
        </div>
        <div v-else class="empty-state">
          <AssetIcon name="activity" :size="36" style="color: var(--rb-border-strong)" />
          <p>No recent activity</p>
        </div>
      </div>

      </div>
    </div>

    <!-- Confirm process/fulfill modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="confirmModalOpen" class="modal-overlay" @click.self="closeConfirmModal">
          <div class="modal-card" role="dialog" v-focus-trap aria-modal="true">
            <button type="button" class="modal-close" @click="closeConfirmModal">
              <AssetIcon name="x" :size="16" />
            </button>

            <div class="modal-icon">
              <AssetIcon name="alert" :size="18" style="color: var(--rb-primary-text)" />
            </div>

            <h3 class="modal-title">
              {{ selectedRequest?.status === 'processing' ? 'Mark as fulfilled?' : 'Process this request?' }}
            </h3>
            <p class="modal-subtitle" v-if="selectedRequest">
              {{ selectedRequest.code }} &middot; {{ selectedRequest.hospital }} &middot;
              {{ selectedRequest.units }} unit{{ selectedRequest.units !== 1 ? 's' : '' }} {{ selectedRequest.blood_type }}
            </p>

            <div class="modal-actions">
              <button type="button" class="btn-primary modal-actions__btn" :disabled="confirmSubmitting" @click="confirmAction">
                {{ confirmSubmitting ? 'Please wait…' : (selectedRequest?.status === 'processing' ? 'Fulfill' : 'Process') }}
              </button>
              <button type="button" class="btn-outline modal-actions__btn" @click="closeConfirmModal" :disabled="confirmSubmitting">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import LowStockBanner from '~/components/common/LowStockBanner.vue'
import { ref, reactive, computed, onMounted } from 'vue'
import { useUser } from '~/composables/useUser'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'reports.view_all',
})

const { user, can } = useUser()
const facilityLabel = computed(() => user.value?.facility?.facility_name || user.value?.facility_name || 'Blood Center')

const loading = ref(true)

// --- Top-level stats ---
const totalUnits = ref(null)
const donationsToday = ref(null)
const dailyGoal = ref(null)
const weeklyChangePercent = ref(null)
const vsYesterdayPercent = ref(null)

// --- Inventory (stock tiles + attention) ---
const inventory = ref([])

// Canonical order, so the tiles read the same way every day.
const BLOOD_TYPE_ORDER = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const stockTiles = computed(() =>
  [...inventory.value].sort((a, b) => {
    const ai = BLOOD_TYPE_ORDER.indexOf(a.blood_type)
    const bi = BLOOD_TYPE_ORDER.indexOf(b.blood_type)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
)

function statusLabel(status) {
  const map = { adequate: 'Adequate', low: 'Low Stock', critical: 'Critical' }
  return map[status] || status
}

const pendingRequestsCount = computed(() => requests.value.filter(r => r.status === 'pending').length)

const criticalTypes = computed(() => inventory.value.filter(r => r.status === 'critical').map(r => r.blood_type))
const criticalTypesCount = computed(() => criticalTypes.value.length)
const criticalTypesLabel = computed(() => {
  if (!criticalTypesCount.value) return 'No critical types'
  return `${criticalTypes.value.join(' and ')} at critical`
})

const lowTypes = computed(() => inventory.value.filter(r => r.status === 'low').map(r => r.blood_type))

// Dev note: reference data (blood types, components) kay gikan sa
// /blood-center/reference-data endpoint — dili na hardcoded diri.
const bloodTypeOptions = ref([])
const componentOptions = ref([])

// --- Inventory Trends (line chart) ---
const chartWidth = 560
const chartHeight = 200
const chartPadding = { top: 16, right: 14, bottom: 26, left: 14 }
const gridLines = [chartPadding.top, (chartHeight - chartPadding.bottom + chartPadding.top) / 2, chartHeight - chartPadding.bottom]

const trendRanges = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
]
const trendRange = ref('weekly')
const inventoryTrends = reactive({ weekly: [], monthly: [], quarterly: [] })
const currentTrendData = computed(() => inventoryTrends[trendRange.value] || [])

const trendScale = computed(() => {
  const data = currentTrendData.value
  if (!data.length) return { max: 1, min: 0 }
  const values = data.flatMap(d => [d.available, d.reserved])
  return { max: Math.max(...values), min: 0 }
})

function xForIndex(i, len) {
  const innerWidth = chartWidth - chartPadding.left - chartPadding.right
  if (len <= 1) return chartPadding.left
  return chartPadding.left + (innerWidth * i) / (len - 1)
}
function yForValue(v) {
  const innerHeight = chartHeight - chartPadding.top - chartPadding.bottom
  const { max, min } = trendScale.value
  if (max === min) return chartHeight - chartPadding.bottom
  const ratio = (v - min) / (max - min)
  return chartHeight - chartPadding.bottom - ratio * innerHeight
}
function pointsToPath(points) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
}

const availablePoints = computed(() =>
  currentTrendData.value.map((d, i) => ({ x: xForIndex(i, currentTrendData.value.length), y: yForValue(d.available), value: d.available, label: d.label }))
)
const reservedPoints = computed(() =>
  currentTrendData.value.map((d, i) => ({ x: xForIndex(i, currentTrendData.value.length), y: yForValue(d.reserved), value: d.reserved, label: d.label }))
)
const availablePath = computed(() => pointsToPath(availablePoints.value))
const reservedPath = computed(() => pointsToPath(reservedPoints.value))
const areaPath = computed(() => {
  if (!availablePoints.value.length) return ''
  const baseline = chartHeight - chartPadding.bottom
  const pts = availablePoints.value
  return `${pointsToPath(pts)} L ${pts[pts.length - 1].x.toFixed(1)} ${baseline} L ${pts[0].x.toFixed(1)} ${baseline} Z`
})
const hoveredPointIndex = ref(null)

// --- Blood Component Distribution (donut chart) ---
const donutRadius = 58
const donutCircumference = 2 * Math.PI * donutRadius
const componentDistributionOverride = ref([])
const hoveredDonut = ref(null)

const computedDistribution = computed(() => {
  if (componentDistributionOverride.value.length) return componentDistributionOverride.value
  const sums = inventory.value.reduce(
    (acc, row) => {
      acc.whole_blood += row.whole_blood
      acc.red_blood_cells += row.red_blood_cells
      acc.plasma += row.plasma
      acc.platelets += row.platelets
      return acc
    },
    { whole_blood: 0, red_blood_cells: 0, plasma: 0, platelets: 0 }
  )
  return [
    { label: 'Packed RBC', value: sums.red_blood_cells, color: 'var(--rb-primary)' },
    { label: 'Whole Blood', value: sums.whole_blood, color: 'var(--rb-accent)' },
    { label: 'Fresh Frozen Plasma', value: sums.plasma, color: 'var(--rb-purple)' },
    { label: 'Platelets', value: sums.platelets, color: 'var(--rb-teal)' },
  ]
})

const donutTotal = computed(() => computedDistribution.value.reduce((s, d) => s + d.value, 0))

const donutSegments = computed(() => {
  let cumulative = 0
  const total = donutTotal.value || 1
  return computedDistribution.value.map(seg => {
    const pct = seg.value / total
    const dash = pct * donutCircumference
    const geo = {
      ...seg,
      pct: Math.round(pct * 100),
      dasharray: `${dash.toFixed(2)} ${(donutCircumference - dash).toFixed(2)}`,
      dashoffset: (-cumulative).toFixed(2),
    }
    cumulative += dash
    return geo
  })
})

// --- Near expiry blood units ---
const nearExpiry = ref([])

function unitsExpiringWithin(days) {
  return nearExpiry.value
    .filter(row => row.days_remaining <= days)
    .reduce((sum, row) => sum + (Number(row.units) || 0), 0)
}

// --- Recent donation activity ---
const donationActivity = ref([])

// --- Recent system activity ---
const systemActivity = ref([])

// --- Hospital requests ---
const requests = ref([])

const URGENCY_RANK = { emergency: 0, urgent: 1, routine: 2 }

// The three most pressing, so the overview stays short; the rest are one
// click away on Incoming Requests.
const waitingRequests = computed(() =>
  [...requests.value]
    .sort((a, b) => (URGENCY_RANK[a.urgency] ?? 3) - (URGENCY_RANK[b.urgency] ?? 3))
    .slice(0, 3)
)

const urgentRequestsCount = computed(() =>
  requests.value.filter(r => r.urgency === 'emergency' || r.urgency === 'urgent').length
)

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * What a supervisor should act on today, most severe first. Built only from
 * data the overview already loads; an empty list renders "All clear".
 */
const attentionItems = computed(() => {
  const items = []

  if (criticalTypesCount.value) {
    items.push({
      key: 'critical', tone: 'critical', icon: 'alert',
      title: `${criticalTypes.value.join(', ')} at critical stock`,
      detail: 'Immediate replenishment needed.',
      to: '/blood-center/inventory', action: 'View stock',
    })
  }

  const within3 = unitsExpiringWithin(3)
  if (within3) {
    items.push({
      key: 'expiry-3', tone: 'critical', icon: 'clock',
      title: `${plural(within3, 'unit')} expire within 3 days`,
      detail: 'Issue these first, or reallocate them.',
      to: '/blood-center/inventory', action: 'View units',
    })
  }

  const within7 = unitsExpiringWithin(7) - within3
  if (within7 > 0) {
    items.push({
      key: 'expiry-7', tone: 'low', icon: 'clock',
      title: `${plural(within7, 'more unit')} expire within 7 days`,
      detail: 'Plan to issue these this week.',
      to: '/blood-center/inventory', action: 'View units',
    })
  }

  if (lowTypes.value.length) {
    items.push({
      key: 'low', tone: 'low', icon: 'triangle-alert',
      title: `${lowTypes.value.join(', ')} running low`,
      detail: 'Approaching the reorder threshold.',
      to: '/blood-center/inventory', action: 'View stock',
    })
  }

  if (urgentRequestsCount.value) {
    items.push({
      key: 'urgent', tone: 'critical', icon: 'clipboard-check',
      title: `${plural(urgentRequestsCount.value, 'urgent hospital request')}`,
      detail: 'Emergency or urgent priority.',
      to: '/blood-center/bloodrequests', action: 'Open requests',
    })
  }

  return items
})

const urgencyIconBg = (urgency) => {
  if (urgency === 'emergency') return 'rgba(var(--rb-accent-rgb), 0.08)'
  if (urgency === 'urgent') return 'rgba(var(--rb-warning-rgb), 0.08)'
  return 'rgba(var(--rb-primary-rgb), 0.08)'
}
const urgencyIconColor = (urgency) => {
  if (urgency === 'emergency') return 'var(--rb-accent)'
  if (urgency === 'urgent') return 'var(--rb-warning)'
  return 'var(--rb-primary)'
}
function initials(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

// --- Confirm process/fulfill modal ---
const confirmModalOpen = ref(false)
const selectedRequest = ref(null)
const confirmSubmitting = ref(false)

const openConfirmModal = (req) => {
  selectedRequest.value = req
  confirmModalOpen.value = true
}
const closeConfirmModal = () => {
  if (confirmSubmitting.value) return
  confirmModalOpen.value = false
  selectedRequest.value = null
}
const confirmAction = async () => {
  if (!selectedRequest.value) return
  confirmSubmitting.value = true
  const req = selectedRequest.value
  try {
    if (req.status === 'processing') {
      // Dev note: i-connect sa /blood-center/hospital-requests/:id/fulfill endpoint
      await bloodCenterService.fulfillRequest?.(req.id)
      req.status = 'fulfilled'
      requests.value = requests.value.filter(r => r.id !== req.id)
    } else {
      // Dev note: i-connect sa /blood-center/hospital-requests/:id/process endpoint
      await bloodCenterService.processRequest?.(req.id)
      req.status = 'processing'
    }
    confirmModalOpen.value = false
    selectedRequest.value = null
  } catch (err) {
    console.error('Failed to update hospital request:', err)
  } finally {
    confirmSubmitting.value = false
  }
}

const exporting = ref(false)
const exportReport = async () => {
  exporting.value = true
  try {
    // Dev note: i-connect sa /blood-center/reports/export endpoint
    await bloodCenterService.exportReport?.()
  } catch (err) {
    console.error('Failed to export report:', err)
  } finally {
    exporting.value = false
  }
}

// Loaded on its own so the banner does not depend on the overview call below.
// Supplementary: a failure leaves no banner.
const lowStock = ref([])

onMounted(async () => {
  try {
    lowStock.value = (await bloodCenterService.stockThresholds()).low ?? []
  } catch (err) {
    console.error('Failed to load stock thresholds:', err)
  }
})

onMounted(async () => {
  try {
    // Dev note: gikan sa /blood-center/dashboard-summary, /inventory, /hospital-requests,
    // /inventory-trends, /component-distribution, /near-expiry, /donations, /activity-log endpoints.
    // Walay hardcoded/mock values diri — kung wala'y balik gikan sa API, mag-empty state na lang
    // ang UI (empty array/null) imbes mag-display og sample data.
    const data = await bloodCenterService.dashboardOverview?.()

    totalUnits.value = data?.total_units ?? null
    donationsToday.value = data?.donations_today ?? null
    dailyGoal.value = data?.daily_goal ?? null
    weeklyChangePercent.value = data?.weekly_change_percent ?? null
    vsYesterdayPercent.value = data?.vs_yesterday_percent ?? null

    inventory.value = data?.inventory ?? []
    requests.value = data?.hospital_requests ?? []

    const trends = data?.inventory_trends ?? {}
    inventoryTrends.weekly = trends.weekly ?? []
    inventoryTrends.monthly = trends.monthly ?? []
    inventoryTrends.quarterly = trends.quarterly ?? []

    componentDistributionOverride.value = data?.component_distribution ?? []
    nearExpiry.value = data?.near_expiry ?? []
    donationActivity.value = data?.recent_donations ?? []
    systemActivity.value = data?.system_activity ?? []

    // Dev note: reference dropdown data (blood types, components) — kinahanglan gikan sa
    // /blood-center/reference-data endpoint, dili hardcoded diri sa component.
    const reference = data?.reference ?? (await bloodCenterService.referenceData?.()) ?? {}
    bloodTypeOptions.value = reference?.blood_types ?? []
    componentOptions.value = reference?.components ?? []
  } catch (err) {
    console.error('Failed to load blood center dashboard:', err)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>

.dashboard {
  font-family: var(--rb-font-sans);
  max-width: var(--rb-content-max, 1600px);
  background: var(--rb-page-bg);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  transition: background-color 0.2s ease;
}

.low-stock-banner { margin-bottom: 20px; }

/* Skeleton loading */
.skeleton {
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
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

@media (prefers-reduced-motion: reduce) {
  .skeleton, .stat-card, .stock-tile { animation: none !important; transition: none !important; }
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
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--rb-text-primary);
  margin: 0;
}
.page-subtitle {
  font-size: 13px;
  color: var(--rb-text-secondary);
  margin: 3px 0 0;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  color: #ffffff;
  background: var(--rb-primary);
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.06);
  transition: opacity 0.15s ease;
  border: none;
  cursor: pointer;
  text-decoration: none;
  line-height: 1.2;
  font-family: inherit;
}
.btn-primary:hover:not(:disabled) { background: #0D47A1; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.btn-primary--sm { padding: 7px 13px; font-size: 12px; }

.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  color: var(--rb-text-primary);
  background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
  line-height: 1.2;
  font-family: inherit;
}
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn-outline:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-outline:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }

/* Stats */
/* auto-fit, not a fixed count: the content column now changes width
   when the rail expands, so the grid has to answer to its container
   rather than to a viewport breakpoint that no longer describes it. */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 14px;
}
.stat-card {
  background: var(--rb-surface);
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
  border: 1px solid var(--rb-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.15s ease, background-color 0.2s ease;
}
.stat-card:hover {
  border-color: var(--rb-border-hover);
}
.stat-card--emphasized {
  border-color: rgba(var(--rb-accent-rgb), 0.25);
  box-shadow: 0 0 0 1px rgba(var(--rb-accent-rgb), 0.13), 0 4px 14px rgba(var(--rb-accent-rgb), 0.08);
}
.stat-card__top { display: flex; align-items: center; justify-content: space-between; }
.stat-card__label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--rb-text-secondary);
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
.stat-card__value { font-size: 24px; font-weight: 800; color: var(--rb-text-primary); margin: 0; line-height: 1; }
.stat-card__value--empty { font-size: 15px; font-weight: 600; color: var(--rb-text-secondary); line-height: 24px; }
a.stat-card { text-decoration: none; color: inherit; }
a.stat-card:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.stat-chip {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  max-width: 100%;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--rb-surface-alt);
  color: var(--rb-text-secondary);
}
.truncate-chip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stat-trend { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 700; }
.stat-trend--up { color: var(--rb-success-text); }
.stat-trend--down { color: var(--rb-accent-text); }

/* Panels */
.panel {
  background: var(--rb-surface);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
  border: 1px solid var(--rb-border);
  overflow: hidden;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--rb-border);
  flex-wrap: wrap;
}
.panel-title { font-weight: 700; font-size: 14px; color: var(--rb-text-primary); margin: 0; }
.panel-subtitle { font-size: 12px; color: var(--rb-text-secondary); margin: 3px 0 0; }
.panel-link { font-size: 12px; font-weight: 600; color: var(--rb-primary-text); text-decoration: none; flex-shrink: 0; }
.panel-link:hover { text-decoration: underline; }

.type-pill {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(var(--rb-accent-rgb), 0.08);
  color: var(--rb-accent-text);
}
.type-pill--sm { font-size: 11px; padding: 2px 8px; }

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  text-transform: capitalize;
}
.status-pill--sm { font-size: 11px; padding: 3px 9px; }
.status-pill__dot { width: 6px; height: 6px; border-radius: 999px; background: currentColor; flex-shrink: 0; }
.status-pill--adequate { background: rgba(var(--rb-success-rgb), 0.08); color: var(--rb-success-text); }
.status-pill--low { background: rgba(var(--rb-warning-rgb), 0.08); color: var(--rb-warning-text); }
.status-pill--critical { background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); }
.status-pill--pending { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }
.status-pill--processing { background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); }

/* Needs attention + stock by type */
.focus-grid { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 16px; align-items: start; }

.attention-list { list-style: none; margin: 0; padding: 6px 0; }
.attention-item { display: flex; align-items: center; gap: 12px; padding: 10px 18px; }
.attention-item__icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.attention-item--critical .attention-item__icon { background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); }
.attention-item--low .attention-item__icon { background: rgba(var(--rb-warning-rgb), 0.1); color: var(--rb-warning-text); }
.attention-item__body { flex: 1; min-width: 0; }
.attention-item__title { font-size: 13px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.attention-item__detail { font-size: 11.5px; color: var(--rb-text-secondary); margin: 2px 0 0; }
.attention-item__link { display: inline-flex; align-items: center; gap: 2px; white-space: nowrap; }

.attention-clear { display: flex; align-items: center; gap: 12px; padding: 18px; }
.attention-clear__title { font-size: 13px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.attention-clear__detail { font-size: 12px; color: var(--rb-text-secondary); margin: 2px 0 0; }

.subsection-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 18px 4px;
  border-top: 1px solid var(--rb-border);
}
.subsection-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--rb-text-secondary);
  margin: 0;
}

.stock-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; padding: 16px 18px 18px; }
.stock-tile {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface-alt);
  text-decoration: none;
  box-shadow: inset 3px 0 0 var(--tile-accent, var(--rb-border-strong));
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.stock-tile:hover { border-color: var(--rb-border-hover); background: var(--rb-surface-hover); }
.stock-tile:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.stock-tile--adequate { --tile-accent: var(--rb-success); }
.stock-tile--low { --tile-accent: var(--rb-warning); }
.stock-tile--critical { --tile-accent: var(--rb-accent); background: rgba(var(--rb-accent-rgb), 0.05); }
.stock-tile__type { font-size: 12px; font-weight: 700; color: var(--rb-text-secondary); }
.stock-tile__value { font-size: 20px; font-weight: 800; color: var(--rb-text-primary); line-height: 1.15; font-variant-numeric: tabular-nums; }
.stock-tile__status { font-size: 10.5px; font-weight: 600; color: var(--rb-text-secondary); }
.stock-tile--low .stock-tile__status { color: var(--rb-warning-text); }
.stock-tile--critical .stock-tile__status { color: var(--rb-accent-text); }

/* Recent activity, side by side */
.activity-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }

/* Insights (charts) */
.insights-grid { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 16px; }
.insight-card { display: flex; flex-direction: column; }

.segmented-control {
  display: inline-flex;
  padding: 3px;
  background: var(--rb-surface-alt);
  border-radius: 999px;
  gap: 2px;
  flex-shrink: 0;
}
.segmented-control__btn {
  padding: 6px 12px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  background: transparent;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s ease, color 0.15s ease;
}
.segmented-control__btn--active { background: var(--rb-surface); color: var(--rb-primary-text); box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.08); }

.chart-body { padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 10px; }
.chart-legend { display: flex; gap: 16px; }
.legend-item { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--rb-text-secondary); font-weight: 600; }
.legend-dot { width: 8px; height: 8px; border-radius: 999px; flex-shrink: 0; }

.line-chart-wrap { position: relative; }
.line-chart { width: 100%; height: 200px; display: block; overflow: visible; }
.chart-grid-line { stroke: var(--rb-border); stroke-width: 1; }
.chart-axis-label { font-size: 9.5px; fill: var(--rb-text-secondary); font-family: inherit; }
.hover-target { cursor: pointer; }

.chart-tooltip {
  position: absolute;
  transform: translate(-50%, -115%);
  background: var(--rb-text-primary);
  color: var(--rb-surface);
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 11px;
  pointer-events: none;
  white-space: nowrap;
  box-shadow: 0 8px 20px rgba(var(--rb-shadow-rgb), 0.18);
  z-index: 2;
}
.chart-tooltip__label { font-weight: 700; margin: 0 0 4px; }
.chart-tooltip__row { display: flex; align-items: center; gap: 5px; margin: 2px 0; }

.donut-body { padding: 16px 18px 18px; display: flex; align-items: center; gap: 22px; }
.donut-chart-wrap { position: relative; width: 160px; height: 160px; flex-shrink: 0; }
.donut-chart { width: 100%; height: 100%; }
.donut-segment { transition: opacity 0.15s ease; cursor: pointer; }
.donut-segment--dim { opacity: 0.35; }
.donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  pointer-events: none;
}
.donut-center__value { font-size: 20px; font-weight: 800; color: var(--rb-text-primary); margin: 0; }
.donut-center__label { font-size: 10.5px; color: var(--rb-text-secondary); margin: 2px 0 0; max-width: 90px; }

.donut-legend { display: flex; flex-direction: column; gap: 10px; flex: 1; min-width: 0; }
.donut-legend__row { display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 4px; border-radius: 8px; transition: background 0.12s ease; }
.donut-legend__row:hover { background: var(--rb-surface-alt); }
.donut-legend__label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); flex: 1; }
.donut-legend__value { font-size: 11.5px; color: var(--rb-text-secondary); flex-shrink: 0; }

/* Hospital requests */
.request-list { display: flex; flex-direction: column; }
.request-item { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 18px; border-top: 1px solid var(--rb-surface-alt); }
.request-item:first-child { border-top: none; }
.request-item__left { display: flex; align-items: flex-start; gap: 12px; min-width: 0; }

.hospital-avatar {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
}

.request-info { min-width: 0; }
.request-info__row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.request-hospital { font-size: 13.5px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.urgency-pill { font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 999px; text-transform: capitalize; flex-shrink: 0; }
.urgency-pill--urgent { background: rgba(var(--rb-warning-rgb), 0.08); color: var(--rb-warning-text); }
.urgency-pill--routine { background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); }
.urgency-pill--emergency { background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); }

.request-meta { font-size: 11.5px; color: var(--rb-text-secondary); margin: 4px 0 0; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.request-item__right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

.empty-state { padding: 28px; text-align: center; color: var(--rb-text-secondary); font-size: 13px; display: flex; flex-direction: column; align-items: center; gap: 8px; }

/* Timeline (recent donation activity) */
.timeline { display: flex; flex-direction: column; }
.timeline-item { display: flex; align-items: flex-start; gap: 12px; padding: 13px 18px; border-top: 1px solid var(--rb-surface-alt); }
.timeline-item:first-child { border-top: none; }
.timeline-item__marker {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: rgba(var(--rb-primary-rgb), 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.timeline-item__body { flex: 1; min-width: 0; }
.timeline-item__row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.timeline-item__name { font-size: 13px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.timeline-item__meta { font-size: 11.5px; color: var(--rb-text-secondary); margin: 3px 0 0; }
.verified-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--rb-success-text);
  background: rgba(var(--rb-success-rgb), 0.08);
  padding: 2px 7px;
  border-radius: 999px;
}

/* Activity feed */
.activity-feed { display: flex; flex-direction: column; }
.activity-feed__item { display: flex; align-items: center; gap: 12px; padding: 12px 18px; border-top: 1px solid var(--rb-surface-alt); }
.activity-feed__item:first-child { border-top: none; }
.activity-feed__icon { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.activity-feed__body { flex: 1; min-width: 0; }
.activity-feed__title { font-size: 12.5px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.activity-feed__desc { font-size: 11.5px; color: var(--rb-text-secondary); margin: 2px 0 0; }
.activity-feed__time { font-size: 11px; color: var(--rb-text-secondary); flex-shrink: 0; white-space: nowrap; }

/* Modals */
.modal-overlay { position: fixed; inset: 0; background: var(--rb-overlay); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 1000; }
.modal-card { background: var(--rb-surface); border-radius: 14px; padding: 24px; width: 100%; max-width: 400px; box-shadow: 0 8px 28px rgba(var(--rb-shadow-rgb), 0.18); position: relative; }
.modal-card .btn-primary { color: #ffffff; background: var(--rb-primary); }
.modal-card .btn-primary:hover:not(:disabled) { background: #0D47A1; }
.modal-card .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.modal-card .btn-outline { color: var(--rb-text-primary); background: var(--rb-surface); border: 1px solid var(--rb-border-strong); }
.modal-card .btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.modal-card .btn-outline:disabled { opacity: 0.6; cursor: not-allowed; }
.modal-card--form { max-width: 460px; }
.modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--rb-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease;
}
.modal-close:hover { background: var(--rb-surface-alt); }
.modal-icon { width: 40px; height: 40px; border-radius: 10px; background: rgba(var(--rb-primary-rgb), 0.08); display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
.modal-title { font-size: 16px; font-weight: 700; color: var(--rb-text-primary); margin: 0 0 6px; }
.modal-title--left { margin-top: 4px; }
.modal-subtitle { font-size: 12.5px; color: var(--rb-text-secondary); margin: 0 0 20px; }
.modal-subtitle--left { margin-bottom: 18px; }
.modal-actions { display: flex; gap: 10px; margin-top: 4px; }
.modal-actions__btn { flex: 1; }

/* Donation form */
.donation-form { display: flex; flex-direction: column; gap: 14px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-field { display: flex; flex-direction: column; gap: 6px; }
.form-field__label { font-size: 12px; font-weight: 600; color: var(--rb-text-primary); }
.form-field__input {
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid var(--rb-border-strong);
  font-size: 13px;
  color: var(--rb-text-primary);
  background: var(--rb-surface);
  transition: border-color 0.15s ease;
  font-family: inherit;
}
.form-field__input:focus { outline: none; border-color: var(--rb-primary); box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.08); }
.form-field__input::placeholder { color: var(--rb-placeholder); }
.form-field__select {
  appearance: none;
  background: var(--rb-surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E") no-repeat right 12px center;
}
.form-field__textarea { resize: vertical; min-height: 64px; }
.form-error { font-size: 12px; color: var(--rb-accent-text); margin: -6px 0 0; }

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.15s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

/* Responsive */
@media (max-width: 1100px) {
  .focus-grid,
  .insights-grid,
  .activity-grid { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .dashboard { padding: 16px 16px 32px; }
  .header-row { flex-direction: column; align-items: stretch; }
  .header-actions { justify-content: space-between; }
  .panel-header { flex-direction: column; align-items: stretch; }
  .stock-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .attention-item { flex-wrap: wrap; }
  .attention-item__link { margin-left: 42px; }
  .request-item { flex-direction: column; align-items: stretch; }
  .request-item__right { justify-content: space-between; }
  .form-row { grid-template-columns: 1fr; }
  .donut-body { flex-direction: column; }
}
</style>