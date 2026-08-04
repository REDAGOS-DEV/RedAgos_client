<template>
  <div class="rf-page" :class="{ 'rf-dark': isDark }">
    <!-- ================= HEADER ================= -->
    <header class="rf-header">
      <div class="rf-header-left">
        <nav class="rf-breadcrumb" aria-label="Breadcrumb">
          <span>Dashboard</span>
          <span class="rf-breadcrumb-sep">/</span>
          <span class="rf-breadcrumb-current">Request Fulfillment</span>
        </nav>
        <h1 class="rf-title">Request Fulfillment</h1>
        <p class="rf-subtitle">
          Prepare, verify, dispatch, and complete approved blood requests for partner hospitals.
        </p>
      </div>
      <div class="rf-header-actions">
        <button class="rf-btn rf-btn-outline" :disabled="pending" @click="refreshQueue">
          <AssetIcon name="refresh" :class="{ 'rf-spin': pending }" />
          Refresh Queue
        </button>
        <button class="rf-btn rf-btn-primary" :disabled="exporting" @click="exportReport">
          <AssetIcon name="upload" />
          {{ exporting ? 'Exporting…' : 'Export Fulfillment Report' }}
        </button>
      </div>
    </header>

    <!-- ================= OPERATION ALERT ================= -->
    <div v-if="pending && !alertChecked" class="rf-alert rf-skeleton-card" style="height:64px" />
    <div v-else-if="activeAlert" class="rf-alert" role="alert">
      <div class="rf-alert-icon"><AssetIcon name="alert-triangle" /></div>
      <div class="rf-alert-body">
        <p class="rf-alert-title">{{ activeAlert.title }}</p>
        <p class="rf-alert-desc">{{ activeAlert.description }}</p>
      </div>
      <button class="rf-btn rf-btn-primary rf-btn-sm" @click="handleAlertAction(activeAlert)">
        {{ activeAlert.actionLabel }}
      </button>
    </div>

    <!-- ================= SUMMARY CARDS ================= -->
    <section class="rf-kpi-grid" aria-label="Fulfillment summary">
      <template v-if="pending && !kpis.length">
        <div v-for="n in 4" :key="n" class="rf-kpi-card rf-skeleton-card" />
      </template>
      <article
        v-for="kpi in kpis"
        v-else
        :key="kpi.key"
        class="rf-kpi-card"
        :style="{ '--kpi-accent': kpi.accent }"
      >
        <div class="rf-kpi-top">
          <div class="rf-kpi-icon"><AssetIcon :name="kpi.icon" /></div>
          <span class="rf-kpi-trend" :class="kpi.trend >= 0 ? 'is-up' : 'is-down'">
            <AssetIcon :name="kpi.trend >= 0 ? 'trending-up' : 'trending-down'" />
            {{ Math.abs(kpi.trend) }}%
          </span>
        </div>
        <p class="rf-kpi-value">{{ kpi.value }}</p>
        <p class="rf-kpi-label">{{ kpi.label }}</p>
        <p class="rf-kpi-desc">{{ kpi.description }}</p>
      </article>
    </section>

    <!-- ================= STATUS FILTER PILLS ================= -->
    <div class="rf-filter-pills" role="tablist" aria-label="Fulfillment status filters">
      <button
        v-for="pill in statusPills"
        :key="pill.value"
        class="rf-pill"
        :class="{ 'is-active': query.status === pill.value }"
        role="tab"
        :aria-selected="query.status === pill.value"
        @click="setStatus(pill.value)"
      >
        {{ pill.label }}
        <span class="rf-pill-count">{{ statusCounts[pill.value] ?? 0 }}</span>
      </button>
    </div>

    <!-- ================= ADVANCED FILTER TOOLBAR ================= -->
    <div class="rf-toolbar">
      <div class="rf-toolbar-search">
        <AssetIcon name="search" />
        <input
          v-model="query.search"
          type="text"
          placeholder="Search request ID, hospital, or batch..."
          @keyup.enter="applyFilters"
        />
      </div>

      <select v-model="query.hospital" class="rf-select">
        <option value="">Hospital</option>
        <option v-for="h in filterOptions.hospitals" :key="h" :value="h">{{ h }}</option>
      </select>

      <select v-model="query.bloodType" class="rf-select">
        <option value="">Blood Type</option>
        <option v-for="b in filterOptions.bloodTypes" :key="b" :value="b">{{ b }}</option>
      </select>

      <select v-model="query.component" class="rf-select">
        <option value="">Component</option>
        <option v-for="c in filterOptions.components" :key="c" :value="c">{{ c }}</option>
      </select>

      <select v-model="query.dispatchStatus" class="rf-select">
        <option value="">Dispatch Status</option>
        <option v-for="s in statusPills.slice(1)" :key="s.value" :value="s.value">{{ s.label }}</option>
      </select>

      <select v-model="query.priority" class="rf-select">
        <option value="">Priority</option>
        <option v-for="p in filterOptions.priorities" :key="p" :value="p">{{ p }}</option>
      </select>

      <select v-model="query.courier" class="rf-select">
        <option value="">Courier</option>
        <option v-for="c in filterOptions.couriers" :key="c" :value="c">{{ c }}</option>
      </select>

      <input v-model="query.date" type="date" class="rf-select" />

      <div class="rf-toolbar-btns">
        <button class="rf-btn rf-btn-outline rf-btn-sm" @click="resetFilters">Reset Filters</button>
        <button class="rf-btn rf-btn-primary rf-btn-sm" @click="applyFilters">Apply Filters</button>
      </div>

      <div class="rf-toolbar-meta">
        <span>Showing {{ meta.total ?? requests.length }} active requests</span>
        <span class="rf-toolbar-updated">Updated {{ lastUpdatedLabel }}</span>
      </div>
    </div>

    <div class="rf-content-grid">
      <!-- ================= MAIN FULFILLMENT TABLE ================= -->
      <div class="rf-table-wrap">
        <div v-if="pending" class="rf-skeleton-table">
          <div v-for="n in 6" :key="n" class="rf-skeleton-row" />
        </div>

        <div v-else-if="error" class="rf-empty-state">
          <AssetIcon name="alert-triangle" class="rf-empty-illustration" />
          <h3>Couldn't load the fulfillment queue</h3>
          <p>{{ error.message || 'Something went wrong while contacting the server.' }}</p>
          <button class="rf-btn rf-btn-primary" @click="refreshQueue">Try Again</button>
        </div>

        <div v-else-if="requests.length === 0" class="rf-empty-state">
          <AssetIcon name="inbox" class="rf-empty-illustration" />
          <h3>No Active Fulfillment Requests</h3>
          <p>There are currently no approved requests waiting for fulfillment.</p>
          <button class="rf-btn rf-btn-primary" @click="refreshQueue">Refresh Queue</button>
        </div>

        <table v-else class="rf-table">
          <thead>
            <tr>
              <th>Request ID</th>
              <th>Hospital</th>
              <th>Blood Type</th>
              <th>Component</th>
              <th>Reserved Units</th>
              <th>Assigned Staff</th>
              <th>Dispatch Method</th>
              <th>Current Stage</th>
              <th>Needed By</th>
              <th class="rf-th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="req in requests" :key="req.id" class="rf-row">
              <td class="rf-mono">{{ req.id }}</td>
              <td>
                <p class="rf-cell-strong">{{ req.hospital }}</p>
                <p class="rf-cell-sub">{{ req.department }}</p>
              </td>
              <td><span class="rf-blood-badge">{{ req.bloodType }}</span></td>
              <td>{{ req.component }}</td>
              <td>
                <p class="rf-cell-strong">{{ req.reservedUnits }} units</p>
                <p class="rf-cell-sub">{{ (req.batchIds || []).join(', ') }}</p>
              </td>
              <td>{{ req.assignedStaff || '—' }}</td>
              <td>{{ req.dispatchMethod || '—' }}</td>
              <td>
                <span class="rf-stage-badge" :class="`is-${stageToSlug(req.stage)}`">
                  {{ req.stage }}
                </span>
              </td>
              <td :class="{ 'rf-needed-urgent': isUrgent(req.neededBy) }">{{ formatTime(req.neededBy) }}</td>
              <td class="rf-actions-cell">
                <button class="rf-btn rf-btn-primary rf-btn-sm" @click="openDrawer(req.id)">Continue</button>
                <div class="rf-menu-wrap">
                  <button class="rf-icon-btn" @click="toggleMenu(req.id)" aria-label="More actions">
                    <AssetIcon name="more-horizontal" />
                  </button>
                  <div v-if="openMenu === req.id" class="rf-menu">
                    <button @click="emitRowAction('view-details', req)">View Fulfillment Details</button>
                    <button @click="emitRowAction('update-status', req)">Update Status</button>
                    <button @click="emitRowAction('assign-staff', req)">Assign Staff</button>
                    <button @click="emitRowAction('assign-courier', req)">Assign Courier</button>
                    <button @click="emitRowAction('print-dispatch-form', req)">Print Dispatch Form</button>
                    <button @click="emitRowAction('print-blood-labels', req)">Print Blood Labels</button>
                    <button @click="emitRowAction('view-timeline', req)">View Timeline</button>
                    <button @click="emitRowAction('export-pdf', req)">Export PDF</button>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ================= SIDE COLUMN ================= -->
      <aside class="rf-side-col">
        <div class="rf-card rf-dispatch-panel">
          <h3 class="rf-card-title">Today's Dispatch</h3>
          <div v-if="pending && !dispatchPanel" class="rf-skeleton-row" style="height:90px" />
          <div v-else class="rf-dispatch-grid">
            <div class="rf-dispatch-stat">
              <p class="rf-dispatch-value">{{ dispatchPanel?.scheduled ?? '—' }}</p>
              <p class="rf-dispatch-label">Scheduled Dispatches</p>
            </div>
            <div class="rf-dispatch-stat">
              <p class="rf-dispatch-value">{{ dispatchPanel?.inTransit ?? '—' }}</p>
              <p class="rf-dispatch-label">In Transit</p>
            </div>
            <div class="rf-dispatch-stat">
              <p class="rf-dispatch-value">{{ dispatchPanel?.deliveredToday ?? '—' }}</p>
              <p class="rf-dispatch-label">Delivered Today</p>
            </div>
            <div class="rf-dispatch-stat">
              <p class="rf-dispatch-value">{{ dispatchPanel?.avgPrepTime ?? '—' }}</p>
              <p class="rf-dispatch-label">Avg. Preparation Time</p>
            </div>
          </div>
        </div>

        <div class="rf-card rf-activity-panel">
          <h3 class="rf-card-title">Recent Fulfillment Activity</h3>
          <div v-if="pending && !activityLog.length" class="rf-skeleton-row" style="height:160px" />
          <ul v-else class="rf-timeline">
            <li v-for="event in activityLog" :key="event.id" class="rf-timeline-item">
              <span class="rf-timeline-dot" :class="`is-${event.type}`">
                <AssetIcon :name="event.icon" />
              </span>
              <div class="rf-timeline-body">
                <p class="rf-timeline-desc">{{ event.description }}</p>
                <p class="rf-timeline-meta">{{ event.staff }} · {{ event.timestamp }}</p>
              </div>
            </li>
            <li v-if="!activityLog.length" class="rf-timeline-empty">No activity recorded yet today.</li>
          </ul>
        </div>
      </aside>
    </div>

    <!-- ================= FULFILLMENT DETAILS DRAWER ================= -->
    <Teleport to="body">
      <div v-if="drawerRequestId" class="rf-drawer-overlay" @click.self="closeDrawer">
        <aside class="rf-drawer" role="dialog" aria-label="Fulfillment details">
          <div v-if="drawerPending" class="rf-drawer-loading">
            <div v-for="n in 5" :key="n" class="rf-skeleton-row" />
          </div>

          <template v-else-if="drawerRequest">
            <header class="rf-drawer-header">
              <div>
                <p class="rf-drawer-eyebrow">{{ drawerRequest.id }}</p>
                <h2>{{ drawerRequest.hospital }}</h2>
              </div>
              <button class="rf-icon-btn" @click="closeDrawer" aria-label="Close drawer"><AssetIcon name="x" /></button>
            </header>

            <div class="rf-drawer-body">
              <div class="rf-stepper">
                <div
                  v-for="(step, i) in workflowSteps"
                  :key="step"
                  class="rf-step"
                  :class="stepClass(i)"
                  :title="step"
                >
                  <span class="rf-step-dot">
                    <AssetIcon v-if="i < currentStepIndex" name="check" />
                    <span v-else>{{ i + 1 }}</span>
                  </span>
                  <span class="rf-step-label">{{ step }}</span>
                </div>
              </div>

              <section class="rf-drawer-section">
                <h3>Hospital Information</h3>
                <dl class="rf-info-grid">
                  <div><dt>Hospital Name</dt><dd>{{ drawerRequest.hospital }}</dd></div>
                  <div><dt>Contact Person</dt><dd>{{ drawerRequest.contactPerson || '—' }}</dd></div>
                  <div><dt>Receiving Department</dt><dd>{{ drawerRequest.department || '—' }}</dd></div>
                  <div>
                    <dt>Priority</dt>
                    <dd><span class="rf-priority-badge" :class="`is-${(drawerRequest.priority || '').toLowerCase()}`">{{ drawerRequest.priority }}</span></dd>
                  </div>
                  <div><dt>Required Delivery Time</dt><dd>{{ formatTime(drawerRequest.neededBy) }}</dd></div>
                </dl>
              </section>

              <section class="rf-drawer-section">
                <h3>Reserved Blood Units</h3>
                <div class="rf-unit-cards">
                  <div v-for="unit in drawerRequest.units || []" :key="unit.batchId" class="rf-unit-card">
                    <div class="rf-unit-card-top">
                      <span class="rf-mono">{{ unit.batchId }}</span>
                      <span class="rf-unit-status" :class="`is-${unit.status.toLowerCase()}`">{{ unit.status }}</span>
                    </div>
                    <p><strong>{{ unit.bloodType }}</strong> · {{ unit.component }} · {{ unit.units }} units</p>
                    <p class="rf-cell-sub">Collected {{ unit.collectionDate }} · Expires {{ unit.expiryDate }}</p>
                    <p class="rf-cell-sub">Storage: {{ unit.storageLocation }}</p>
                  </div>
                </div>
              </section>

              <section class="rf-drawer-section">
                <h3>Preparation Checklist</h3>
                <ul class="rf-checklist">
                  <li v-for="item in drawerRequest.checklist || []" :key="item.key">
                    <label>
                      <input
                        type="checkbox"
                        :checked="item.done"
                        @change="toggleChecklistItem(item)"
                      />
                      <AssetIcon v-if="item.done" name="check" class="rf-check-icon" />
                      <span :class="{ 'is-done': item.done }">{{ item.label }}</span>
                    </label>
                  </li>
                </ul>
              </section>

              <section class="rf-drawer-section">
                <h3>Dispatch Information</h3>
                <dl class="rf-info-grid">
                  <div><dt>Dispatch Method</dt><dd>{{ drawerRequest.dispatchMethod || '—' }}</dd></div>
                  <div><dt>Courier Name</dt><dd>{{ drawerRequest.courier || '—' }}</dd></div>
                  <div><dt>Vehicle</dt><dd>{{ drawerRequest.vehicle || '—' }}</dd></div>
                  <div><dt>Tracking Number</dt><dd>{{ drawerRequest.trackingNumber || '—' }}</dd></div>
                  <div><dt>Estimated Arrival</dt><dd>{{ drawerRequest.estimatedArrival || '—' }}</dd></div>
                  <div><dt>Recipient Name</dt><dd>{{ drawerRequest.recipientName || '—' }}</dd></div>
                </dl>
                <label class="rf-notes-label" for="rf-dispatch-notes">Dispatch Notes</label>
                <textarea
                  id="rf-dispatch-notes"
                  v-model="dispatchNotesDraft"
                  class="rf-textarea"
                  rows="3"
                  @blur="persistDispatchNotes"
                />
              </section>
            </div>

            <footer class="rf-drawer-footer">
              <button class="rf-btn rf-btn-outline" :disabled="saving" @click="saveProgress">
                {{ saving ? 'Saving…' : 'Save Progress' }}
              </button>
              <button class="rf-btn rf-btn-primary" :disabled="advancing" @click="advanceStage">
                {{ advancing ? 'Updating…' : primaryActionLabel }}
              </button>
            </footer>
          </template>
        </aside>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useDarkMode } from '~/composables/useDarkMode'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

