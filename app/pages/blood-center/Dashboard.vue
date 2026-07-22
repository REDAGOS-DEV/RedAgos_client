<template>
  <div class="dashboard">
    <div v-if="loading" class="loading-wrap">
      <div class="spinner" />
    </div>

    <div v-else class="dashboard-inner">
      <!-- Top header row -->
      <div class="header-row fade-in" style="--delay: 0ms">
        <div>
          <h1 class="page-title">Dashboard Overview</h1>
          <p class="page-subtitle">
            {{ greeting }}, {{ staffFirstName }}! Here's a quick overview for your operations.
          </p>
        </div>
        <div class="header-actions">
          <button class="bell-btn">
            <!-- KEPT YANNIE'S lowercase path -->
            <NuxtLink to="/blood-center/notifications">
              <AssetIcon name="bell" :size="16" />
              <span v-if="alerts.length" class="bell-dot" />
            </NuxtLink>
          </button>
        </div>
      </div>

      <!-- Stat cards -->
      <div class="stats-grid">
        <div class="stat-card stat-card--blue fade-in" style="--delay: 100ms">
          <p class="stat-card__label">Total Units</p>
          <p class="stat-card__value">{{ totalUnits }}</p>
          <p class="stat-card__trend stat-card__trend--up">
            <AssetIcon name="arrow-up-right" :size="12" />
            {{ unitsChangeLabel }} within this week
          </p>
        </div>

        <div class="stat-card stat-card--red fade-in" style="--delay: 150ms">
          <p class="stat-card__label">Pending Req.</p>
          <p class="stat-card__value" style="color:#D32F2F">{{ pendingRequests }}</p>
          <p class="stat-card__trend stat-card__trend--red">
            <span class="dot dot--red" />
            {{ urgentRequests }} urgent
          </p>
        </div>

        <div class="stat-card stat-card--orange fade-in" style="--delay: 200ms">
          <p class="stat-card__label">Near Expiry</p>
          <p class="stat-card__value" style="color:#F57C00">{{ nearExpiry }}</p>
          <p class="stat-card__trend stat-card__trend--orange">
            <AssetIcon name="alert" :size="12" />
            within {{ nearExpiryDays }} days
          </p>
        </div>

        <div class="stat-card stat-card--green fade-in" style="--delay: 250ms">
          <p class="stat-card__label">Donors Today</p>
          <p class="stat-card__value" style="color:#2E7D32">{{ donorsToday }}</p>
          <p class="stat-card__trend stat-card__trend--green">
            <AssetIcon name="check" :size="12" />
            {{ donorsScheduled }} scheduled
          </p>
        </div>
      </div>

      <!-- Alerts + Today's appointments -->
      <div class="row-grid">
        <div class="panel fade-in" style="--delay: 300ms">
          <div class="panel-header panel-header--simple">
            <h2 class="panel-title">Active Alerts</h2>
          </div>

          <div v-if="alerts.length" class="alert-list">
            <div v-for="a in alerts" :key="a.id" class="alert-item" :class="`alert-item--${a.level}`">
              <AssetIcon name="alert" :size="14" class="alert-item__icon" />
              <p class="alert-item__text">
                <strong v-if="a.level === 'critical'">Critical:</strong>
                <strong v-else-if="a.level === 'warning'">Warning:</strong>
                {{ a.message }}
              </p>
              <NuxtLink v-if="a.actionPath" :to="a.actionPath" class="alert-item__link">{{ a.actionLabel }} →</NuxtLink>
            </div>
          </div>
          <div v-else class="empty-state empty-state--compact">
            <AssetIcon name="check-circle" :size="32" style="color:#e5e7eb" />
            <p>No active alerts right now</p>
          </div>
        </div>

        <div class="panel fade-in" style="--delay: 320ms">
          <div class="panel-header">
            <h2 class="panel-title">Today's Appointments</h2>
            <!-- KEPT YANNIE'S lowercase path -->
            <NuxtLink to="/blood-center/appointments" class="panel-link-plain">View All</NuxtLink>
          </div>

          <div v-if="todaysAppointments.length" class="appt-list">
            <div v-for="slot in todaysAppointments" :key="slot.time" class="appt-slot-row"
              :class="{ 'appt-slot-row--full': slot.booked === slot.capacity }">
              <p class="appt-slot-row__time">{{ slot.time }}</p>
              <p class="appt-slot-row__count" :class="{ 'appt-slot-row__count--full': slot.booked === slot.capacity }">
                {{ slot.booked }} / {{ slot.capacity }}{{ slot.booked === slot.capacity ? ' Full' : '' }}
              </p>
            </div>
          </div>
          <div v-else class="empty-state empty-state--compact">
            <AssetIcon name="calendar" :size="32" style="color:#e5e7eb" />
            <p>No appointments scheduled today</p>
          </div>
        </div>
      </div>

      <!-- Recent requests + Stock summary -->
      <div class="row-grid">
        <div class="panel fade-in" style="--delay: 350ms">
          <div class="panel-header">
            <h2 class="panel-title">Recent Blood Requests</h2>
            <!-- KEPT YANNIE'S lowercase path -->
            <NuxtLink to="/blood-center/requests" class="panel-link">
              View All
              <AssetIcon name="chevron-right" :size="14" />
            </NuxtLink>
          </div>

          <div v-if="recentRequests.length" class="request-table">
            <div class="request-table__head">
              <span>REF #</span>
              <span>Blood Type</span>
              <span>Status</span>
              <span>Hospital</span>
              <span>Action</span>
            </div>
            <div v-for="r in recentRequests" :key="r.id" class="request-table__row">
              <!-- KEPT YANNIE'S lowercase path in the link -->
              <NuxtLink :to="`/blood-center/requests?ref=${r.reference}`" class="request-table__ref">{{ r.reference }}</NuxtLink>
              <span class="request-table__blood" :style="{ color: requestBadgeColor(r.status) }">{{ r.blood_type }}</span>
              <span class="request-table__status" :style="{ color: requestBadgeColor(r.status) }">{{ statusLabel(r.status) }}</span>
              <span class="request-table__hospital">{{ r.facility_name }}</span>
              <NuxtLink :to="requestActionPath(r)" class="request-table__action">{{ requestActionLabel(r.status) }} →</NuxtLink>
            </div>
          </div>
          <div v-else class="empty-state">
            <AssetIcon name="clipboard-check" :size="40" style="color:#e5e7eb" />
            <p>No blood requests yet</p>
          </div>
        </div>

        <div class="panel fade-in" style="--delay: 370ms">
          <div class="panel-header">
            <h2 class="panel-title">Stock Summary</h2>
            <!-- KEPT YANNIE'S lowercase path -->
            <NuxtLink to="/blood-center/inventory" class="panel-link-plain">Full Inventory</NuxtLink>
          </div>

          <div v-if="stockSummary.length" class="stock-grid">
            <div v-for="s in stockSummary" :key="s.blood_type" class="stock-chip" :class="{ 'stock-chip--low': s.low }">
              <p class="stock-chip__type" :class="{ 'stock-chip__type--low': s.low }">{{ s.blood_type }}</p>
              <p class="stock-chip__count" :class="{ 'stock-chip__count--low': s.low }">{{ s.count }}</p>
            </div>
          </div>
          <div v-else class="empty-state empty-state--compact">
            <AssetIcon name="archive" :size="32" style="color:#e5e7eb" />
            <p>No inventory data yet</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { ref, computed, onMounted } from 'vue'

