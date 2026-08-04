<template>
  <div class="page">
    <!-- HEADER -->
    <header class="page-header">
      <div>
        <h1 class="page-title">Incoming Requests</h1>
        <p class="page-subtitle">Review, prioritize, and process blood requests submitted by partner hospitals.</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-outline" @click="handleRefresh" :disabled="loading">
          <AssetIcon name="refresh-cw" :size="16" :class="{ spinning: loading }" />
          Refresh
        </button>
        <button class="btn btn-outline">
          <AssetIcon name="download" :size="16" />
          Export Requests
        </button>
      </div>
    </header>

    <!-- ERROR / RETRY BANNER -->
    <div v-if="error" class="retry-banner">
      <AssetIcon name="triangle-alert" :size="16" />
      <span>Couldn't load incoming requests. {{ error?.message || 'Please try again.' }}</span>
      <button class="btn btn-outline btn-sm" @click="handleRefresh">Retry</button>
    </div>

    <!-- EMERGENCY ALERT -->
    <transition name="fade">
      <div v-if="primaryEmergency" class="emergency-banner">
        <div class="emergency-main">
          <div class="emergency-icon">
            <AssetIcon name="triangle-alert" :size="20" />
          </div>
          <div class="emergency-body">
            <div class="emergency-title-row">
              <span class="emergency-title">Emergency Blood Request</span>
              <span class="emergency-id">{{ primaryEmergency.id }}</span>
            </div>
            <div class="emergency-grid">
              <div><span class="e-label">Hospital</span><span class="e-value">{{ primaryEmergency.hospital }}</span></div>
              <div><span class="e-label">Blood Type</span><span class="e-value">{{ primaryEmergency.bloodType }}</span></div>
              <div><span class="e-label">Component</span><span class="e-value">{{ primaryEmergency.component }}</span></div>
              <div><span class="e-label">Units Requested</span><span class="e-value">{{ primaryEmergency.units }}</span></div>
              <div><span class="e-label">Needed Within</span><span class="e-value">{{ primaryEmergency.neededBy }}</span></div>
              <div>
                <span class="e-label">Available Inventory</span>
                <span class="e-value" :class="'inv-' + inventoryLevel(primaryEmergency)">
                  {{ primaryEmergency.available }} units
                </span>
              </div>
            </div>
            <p v-if="inventoryLevel(primaryEmergency) === 'insufficient'" class="insufficient-tag">
              <AssetIcon name="octagon-alert" :size="14" /> Insufficient Inventory
            </p>
          </div>
        </div>
        <div class="emergency-actions">
          <button class="btn btn-primary btn-sm" @click="openReview(primaryEmergency)">Review Request</button>
          <button class="btn btn-outline btn-sm" @click="activeFilter = 'Emergency'">View Queue</button>
          <button class="icon-btn" @click="dismissAlert(primaryEmergency.id)" aria-label="Dismiss alert">
            <AssetIcon name="x" :size="16" />
          </button>
        </div>
      </div>
    </transition>

    <!-- SUMMARY CARDS -->
    <section class="summary-grid">
      <template v-if="summaryLoading">
        <div v-for="n in 4" :key="'sk-' + n" class="summary-card skeleton-card" />
      </template>
      <template v-else>
        <div v-for="stat in summaryStats" :key="stat.key" class="summary-card" :class="{ 'is-danger': stat.danger }">
          <div class="summary-icon" :class="{ 'is-danger': stat.danger }">
            <AssetIcon :name="stat.icon" :size="20" />
          </div>
          <div class="summary-body">
            <p class="summary-value">{{ stat.value }}</p>
            <p class="summary-label">{{ stat.label }}</p>
            <p class="summary-trend" :class="{ up: stat.trendUp === true, down: stat.trendUp === false }">
              <AssetIcon v-if="stat.trendUp === true" name="trending-up" :size="12" />
              <AssetIcon v-else-if="stat.trendUp === false" name="trending-down" :size="12" />
              {{ stat.trend }}
            </p>
          </div>
        </div>
      </template>
    </section>

    <!-- QUICK FILTERS -->
    <div class="quick-filters">
      <button
        v-for="opt in filterOptions"
        :key="opt"
        class="pill"
        :class="{ active: activeFilter === opt }"
        @click="activeFilter = opt"
      >
        {{ opt }}
      </button>
    </div>

    <!-- ADVANCED FILTER TOOLBAR -->
    <div class="toolbar">
      <div class="toolbar-search">
        <AssetIcon name="search" :size="16" class="search-icon" />
        <input v-model="searchQuery" type="text" placeholder="Search request ID, hospital..." @input="onSearchInput" />
      </div>

      <select v-model="toolbarFilters.hospital">
        <option value="">Hospital</option>
        <option v-for="h in hospitalOptions" :key="h" :value="h">{{ h }}</option>
      </select>
      <select v-model="toolbarFilters.bloodType">
        <option value="">Blood Type</option>
        <option v-for="b in bloodTypeOptions" :key="b" :value="b">{{ b }}</option>
      </select>
      <select v-model="toolbarFilters.component">
        <option value="">Blood Component</option>
        <option v-for="c in componentOptions" :key="c" :value="c">{{ c }}</option>
      </select>
      <select v-model="toolbarFilters.priority">
        <option value="">Priority</option>
        <option>Routine</option>
        <option>Urgent</option>
        <option>Emergency</option>
      </select>
      <select v-model="toolbarFilters.status">
        <option value="">Status</option>
        <option>Pending</option>
        <option>Under Review</option>
        <option>Approved</option>
      </select>
      <input v-model="toolbarFilters.date" type="date" />

      <div class="toolbar-buttons">
        <button class="btn btn-outline btn-sm" @click="resetFilters">Reset Filters</button>
        <button class="btn btn-primary btn-sm" :disabled="loading" @click="loadRequests">Apply Filters</button>
      </div>

      <div class="toolbar-meta">
        <span>Showing {{ requests.length }} requests</span>
        <span class="dot">·</span>
        <span>Updated {{ lastUpdatedLabel }}</span>
      </div>
    </div>

    <!-- REQUEST TABLE -->
    <div class="table-card">
      <div v-if="loading" class="table-skeleton">
        <div v-for="n in 5" :key="n" class="skeleton-row" />
      </div>

      <div v-else-if="!error && requests.length === 0" class="empty-state">
        <AssetIcon name="inbox" :size="40" />
        <h3>No Incoming Requests</h3>
        <p>There are currently no pending hospital requests to review.</p>
        <button class="btn btn-primary btn-sm" @click="handleRefresh">Refresh Requests</button>
      </div>

      <table v-else-if="!error" class="request-table">
        <thead>
          <tr>
            <th>Request ID</th>
            <th>Hospital</th>
            <th>Blood Type</th>
            <th>Component</th>
            <th>Units</th>
            <th>Available</th>
            <th>Priority</th>
            <th>Needed By</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in requests"
            :key="r.id"
            class="table-row"
            :class="{ 'is-mutating': isMutating(r.id) }"
            @click="openReview(r)"
          >
            <td class="mono">{{ r.id }}</td>
            <td>
              <div class="hospital-cell">
                <span class="hospital-name">{{ r.hospital }}</span>
                <span class="hospital-contact">{{ r.contact }}</span>
              </div>
            </td>
            <td><span class="blood-pill">{{ r.bloodType }}</span></td>
            <td>{{ r.component }}</td>
            <td>{{ r.units }}</td>
            <td>
              <span class="inv-pill" :class="'inv-' + inventoryLevel(r)">{{ r.available }} units</span>
            </td>
            <td>
              <span class="priority-badge" :class="'priority-' + r.priority.toLowerCase()">{{ r.priority }}</span>
            </td>
            <td class="needed-by">{{ r.neededBy }}</td>
            <td>
              <span class="status-badge" :class="'status-' + r.status.toLowerCase().replace(' ', '-')">{{ r.status }}</span>
            </td>
            <td class="actions-cell" @click.stop>
              <button class="btn btn-primary btn-xs" :disabled="isMutating(r.id)" @click="openReview(r)">
                Review
              </button>
              <div class="menu-wrap">
                <button class="icon-btn" @click="toggleMenu(r.id)" aria-label="More actions">
                  <AssetIcon name="move-vertical" :size="16" />
                </button>
                <div v-if="openMenuId === r.id" class="context-menu" @click="openMenuId = null">
                  <button @click="openReview(r)"><AssetIcon name="eye" :size="14" /> View Details</button>
                  <button :disabled="isMutating(r.id)" @click="handleApprove(r)"><AssetIcon name="check" :size="14" /> Approve Request</button>
                  <button :disabled="isMutating(r.id)" @click="handleApprove(r)"><AssetIcon name="archive" :size="14" /> Reserve Inventory</button>
                  <button class="danger" :disabled="isMutating(r.id)" @click="handleReject(r)"><AssetIcon name="circle-x" :size="14" /> Reject Request</button>
                  <button><AssetIcon name="printer" :size="14" /> Print Request</button>
                  <button @click="openReview(r)"><AssetIcon name="activity" :size="14" /> View Timeline</button>
                  <button><AssetIcon name="file-text" :size="14" /> Export PDF</button>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- RECENT ACTIVITY -->
    <section class="activity-card">
      <h2 class="section-title">Recent Request Activity</h2>

      <div v-if="activityLoading" class="activity-skeleton">
        <div v-for="n in 4" :key="n" class="skeleton-row" />
      </div>

      <p v-else-if="activity.length === 0" class="activity-empty">No recent activity yet.</p>

      <ul v-else class="activity-list">
        <li v-for="item in activity" :key="item.id" class="activity-item">
          <span class="activity-dot" :class="activityToneClass(item.type)">
            <AssetIcon :name="activityIcon(item.type)" :size="14" />
          </span>
          <div class="activity-body">
            <p><strong>{{ item.description }}</strong> — {{ item.hospital }}</p>
            <span class="activity-meta">{{ item.time }} · {{ item.staff }}</span>
          </div>
        </li>
      </ul>
    </section>

    <!-- REVIEW DRAWER -->
    <transition name="drawer">
      <aside v-if="drawerOpen" class="drawer-overlay" @click.self="closeDrawer">
        <div class="drawer">
          <header class="drawer-header">
            <h2>Review Request</h2>
            <button class="icon-btn" @click="closeDrawer" aria-label="Close"><AssetIcon name="x" :size="18" /></button>
          </header>

          <div v-if="drawerLoading" class="drawer-loading">
            <div v-for="n in 4" :key="n" class="skeleton-row" />
          </div>

          <div v-else-if="activeRequest" class="drawer-content">
            <section class="drawer-section">
              <h3>Hospital Information</h3>
              <dl class="detail-grid">
                <div><dt>Hospital Name</dt><dd>{{ activeRequest.hospital }}</dd></div>
                <div><dt>Doctor</dt><dd>{{ activeRequest.contact }}</dd></div>
                <div><dt>Priority</dt><dd><span class="priority-badge" :class="'priority-' + activeRequest.priority.toLowerCase()">{{ activeRequest.priority }}</span></dd></div>
                <div><dt>Request Date</dt><dd>{{ activeRequest.requestDate }}</dd></div>
              </dl>
            </section>

            <section class="drawer-section">
              <h3>Requested Blood</h3>
              <dl class="detail-grid">
                <div><dt>Blood Type</dt><dd><span class="blood-pill">{{ activeRequest.bloodType }}</span></dd></div>
                <div><dt>Component</dt><dd>{{ activeRequest.component }}</dd></div>
                <div><dt>Units Requested</dt><dd>{{ activeRequest.units }}</dd></div>
                <div><dt>Needed By</dt><dd>{{ activeRequest.neededBy }}</dd></div>
              </dl>
              <div class="notes-block">
                <p class="notes-label">Reason</p>
                <p class="notes-text">{{ activeRequest.reason || '—' }}</p>
                <p class="notes-label">Clinical Notes</p>
                <p class="notes-text">{{ activeRequest.notes || '—' }}</p>
              </div>
            </section>

            <section class="drawer-section">
              <h3>Inventory Availability</h3>
              <dl class="detail-grid">
                <div><dt>Compatible Types</dt><dd>{{ (activeRequest.compatibleTypes || []).join(', ') || '—' }}</dd></div>
                <div>
                  <dt>Available Units</dt>
                  <dd :class="'inv-' + inventoryLevel(activeRequest)">{{ activeRequest.available }} units</dd>
                </div>
              </dl>
              <p class="batches-label">Suggested Inventory Batches</p>
              <div class="batch-list">
                <div v-if="!(activeRequest.batches || []).length" class="batch-empty">No suggested batches available.</div>
                <div v-for="batch in activeRequest.batches || []" :key="batch.code" class="batch-row">
                  <span>{{ batch.code }}</span>
                  <span>{{ batch.units }} units</span>
                  <span class="ok-tag">{{ batch.compatible ? 'Compatible' : 'Check' }}</span>
                </div>
              </div>
              <p class="health-bar-label">Inventory Health</p>
              <div class="health-bar">
                <div
                  class="health-fill"
                  :class="'inv-' + inventoryLevel(activeRequest)"
                  :style="{ width: Math.min(100, (activeRequest.available / Math.max(activeRequest.units, 1)) * 100) + '%' }"
                />
              </div>
            </section>

            <section class="drawer-section">
              <h3>Request Timeline</h3>
              <ol class="timeline">
                <li
                  v-for="(step, i) in timelineSteps"
                  :key="step"
                  :class="{ done: i <= currentStepIndex, current: i === currentStepIndex }"
                >
                  <span class="timeline-dot">
                    <AssetIcon v-if="i <= currentStepIndex" name="check" :size="10" />
                  </span>
                  {{ step }}
                </li>
              </ol>
            </section>
          </div>

          <footer class="drawer-footer">
            <button class="btn btn-outline" :disabled="drawerMutating" @click="handleReject(activeRequest)">
              Reject Request
            </button>
            <button class="btn btn-primary" :disabled="drawerMutating" @click="handleApprove(activeRequest)">
              {{ drawerMutating ? 'Processing…' : 'Approve & Reserve Inventory' }}
            </button>
          </footer>
        </div>
      </aside>
    </transition>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { ref, computed, watch, onMounted } from 'vue'