definePageMeta({
  middleware: 'auth',
  layout: 'blood-centerdashboard',
})

const { isDark } = useDarkMode()

/* ---------------------------------------------------------------
   API ENDPOINTS — point these at your real Nitro/API routes
--------------------------------------------------------------- */
const endpoints = {
  queue: '/api/blood-center/fulfillment',                 // GET  -> { requests, kpis, statusCounts, filterOptions, meta }
  alert: '/api/blood-center/fulfillment/alert',            // GET  -> { title, description, actionLabel, actionType, requestId } | null
  dispatchPanel: '/api/blood-center/fulfillment/dispatch-panel', // GET -> { scheduled, inTransit, deliveredToday, avgPrepTime }
  activity: '/api/blood-center/fulfillment/activity',      // GET  -> [{ id, type, icon, description, staff, timestamp }]
  detail: (id) => `/api/blood-center/fulfillment/${id}`,   // GET  -> full request detail incl. units & checklist
  updateChecklist: (id, itemKey) => `/api/blood-center/fulfillment/${id}/checklist/${itemKey}`, // PATCH
  saveProgress: (id) => `/api/blood-center/fulfillment/${id}/save`,       // PATCH
  advanceStage: (id) => `/api/blood-center/fulfillment/${id}/advance`,    // POST
  dispatchNotes: (id) => `/api/blood-center/fulfillment/${id}/notes`,     // PATCH
  exportReport: '/api/blood-center/fulfillment/export',    // POST -> { downloadUrl }
}

