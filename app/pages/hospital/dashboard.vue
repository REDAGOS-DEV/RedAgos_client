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
          <h1 class="page-title">Here's your blood bank overview</h1>
          <p class="page-subtitle">Track requests, inventory, and fulfillment, all in one place.</p>
        </div>
        <div class="header-actions">
          <span v-if="criticalCount > 0" class="icon-btn__dot" />
          <NuxtLink to="/hospital/requests/new" class="btn-primary">
            <AssetIcon name="file-plus" :size="15" />
            New Request
          </NuxtLink>
        </div>
      </div>

      <!-- Critical stock / urgent request banner -->
      <div v-if="criticalAlert" class="banner banner--warning fade-in" style="--delay: 60ms">
        <AssetIcon name="alert" :size="16" class="banner-icon" />
        <p class="banner-text">
          {{ criticalAlert.message }}
        </p>
        <NuxtLink :to="criticalAlert.path" class="banner-link">{{ criticalAlert.linkLabel }}</NuxtLink>
      </div>
      <div v-else-if="pendingCount > 0" class="banner fade-in" style="--delay: 60ms">
        <AssetIcon name="check-circle" :size="16" class="banner-icon" />
        <p class="banner-text">
          All blood units are within safe threshold levels.
        </p>
        <NuxtLink to="/hospital/requests" class="banner-link">View Requests</NuxtLink>
      </div>

      <!-- Stat cards -->
      <div class="stats-grid">
        <div class="stat-card fade-in" style="--delay: 100ms">
          <div class="stat-card__top">
            <p class="stat-card__label">Units Available</p>
            <div class="stat-card__badge" style="background:#1565C014">
              <AssetIcon name="blood-drop" :size="14" style="color:#1565C0" />
            </div>
          </div>
          <p class="stat-card__value">{{ unitsAvailable }}</p>
          <span class="stat-chip stat-chip--neutral">Across all blood types</span>
        </div>

        <div class="stat-card fade-in" style="--delay: 150ms">
          <div class="stat-card__top">
            <p class="stat-card__label">Pending Requests</p>
            <div class="stat-card__badge" style="background:#F57C0014">
              <AssetIcon name="clock" :size="14" style="color:#F57C00" />
            </div>
          </div>
          <p class="stat-card__value" style="color:#F57C00">{{ pendingCount }}</p>
          <span class="stat-chip stat-chip--warning">Awaiting fulfillment</span>
        </div>

        <div class="stat-card fade-in" style="--delay: 200ms">
          <div class="stat-card__top">
            <p class="stat-card__label">In Processing</p>
            <div class="stat-card__badge" style="background:#42A5F514">
              <AssetIcon name="loader" :size="14" style="color:#42A5F5" />
            </div>
          </div>
          <p class="stat-card__value" style="color:#1565C0">{{ processingCount }}</p>
          <span class="stat-chip stat-chip--neutral">Being prepared now</span>
        </div>

        <div class="stat-card fade-in" style="--delay: 250ms">
          <div class="stat-card__top">
            <p class="stat-card__label">Completed Today</p>
            <div class="stat-card__badge" style="background:#2E7D3214">
              <AssetIcon name="check-circle" :size="14" style="color:#2E7D32" />
            </div>
          </div>
          <p class="stat-card__value" style="color:#2E7D32">{{ completedToday }}</p>
          <span class="stat-chip stat-chip--success">Fulfilled since {{ completedToday }} AM</span>
        </div>
      </div>

      <!-- Main content grid -->
      <div class="main-grid">
        <!-- Left column -->
        <div class="col-left">
          <!-- Recent blood requests -->
          <div class="panel fade-in" style="--delay: 300ms">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">Recent Blood Requests</h2>
                <p class="panel-subtitle">Latest requests submitted from your facility</p>
              </div>
              <NuxtLink to="/hospital/requests" class="panel-link">
                View All
                <AssetIcon name="chevron-right" :size="14" />
              </NuxtLink>
            </div>

            <div v-if="recentRequests.length" class="donation-list">
              <div v-for="req in recentRequests" :key="req.id" class="donation-item">
                <div class="donation-item__left">
                  <div class="donation-icon" :style="{ background: bloodTypeBg(req.blood_type) }">
                    <span class="blood-type-label" :style="{ color: bloodTypeColor(req.blood_type) }">
                      {{ req.blood_type }}
                    </span>
                  </div>
                  <div>
                    <p class="donation-title">
                      {{ req.reference_number }} &middot; {{ req.quantity }} unit{{ req.quantity !== 1 ? 's' : '' }} {{ req.component_name }}
                    </p>
                    <p class="donation-meta">
                      {{ req.ward || req.facility_name }} &middot; Submitted {{ req.submitted_at_relative }}
                    </p>
                  </div>
                </div>
                <div class="donation-item__right">
                  <span class="badge capitalize" :style="{
                    background: statusMap[req.status]?.bg || '#f1f5f9',
                    color: statusMap[req.status]?.color || '#64748b',
                  }">
                    {{ statusMap[req.status]?.label || req.status }}
                  </span>
                </div>
              </div>
            </div>
            <div v-else class="empty-state">
              <AssetIcon name="inbox" :size="36" style="color:#e5e7eb" />
              <p>No blood requests yet</p>
            </div>
          </div>

          <!-- Weekly request trend -->
          <div class="panel fade-in" style="--delay: 350ms">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">Request Trend</h2>
                <p class="panel-subtitle">Blood requests submitted over the last 7 weeks</p>
              </div>
              <span class="period-pill">Last 7 weeks</span>
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
                    v-for="(w, i) in weeklyTrend"
                    :key="w.key"
                    class="chart__col"
                    tabindex="0"
                    role="button"
                    :aria-label="`${w.week}: ${w.count} request${w.count !== 1 ? 's' : ''}`"
                    @mouseenter="hoveredWeek = i"
                    @mouseleave="hoveredWeek = null"
                    @focus="hoveredWeek = i"
                    @blur="hoveredWeek = null"
                    @click="hoveredWeek = hoveredWeek === i ? null : i"
                  >
                    <div class="chart__tooltip" v-if="hoveredWeek === i">
                      {{ w.count }} request{{ w.count !== 1 ? 's' : '' }}
                    </div>

                    <div class="chart__track">
                      <div class="chart__bar" :class="{
                        'chart__bar--current': i === weeklyTrend.length - 1 && w.count > 0,
                        'chart__bar--low': w.count > 0 && w.count <= lowThreshold && i !== weeklyTrend.length - 1,
                        'chart__bar--empty': w.count === 0
                      }" :style="{ height: `${barHeight(w.count)}%` }" />
                    </div>

                    <span class="chart__label" :class="{ 'chart__label--current': i === weeklyTrend.length - 1 }">{{ w.week }}</span>
                  </div>
                </div>
              </div>

              <div v-else class="trend-empty">
                <AssetIcon name="trending-up" :size="36" style="color:#e5e7eb" />
                <p>Not enough data yet to show a trend</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Right column -->
        <div class="col-right">
          <!-- Blood inventory status -->
          <div class="panel fade-in" style="--delay: 300ms">
            <div class="panel-header panel-header--simple">
              <h2 class="panel-title">Blood Inventory Status</h2>
              <NuxtLink to="/hospital/availability" class="panel-link-plain">Manage</NuxtLink>
            </div>

            <div v-if="inventorySummary.length" class="inventory-grid">
              <div v-for="item in inventorySummary" :key="item.blood_type" class="inventory-pill"
                :style="{ background: item.is_low ? '#D32F2F0F' : undefined }">
                <span class="inventory-pill__dot" :style="{ background: item.is_low ? '#D32F2F' : '#2E7D32' }" />
                <span class="inventory-pill__type">{{ item.blood_type }}</span>
                <span class="inventory-pill__units">{{ item.units }} units</span>
              </div>
            </div>
            <div v-else class="empty-state">
              <AssetIcon name="blood-drop" :size="36" style="color:#e5e7eb" />
              <p>No inventory data available</p>
            </div>
          </div>

          <!-- Active alerts -->
          <div class="panel fade-in" style="--delay: 350ms">
            <div class="panel-header panel-header--simple">
              <h2 class="panel-title">Active Alerts</h2>
            </div>

            <div v-if="alerts.length" class="alerts-list">
              <div v-for="alert in alerts" :key="alert.id" class="alert-row" :style="{
                background: alert.level === 'critical' ? '#FFEBEE' : '#FFF8E1'
              }">
                <AssetIcon name="alert" :size="15"
                  :style="{ color: alert.level === 'critical' ? '#D32F2F' : '#F57C00' }" />
                <p class="alert-text" :style="{ color: alert.level === 'critical' ? '#D32F2F' : '#F57C00' }">
                  {{ alert.message }}
                </p>
              </div>
            </div>
            <div v-else class="empty-state empty-state--sm">
              <AssetIcon name="check-circle" :size="30" style="color:#e5e7eb" />
              <p>No active alerts</p>
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
import { ref, computed, onMounted } from 'vue'
import { hospitalService } from '~/api/hospital/HospitalService'