import { useDarkMode } from '~/composables/useDarkMode'
import { useIncomingRequests } from '~/composables/useIncomingRequests'

definePageMeta({ layout: 'blood-centerdashboard' })

const { isDark } = useDarkMode()

const {
  requests,
  summary,
  activity,
  loading,
  error,
  isMutating,
  fetchRequests,
  fetchSummary,
  fetchRequestDetail,
  approveAndReserve,
  rejectRequest,
  fetchActivity,
} = useIncomingRequests()

/* FILTER STATE */
const activeFilter = ref('All')
const searchQuery = ref('')
const dismissedAlertIds = ref([])

const filterOptions = ['All', 'Emergency', 'Urgent', 'Routine', 'Pending', 'Under Review', 'Approved', 'Rejected', 'Completed']

const toolbarFilters = ref({
  hospital: '',
  bloodType: '',
  component: '',
  priority: '',
  status: '',
  date: '',
})

const hospitalOptions = computed(() => [...new Set(requests.value.map(r => r.hospital))])
const bloodTypeOptions = computed(() => [...new Set(requests.value.map(r => r.bloodType))])
const componentOptions = computed(() => [...new Set(requests.value.map(r => r.component))])

const lastUpdatedAt = ref(null)
const lastUpdatedLabel = computed(() => {
  if (!lastUpdatedAt.value) return '—'
  const seconds = Math.round((Date.now() - lastUpdatedAt.value) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
})

let searchDebounce = null
function onSearchInput() {
  clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => loadRequests(), 400)
}