const statusPills = [
  { label: 'All', value: 'all' },
  { label: 'Preparing', value: 'preparing' },
  { label: 'Quality Check', value: 'quality-check' },
  { label: 'Ready for Dispatch', value: 'ready-for-dispatch' },
  { label: 'Dispatched', value: 'dispatched' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Completed', value: 'completed' },
]
const workflowSteps = [
  'Approved', 'Inventory Reserved', 'Preparing Units', 'Quality Check',
  'Ready for Dispatch', 'Dispatched', 'Delivered', 'Completed',
]

/* ---------------------------------------------------------------
   QUERY STATE (drives the API request)
--------------------------------------------------------------- */
const query = reactive({
  search: '', status: 'all', hospital: '', bloodType: '', component: '',
  dispatchStatus: '', priority: '', courier: '', date: '',
})

/* ---------------------------------------------------------------
   DATA FETCHING
--------------------------------------------------------------- */
const { data: queueData, pending, error, refresh: refreshQueueData } = await useAsyncData(
  'fulfillment-queue',
  () => $fetch(endpoints.queue, { params: { ...query } }),
  { watch: [() => query.status] }
)

const { data: alertData, refresh: refreshAlert } = await useAsyncData(
  'fulfillment-alert',
  () => $fetch(endpoints.alert)
)
const alertChecked = ref(true) // flips true once first alert fetch resolves; useAsyncData already awaited above

const { data: dispatchPanelData, refresh: refreshDispatchPanel } = await useAsyncData(
  'fulfillment-dispatch-panel',
  () => $fetch(endpoints.dispatchPanel)
)

const { data: activityData, refresh: refreshActivity } = await useAsyncData(
  'fulfillment-activity',
  () => $fetch(endpoints.activity)
)

const requests = computed(() => queueData.value?.requests ?? [])
const kpis = computed(() => queueData.value?.kpis ?? [])
const statusCounts = computed(() => queueData.value?.statusCounts ?? {})
const filterOptions = computed(() => queueData.value?.filterOptions ?? { hospitals: [], bloodTypes: [], components: [], priorities: [], couriers: [] })
const meta = computed(() => queueData.value?.meta ?? {})
const activeAlert = computed(() => alertData.value ?? null)
const dispatchPanel = computed(() => dispatchPanelData.value ?? null)
const activityLog = computed(() => activityData.value ?? [])

const lastUpdatedLabel = ref('just now')

async function refreshQueue() {
  await Promise.all([refreshQueueData(), refreshAlert(), refreshDispatchPanel(), refreshActivity()])
  lastUpdatedLabel.value = 'just now'
}

function setStatus(value) {
  query.status = value
}
function applyFilters() {
  refreshQueueData().then(() => (lastUpdatedLabel.value = 'just now'))
}
function resetFilters() {
  Object.assign(query, { search: '', status: 'all', hospital: '', bloodType: '', component: '', dispatchStatus: '', priority: '', courier: '', date: '' })
  applyFilters()
}

const exporting = ref(false)
async function exportReport() {
  exporting.value = true
  try {
    const res = await $fetch(endpoints.exportReport, { method: 'POST', body: { ...query } })
    if (res?.downloadUrl && typeof window !== 'undefined') {
      window.open(res.downloadUrl, '_blank')
    }
  } catch (e) {
    console.error('Export failed', e)
  } finally {
    exporting.value = false
  }
}

async function handleAlertAction(alert) {
  if (alert?.requestId) {
    await openDrawer(alert.requestId)
  }
}

function stageToSlug(stage) {
  return (stage || '').toLowerCase().replace(/\s+/g, '-')
}
function formatTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
function isUrgent(iso) {
  if (!iso) return false
  return new Date(iso).getTime() - Date.now() < 1000 * 60 * 60
}

/* ---------------------------------------------------------------
   ROW MENU
--------------------------------------------------------------- */
const openMenu = ref(null)
function toggleMenu(id) {
  openMenu.value = openMenu.value === id ? null : id
}
function closeMenu() {
  openMenu.value = null
}

const emit = defineEmits(['row-action'])
function emitRowAction(action, request) {
  emit('row-action', { action, request })
  closeMenu()
}

/* ---------------------------------------------------------------
   DRAWER
--------------------------------------------------------------- */
const drawerRequestId = ref(null)
const drawerRequest = ref(null)
const drawerPending = ref(false)
const dispatchNotesDraft = ref('')
const saving = ref(false)
const advancing = ref(false)

async function openDrawer(id) {
  drawerRequestId.value = id
  drawerPending.value = true
  closeMenu()
  try {
    const detail = await $fetch(endpoints.detail(id))
    drawerRequest.value = detail
    dispatchNotesDraft.value = detail?.dispatchNotes || ''
  } catch (e) {
    console.error('Failed to load fulfillment detail', e)
    drawerRequest.value = null
  } finally {
    drawerPending.value = false
  }
}
function closeDrawer() {
  drawerRequestId.value = null
  drawerRequest.value = null
}

const currentStepIndex = computed(() => {
  const map = { 'Preparing': 2, 'Quality Check': 3, 'Ready for Dispatch': 4, 'Dispatched': 5, 'Delivered': 6, 'Completed': 7 }
  return map[drawerRequest.value?.stage] ?? 0
})
function stepClass(i) {
  if (i < currentStepIndex.value) return 'is-complete'
  if (i === currentStepIndex.value) return 'is-current'
  return 'is-future'
}
const primaryActionLabel = computed(() => {
  const stage = drawerRequest.value?.stage
  if (stage === 'Dispatched') return 'Mark as Delivered'
  if (stage === 'Delivered') return 'Complete Fulfillment'
  return 'Mark Ready for Dispatch'
})

async function toggleChecklistItem(item) {
  if (!drawerRequest.value) return
  const previous = item.done
  item.done = !item.done
  try {
    await $fetch(endpoints.updateChecklist(drawerRequest.value.id, item.key), {
      method: 'PATCH',
      body: { done: item.done },
    })
  } catch (e) {
    item.done = previous
    console.error('Checklist update failed', e)
  }
}

async function persistDispatchNotes() {
  if (!drawerRequest.value) return
  try {
    await $fetch(endpoints.dispatchNotes(drawerRequest.value.id), {
      method: 'PATCH',
      body: { notes: dispatchNotesDraft.value },
    })
  } catch (e) {
    console.error('Failed to save dispatch notes', e)
  }
}

async function saveProgress() {
  if (!drawerRequest.value) return
  saving.value = true
  try {
    await $fetch(endpoints.saveProgress(drawerRequest.value.id), {
      method: 'PATCH',
      body: { checklist: drawerRequest.value.checklist, dispatchNotes: dispatchNotesDraft.value },
    })
  } catch (e) {
    console.error('Save progress failed', e)
  } finally {
    saving.value = false
  }
}

async function advanceStage() {
  if (!drawerRequest.value) return
  advancing.value = true
  try {
    const updated = await $fetch(endpoints.advanceStage(drawerRequest.value.id), { method: 'POST' })
    drawerRequest.value = { ...drawerRequest.value, ...updated }
    await refreshQueue()
  } catch (e) {
    console.error('Advance stage failed', e)
  } finally {
    advancing.value = false
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('click', (e) => {
    if (!e.target.closest?.('.rf-menu-wrap')) closeMenu()
  })
}
</script>

<style scoped>
/* ============================================================
   REDAGOS DESIGN TOKENS
============================================================ */
.rf-page {
  --rf-primary: #1565C0;
  --rf-primary-hover: #0D47A1;
  --rf-bg: #F7F9FC;
  --rf-card: #FFFFFF;
  --rf-border: #E5EAF0;
  --rf-text: #1E293B;
  --rf-text-secondary: #64748B;
  --rf-success: #2E7D32;
  --rf-warning: #F59E0B;
  --rf-danger: #D32F2F;
  --rf-info: #2563EB;
  --rf-purple: #7C3AED;
  --rf-teal: #0F766E;
  --rf-radius: 18px;
  --rf-pad: 24px;
  --rf-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);

  background: var(--rf-bg);
  color: var(--rf-text);
  font-family: 'Inter', system-ui, sans-serif;
  padding: 28px clamp(16px, 3vw, 40px) 60px;
  min-height: 100vh;
}
.rf-page.rf-dark {
  --rf-bg: #0F1420;
  --rf-card: #171D2B;
  --rf-border: #2A3447;
  --rf-text: #E6EBF3;
  --rf-text-secondary: #94A3B8;
  --rf-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
}

/* ---------- Header ---------- */
.rf-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; flex-wrap: wrap; margin-bottom: 20px; }
.rf-breadcrumb { font-size: 13px; color: var(--rf-text-secondary); display: flex; gap: 6px; margin-bottom: 8px; }
.rf-breadcrumb-current { color: var(--rf-text); font-weight: 600; }
.rf-title { font-size: 28px; font-weight: 700; letter-spacing: -0.01em; margin: 0 0 6px; }
.rf-subtitle { color: var(--rf-text-secondary); font-size: 14.5px; max-width: 560px; margin: 0; }
.rf-header-actions { display: flex; gap: 10px; }