definePageMeta({
  middleware: 'auth',
  layout: 'blood-centerdashboard'
})

const loading = ref(true)

// Core blood center data — all start empty/zero; populated only from the API response.
const staffFirstName = ref('')
const totalUnits = ref(0)
const unitsChangeLabel = ref('')
const pendingRequests = ref(0)
const urgentRequests = ref(0)
const nearExpiry = ref(0)
const donorsToday = ref(0)
const donorsScheduled = ref(0)
const alerts = ref([]) // [{ id, level: 'critical' | 'warning' | 'info', message, actionPath, actionLabel }]
const recentRequests = ref([]) // [{ id, reference, blood_type, component, quantity, facility_name, status, request_date }]
const todaysAppointments = ref([]) // [{ time, booked, capacity }]
const stockSummary = ref([]) // [{ blood_type, count, low }]

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
})

function statusLabel(status) {
  const map = {
    pending: 'Pending',
    processing: 'Processing',
    dispatched: 'Dispatched',
    received: 'Received',
    rejected: 'Rejected',
  }
  return map[status] ?? status
}

function requestBadgeColor(status) {
  const map = {
    pending: '#D32F2F',
    processing: '#1565C0',
    dispatched: '#1565C0',
    received: '#2E7D32',
    rejected: '#6b7280',
  }
  return map[status] ?? '#6b7280'
}