definePageMeta({ middleware: 'auth', layout: 'hospitaldashboard' })

const loading = ref(true)

// Core hospital dashboard data
const unitsAvailable = ref(0)
const pendingCount = ref(0)
const processingCount = ref(0)
const completedToday = ref(0)
const recentRequests = ref([])
const inventorySummary = ref([])
const alerts = ref([])
const weeklyTrend = ref([])

// Trend chart state
const hoveredWeek = ref(null)
const lowThreshold = 1

const maxTrendCount = computed(() => {
  const max = Math.max(0, ...weeklyTrend.value.map(w => w.count))
  return max > 0 ? max : 1
})

const hasTrendData = computed(() => weeklyTrend.value.some(w => w.count > 0))

const yTicks = computed(() => {
  const max = maxTrendCount.value
  return [max, Math.round(max * 0.75), Math.round(max * 0.5), Math.round(max * 0.25), 0]
})

function barHeight(count) {
  return Math.round((count / maxTrendCount.value) * 100)
}

const criticalCount = computed(() => inventorySummary.value.filter(i => i.is_low).length)

const criticalAlert = computed(() => {
  const critical = alerts.value.find(a => a.level === 'critical')
  if (!critical) return null
  return { message: critical.message, path: '/hospital/availability', linkLabel: 'View Inventory' }
})