.rf-btn { display: inline-flex; align-items: center; gap: 8px; font-family: inherit; font-weight: 600; font-size: 14px; padding: 10px 18px; border-radius: 12px; border: 1px solid transparent; cursor: pointer; transition: all .18s ease; white-space: nowrap; }
.rf-btn:disabled { opacity: .6; cursor: not-allowed; }
.rf-btn-sm { padding: 7px 12px; font-size: 13px; }
.rf-btn-primary { background: var(--rf-primary); color: #fff; box-shadow: var(--rf-shadow); }
.rf-btn-primary:hover:not(:disabled) { background: var(--rf-primary-hover); transform: translateY(-1px); }
.rf-btn-outline { background: transparent; border-color: var(--rf-border); color: var(--rf-text); }
.rf-btn-outline:hover:not(:disabled) { background: rgba(21,101,192,0.06); border-color: var(--rf-primary); }
.rf-spin { animation: rf-spin 1s linear infinite; }

/* ---------- Alert ---------- */
.rf-alert { display: flex; align-items: center; gap: 14px; background: #FFF8EC; border: 1px solid #FBD9A0; color: #92400E; border-radius: var(--rf-radius); padding: 16px 20px; margin-bottom: 22px; animation: rf-fade .3s ease; }
.rf-page.rf-dark .rf-alert { background: #2A2210; border-color: #4A3B12; color: #F5C46C; }
.rf-alert-icon { color: var(--rf-warning); flex-shrink: 0; }
.rf-alert-body { flex: 1; }
.rf-alert-title { font-weight: 700; font-size: 14.5px; margin: 0 0 2px; }
.rf-alert-desc { font-size: 13.5px; margin: 0; opacity: .9; }

/* ---------- KPI grid ---------- */
.rf-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; margin-bottom: 24px; }
.rf-kpi-card { background: var(--rf-card); border: 1px solid var(--rf-border); border-radius: var(--rf-radius); padding: var(--rf-pad); box-shadow: var(--rf-shadow); transition: transform .2s ease, box-shadow .2s ease; min-height: 128px; }
.rf-kpi-card:hover { transform: translateY(-3px); box-shadow: 0 10px 26px rgba(15,23,42,.09); }
.rf-skeleton-card { background: linear-gradient(90deg, var(--rf-border) 25%, rgba(255,255,255,.6) 50%, var(--rf-border) 75%); background-size: 200% 100%; animation: rf-shimmer 1.4s infinite; }
.rf-kpi-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.rf-kpi-icon { width: 38px; height: 38px; border-radius: 11px; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--kpi-accent) 14%, transparent); color: var(--kpi-accent); }
.rf-kpi-trend { font-size: 12.5px; font-weight: 700; display: flex; align-items: center; gap: 3px; }
.rf-kpi-trend.is-up { color: var(--rf-success); }
.rf-kpi-trend.is-down { color: var(--rf-danger); }
.rf-kpi-value { font-size: 30px; font-weight: 800; margin: 0; letter-spacing: -0.02em; }
.rf-kpi-label { font-weight: 600; font-size: 14px; margin: 4px 0 2px; }
.rf-kpi-desc { font-size: 12.5px; color: var(--rf-text-secondary); margin: 0; }