function buildParams() {
  return {
    filter: activeFilter.value !== 'All' ? activeFilter.value : undefined,
    search: searchQuery.value.trim() || undefined,
    hospital: toolbarFilters.value.hospital || undefined,
    blood_type: toolbarFilters.value.bloodType || undefined,
    component: toolbarFilters.value.component || undefined,
    priority: toolbarFilters.value.priority || undefined,
    status: toolbarFilters.value.status || undefined,
    date: toolbarFilters.value.date || undefined,
  }
}

async function loadRequests() {
  await fetchRequests(buildParams())
  lastUpdatedAt.value = Date.now()
}

function resetFilters() {
  toolbarFilters.value = { hospital: '', bloodType: '', component: '', priority: '', status: '', date: '' }
  searchQuery.value = ''
  activeFilter.value = 'All'
  loadRequests()
}

async function handleRefresh() {
  await Promise.all([loadRequests(), fetchSummary(), fetchActivity()])
}

/* re-fetch whenever a quick filter pill changes */
watch(activeFilter, () => loadRequests())

/* ------------------------------------------------------------------ *
 *  SUMMARY CARDS
 * ------------------------------------------------------------------ */
const summaryLoading = computed(() => loading.value && !summary.value)

const summaryStats = computed(() => {
  const s = summary.value || {}
  return [
    {
      key: 'pending',
      label: 'Pending Requests',
      value: s.pending ?? 0,
      icon: 'clock',
      trend: s.pendingTrend ?? '—',
      trendUp: s.pendingTrendUp ?? null,
    },
    {
      key: 'emergency',
      label: 'Emergency Requests',
      value: s.emergency ?? 0,
      icon: 'triangle-alert',
      trend: s.emergencyTrend ?? 'Needs attention',
      trendUp: null,
      danger: true,
    },
    {
      key: 'review',
      label: 'Under Review',
      value: s.underReview ?? 0,
      icon: 'search',
      trend: s.underReviewTrend ?? '—',
      trendUp: s.underReviewTrendUp ?? null,
    },
    {
      key: 'ready',
      label: 'Ready for Fulfillment',
      value: s.readyForFulfillment ?? 0,
      icon: 'check-circle',
      trend: s.readyTrend ?? '—',
      trendUp: s.readyTrendUp ?? null,
    },
  ]
})