const statusMap = {
  pending: { label: 'Pending', bg: '#F57C0014', color: '#F57C00' },
  processing: { label: 'Processing', bg: '#42A5F514', color: '#1565C0' },
  approved: { label: 'Approved', bg: '#2E7D3214', color: '#2E7D32' },
  dispatched: { label: 'Dispatched', bg: '#1565C014', color: '#1565C0' },
  received: { label: 'Received', bg: '#2E7D3214', color: '#2E7D32' },
  rejected: { label: 'Rejected', bg: '#D32F2F14', color: '#D32F2F' },
}

function bloodTypeBg() { return '#1565C014' }
function bloodTypeColor() { return '#1565C0' }

const quickActions = [
  { path: '/hospital/requests/new', icon: 'file-plus', color: '#1565C0', label: 'Create Blood Request' },
  { path: '/hospital/availability', icon: 'search', color: '#2E7D32', label: 'Search Availability' },
  { path: '/hospital/billing', icon: 'receipt', color: '#F57C00', label: 'Billing & Payments' },
  { path: '/hospital/bloodrequests', icon: 'clipboard-list', color: '#D32F2F', label: 'Track Requests' },
]

onMounted(async () => {
  try {
    // // Dev note: dashboard() kay mag-return unta og
    // // { units_available, pending_requests, processing_requests, completed_today,
    // //   recent_requests, inventory_summary, alerts, weekly_trend }
    // // gikan sa GET /hospital/dashboard endpoint.
    const data = await hospitalService.dashboard()
    unitsAvailable.value = data.units_available ?? 0
    pendingCount.value = data.pending_requests ?? 0
    processingCount.value = data.processing_requests ?? 0
    completedToday.value = data.completed_today ?? 0
    recentRequests.value = data.recent_requests ?? []
    inventorySummary.value = data.inventory_summary ?? []
    alerts.value = data.alerts ?? []
    weeklyTrend.value = data.weekly_trend ?? []
  } catch (err) {
    console.error('Failed to load hospital dashboard data:', err)
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
  position: relative;
}

.icon-btn__dot {
  position: absolute;
  top: -3px;
  right: -3px;
  width: 8px;
  height: 8px;
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

.banner--warning {
  background: #fff8e1;
  border-color: #ffe082;
}

.banner-icon {
  color: var(--success);
  flex-shrink: 0;
}

.banner--warning .banner-icon {
  color: var(--warning);
}

.banner-text {
  font-size: 12px;
  font-weight: 500;
  color: var(--success);
  margin: 0;
}

.banner--warning .banner-text {
  color: var(--warning);
}

.banner-link {
  margin-left: auto;
  font-size: 12px;
  font-weight: 700;
  text-decoration: underline;
  color: var(--success);
  flex-shrink: 0;
}

.banner--warning .banner-link {
  color: var(--warning);
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

/* Request / donation-style list */
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
  gap: 12px;
}

.donation-item:last-child { border-bottom: none; }

.donation-item__left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.donation-icon {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.blood-type-label {
  font-size: 11px;
  font-weight: 800;
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

.badge {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 999px;
  display: inline-block;
}

.capitalize { text-transform: capitalize; }

.empty-state {
  padding: 28px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}

.empty-state--sm {
  padding: 20px;
}

/* Inventory grid */
.inventory-grid {
  padding: 14px 18px 18px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.inventory-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f8fafc;
}

.inventory-pill__dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex-shrink: 0;
}

.inventory-pill__type {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  flex: 1;
}

.inventory-pill__units {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
}

/* Alerts */
.alerts-list {
  padding: 10px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alert-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  border-radius: 10px;
  padding: 10px 12px;
}

.alert-text {
  font-size: 12px;
  font-weight: 500;
  margin: 0;
  line-height: 1.4;
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
  .header-actions { justify-content: flex-end; }
  .inventory-grid { grid-template-columns: repeat(2, 1fr); }
}

/* ============ Dark mode ============ */
:global(.dark .dashboard) {
  --text-primary: #F1F5F9;
  --text-secondary: #94A3B8;
  --border: #334155;
  background: #0F172A;
}

:global(.dark .stat-card),
:global(.dark .panel) {
  background: #1E293B;
  border-color: #334155;
}

:global(.dark .quick-action:hover),
:global(.dark .quick-action:focus-visible) {
  background: #263449;
}

:global(.dark .icon-btn__dot) { border-color: #1E293B; }

:global(.dark .stat-card:hover) { border-color: #475569; }

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
:global(.dark .quick-action__label) { color: #E2E8F0; }
:global(.dark .quick-action__chevron) { color: #475569; }

:global(.dark .banner) { background: rgba(102,187,106,0.14); border-color: rgba(102,187,106,0.3); }
:global(.dark .banner--warning) { background: rgba(255,167,38,0.14); border-color: rgba(255,167,38,0.3); }

:global(.dark .inventory-pill) { background: #243247; }
:global(.dark .inventory-pill__type) { color: #E2E8F0; }

:global(.dark .alert-row) { background: rgba(255,167,38,0.1) !important; }

:global(.dark .skeleton) {
  background: linear-gradient(90deg, #1E293B 25%, #263449 37%, #1E293B 63%);
}
</style>