/* ---------- Status pills ---------- */
.rf-filter-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.rf-pill { font-size: 13.5px; font-weight: 600; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--rf-border); background: var(--rf-card); color: var(--rf-text-secondary); cursor: pointer; display: flex; align-items: center; gap: 7px; transition: all .15s ease; }
.rf-pill:hover { border-color: var(--rf-primary); color: var(--rf-primary); }
.rf-pill.is-active { background: var(--rf-primary); border-color: var(--rf-primary); color: #fff; }
.rf-pill-count { font-size: 11.5px; background: rgba(0,0,0,.08); border-radius: 999px; padding: 1px 7px; }
.rf-pill.is-active .rf-pill-count { background: rgba(255,255,255,.25); }

/* ---------- Toolbar ---------- */
.rf-toolbar { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; background: var(--rf-card); border: 1px solid var(--rf-border); border-radius: var(--rf-radius); padding: 14px 18px; margin-bottom: 20px; box-shadow: var(--rf-shadow); }
.rf-toolbar-search { display: flex; align-items: center; gap: 8px; border: 1px solid var(--rf-border); border-radius: 10px; padding: 8px 12px; flex: 1 1 220px; color: var(--rf-text-secondary); }
.rf-toolbar-search input { border: none; outline: none; background: transparent; font-family: inherit; font-size: 13.5px; width: 100%; color: var(--rf-text); }
.rf-select { border: 1px solid var(--rf-border); border-radius: 10px; padding: 8px 10px; font-family: inherit; font-size: 13px; background: var(--rf-card); color: var(--rf-text); }
.rf-toolbar-btns { display: flex; gap: 8px; }
.rf-toolbar-meta { margin-left: auto; display: flex; flex-direction: column; align-items: flex-end; font-size: 12px; color: var(--rf-text-secondary); }
.rf-toolbar-updated { opacity: .75; }

/* ---------- Layout grid ---------- */
.rf-content-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 20px; align-items: start; }