/* ------------------------------------------------------------------ *
 *  EMERGENCY BANNER
 * ------------------------------------------------------------------ */
const emergencyRequests = computed(() =>
  requests.value.filter(r => r.priority === 'Emergency' && !dismissedAlertIds.value.includes(r.id))
)
const primaryEmergency = computed(() => emergencyRequests.value[0] || null)

function dismissAlert(id) {
  dismissedAlertIds.value.push(id)
}

/* ------------------------------------------------------------------ *
 *  REVIEW DRAWER
 * ------------------------------------------------------------------ */
const drawerOpen = ref(false)
const drawerLoading = ref(false)
const activeRequest = ref(null)

const timelineSteps = ['Submitted', 'Reviewed', 'Inventory Reserved', 'Preparing Units', 'Ready for Dispatch', 'Completed']
const statusStepIndex = {
  Pending: 0,
  'Under Review': 1,
  Approved: 2,
  Rejected: 1,
}
const currentStepIndex = computed(() => statusStepIndex[activeRequest.value?.status] ?? 0)

const drawerMutating = computed(() => activeRequest.value && isMutating(activeRequest.value.id))

async function openReview(request) {
  drawerOpen.value = true
  drawerLoading.value = true
  activeRequest.value = request

  const { data, error: detailError } = await fetchRequestDetail(request.id)
  if (!detailError.value && data.value) {
    activeRequest.value = { ...request, ...data.value }
  }
  drawerLoading.value = false
}