function requestActionLabel(status) {
  const map = {
    pending: 'Process',
    processing: 'Mark Received',
    dispatched: 'View',
    received: 'View',
    rejected: 'View',
  }
  return map[status] ?? 'View'
}

function requestActionPath(r) {
  // KEPT YANNIE'S lowercase path
  return `/blood-center/requests?ref=${r.reference}`
}

onMounted(async () => {
  try {
    // Backend contract: GET /api/bloodcenter/dashboard
    // Response fields:
    // { staff_first_name, total_units, units_change_label,
    //   pending_requests, urgent_requests, near_expiry, donors_today, donors_scheduled,
    //   alerts: [...], recent_requests: [...], todays_appointments: [...], stock_summary: [...] }
    const data = await $fetch('/api/bloodcenter/dashboard')
    staffFirstName.value = data.staff_first_name ?? ''
    totalUnits.value = data.total_units ?? 0
    unitsChangeLabel.value = data.units_change_label ?? ''
    pendingRequests.value = data.pending_requests ?? 0
    urgentRequests.value = data.urgent_requests ?? 0
    nearExpiry.value = data.near_expiry ?? 0
    donorsToday.value = data.donors_today ?? 0
    donorsScheduled.value = data.donors_scheduled ?? 0
    alerts.value = data.alerts ?? []
    recentRequests.value = data.recent_requests ?? []
    todaysAppointments.value = data.todays_appointments ?? []
    stockSummary.value = data.stock_summary ?? []
  } catch (err) {
    // sa dev/UI stage pa lang, wala pay live nga /api/bloodcenter/dashboard endpoint,
    // so mag-fail gyud ni nga call. Nagpabilin ra sa default nga 0/empty values,
    // so mag-display ug empty states ang UI imbes mag-crash o mag-display ug fake data.
    console.error('Failed to load dashboard data (expected while backend is not yet wired up):', err)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.dashboard {
  --primary: #1565c0;
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
  .fade-in, .spinner { animation: none !important; }
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
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.page-subtitle {
  font-size: 13.5px;
  color: var(--text-secondary);
  margin: 2px 0 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bell-btn {
  position: relative;
  padding: 8px;
  border-radius: 12px;
  background: white;
  border: 1px solid #f3f4f6;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  cursor: pointer;
  transition: background 0.15s ease;
}

.bell-btn:hover {
  background: #f9fafb;
}

.bell-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--accent);
}

/* Stat cards (flat, colored top border) */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 16px 18px;
  border: 1px solid #eef0f3;
  border-top: 3px solid transparent;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.stat-card--blue { border-top-color: var(--primary); }
.stat-card--red { border-top-color: var(--accent); }
.stat-card--orange { border-top-color: var(--warning); }
.stat-card--green { border-top-color: var(--success); }

.stat-card__label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  margin: 0;
}

.stat-card__value {
  font-size: 30px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 6px 0 4px;
  line-height: 1;
}

.stat-card__trend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  margin: 0;
}

.stat-card__trend--up { color: var(--success); }
.stat-card__trend--red { color: var(--accent); }
.stat-card__trend--orange { color: var(--warning); }
.stat-card__trend--green { color: var(--success); }

.dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  flex-shrink: 0;
}

.dot--red { background: var(--accent); }

/* Two-column rows */
.row-grid {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 20px;
  align-items: start;
}