/* ---------- Table ---------- */
.rf-table-wrap { background: var(--rf-card); border: 1px solid var(--rf-border); border-radius: var(--rf-radius); overflow: auto; box-shadow: var(--rf-shadow); }
.rf-table { width: 100%; border-collapse: collapse; font-size: 13.5px; min-width: 920px; }
.rf-table thead th { position: sticky; top: 0; background: var(--rf-card); text-align: left; font-size: 11.5px; text-transform: uppercase; letter-spacing: .04em; color: var(--rf-text-secondary); padding: 14px 16px; border-bottom: 1px solid var(--rf-border); z-index: 1; }
.rf-th-actions { text-align: right; }
.rf-row td { padding: 14px 16px; border-bottom: 1px solid var(--rf-border); vertical-align: top; transition: background .15s ease, border-color .15s ease; border-left: 3px solid transparent; }
.rf-row:hover td { background: rgba(21,101,192,0.04); border-left-color: var(--rf-primary); }
.rf-row:last-child td { border-bottom: none; }
.rf-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 12.5px; }
.rf-cell-strong { font-weight: 600; margin: 0; }
.rf-cell-sub { font-size: 12px; color: var(--rf-text-secondary); margin: 2px 0 0; }
.rf-blood-badge { display: inline-block; font-weight: 700; font-size: 12.5px; padding: 3px 9px; border-radius: 8px; background: rgba(211,47,47,.1); color: var(--rf-danger); }
.rf-needed-urgent { color: var(--rf-danger); font-weight: 700; }