function closeDrawer() {
  drawerOpen.value = false
  setTimeout(() => (activeRequest.value = null), 250)
}

async function handleApprove(request) {
  if (!request) return
  await approveAndReserve(request.id)
  closeDrawer()
}

async function handleReject(request) {
  if (!request) return
  await rejectRequest(request.id)
  closeDrawer()
}

/* ------------------------------------------------------------------ *
 *  ROW MENU
 * ------------------------------------------------------------------ */
const openMenuId = ref(null)
function toggleMenu(id) {
  openMenuId.value = openMenuId.value === id ? null : id
}

function inventoryLevel(request) {
  if (!request) return 'ok'
  if (request.available <= 0) return 'insufficient'
  if (request.available < request.units) return 'low'
  return 'ok'
}

/* ------------------------------------------------------------------ *
 *  ACTIVITY FEED HELPERS
 * ------------------------------------------------------------------ */
const activityLoading = computed(() => loading.value && activity.value.length === 0)

function activityToneClass(type) {
  if (type === 'emergency' || type === 'rejected') return 'danger'
  if (type === 'approved' || type === 'reserved') return 'success'
  return 'info'
}
function activityIcon(type) {
  const map = {
    received: 'inbox',
    emergency: 'alert-triangle',
    reserved: 'archive',
    approved: 'check-circle',
    rejected: 'x-circle',
  }
  return map[type] || 'activity'
}

/* ------------------------------------------------------------------ *
 *  INITIAL LOAD
 * ------------------------------------------------------------------ */
onMounted(() => {
  handleRefresh()
})
</script>

<style scoped>
/* TOKENS */
.page {
  --primary: #1565c0;
  --primary-hover: #0d47a1;
  --bg: #f7f9fc;
  --card: #ffffff;
  --border: #e5eaf0;
  --text: #1e293b;
  --text-secondary: #64748b;
  --success: #2e7d32;
  --warning: #f59e0b;
  --danger: #d32f2f;
  --info: #2563eb;
  --purple: #7c3aed;
  --radius: 18px;
  --card-padding: 24px;
  --shadow: 0 4px 18px rgba(15, 23, 42, 0.05);

  background: var(--bg);
  color: var(--text);
  font-family: 'Inter', sans-serif;
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 100vh;
}

/* HEADER */
.page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; }
.breadcrumb { font-size: 13px; color: var(--text-secondary); margin: 0 0 6px; }
.page-title { font-size: 26px; font-weight: 700; margin: 0 0 4px; letter-spacing: -0.02em; }
.page-subtitle { font-size: 14px; color: var(--text-secondary); margin: 0; }
.header-actions { display: flex; gap: 10px; }