/* Panels */
.panel {
  background: white;
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  border: 1px solid #eef0f3;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #f3f4f6;
}

.panel-header--simple {
  padding: 14px 18px;
}

.panel-title {
  font-weight: 700;
  font-size: 13.5px;
  color: var(--text-primary);
  margin: 0;
}

.panel-link {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
  display: flex;
  align-items: center;
  gap: 2px;
  text-decoration: none;
}

.panel-link:hover { text-decoration: underline; }

.panel-link-plain {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
  text-decoration: none;
}

.panel-link-plain:hover { text-decoration: underline; }

/* Alerts */
.alert-list {
  display: flex;
  flex-direction: column;
  padding: 10px;
  gap: 6px;
}

.alert-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #E3F2FD;
  border-left: 3px solid var(--primary);
}

.alert-item--critical {
  background: #FDEAEA;
  border-left-color: var(--accent);
}

.alert-item--warning {
  background: #FFF6E5;
  border-left-color: var(--warning);
}

.alert-item__icon {
  color: var(--primary);
  flex-shrink: 0;
}

.alert-item--critical .alert-item__icon { color: var(--accent); }
.alert-item--warning .alert-item__icon { color: var(--warning); }

.alert-item__text {
  font-size: 12px;
  color: #374151;
  margin: 0;
  flex: 1;
}

.alert-item--critical .alert-item__text strong { color: var(--accent); }
.alert-item--warning .alert-item__text strong { color: var(--warning); }

.alert-item__link {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--primary);
  text-decoration: none;
  flex-shrink: 0;
  white-space: nowrap;
}

.alert-item__link:hover { text-decoration: underline; }

/* Today's appointments */
.appt-list {
  display: flex;
  flex-direction: column;
  padding: 10px;
  gap: 6px;
}

.appt-slot-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f8f9fb;
}

.appt-slot-row--full {
  background: #FDEAEA;
}

.appt-slot-row__time {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.appt-slot-row__count {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 0;
}

.appt-slot-row__count--full {
  color: var(--accent);
}

/* Recent requests table */
.request-table {
  display: flex;
  flex-direction: column;
}

.request-table__head {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
  padding: 10px 18px;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-secondary);
  border-bottom: 1px solid #f3f4f6;
}

.request-table__row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
  align-items: center;
  padding: 12px 18px;
  border-bottom: 1px solid #fafafa;
  font-size: 12.5px;
}

.request-table__row:last-child {
  border-bottom: none;
}

.request-table__ref {
  font-weight: 700;
  color: var(--primary);
  text-decoration: none;
}

.request-table__ref:hover { text-decoration: underline; }

.request-table__blood,
.request-table__status {
  font-weight: 700;
}

.request-table__hospital {
  color: #6b7280;
}

.request-table__action {
  font-weight: 700;
  color: var(--primary);
  text-decoration: none;
}

.request-table__action:hover { text-decoration: underline; }

/* Stock summary */
.stock-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 16px 18px;
}

.stock-chip {
  border-radius: 10px;
  padding: 12px;
  background: #E8F5E9;
  text-align: center;
}

.stock-chip--low {
  background: #FDEAEA;
}

.stock-chip__type {
  font-size: 12px;
  font-weight: 700;
  color: var(--success);
  margin: 0;
}

.stock-chip__type--low { color: var(--accent); }

.stock-chip__count {
  font-size: 20px;
  font-weight: 800;
  color: var(--success);
  margin: 4px 0 0;
}

.stock-chip__count--low { color: var(--accent); }

/* Empty states */
.empty-state {
  padding: 32px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 12.5px;
}

.empty-state--compact {
  padding: 24px;
}

.empty-state p {
  margin: 8px 0 0;
}

/* Responsive */
@media (max-width: 1024px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .row-grid { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .dashboard { padding: 16px 16px 32px; }
  .header-row { flex-direction: column; align-items: stretch; }
  .request-table__head,
  .request-table__row {
    grid-template-columns: 1fr 1fr 1fr;
  }
  .request-table__hospital { display: none; }
}
</style>