.rf-stage-badge { display: inline-block; font-size: 12px; font-weight: 700; padding: 4px 11px; border-radius: 999px; }
.rf-stage-badge.is-preparing { background: rgba(245,158,11,.14); color: #B45309; }
.rf-stage-badge.is-quality-check { background: rgba(124,58,237,.12); color: var(--rf-purple); }
.rf-stage-badge.is-ready-for-dispatch { background: rgba(37,99,235,.12); color: var(--rf-info); }
.rf-stage-badge.is-dispatched { background: rgba(15,118,110,.12); color: var(--rf-teal); }
.rf-stage-badge.is-delivered { background: rgba(21,101,192,.12); color: var(--rf-primary); }
.rf-stage-badge.is-completed { background: rgba(46,125,50,.14); color: var(--rf-success); }

.rf-actions-cell { display: flex; align-items: center; gap: 8px; justify-content: flex-end; position: relative; }
.rf-icon-btn { width: 32px; height: 32px; border-radius: 9px; border: 1px solid var(--rf-border); background: var(--rf-card); color: var(--rf-text-secondary); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.rf-icon-btn:hover { border-color: var(--rf-primary); color: var(--rf-primary); }
.rf-menu-wrap { position: relative; }
.rf-menu { position: absolute; right: 0; top: 38px; background: var(--rf-card); border: 1px solid var(--rf-border); border-radius: 12px; box-shadow: 0 10px 30px rgba(15,23,42,.14); min-width: 200px; padding: 6px; z-index: 20; display: flex; flex-direction: column; }
.rf-menu button { text-align: left; background: none; border: none; font-family: inherit; font-size: 13px; padding: 8px 10px; border-radius: 8px; cursor: pointer; color: var(--rf-text); }
.rf-menu button:hover { background: rgba(21,101,192,.08); color: var(--rf-primary); }

/* ---------- Empty / skeleton ---------- */
.rf-empty-state { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 70px 20px; color: var(--rf-text-secondary); }
.rf-empty-illustration { width: 64px; height: 64px; margin-bottom: 16px; opacity: .5; }
.rf-empty-state h3 { color: var(--rf-text); margin: 0 0 6px; }
.rf-empty-state p { margin: 0 0 18px; font-size: 13.5px; }
.rf-skeleton-table { padding: 18px; display: flex; flex-direction: column; gap: 12px; }
.rf-skeleton-row { height: 46px; border-radius: 10px; background: linear-gradient(90deg, var(--rf-border) 25%, rgba(255,255,255,.6) 50%, var(--rf-border) 75%); background-size: 200% 100%; animation: rf-shimmer 1.4s infinite; }

/* ---------- Side column ---------- */
.rf-side-col { display: flex; flex-direction: column; gap: 18px; }
.rf-card { background: var(--rf-card); border: 1px solid var(--rf-border); border-radius: var(--rf-radius); padding: var(--rf-pad); box-shadow: var(--rf-shadow); }
.rf-card-title { font-size: 15px; font-weight: 700; margin: 0 0 14px; }
.rf-dispatch-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.rf-dispatch-value { font-size: 22px; font-weight: 800; margin: 0; }
.rf-dispatch-label { font-size: 12px; color: var(--rf-text-secondary); margin: 2px 0 0; }

.rf-timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 16px; }
.rf-timeline-item { display: flex; gap: 12px; }
.rf-timeline-dot { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.rf-timeline-dot.is-success { background: rgba(46,125,50,.14); color: var(--rf-success); }
.rf-timeline-dot.is-info { background: rgba(37,99,235,.12); color: var(--rf-info); }
.rf-timeline-dot.is-warning { background: rgba(245,158,11,.14); color: #B45309; }
.rf-timeline-desc { font-size: 13.5px; margin: 0; font-weight: 500; }
.rf-timeline-meta { font-size: 12px; color: var(--rf-text-secondary); margin: 2px 0 0; }
.rf-timeline-empty { font-size: 13px; color: var(--rf-text-secondary); }

/* ---------- Drawer ---------- */
.rf-drawer-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.35); display: flex; justify-content: flex-end; z-index: 50; animation: rf-fade .2s ease; }
.rf-drawer { width: 500px; max-width: 100%; height: 100%; background: var(--rf-card); display: flex; flex-direction: column; animation: rf-slide-in .25s ease; }
.rf-drawer-loading { padding: 24px; display: flex; flex-direction: column; gap: 12px; }
.rf-drawer-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 22px 24px; border-bottom: 1px solid var(--rf-border); }
.rf-drawer-eyebrow { font-size: 12px; color: var(--rf-text-secondary); font-family: ui-monospace, monospace; margin: 0 0 2px; }
.rf-drawer-header h2 { font-size: 18px; margin: 0; }
.rf-drawer-body { flex: 1; overflow-y: auto; padding: 22px 24px; display: flex; flex-direction: column; gap: 26px; }
.rf-drawer-section h3 { font-size: 14px; font-weight: 700; margin: 0 0 12px; }
.rf-drawer-footer { display: flex; gap: 10px; padding: 18px 24px; border-top: 1px solid var(--rf-border); }
.rf-drawer-footer .rf-btn { flex: 1; justify-content: center; }