.btn {
  display: inline-flex; align-items: center; gap: 6px; border-radius: 10px;
  font-size: 14px; font-weight: 600; padding: 10px 16px; cursor: pointer;
  border: 1px solid transparent; transition: all 0.15s ease;
}
.btn-sm { padding: 7px 12px; font-size: 13px; }
.btn-xs { padding: 5px 10px; font-size: 12px; border-radius: 8px; }
.btn-primary { background: var(--primary); color: #fff; }
.btn-primary:hover { background: var(--primary-hover); }
.btn-outline { background: var(--card); color: var(--text); border-color: var(--border); }
.btn-outline:hover { border-color: var(--primary); color: var(--primary); }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }

.icon-btn {
  display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px;
  border-radius: 8px; border: 1px solid var(--border); background: var(--card);
  color: var(--text-secondary); cursor: pointer; transition: all 0.15s ease;
}
.icon-btn:hover { border-color: var(--primary); color: var(--primary); }

.spinning { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* RETRY BANNER */
.retry-banner {
  display: flex; align-items: center; gap: 10px; background: #fdecea;
  border: 1px solid #f5b8b1; color: var(--danger); border-radius: 12px;
  padding: 12px 16px; font-size: 13px; font-weight: 600;
}
.retry-banner .btn { margin-left: auto; }

/* EMERGENCY BANNER */
.emergency-banner {
  background: #fdecea; border: 1px solid #f5b8b1; border-left: 4px solid var(--danger);
  border-radius: var(--radius); padding: 20px 24px; display: flex;
  justify-content: space-between; gap: 20px; align-items: flex-start;
}
.emergency-main { display: flex; gap: 14px; }
.emergency-icon {
  width: 36px; height: 36px; border-radius: 10px; background: var(--danger); color: #fff;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.emergency-title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.emergency-title { font-weight: 700; font-size: 15px; color: var(--danger); }
.emergency-id { font-size: 12px; color: var(--text-secondary); font-family: monospace; }
.emergency-grid { display: grid; grid-template-columns: repeat(3, minmax(140px, 1fr)); gap: 10px 24px; }
.e-label { display: block; font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
.e-value { display: block; font-size: 14px; font-weight: 600; }
.insufficient-tag { margin-top: 12px; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--danger); }
.emergency-actions { display: flex; align-items: flex-start; gap: 8px; flex-shrink: 0; }

/* SUMMARY CARDS */
.summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.summary-card {
  background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
  padding: var(--card-padding); display: flex; gap: 14px; box-shadow: var(--shadow);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.summary-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08); }
.skeleton-card { min-height: 88px; background: linear-gradient(90deg, #eef2f7 25%, #f7f9fc 37%, #eef2f7 63%); background-size: 400% 100%; animation: shimmer 1.4s infinite; }
.summary-icon {
  width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0; background: #e8f0fc; color: var(--primary);
  display: flex; align-items: center; justify-content: center;
}
.summary-icon.is-danger { background: #fdecea; color: var(--danger); }
.summary-value { font-size: 26px; font-weight: 700; margin: 0; line-height: 1.1; }
.summary-label { font-size: 13px; color: var(--text-secondary); margin: 2px 0 6px; }
.summary-trend { font-size: 12px; color: var(--text-secondary); display: flex; align-items: center; gap: 4px; margin: 0; }
.summary-trend.up { color: var(--success); }
.summary-trend.down { color: var(--danger); }

/* QUICK FILTERS */
.quick-filters { display: flex; flex-wrap: wrap; gap: 8px; }
.pill {
  padding: 7px 14px; border-radius: 999px; font-size: 13px; font-weight: 600;
  border: 1px solid var(--border); background: var(--card); color: var(--text-secondary);
  cursor: pointer; transition: all 0.15s ease;
}
.pill:hover { border-color: var(--primary); color: var(--primary); }
.pill.active { background: var(--primary); border-color: var(--primary); color: #fff; }

/* TOOLBAR */
.toolbar {
  background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 16px 20px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
  box-shadow: var(--shadow); position: sticky; top: 0; z-index: 5;
}
.toolbar-search { position: relative; flex: 1 1 220px; min-width: 200px; }
.search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-secondary); }
.toolbar-search input { width: 100%; padding: 9px 12px 9px 32px; border-radius: 10px; border: 1px solid var(--border); font-size: 13px; background: var(--bg); }
.toolbar select, .toolbar input[type="date"] { padding: 9px 10px; border-radius: 10px; border: 1px solid var(--border); font-size: 13px; background: var(--bg); color: var(--text); }
.toolbar-buttons { display: flex; gap: 8px; }
.toolbar-meta { margin-left: auto; font-size: 12px; color: var(--text-secondary); display: flex; gap: 6px; align-items: center; }
.dot { opacity: 0.5; }

/* TABLE */
.table-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); overflow: auto; }
.request-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 900px; }
.request-table thead th {
  position: sticky; top: 0; background: var(--card); text-align: left; padding: 14px 16px;
  font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.03em;
  border-bottom: 1px solid var(--border); z-index: 2;
}
.table-row { border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s ease, border-left 0.15s ease; border-left: 3px solid transparent; }
.table-row:hover { background: #f4f8fd; border-left-color: var(--primary); }
.table-row.is-mutating { opacity: 0.6; pointer-events: none; }
.request-table td { padding: 14px 16px; vertical-align: middle; }
.mono { font-family: monospace; font-size: 12px; color: var(--text-secondary); }

.hospital-cell { display: flex; flex-direction: column; }
.hospital-name { font-weight: 600; }
.hospital-contact { font-size: 12px; color: var(--text-secondary); }

.blood-pill { display: inline-flex; align-items: center; justify-content: center; min-width: 34px; padding: 3px 8px; border-radius: 8px; background: #fdecea; color: var(--danger); font-weight: 700; font-size: 12px; }

.inv-pill { font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 8px; }
.inv-ok { color: var(--success); background: #e8f5e9; }
.inv-low { color: var(--warning); background: #fef3e0; }
.inv-insufficient { color: var(--danger); background: #fdecea; }

.priority-badge { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
.priority-routine { background: #eef2f7; color: var(--text-secondary); }
.priority-urgent { background: #fef3e0; color: var(--warning); }
.priority-emergency { background: #fdecea; color: var(--danger); }

.status-badge { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
.status-pending { background: #eef2f7; color: var(--text-secondary); }
.status-under-review { background: #e8f0fc; color: var(--info); }
.status-approved { background: #e8f5e9; color: var(--success); }
.status-rejected { background: #fdecea; color: var(--danger); }
.status-ready { background: #ede7fb; color: var(--purple); }
.status-completed { background: #eef2f7; color: var(--text-secondary); }

.needed-by { color: var(--text-secondary); font-size: 12.5px; }

.actions-cell { display: flex; align-items: center; gap: 8px; }
.menu-wrap { position: relative; }
.context-menu {
  position: absolute; right: 0; top: 36px; background: var(--card); border: 1px solid var(--border);
  border-radius: 12px; box-shadow: 0 8px 24px rgba(15,23,42,0.12); display: flex; flex-direction: column;
  min-width: 180px; padding: 6px; z-index: 10;
}
.context-menu button { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; border: none; background: transparent; font-size: 13px; text-align: left; cursor: pointer; color: var(--text); }
.context-menu button:hover { background: var(--bg); }
.context-menu button.danger { color: var(--danger); }
.context-menu button:disabled { opacity: 0.5; cursor: not-allowed; }

/* skeleton / empty */
.table-skeleton, .activity-skeleton, .drawer-loading { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
.skeleton-row { height: 44px; border-radius: 10px; background: linear-gradient(90deg, #eef2f7 25%, #f7f9fc 37%, #eef2f7 63%); background-size: 400% 100%; animation: shimmer 1.4s infinite; }
@keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
.empty-state { padding: 60px 24px; text-align: center; color: var(--text-secondary); display: flex; flex-direction: column; align-items: center; gap: 8px; }
.empty-state h3 { margin: 8px 0 0; color: var(--text); font-size: 16px; }
.empty-state p { margin: 0 0 8px; font-size: 13px; }

/* ACTIVITY */
.activity-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--card-padding); box-shadow: var(--shadow); }
.section-title { font-size: 15px; font-weight: 700; margin: 0 0 16px; }
.activity-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.activity-empty { font-size: 13px; color: var(--text-secondary); margin: 0; }
.activity-item { display: flex; gap: 12px; align-items: flex-start; }
.activity-dot { width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.activity-dot.info { background: #e8f0fc; color: var(--info); }
.activity-dot.danger { background: #fdecea; color: var(--danger); }
.activity-dot.success { background: #e8f5e9; color: var(--success); }
.activity-body p { margin: 0; font-size: 13.5px; }
.activity-meta { font-size: 12px; color: var(--text-secondary); }

/* DRAWER */
.drawer-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); display: flex; justify-content: flex-end; z-index: 50; }
.drawer { width: 480px; max-width: 100%; height: 100%; background: var(--card); display: flex; flex-direction: column; box-shadow: -8px 0 30px rgba(15,23,42,0.15); }
.drawer-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid var(--border); }
.drawer-header h2 { margin: 0; font-size: 17px; }
.drawer-content { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 24px; }
.drawer-section h3 { margin: 0 0 12px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-secondary); }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; margin: 0; }
.detail-grid dt { font-size: 11px; color: var(--text-secondary); margin-bottom: 2px; }
.detail-grid dd { margin: 0; font-size: 13.5px; font-weight: 600; }

.notes-block { margin-top: 12px; background: var(--bg); border-radius: 10px; padding: 12px 14px; }
.notes-label { font-size: 11px; color: var(--text-secondary); margin: 0 0 2px; text-transform: uppercase; }
.notes-text { font-size: 13px; margin: 0 0 10px; }
.notes-text:last-child { margin-bottom: 0; }

.batches-label, .health-bar-label { font-size: 12px; color: var(--text-secondary); margin: 14px 0 6px; }
.batch-list { display: flex; flex-direction: column; gap: 6px; }
.batch-empty { font-size: 12.5px; color: var(--text-secondary); }
.batch-row { display: flex; justify-content: space-between; font-size: 12.5px; padding: 8px 10px; background: var(--bg); border-radius: 8px; }
.ok-tag { color: var(--success); font-weight: 700; }
.health-bar { height: 8px; border-radius: 999px; background: var(--border); overflow: hidden; }
.health-fill { height: 100%; border-radius: 999px; transition: width 0.3s ease; }
.health-fill.inv-ok { background: var(--success); }
.health-fill.inv-low { background: var(--warning); }
.health-fill.inv-insufficient { background: var(--danger); }

.timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.timeline li { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--text-secondary); }
.timeline li.done { color: var(--text); font-weight: 600; }
.timeline-dot { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #fff; }
.timeline li.done .timeline-dot { background: var(--primary); border-color: var(--primary); }

.drawer-footer { display: flex; gap: 10px; padding: 16px 24px; border-top: 1px solid var(--border); }
.drawer-footer .btn { flex: 1; justify-content: center; }

/* TRANSITIONS */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.drawer-enter-active, .drawer-leave-active { transition: opacity 0.25s ease; }
.drawer-enter-active .drawer, .drawer-leave-active .drawer { transition: transform 0.25s ease; }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }
.drawer-enter-from .drawer, .drawer-leave-to .drawer { transform: translateX(100%); }

/* RESPONSIVE */
@media (max-width: 1100px) {
  .summary-grid { grid-template-columns: repeat(2, 1fr); }
  .emergency-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .page { padding: 18px; }
  .summary-grid { grid-template-columns: 1fr; }
  .emergency-banner { flex-direction: column; }
  .emergency-actions { flex-wrap: wrap; }
  .drawer { width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .summary-card, .pill, .table-row, .drawer, .health-fill, .spinning { transition: none !important; animation: none !important; }
}
/* DARK MODE — :global(.dark .selector), NOT :global(.dark) .selector */
:global(.dark .page) {
  --bg: #0f1420; --card: #171e2c; --border: #2a3447; --text: #e2e8f0; --text-secondary: #94a3b8;
}
:global(.dark .summary-icon) { background: #1c2a42; }
:global(.dark .summary-icon.is-danger) { background: #3a1f22; }
:global(.dark .emergency-banner) { background: #2a1618; border-color: #4a2427; }
:global(.dark .retry-banner) { background: #2a1618; border-color: #4a2427; }
:global(.dark .blood-pill) { background: #3a1f22; }
:global(.dark .inv-ok) { background: #16301c; }
:global(.dark .inv-low) { background: #3a2c10; }
:global(.dark .inv-insufficient) { background: #3a1f22; }
:global(.dark .status-pending) { background: #1e2635; }
:global(.dark .status-under-review) { background: #16223a; }
:global(.dark .status-approved) { background: #16301c; }
:global(.dark .status-rejected) { background: #3a1f22; }
:global(.dark .table-row:hover) { background: #1c2536; }
:global(.dark .skeleton-row),
:global(.dark .skeleton-card) { background: linear-gradient(90deg, #1c2536 25%, #212b3f 37%, #1c2536 63%); background-size: 400% 100%; }
:global(.dark .notes-block),
:global(.dark .batch-row) { background: #1c2536; }
:global(.dark .context-menu) { box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
</style>