<template>
  <div class="requests-page">
    <!-- Loading skeleton -->
    <div v-if="loading" class="page-inner">
      <div class="skeleton skeleton--title" />
      <div class="skeleton skeleton--search" />
      <div class="stats-grid">
        <div class="skeleton skeleton--card" v-for="n in 4" :key="n" />
      </div>
      <div class="skeleton skeleton--panel" style="height:420px" />
    </div>

    <div v-else class="page-inner">
      <!-- Page header -->
      <PageHeader title="Blood Requests" subtitle="Create, monitor, and manage blood requests submitted to the Blood Center.">
        <template #actions>
          <button type="button" class="ui-btn ui-btn--primary" @click="openNewRequest">
            <AssetIcon name="plus" :size="15" />
            New Blood Request
          </button>
        </template>
      </PageHeader>

      <!-- Summary figures -->
      <StatStrip>
        <StatItem label="Pending requests" :value="animatedCounts.pending" icon="clock" tone="warning">
          <template #hint>
            Awaiting Blood Center review
            <span v-if="trends.pending.hasData" class="stat-trend" :class="trends.pending.up ? 'up' : 'down'">
              <AssetIcon :name="trends.pending.up ? 'trending-up' : 'trending-down'" :size="11" />
              {{ trends.pending.label }}
            </span>
          </template>
        </StatItem>
        <StatItem label="Processing" :value="animatedCounts.approved" icon="check-circle" tone="success">
          <template #hint>
            Stock reserved by the blood center
            <span v-if="trends.approved.hasData" class="stat-trend" :class="trends.approved.up ? 'up' : 'down'">
              <AssetIcon :name="trends.approved.up ? 'trending-up' : 'trending-down'" :size="11" />
              {{ trends.approved.label }}
            </span>
          </template>
        </StatItem>
        <StatItem label="Partially fulfilled" :value="animatedCounts.ready" icon="package-check" tone="purple">
          <template #hint>
            Some units supplied, the rest outstanding
            <span v-if="trends.ready.hasData" class="stat-trend" :class="trends.ready.up ? 'up' : 'down'">
              <AssetIcon :name="trends.ready.up ? 'trending-up' : 'trending-down'" :size="11" />
              {{ trends.ready.label }}
            </span>
          </template>
        </StatItem>
        <StatItem label="Fulfilled" :value="animatedCounts.completed" icon="clipboard-check" tone="primary">
          <template #hint>
            Every requested unit released
            <span v-if="trends.completed.hasData" class="stat-trend" :class="trends.completed.up ? 'up' : 'down'">
              <AssetIcon :name="trends.completed.up ? 'trending-up' : 'trending-down'" :size="11" />
              {{ trends.completed.label }}
            </span>
          </template>
        </StatItem>
      </StatStrip>

      <!-- Restocking the blood bank is not requested here: it is the weekly request. -->
      <p class="restock-note fade-in" style="--delay:80ms">
        Patient transfusion requests. To restock your blood bank, send your
        <NuxtLink to="/hospital/receiving/weekly">weekly request</NuxtLink> under Receiving.
      </p>

      <!-- Search + Filters -->
      <section class="toolbar fade-in" style="--delay:100ms">
        <div class="search-bar">
          <AssetIcon name="search" :size="17" class="search-bar__icon" />
          <input
            v-model="searchQuery"
            type="text"
            class="search-bar__input"
            placeholder="Search by reference number, patient ID, blood type, or component..."
            aria-label="Search blood requests"
          />
          <button v-if="searchQuery" type="button" class="search-bar__clear" @click="searchQuery = ''" aria-label="Clear search">
            <AssetIcon name="x" :size="14" />
          </button>
          <button type="button" class="filter-toggle" @click="filtersOpen = !filtersOpen" :aria-expanded="filtersOpen">
            <AssetIcon name="sliders-horizontal" :size="15" />
            Filters
            <span v-if="activeFilterCount" class="filter-toggle__badge">{{ activeFilterCount }}</span>
          </button>
        </div>

        <div v-show="filtersOpen" class="filter-panel">
          <div class="filter-field">
            <label class="filter-field__label" for="hbr-status">Status</label>
            <SelectField id="hbr-status" v-model="filters.status" :options="[{ value: '', label: 'All statuses' }, ...Object.entries(statusMap).map(([k, v]) => ({ value: k, label: v.label }))]" size="sm" />
          </div>
          <div class="filter-field">
            <label class="filter-field__label" for="hbr-source">Source</label>
            <SelectField id="hbr-source" v-model="filters.source" :options="[{ value: '', label: 'All sources' }, ...Object.entries(REQUEST_SOURCE_LABELS).map(([value, label]) => ({ value, label }))]" size="sm" />
          </div>
          <div class="filter-field">
            <label class="filter-field__label" for="hbr-blood-type">Blood Type</label>
            <SelectField id="hbr-blood-type" v-model="filters.bloodType" :options="[{ value: '', label: 'All types' }, ...bloodTypes.map((bt) => ({ value: bt, label: bt }))]" size="sm" />
          </div>
          <div class="filter-field">
            <label class="filter-field__label" for="hbr-component">Blood Component</label>
            <SelectField id="hbr-component" v-model="filters.component" :options="[{ value: '', label: 'All components' }, ...components.map((c) => ({ value: c, label: c }))]" size="sm" />
          </div>
          <div class="filter-field">
            <label class="filter-field__label" for="hbr-priority">Priority</label>
            <SelectField id="hbr-priority" v-model="filters.priority" :options="[{ value: '', label: 'All priorities' }, ...Object.entries(priorityMap).map(([k, v]) => ({ value: k, label: v.label }))]" size="sm" />
          </div>
          <div class="filter-field">
            <label class="filter-field__label">Date Range</label>
            <div class="filter-field__range">
              <DatePicker id="hbr-from" v-model="filters.dateFrom" :max="filters.dateTo || undefined" aria-label="From" size="sm" />
              <span class="filter-field__range-sep">–</span>
              <DatePicker id="hbr-to" v-model="filters.dateTo" :min="filters.dateFrom || undefined" aria-label="To" size="sm" />
            </div>
          </div>
          <div class="filter-actions">
            <button type="button" class="ui-btn" @click="resetFilters">Reset Filters</button>
            <button type="button" class="ui-btn ui-btn--primary" @click="filtersOpen = false">Apply Filters</button>
          </div>
        </div>
      </section>

      <!-- Export row -->
      <div class="export-row fade-in" style="--delay:130ms">
        <p class="export-row__count">{{ filteredRequests.length }} request{{ filteredRequests.length === 1 ? '' : 's' }} found</p>
        <div class="export-row__actions">
          <button type="button" class="ui-btn ui-btn--sm" @click="exportCsv">
            <AssetIcon name="file-down" :size="14" /> Export CSV
          </button>
          <button type="button" class="ui-btn ui-btn--sm" @click="printPage">
            <AssetIcon name="file-text" :size="14" /> Export PDF
          </button>
          <button type="button" class="ui-btn ui-btn--sm" @click="printPage">
            <AssetIcon name="printer" :size="14" /> Print
          </button>
        </div>
      </div>

      <!-- Table / Card list -->
      <section class="panel fade-in" style="--delay:160ms">
        <div v-if="pagedRequests.length">
          <div class="req-table">
            <div class="req-table__head">
              <span>Reference</span>
              <span>Date</span>
              <span>Blood Type</span>
              <span>Component</span>
              <span>Units</span>
              <span>Priority</span>
              <span>Status</span>
              <span>Progress</span>
              <span class="sr-only">Actions</span>
            </div>

            <div v-for="req in pagedRequests" :key="req.id" class="req-row" @click="openDrawer(req)">
              <span class="req-row__ref" data-label="Reference">
                {{ req.reference_number }}
                <span v-if="req.is_walk_in" class="source-chip" title="Brought to the blood center by a watcher and confirmed by your blood bank by phone">Walk-in</span>
                <span v-if="req.needs_allocation" class="source-chip source-chip--alert" title="Some units have not been asked of any facility">{{ req.unallocated }} unallocated</span>
              </span>
              <span class="req-row__date" data-label="Date">{{ formatDate(req.request_date) }}</span>
              <span data-label="Blood Type"><span class="type-chip">{{ req.blood_type }}</span></span>
              <span class="req-row__component" data-label="Component">{{ req.component }}</span>
              <span data-label="Units">{{ req.units }}</span>
              <span data-label="Priority">
                <StatusBadge :tone="priorityOf(req.priority).tone" :dot="false">{{ priorityOf(req.priority).label }}</StatusBadge>
              </span>
              <span data-label="Status">
                <StatusBadge :tone="statusOf(req.status).tone">{{ req.status_text }}</StatusBadge>
              </span>
              <span class="req-row__progress" data-label="Progress">
                <span class="step-dots" :title="progressLabel(req.status)">
                  <span v-for="(s, i) in progressSteps" :key="s"
                    class="step-dot"
                    :class="{
                      'step-dot--done': stepIndex(req.status) > i,
                      'step-dot--current': stepIndex(req.status) === i,
                      'step-dot--halted': isHalted(req.status)
                    }" />
                </span>
              </span>
              <span class="req-row__actions" @click.stop>
                <div class="action-menu">
                  <button type="button" class="action-menu__btn" @click.stop="toggleMenu(req.id)" aria-label="Row actions" :aria-expanded="activeMenuId === req.id">
                    <AssetIcon name="move-vertical" :size="16" />
                  </button>
                  <div v-if="activeMenuId === req.id" class="action-menu__dropdown" @click.stop>
                    <button type="button" class="action-menu__item" @click="openDrawer(req)">
                      <AssetIcon name="eye" :size="14" /> Quick View
                    </button>
                    <button type="button" class="action-menu__item" @click="viewDetails(req)">
                      <AssetIcon name="file-text" :size="14" /> Full Details &amp; Fulfilment
                    </button>
                    <button type="button" class="action-menu__item" @click="trackRequest(req)">
                      <AssetIcon name="route" :size="14" /> Track Request
                    </button>
                    <button type="button" class="action-menu__item" @click="printPage">
                      <AssetIcon name="printer" :size="14" /> Print
                    </button>
                    <button v-if="canCancel(req)" type="button" class="action-menu__item action-menu__item--danger" @click="cancelRequest(req)">
                      <AssetIcon name="circle-x" :size="14" /> Cancel Request
                    </button>
                  </div>
                </div>
              </span>
            </div>
          </div>

          <!-- Pagination -->
          <div class="pagination">
            <div class="pagination__rows">
              <label for="rowsPerPage">Rows per page</label>
              <div class="rows-select">
                <SelectField id="rowsPerPage" v-model="rowsPerPage" :options="[10, 25, 50].map((n) => ({ value: n, label: String(n) }))" size="sm" />
              </div>
            </div>
            <div class="pagination__nav">
              <button type="button" class="pagination__btn" :disabled="currentPage === 1" @click="currentPage--">
                <AssetIcon name="chevron-left" :size="15" /> Previous
              </button>
              <button v-for="p in visiblePages" :key="p" type="button"
                class="pagination__page" :class="{ 'pagination__page--active': p === currentPage }"
                @click="currentPage = p">{{ p }}</button>
              <button type="button" class="pagination__btn" :disabled="currentPage === totalPages" @click="currentPage++">
                Next <AssetIcon name="chevron-right" :size="15" />
              </button>
            </div>
          </div>
        </div>

        <!-- Error state -->
        <EmptyState v-else-if="loadError" icon="triangle-alert" title="Couldn't Load Blood Requests" description="Something went wrong while fetching your requests. Please try again.">
          <button type="button" class="ui-btn" @click="loadRequests">Retry</button>
        </EmptyState>

        <!-- Empty state -->
        <EmptyState
          v-else
          icon="droplets"
          title="No Blood Requests Found"
          :description="hasActiveFilters
            ? 'No requests match your search or filters. Try adjusting them.'
            : 'You haven\'t submitted any blood requests yet. Create a new blood request to begin.'">
          <button v-if="hasActiveFilters" type="button" class="ui-btn" @click="resetFilters">Reset Filters</button>
          <button v-else type="button" class="ui-btn ui-btn--primary" @click="openNewRequest">
            <AssetIcon name="plus" :size="15" /> Create Blood Request
          </button>
        </EmptyState>
      </section>
    </div>

    <!-- Slide-over drawer -->
    <Transition name="drawer-fade">
      <div v-if="drawerOpen" class="drawer-backdrop" @click="closeDrawer" />
    </Transition>
    <Transition name="drawer-slide">
      <aside v-if="drawerOpen && selectedRequest" class="drawer" role="dialog" v-focus-trap aria-label="Request details">
        <div class="drawer__header">
          <div>
            <p class="drawer__eyebrow">Request Details</p>
            <h2 class="drawer__title">{{ selectedRequest.reference_number }}</h2>
          </div>
          <button type="button" class="ui-btn ui-btn--icon" @click="closeDrawer" aria-label="Close details">
            <AssetIcon name="x" :size="18" />
          </button>
        </div>

        <div class="drawer__body">
          <div class="drawer__status-row">
            <StatusBadge :tone="statusOf(selectedRequest.status).tone">{{ selectedRequest.status_text }}</StatusBadge>
            <StatusBadge :tone="priorityOf(selectedRequest.priority).tone" :dot="false">{{ priorityOf(selectedRequest.priority).label }} Priority</StatusBadge>
          </div>

          <dl class="drawer__grid">
            <div class="drawer__field">
              <dt>Hospital Name</dt>
              <dd>{{ selectedRequest.hospital_name }}</dd>
            </div>
            <div class="drawer__field">
              <dt>{{ selectedRequest.kind === 'transfusion' ? 'Facilities asked' : 'Blood Center' }}</dt>
              <dd>{{ selectedRequest.centre_name || '—' }}</dd>
            </div>
            <div class="drawer__field">
              <dt>Source</dt>
              <dd>{{ selectedRequest.source_label }}</dd>
            </div>
            <div class="drawer__field">
              <dt>Fulfilled</dt>
              <dd>{{ selectedRequest.fulfilled }} of {{ selectedRequest.units }}</dd>
            </div>
            <div class="drawer__field">
              <dt>Blood Type</dt>
              <dd>{{ selectedRequest.blood_type }}</dd>
            </div>
            <div class="drawer__field">
              <dt>Blood Component</dt>
              <dd>{{ selectedRequest.component }}</dd>
            </div>
            <div class="drawer__field">
              <dt>{{ selectedRequest.kind === 'transfusion' ? 'Units Required' : 'Units Requested' }}</dt>
              <dd>{{ selectedRequest.units }}</dd>
            </div>
            <div v-if="selectedRequest.kind === 'transfusion'" class="drawer__field">
              <dt>Unallocated</dt>
              <dd>{{ selectedRequest.unallocated }}</dd>
            </div>
            <div v-if="selectedRequest.patient" class="drawer__field">
              <dt>Patient</dt>
              <dd>{{ selectedRequest.patient }}</dd>
            </div>
            <div class="drawer__field">
              <dt>Requested By</dt>
              <dd>{{ selectedRequest.requested_by }}</dd>
            </div>
            <div class="drawer__field">
              <dt>Date Submitted</dt>
              <dd>{{ formatDate(selectedRequest.request_date, true) }}</dd>
            </div>
            <div class="drawer__field drawer__field--full">
              <dt>Reason</dt>
              <dd>{{ selectedRequest.reason }}</dd>
            </div>
          </dl>

          <div class="drawer__timeline-section">
            <h3 class="drawer__section-title">Timeline</h3>
            <div class="v-timeline">
              <div v-for="(step, i) in detailSteps" :key="step" class="v-timeline__row">
                <div class="v-timeline__rail">
                  <span class="v-timeline__dot" :class="{
                    'v-timeline__dot--done': detailStepIndex > i || (detailStepIndex === i && !isHalted(selectedRequest.status)),
                    'v-timeline__dot--halted': isHalted(selectedRequest.status) && i === detailStepIndex
                  }">
                    <AssetIcon v-if="detailStepIndex > i" name="check" :size="11" />
                  </span>
                  <span v-if="i !== detailSteps.length - 1" class="v-timeline__line" :class="{ 'v-timeline__line--done': detailStepIndex > i }" />
                </div>
                <div class="v-timeline__body">
                  <p class="v-timeline__label" :class="{ 'v-timeline__label--muted': detailStepIndex < i }">{{ step }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="drawer__footer">
          <button type="button" class="ui-btn ui-btn--primary" @click="viewDetails(selectedRequest)">
            <AssetIcon name="file-text" :size="15" /> Full Details
          </button>
          <button v-if="canCancel(selectedRequest)" type="button" class="ui-btn ui-btn--danger" @click="cancelRequest(selectedRequest)">
            <AssetIcon name="circle-x" :size="15" /> Cancel Request
          </button>
        </div>
      </aside>
    </Transition>
  </div>
</template>

<script setup>
import PageHeader from '~/components/ui/PageHeader.vue'
import StatStrip from '~/components/ui/StatStrip.vue'
import StatItem from '~/components/ui/StatItem.vue'
import StatusBadge from '~/components/ui/StatusBadge.vue'
import EmptyState from '~/components/ui/EmptyState.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { componentSummary, REQUEST_SOURCE_LABELS, requestStatusLabel } from '~/types/bloodRequest'
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { hospitalService } from '~/api/hospital/HospitalService'
import { canCancelTransfusion, transfusionProgressLabel } from '~/utils/transfusionSourcing'
import SelectField from '~/components/common/SelectField.vue'
import DatePicker from '~/components/common/DatePicker.vue'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard', requires: 'hospital.requests.view' })

const router = useRouter()
const route = useRoute()
const loading = ref(true)

/*
 * A patient's need is a Patient Transfusion Request, possibly split across
 * several centres. Restocking the blood bank is the weekly request, which
 * lives under Receiving, so it is not listed here.
 */
const kind = ref('transfusion')

// ---------- Reference data ----------
const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const components = ['Packed RBC', 'Whole Blood', 'Fresh Frozen Plasma', 'Platelet Concentrate', 'Cryoprecipitate']

/*
 * Keyed on the six statuses the API actually sends. This map used to carry
 * approved / ready / completed, which the schema has never had, and lacked
 * partial and fulfilled — so `statusMap[req.status].bg` threw on the first
 * partly or fully supplied request and took the whole list down with it.
 */
// Each status as a StatusBadge tone, so the colours match every staff page.
const statusMap = {
  pending: { label: 'Pending', tone: 'warning' },
  processing: { label: 'Processing', tone: 'info' },
  partial: { label: 'Partially Fulfilled', tone: 'purple' },
  fulfilled: { label: 'Fulfilled', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}

const FALLBACK_STYLE = { label: '—', tone: 'neutral' }

// The API speaks routine / emergency; the DOH form prints ROUTINE and STAT.
const priorityMap = {
  routine: { label: 'Routine', tone: 'info' },
  emergency: { label: 'STAT', tone: 'danger' },
}

function statusOf(status) {
  return statusMap[status] ?? { ...FALLBACK_STYLE, label: status ?? '—' }
}

function priorityOf(priority) {
  return priorityMap[priority] ?? priorityMap.routine
}

// Fulfilment is counted at dispatch: released units move a request to
// Partially Fulfilled, and every requested unit released makes it Fulfilled.
const progressSteps = ['Submitted', 'Stock reserved', 'Partially fulfilled', 'Fulfilled']
const detailSteps = ['Submitted', 'Reviewed', 'Stock reserved', 'Units released', 'Fulfilled']

function stepIndex(status) {
  return { pending: 0, processing: 1, partial: 2, fulfilled: 3, rejected: 0, cancelled: 0 }[status] ?? 0
}
function isHalted(status) {
  return status === 'rejected' || status === 'cancelled'
}
function progressLabel(status) {
  if (isHalted(status)) return statusOf(status).label
  return progressSteps[stepIndex(status)]
}
function canCancel(req) {
  return req.kind === 'transfusion' ? canCancelTransfusion(req.raw) : req.status === 'pending'
}

const detailStepIndex = computed(() => {
  if (!selectedRequest.value) return 0
  const map = { pending: 1, processing: 3, partial: 4, fulfilled: 5, rejected: 1, cancelled: 1 }
  return (map[selectedRequest.value.status] ?? 1) - 1
})

// ---------- Live data ----------
const allRequests = ref([])
const loadError = ref(null)

/** A Patient Transfusion Request, in the row shape the table and drawer read. */
function normalizeTransfusion(r) {
  return {
    id: r.id,
    kind: 'transfusion',
    raw: r,
    reference_number: r.reference_number,
    hospital_name: r.requesting_facility?.name ?? '',
    centre_name: (r.facilities ?? []).join(', '),
    source: r.request_source ?? 'blood_bank_portal',
    source_label: r.source_label ?? 'Blood Bank Portal',
    is_walk_in: Boolean(r.is_walk_in),
    needs_allocation: Boolean(r.is_open && r.needs_allocation),
    unallocated: r.totals?.unallocated ?? 0,
    status_text: transfusionProgressLabel(r),
    fulfilled: r.totals?.fulfilled ?? 0,
    blood_type: r.blood_type?.code ?? '',
    component: componentSummary({ items: r.lines ?? [] }),
    units: r.totals?.required ?? 0,
    purpose: r.purpose_label ?? '',
    patient: r.patient?.full_name ?? '',
    priority: r.urgency_level ?? 'routine',
    status: r.status,
    request_date: r.request_date ? new Date(r.request_date) : null,
    requested_by: r.requester_name
      ?? (r.is_walk_in ? `Walk-in — recorded by ${r.recorder_name ?? 'the blood center'}` : ''),
    reason: r.cancellation_reason ?? '',
  }
}

// ---------- Search & filters ----------
const searchQuery = ref('')
const filtersOpen = ref(false)
const filters = reactive({
  status: '',
  source: '',
  bloodType: '',
  component: '',
  priority: '',
  dateFrom: '',
  dateTo: '',
})

const activeFilterCount = computed(() =>
  Object.values(filters).filter(v => v !== '').length
)
const hasActiveFilters = computed(() => activeFilterCount.value > 0 || searchQuery.value.trim() !== '')

function resetFilters() {
  filters.status = ''
  filters.source = ''
  filters.bloodType = ''
  filters.component = ''
  filters.priority = ''
  filters.dateFrom = ''
  filters.dateTo = ''
  searchQuery.value = ''
}

const filteredRequests = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return allRequests.value.filter(r => {
    if (q) {
      const haystack = `${r.reference_number} ${r.blood_type} ${r.component}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    if (filters.status && r.status !== filters.status) return false
    if (filters.source && r.source !== filters.source) return false
    if (filters.bloodType && r.blood_type !== filters.bloodType) return false
    if (filters.component && r.component !== filters.component) return false
    if (filters.priority && r.priority !== filters.priority) return false
    if (filters.dateFrom && r.request_date < new Date(filters.dateFrom)) return false
    if (filters.dateTo && r.request_date > new Date(filters.dateTo + 'T23:59:59')) return false
    return true
  })
})

// ---------- Pagination ----------
const currentPage = ref(1)
const rowsPerPage = ref(10)

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRequests.value.length / rowsPerPage.value)))

const pagedRequests = computed(() => {
  const start = (currentPage.value - 1) * rowsPerPage.value
  return filteredRequests.value.slice(start, start + rowsPerPage.value)
})

const visiblePages = computed(() => {
  const total = totalPages.value
  const cur = currentPage.value
  const span = 2
  const pages = []
  for (let p = Math.max(1, cur - span); p <= Math.min(total, cur + span); p++) pages.push(p)
  return pages
})

// Reset to page 1 whenever the filtered result set changes
watch([filteredRequests, rowsPerPage], () => { currentPage.value = 1 })
watch(currentPage, (p) => {
  if (p < 1) currentPage.value = 1
  else if (p > totalPages.value) currentPage.value = totalPages.value
})

// ---------- KPI counts (animated) ----------
// The card keys are historical; each now counts a status the API really sends.
// approved → processing (stock reserved), ready → partial, completed → fulfilled.
const CARD_STATUSES = { pending: 'pending', approved: 'processing', ready: 'partial', completed: 'fulfilled' }

const rawCounts = computed(() => ({
  pending: allRequests.value.filter(r => r.status === CARD_STATUSES.pending).length,
  approved: allRequests.value.filter(r => r.status === CARD_STATUSES.approved).length,
  ready: allRequests.value.filter(r => r.status === CARD_STATUSES.ready).length,
  completed: allRequests.value.filter(r => r.status === CARD_STATUSES.completed).length,
}))

const animatedCounts = reactive({ pending: 0, approved: 0, ready: 0, completed: 0 })

// ---------- Trends (computed live gikan sa actual data — walay hardcoded values) ----------
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function buildTrend(status) {
  const now = new Date()
  const currentStart = new Date(now.getTime() - WEEK_MS)
  const previousStart = new Date(now.getTime() - WEEK_MS * 2)

  const inRange = (start, end) => allRequests.value.filter(r =>
    r.status === status && r.request_date && r.request_date >= start && r.request_date < end
  ).length

  const current = inRange(currentStart, now)
  const previous = inRange(previousStart, currentStart)

  if (previous === 0 && current === 0) {
    return { up: true, label: '', hasData: false }
  }

  let percent
  let up
  if (previous === 0) {
    percent = 100
    up = true
  } else {
    percent = Math.round(((current - previous) / previous) * 100)
    up = percent >= 0
  }

  return {
    up,
    hasData: true,
    label: `${up ? '↑' : '↓'} ${Math.abs(percent)}% this week`,
  }
}

const trends = computed(() => ({
  pending: buildTrend(CARD_STATUSES.pending),
  approved: buildTrend(CARD_STATUSES.approved),
  ready: buildTrend(CARD_STATUSES.ready),
  completed: buildTrend(CARD_STATUSES.completed),
}))

function animateCounter(key, endValue, duration = 800) {
  const start = 0
  const startTime = performance.now()
  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    animatedCounts[key] = Math.round(start + (endValue - start) * eased)
    if (progress < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

// ---------- Action menu ----------
const activeMenuId = ref(null)
function toggleMenu(id) {
  activeMenuId.value = activeMenuId.value === id ? null : id
}
function closeMenu() {
  activeMenuId.value = null
}

// ---------- Drawer ----------
const drawerOpen = ref(false)
const selectedRequest = ref(null)
function openDrawer(req) {
  selectedRequest.value = req
  drawerOpen.value = true
  closeMenu()
}
function closeDrawer() {
  drawerOpen.value = false
}

// ---------- Row / global actions ----------
function openNewRequest() {
  router.push('/hospital/bloodrequests/newrequest')
}
function trackRequest(req) {
  closeMenu()
  // The page is /hospital/trackrequests; the hyphenated path this pushed to
  // has never existed, so "Track Request" landed on a 404.
  router.push(`/hospital/trackrequests?ref=${req.reference_number}`)
}
function viewDetails(req) {
  closeMenu()
  router.push(req.kind === 'transfusion' ? `/hospital/transfusion-requests/${req.id}` : `/hospital/bloodrequests/${req.id}`)
}
function printPage() {
  window.print()
}
async function cancelRequest(req) {
  const previousStatus = req.status
  const previousText = req.status_text
  req.status = 'cancelled' // optimistic update
  req.status_text = statusOf('cancelled').label
  closeMenu()
  if (selectedRequest.value?.id === req.id) drawerOpen.value = false
  try {
    if (req.kind === 'transfusion') {
      const response = await hospitalService.cancelTransfusionRequest(req.id)
      if (response?.request) Object.assign(req, normalizeTransfusion(response.request))
    } else {
      await hospitalService.cancelRequest(req.id)
    }
  } catch (err) {
    console.error('Failed to cancel request:', err)
    req.status = previousStatus // rollback on failure
    req.status_text = previousText
  }
}
function exportCsv() {
  const rows = [
    ['Reference', 'Date', 'Source', 'Blood Type', 'Component', 'Units', 'Fulfilled', 'Priority', 'Status'],
    ...filteredRequests.value.map(r => [
      r.reference_number, formatDate(r.request_date), r.source_label, r.blood_type, r.component,
      r.units, r.fulfilled, priorityOf(r.priority).label, r.status_text,
    ]),
  ]
  const csv = rows.map(row => row.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'blood-requests.csv'
  link.click()
  URL.revokeObjectURL(url)
}

// ---------- Utils ----------
function formatDate(date, withTime = false) {
  if (!date) return '—'
  const d = new Date(date)
  const opts = { year: 'numeric', month: 'short', day: 'numeric' }
  if (withTime) { opts.hour = '2-digit'; opts.minute = '2-digit' }
  return d.toLocaleDateString('en-PH', opts)
}

function handleGlobalKeydown(e) {
  if (e.key === 'Escape') {
    if (drawerOpen.value) closeDrawer()
    else if (activeMenuId.value !== null) closeMenu()
  }
}
function handleGlobalClick() {
  if (activeMenuId.value !== null) closeMenu()
}

async function loadRequests() {
  loading.value = true
  loadError.value = null
  try {
    // Filtered and paged here on the client, so take the most one page may
    // hold rather than the API's default of fifteen.
    const res = await hospitalService.listTransfusionRequests({ per_page: 100 })
    allRequests.value = (res?.data ?? []).map(normalizeTransfusion)
  } catch (err) {
    console.error('Failed to load blood requests:', err)
    loadError.value = err
    allRequests.value = []
  } finally {
    loading.value = false
    requestAnimationFrame(() => {
      const c = rawCounts.value
      animateCounter('pending', c.pending)
      animateCounter('approved', c.approved)
      animateCounter('ready', c.ready)
      animateCounter('completed', c.completed)
    })
  }
}

onMounted(() => {
  loadRequests()
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('click', handleGlobalClick)
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('click', handleGlobalClick)
})
</script>

<style scoped>
.requests-page {
  --primary: var(--rb-primary);
  --primary-hover: color-mix(in srgb, var(--rb-primary) 88%, #000);
  --bg: var(--rb-page-bg);
  --surface: var(--rb-surface);
  --border: var(--rb-border);
  --border-dark: var(--rb-border-strong);
  --text-primary: var(--rb-text-primary);
  --text-secondary: var(--rb-text-secondary);
  --text-muted: var(--rb-text-muted);
  --danger: var(--rb-accent);
  --warning: var(--rb-warning);
  --success: var(--rb-success);
  --purple: var(--rb-purple, #7c3aed);
  font-family: var(--rb-font-sans);
  max-width: var(--rb-content-max, 1600px);
  background: var(--bg);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
}

.sr-only {
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap;
}

.page-inner { display: flex; flex-direction: column; gap: 24px; }

/* Skeleton */
.skeleton {
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  border-radius: 18px;
  animation: shimmer 1.4s ease infinite;
}
.skeleton--title { height: 60px; max-width: 420px; }
.skeleton--search { height: 48px; }
.skeleton--card { height: 140px; }
.skeleton--panel { border-radius: 18px; }
@keyframes shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

.fade-in { animation: fadeInUp 0.4s ease both; animation-delay: var(--delay, 0ms); }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .fade-in, .skeleton { animation: none !important; } }

/* Page header */
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-title { font-size: 30px; font-weight: 700; color: var(--text-primary); margin: 0; letter-spacing: -0.01em; }
.page-subtitle { font-size: 15px; font-weight: 400; color: var(--text-secondary); margin: 6px 0 0; }

.btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  height: 48px; padding: 0 20px; border-radius: 14px;
  font-family: inherit; font-size: 15px; font-weight: 600; color: #fff;
  background: var(--primary); border: none; cursor: pointer;
  box-shadow: 0 1px 2px rgba(15,23,42,0.06);
  transition: background 0.15s ease, transform 0.15s ease;
  flex-shrink: 0; white-space: nowrap;
}
.btn-primary:hover { background: var(--primary-hover); transform: translateY(-1px); }
.btn-primary--sm { height: 40px; padding: 0 16px; font-size: 13.5px; border-radius: 10px; }

.btn-ghost {
  display: inline-flex; align-items: center; gap: 6px;
  height: 40px; padding: 0 16px; border-radius: 10px;
  font-family: inherit; font-size: 13.5px; font-weight: 600; color: var(--text-secondary);
  background: var(--surface); border: 1px solid var(--border); cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
  white-space: nowrap;
}
.btn-ghost:hover { color: var(--rb-primary-text); border-color: var(--rb-primary-text); transform: translateY(-1px); }
.btn-ghost--sm { height: 36px; padding: 0 12px; font-size: 12.5px; }

.btn-danger {
  display: inline-flex; align-items: center; gap: 6px;
  height: 44px; padding: 0 18px; border-radius: 12px;
  font-family: inherit; font-size: 14px; font-weight: 600; color: #fff;
  background: var(--danger); border: none; cursor: pointer;
  transition: background 0.15s ease;
}
.btn-danger:hover { background: color-mix(in srgb, var(--rb-accent) 85%, #000); }

.icon-btn {
  width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--border);
  background: var(--surface); color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center; cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.icon-btn:hover { color: var(--rb-primary-text); border-color: var(--rb-primary-text); }

/* Stat cards */
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
.stat-card {
  background: var(--surface); border-radius: 18px; padding: 24px;
  box-shadow: 0 4px 20px rgba(15,23,42,0.05); border: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 4px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.stat-card:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(15,23,42,0.08); }
.stat-card__top { display: flex; align-items: center; gap: 10px; }
.stat-card__icon { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stat-card__title { font-size: 13.5px; font-weight: 600; color: var(--text-secondary); }
.stat-card__value { font-size: 40px; font-weight: 800; color: var(--text-primary); margin: 14px 0 0; line-height: 1; font-variant-numeric: tabular-nums; }
.stat-card__helper { font-size: 12.5px; color: var(--text-muted); margin: 6px 0 0; }
.stat-card__trend {
  display: inline-flex; align-items: center; gap: 3px; align-self: flex-start;
  font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 999px;
  margin-top: 12px;
}
.stat-card__trend.up { color: var(--success); background: rgba(var(--rb-success-rgb), 0.1); }
.stat-card__trend.down { color: var(--danger); background: rgba(var(--rb-accent-rgb), 0.09); }

/* Toolbar: search + filters */
.toolbar { display: flex; flex-direction: column; gap: 12px; }
.search-bar {
  display: flex; align-items: center; gap: 10px;
  height: 46px; padding: 0 8px 0 16px; border-radius: 12px;
  background: var(--surface); border: 1px solid var(--border);
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}
.search-bar:focus-within { border-color: rgba(var(--rb-primary-rgb), 0.4); background: var(--surface); box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.1); }
.search-bar__icon { color: var(--text-muted); flex-shrink: 0; }
.search-bar__input {
  flex: 1; min-width: 0; height: 100%; border: none; background: transparent; outline: none;
  font-family: inherit; font-size: 14px; color: var(--text-primary);
}
.search-bar__input::placeholder { color: var(--text-muted); }
.search-bar__clear { color: var(--text-muted); background: none; border: none; cursor: pointer; display: flex; flex-shrink: 0; }
.search-bar__clear:hover { color: var(--text-secondary); }

.filter-toggle {
  display: inline-flex; align-items: center; gap: 7px;
  height: 34px; padding: 0 14px; border-radius: 10px;
  font-family: inherit; font-size: 13px; font-weight: 600; color: var(--text-secondary);
  background: var(--surface); border: 1px solid var(--border); cursor: pointer; flex-shrink: 0;
  transition: color 0.15s ease, border-color 0.15s ease;
}
.filter-toggle:hover { color: var(--rb-primary-text); border-color: var(--rb-primary-text); }
.filter-toggle__badge {
  min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px;
  background: var(--primary); color: #fff; font-size: 10px; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center;
}

.filter-panel {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--rb-radius-lg); box-shadow: var(--rb-shadow-sm);
  padding: 18px 20px; display: grid;
  grid-template-columns: repeat(5, 1fr); gap: 14px; align-items: end;
}
.filter-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.filter-field--full { grid-column: 1 / -1; }
.filter-field__label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
.filter-field__range { display: flex; align-items: center; gap: 6px; }
.filter-field__range-sep { color: var(--text-muted); font-size: 12px; }
.filter-actions { grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 10px; padding-top: 4px; }

/* Export row */
.export-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.export-row__count { font-size: 13px; color: var(--text-secondary); margin: 0; }
.export-row__actions { display: flex; gap: 8px; flex-wrap: wrap; }

/* Panel */
.panel {
  background: var(--surface); border-radius: var(--rb-radius-lg); border: 1px solid var(--border);
  box-shadow: var(--rb-shadow-sm); overflow: hidden;
}

/* Table */
.req-table { padding: 0; }
.req-table__head {
  display: grid; grid-template-columns: 1.1fr 0.9fr 0.7fr 1.1fr 0.5fr 0.9fr 1.1fr 1fr 0.5fr;
  gap: 10px; padding: 11px 24px; font-size: 12px; font-weight: 600;
  color: var(--text-secondary); background: var(--rb-surface-alt);
  border-bottom: 1px solid var(--border);
}
.req-row {
  display: grid; grid-template-columns: 1.1fr 0.9fr 0.7fr 1.1fr 0.5fr 0.9fr 1.1fr 1fr 0.5fr;
  gap: 10px; align-items: center; padding: 14px 24px;
  border-bottom: 1px solid var(--border); font-size: 14px; color: var(--text-primary);
  cursor: pointer; transition: background 0.15s ease;
}
.req-row:last-child { border-bottom: none; }
.req-row:hover { background: var(--rb-surface-alt); }
.req-row__ref { font-weight: 600; }
.source-chip {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(var(--rb-purple-rgb), .12);
  color: var(--rb-purple-text);
  font-size: 10.5px;
  font-weight: 700;
  vertical-align: middle;
}
.source-chip--alert {
  background: rgba(var(--rb-accent-rgb), .12);
  color: var(--rb-accent-text);
}

.restock-note { margin: 0; font-size: 13px; color: var(--rb-text-secondary); }
.restock-note a { color: var(--rb-primary-text); font-weight: 600; }
.req-row__component, .req-row__date { color: var(--text-secondary); }

.type-chip {
  display: inline-flex; align-items: center; justify-content: center; min-width: 36px;
  padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 700;
  background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text);
}
.priority-chip {
  display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px;
  font-size: 12px; font-weight: 600;
}
.priority-chip--lg { font-size: 13px; padding: 6px 14px; }

.badge { font-size: 12px; font-weight: 600; padding: 5px 11px; border-radius: 999px; display: inline-block; transition: transform 0.1s ease; }
.badge--lg { font-size: 13px; padding: 7px 16px; }
.req-row:hover .badge { transform: translateY(-1px); }

.step-dots { display: inline-flex; align-items: center; gap: 3px; }
.step-dot { width: 7px; height: 7px; border-radius: 999px; background: var(--rb-border-strong); transition: background 0.2s ease, transform 0.2s ease; }
.step-dot--done { background: var(--success); }
.step-dot--current { background: var(--primary); transform: scale(1.3); }
.step-dot--halted { background: var(--danger); }

.req-row__actions { display: flex; justify-content: flex-end; position: relative; }
.action-menu { position: relative; }
.action-menu__btn {
  width: 32px; height: 32px; border-radius: 8px; border: 1px solid transparent;
  background: transparent; color: var(--text-secondary); cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: background 0.15s ease, border-color 0.15s ease;
}
.action-menu__btn:hover { background: var(--rb-surface-alt); border-color: var(--border); }
.action-menu__dropdown {
  position: absolute; right: 0; top: calc(100% + 4px); z-index: 30;
  width: 190px; background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; box-shadow: 0 12px 32px rgba(15,23,42,0.14);
  padding: 6px; display: flex; flex-direction: column;
}
.action-menu__item {
  display: flex; align-items: center; gap: 9px; padding: 9px 10px; border-radius: 8px;
  font-family: inherit; font-size: 13px; font-weight: 500; color: var(--text-primary);
  background: none; border: none; cursor: pointer; text-align: left; transition: background 0.12s ease;
}
.action-menu__item:hover { background: var(--rb-surface-alt); }
.action-menu__item--danger { color: var(--danger); }
.action-menu__item--danger:hover { background: rgba(var(--rb-accent-rgb), 0.07); }

/* Empty state */
.empty-state {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  padding: 64px 24px; gap: 6px;
}
.empty-state__icon {
  width: 76px; height: 76px; border-radius: 999px; background: var(--rb-surface-alt);
  display: flex; align-items: center; justify-content: center; margin-bottom: 10px;
}
.empty-state__title { font-size: 17px; font-weight: 700; color: var(--text-primary); margin: 0; }
.empty-state__desc { font-size: 13.5px; color: var(--text-secondary); max-width: 340px; margin: 0 0 14px; line-height: 1.5; }

/* Pagination */
.pagination {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 16px 24px; border-top: 1px solid var(--border); flex-wrap: wrap;
}
.pagination__rows { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text-secondary); }
.pagination__nav { display: flex; align-items: center; gap: 4px; margin-left: auto; }
.pagination__btn {
  display: inline-flex; align-items: center; gap: 4px; height: 34px; padding: 0 12px;
  border-radius: 9px; border: 1px solid var(--border); background: var(--surface);
  font-family: inherit; font-size: 12.5px; font-weight: 600; color: var(--text-secondary); cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.pagination__btn:hover:not(:disabled) { border-color: var(--rb-primary-text); color: var(--rb-primary-text); }
.pagination__btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pagination__page {
  width: 34px; height: 34px; border-radius: 9px; border: 1px solid transparent;
  background: transparent; font-family: inherit; font-size: 12.5px; font-weight: 600;
  color: var(--text-secondary); cursor: pointer; transition: background 0.15s ease, color 0.15s ease;
}
.pagination__page:hover { background: var(--rb-surface-alt); }
.pagination__page--active { background: var(--primary); color: #fff; }

/* Drawer */
.drawer-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,0.45); z-index: 50; }
.drawer {
  position: fixed; top: 0; right: 0; height: 100vh; width: 460px; max-width: 100vw;
  background: var(--surface); z-index: 51; display: flex; flex-direction: column;
  box-shadow: -12px 0 40px rgba(15,23,42,0.18);
}
.drawer__header {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 22px 24px; border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.drawer__eyebrow { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); margin: 0 0 4px; }
.drawer__title { font-size: 20px; font-weight: 700; color: var(--text-primary); margin: 0; }
.drawer__body { flex: 1; overflow-y: auto; padding: 22px 24px; display: flex; flex-direction: column; gap: 26px; }
.drawer__status-row { display: flex; gap: 8px; flex-wrap: wrap; }

.drawer__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 0; }
.drawer__field { display: flex; flex-direction: column; gap: 3px; }
.drawer__field--full { grid-column: 1 / -1; }
.drawer__field dt { font-size: 12px; font-weight: 600; color: var(--text-secondary); margin: 0; }
.drawer__field dd { font-size: 14px; font-weight: 500; color: var(--text-primary); margin: 0; line-height: 1.45; }

.drawer__section-title { font-size: 13.5px; font-weight: 700; color: var(--text-primary); margin: 0 0 14px; }
.v-timeline { display: flex; flex-direction: column; }
.v-timeline__row { display: flex; gap: 12px; }
.v-timeline__rail { display: flex; flex-direction: column; align-items: center; width: 20px; flex-shrink: 0; }
.v-timeline__dot {
  width: 20px; height: 20px; border-radius: 999px; background: var(--rb-border-strong); color: #fff;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.v-timeline__dot--done { background: var(--success); }
.v-timeline__dot--halted { background: var(--danger); }
.v-timeline__line { flex: 1; width: 2px; background: var(--border); margin: 2px 0; min-height: 22px; }
.v-timeline__line--done { background: var(--success); }
.v-timeline__body { padding-bottom: 18px; display: flex; align-items: center; }
.v-timeline__label { font-size: 13.5px; font-weight: 600; color: var(--text-primary); margin: 0; }
.v-timeline__label--muted { color: var(--text-muted); font-weight: 500; }

.drawer__footer { display: flex; gap: 10px; padding: 18px 24px; border-top: 1px solid var(--border); flex-shrink: 0; }

.drawer-slide-enter-active, .drawer-slide-leave-active { transition: transform 0.28s cubic-bezier(0.22,1,0.36,1); }
.drawer-slide-enter-from, .drawer-slide-leave-to { transform: translateX(100%); }
.drawer-fade-enter-active, .drawer-fade-leave-active { transition: opacity 0.2s ease; }
.drawer-fade-enter-from, .drawer-fade-leave-to { opacity: 0; }

/* Responsive */
@media (max-width: 1180px) {
  .filter-panel { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 1024px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .req-table__head { display: none; }
  .req-row {
    grid-template-columns: 1fr 1fr; row-gap: 10px; position: relative; padding: 16px 20px 44px;
  }
  .req-row > span::before {
    content: attr(data-label);
    display: block; font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.03em; color: var(--text-muted); margin-bottom: 3px;
  }
  .req-row__actions { position: absolute; bottom: 10px; right: 16px; }
  .req-row__actions::before { display: none; }
}
@media (max-width: 720px) {
  .filter-panel { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 640px) {
  .requests-page { padding: 20px 16px 32px; }
  .page-header { flex-direction: column; align-items: stretch; }
  .stats-grid { grid-template-columns: 1fr; }
  .filter-panel { grid-template-columns: 1fr; }
  .drawer { width: 100vw; }
  .page-title { font-size: 24px; }
}

.rows-select { width: 84px; }

/* The trend under a figure, beside its note. */
.stat-trend {
  display: flex; width: fit-content; align-items: center; gap: 3px; margin-top: 6px;
  font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 999px;
}
.stat-trend.up { color: var(--rb-success-text); background: rgba(var(--rb-success-rgb), 0.1); }
.stat-trend.down { color: var(--rb-accent-text); background: rgba(var(--rb-accent-rgb), 0.09); }
</style>