.rf-stepper { display: flex; overflow-x: auto; gap: 4px; padding-bottom: 6px; }
.rf-step { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1; min-width: 62px; position: relative; }
.rf-step-dot { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; background: var(--rf-border); color: var(--rf-text-secondary); transition: all .2s ease; }
.rf-step.is-complete .rf-step-dot { background: var(--rf-primary); color: #fff; }
.rf-step.is-current .rf-step-dot { background: var(--rf-info); color: #fff; box-shadow: 0 0 0 4px rgba(37,99,235,.18); }
.rf-step-label { font-size: 9.5px; text-align: center; color: var(--rf-text-secondary); line-height: 1.2; }
.rf-step.is-complete .rf-step-label, .rf-step.is-current .rf-step-label { color: var(--rf-text); font-weight: 600; }

.rf-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 0; }
.rf-info-grid dt { font-size: 11.5px; color: var(--rf-text-secondary); margin-bottom: 3px; }
.rf-info-grid dd { font-size: 13.5px; font-weight: 600; margin: 0; }
.rf-priority-badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700; }
.rf-priority-badge.is-critical { background: rgba(211,47,47,.12); color: var(--rf-danger); }
.rf-priority-badge.is-high { background: rgba(245,158,11,.14); color: #B45309; }
.rf-priority-badge.is-standard { background: rgba(100,116,139,.14); color: var(--rf-text-secondary); }

.rf-unit-cards { display: flex; flex-direction: column; gap: 10px; }
.rf-unit-card { border: 1px solid var(--rf-border); border-radius: 12px; padding: 12px 14px; font-size: 13px; }
.rf-unit-card-top { display: flex; justify-content: space-between; margin-bottom: 6px; }
.rf-unit-status { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
.rf-unit-status.is-verified { background: rgba(46,125,50,.14); color: var(--rf-success); }
.rf-unit-status.is-pending { background: rgba(245,158,11,.14); color: #B45309; }

.rf-checklist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.rf-checklist label { display: flex; align-items: center; gap: 10px; font-size: 13.5px; cursor: pointer; }
.rf-checklist input[type='checkbox'] { width: 17px; height: 17px; accent-color: var(--rf-primary); }
.rf-checklist .is-done { text-decoration: line-through; color: var(--rf-text-secondary); }
.rf-check-icon { color: var(--rf-success); }

.rf-notes-label { display: block; font-size: 11.5px; color: var(--rf-text-secondary); margin: 14px 0 6px; }
.rf-textarea { width: 100%; border: 1px solid var(--rf-border); border-radius: 10px; padding: 10px 12px; font-family: inherit; font-size: 13px; resize: vertical; background: var(--rf-bg); color: var(--rf-text); }

/* ---------- Animations ---------- */
@keyframes rf-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes rf-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
@keyframes rf-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@keyframes rf-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* ---------- Responsive ---------- */
@media (max-width: 1180px) {
  .rf-content-grid { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
  .rf-kpi-grid { grid-template-columns: 1fr 1fr; }
  .rf-header { flex-direction: column; }
  .rf-drawer { width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .rf-kpi-card, .rf-row td, .rf-drawer, .rf-drawer-overlay, .rf-spin { animation: none !important; transition: none !important; }
}
</style>