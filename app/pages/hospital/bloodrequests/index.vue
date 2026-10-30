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
      <PageHeader title="Patient Request" subtitle="Create, monitor, and manage blood requests submitted to the Blood Center." />

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
        Blood requests for your patients. To restock your blood bank, send your
        <NuxtLink to="/hospital/receiving/weekly">weekly request</NuxtLink> under Receiving.
      </p>

      <!-- The list, as the centre's Donor Management draws it (project owner, 2026-10-30). -->
      <div v-if="loadError" class="banner banner--error" role="alert">
        <AssetIcon name="circle-alert" :size="16" />
        <p class="banner__text">Your requests could not be loaded.</p>
        <button type="button" class="btn-link" @click="refresh">Retry</button>
      </div>

      <section class="panel fade-in" style="--delay:100ms" aria-labelledby="requests-title">
        <h2 id="requests-title" class="sr-only">Your patient transfusion requests</h2>

        <div class="toolbar">
          <div class="toolbar__filters">
            <label class="search">
              <AssetIcon name="search" :size="15" class="search__icon" />
              <input
                v-model="searchQuery"
                type="search"
                class="search__input"
                placeholder="Search reference / type / component"
                aria-label="Search requests by reference number, blood type or component"
              >
            </label>
            <DateRangeFilter v-model:from="filters.dateFrom" v-model:to="filters.dateTo" aria-label="Requested between" />
            <SelectField v-model="filters.status" class="sel-filter" size="sm" aria-label="Filter by status"
              :options="[{ value: '', label: 'All statuses' }, ...Object.entries(statusMap).map(([k, v]) => ({ value: k, label: v.label }))]" />
            <SelectField v-model="filters.priority" class="sel-filter" size="sm" aria-label="Filter by priority"
              :options="[{ value: '', label: 'All priorities' }, ...Object.entries(priorityMap).map(([k, v]) => ({ value: k, label: v.label }))]" />
            <SelectField v-model="filters.component" class="sel-filter" size="sm" aria-label="Filter by component"
              :options="[{ value: '', label: 'All components' }, ...components.map((c) => ({ value: c, label: c }))]" />
          </div>

          <div class="toolbar__actions">
            <span v-if="updatedAt" class="updated" :title="`List loaded at ${updatedAtLabel}`">
              <AssetIcon name="clock" :size="13" />
              Updated {{ updatedAtLabel }}
            </span>

            <button
              type="button"
              class="btn-outline btn-outline--squeeze"
              :disabled="!filteredRequests.length"
              title="Export the listed requests (CSV)"
              @click="exportCsv"
            >
              <AssetIcon name="download" :size="14" />
              <span class="btn-text">Export</span>
            </button>

            <button
              type="button"
              class="btn-outline btn-outline--squeeze"
              :disabled="refreshing"
              aria-label="Refresh the list"
              :title="updatedAt ? `Refresh · updated ${updatedAtLabel}` : 'Refresh'"
              @click="refresh"
            >
              <AssetIcon name="refresh-cw" :size="14" :class="{ spin: refreshing }" />
              <span class="btn-text">Refresh</span>
            </button>

            <button v-if="canCreate" type="button" class="btn-primary" @click="openNewRequest">
              <AssetIcon name="plus" :size="15" />
              New Request
            </button>
          </div>
        </div>

        <div class="table-wrap" :class="{ 'table-wrap--busy': refreshing && allRequests.length }">
          <table class="list-table">
            <caption class="sr-only">Your patient transfusion requests, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col">Date</th>
                <th scope="col">Group</th>
                <th scope="col">Component</th>
                <th scope="col" class="num">Units</th>
                <th scope="col">Priority</th>
                <th scope="col">Status</th>
                <th scope="col">Progress</th>
                <th scope="col" class="c-actions">Actions</th>
              </tr>
            </thead>

            <tbody v-if="!pageItems.length">
              <tr>
                <td colspan="9" class="empty-cell">
                  <div class="empty-state">
                    <span class="empty-state__icon"><AssetIcon :name="hasActiveFilters ? 'search-x' : 'droplets'" :size="20" /></span>
                    <p class="empty-state__title">{{ hasActiveFilters ? 'No requests match' : 'No blood requests yet' }}</p>
                    <p class="empty-state__text">
                      {{ hasActiveFilters
                        ? 'Try another reference, type or component, or clear the filters.'
                        : 'Requests you raise for your patients appear here, with what each blood center supplied.' }}
                    </p>
                    <button v-if="hasActiveFilters" type="button" class="btn-outline" @click="resetFilters">Clear filters</button>
                    <button v-else-if="canCreate" type="button" class="btn-primary" @click="openNewRequest">
                      <AssetIcon name="plus" :size="15" />
                      New Request
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>

            <tbody v-else>
              <tr v-for="req in pageItems" :key="req.id" class="list-row">
                <td>
                  <div class="cell">
                    <button type="button" class="code code-btn" :title="`Quick view of ${req.reference_number}`" @click="openDrawer(req)">{{ req.reference_number }}</button>
                    <span v-if="req.is_walk_in" class="tag" title="Brought to the blood center by a watcher and confirmed by your blood bank by phone">Walk-in</span>
                    <span v-if="req.needs_allocation" class="tag tag--alert" title="Some units have not been asked of any facility">{{ req.unallocated }} unallocated</span>
                    <span v-if="req.awaiting_receipt" class="tag tag--alert" title="Dispatched by the blood center, not yet received">{{ req.awaiting_receipt }} to receive</span>
                  </div>
                </td>
                <td class="nowrap">{{ formatDate(req.request_date) }}</td>
                <td><span v-if="req.blood_type" class="blood">{{ req.blood_type }}</span><span v-else class="muted">—</span></td>
                <td>{{ req.component || '—' }}</td>
                <td class="num">{{ req.units }}</td>
                <td>
                  <!-- Only STAT is coloured; routine is the rule. -->
                  <span class="badge" :class="badgeClass(req.priority === 'emergency' ? 'danger' : 'muted')">
                    <span class="badge__dot" aria-hidden="true" />
                    {{ priorityOf(req.priority).label }}
                  </span>
                </td>
                <td>
                  <span class="badge" :class="badgeClass(statusOf(req.status).tone)">
                    <span class="badge__dot" aria-hidden="true" />
                    {{ req.status_text }}
                  </span>
                </td>
                <td>
                  <span class="step-dots" :title="progressLabel(req.status)" :aria-label="`Progress: ${progressLabel(req.status)}`">
                    <span v-for="(s, i) in progressSteps" :key="s"
                      class="step-dot"
                      :class="{
                        'step-dot--done': stepIndex(req.status) > i,
                        'step-dot--current': stepIndex(req.status) === i,
                        'step-dot--halted': isHalted(req.status)
                      }" />
                  </span>
                </td>
                <td class="c-actions">
                  <div class="row-actions">
                    <!-- Dispatched or picked up: the whole delivery into Stock Intake from here (project owner, 2026-10-30). -->
                    <button
                      v-if="canReceive && req.awaiting_receipt"
                      type="button"
                      class="btn-outline btn-outline--sm btn-receive"
                      :aria-label="`Receive ${req.awaiting_receipt} unit${req.awaiting_receipt === 1 ? '' : 's'} for ${req.reference_number}`"
                      @click="receiving = req"
                    >
                      <AssetIcon name="package-check" :size="14" />
                      Receive
                    </button>
                    <button type="button" class="icon-btn" :aria-label="`Quick view of ${req.reference_number}`" title="Quick view" @click="openDrawer(req)">
                      <AssetIcon name="eye" :size="15" />
                    </button>
                    <button type="button" class="icon-btn" :aria-label="`Full details and fulfilment of ${req.reference_number}`" title="Full details & fulfilment" @click="viewDetails(req)">
                      <AssetIcon name="file-text" :size="15" />
                    </button>
                    <button type="button" class="icon-btn" :aria-label="`Track ${req.reference_number}`" title="Track request" @click="trackRequest(req)">
                      <AssetIcon name="route" :size="15" />
                    </button>
                    <button
                      v-if="canCancel(req)"
                      type="button"
                      class="icon-btn icon-btn--danger"
                      :aria-label="`Cancel ${req.reference_number}`"
                      title="Cancel request"
                      @click="askCancel(req)"
                    >
                      <AssetIcon name="circle-x" :size="15" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ListPager :page="page" :last-page="lastPage" :from="from" :to="to" :total="total" @go="go" />
      </section>
    </div>

    <!-- CANCEL: confirmed here rather than in the browser's own box -->
    <div v-if="cancelling" class="confirm-backdrop" @click.self="cancelling = null">
      <div
        class="confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancel-title"
        aria-describedby="cancel-desc"
        v-focus-trap
        @dialog-escape="cancelling = null"
      >
        <h2 id="cancel-title" class="confirm__title">
          <AssetIcon name="circle-x" :size="17" />
          Cancel {{ cancelling.reference_number }}?
        </h2>
        <p id="cancel-desc" class="confirm__text">The blood centers stop working on it. This cannot be undone.</p>
        <div class="confirm__actions">
          <button type="button" class="btn-outline" @click="cancelling = null">Keep request</button>
          <button type="button" class="btn-primary btn-primary--danger" @click="confirmCancel">Cancel Request</button>
        </div>
      </div>
    </div>

    <HospitalReceiveDeliveryDialog
      v-if="receiving"
      kind="transfusion"
      :request-id="receiving.id"
      :reference="receiving.reference_number"
      @received="refresh"
      @close="receiving = null"
    />

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
          <button v-if="canCancel(selectedRequest)" type="button" class="ui-btn ui-btn--danger" @click="askCancel(selectedRequest)">
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
import AssetIcon from '~/components/common/AssetIcon.vue'
import ListPager from '~/components/common/ListPager.vue'
import DateRangeFilter from '~/components/common/DateRangeFilter.vue'
import { useListPager } from '~/composables/useListPager'
import { badgeClass } from '~/utils/listBadge'
import { componentSummary, requestStatusLabel } from '~/types/bloodRequest'
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { hospitalService } from '~/api/hospital/HospitalService'
import { canCancelTransfusion, transfusionProgressLabel } from '~/utils/transfusionSourcing'
import SelectField from '~/components/common/SelectField.vue'
import HospitalReceiveDeliveryDialog from '~/components/Hospital/ReceiveDeliveryDialog.vue'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard', requires: 'hospital.requests.view' })

const router = useRouter()
const route = useRoute()
const loading = ref(true)
const refreshing = ref(false)
const updatedAt = ref(null)

const { can } = useUser()
// Raising a request is Requesting Staff's and the Head's; the form's page needs it too.
const canCreate = computed(() => can('hospital.requests.manage'))
// Receiving is confirmed by whoever holds that ability; the server checks it too.
const canReceive = computed(() => can('hospital.receipt.confirm'))
// The row whose delivery is being received, in ReceiveDeliveryDialog.
const receiving = ref(null)

/*
 * A patient's need is a Patient Transfusion Request, possibly split across
 * several centres. Restocking the blood bank is the weekly request, which
 * lives under Receiving, so it is not listed here.
 */
const kind = ref('transfusion')

// ---------- Reference data ----------
const components =['Packed RBC', 'Whole Blood', 'Fresh Frozen Plasma', 'Platelet Concentrate', 'Cryoprecipitate']

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
    awaiting_receipt: r.totals?.awaiting_receipt ?? 0,
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
// The donors page's toolbar (project owner, 2026-10-30): search, dates, status,
// priority and component. The type is found through the search.
const searchQuery = ref('')
const filters = reactive({
  status: '',
  component: '',
  priority: '',
  dateFrom: '',
  dateTo: '',
})

const hasActiveFilters = computed(() =>
  Object.values(filters).some(v => v !== '') || searchQuery.value.trim() !== ''
)

function resetFilters() {
  filters.status = ''
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
    if (filters.component && r.component !== filters.component) return false
    if (filters.priority && r.priority !== filters.priority) return false
    if (filters.dateFrom && r.request_date < new Date(filters.dateFrom)) return false
    if (filters.dateTo && r.request_date > new Date(filters.dateTo + 'T23:59:59')) return false
    return true
  })
})

// ---------- Pagination ----------
const { page, total, lastPage, from, to, pageItems, go } = useListPager(filteredRequests)

// A new search or filter starts from the first page.
watch([searchQuery, () => ({ ...filters })], () => go(1))

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

// ---------- Drawer ----------
const drawerOpen = ref(false)
const selectedRequest = ref(null)
function openDrawer(req) {
  selectedRequest.value = req
  drawerOpen.value = true
}
function closeDrawer() {
  drawerOpen.value = false
}

// ---------- Row / global actions ----------
function openNewRequest() {
  router.push('/hospital/bloodrequests/newrequest')
}
function trackRequest(req) {
  // The page is /hospital/trackrequests; the hyphenated path this pushed to
  // has never existed, so "Track Request" landed on a 404.
  router.push(`/hospital/trackrequests?ref=${req.reference_number}`)
}
function viewDetails(req) {
  router.push(req.kind === 'transfusion' ? `/hospital/transfusion-requests/${req.id}` : `/hospital/bloodrequests/${req.id}`)
}

// A row's cancel is one click away, so it asks first, in the page's own dialog.
const cancelling = ref(null)
function askCancel(req) {
  cancelling.value = req
}
function confirmCancel() {
  const req = cancelling.value
  cancelling.value = null
  if (req) cancelRequest(req)
}

async function cancelRequest(req) {
  const previousStatus = req.status
  const previousText = req.status_text
  req.status = 'cancelled' // optimistic update
  req.status_text = statusOf('cancelled').label
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
  // The cancel and receive dialogs close on their own Escape.
  if (e.key === 'Escape' && drawerOpen.value && !cancelling.value && !receiving.value) closeDrawer()
}

const updatedAtLabel = computed(() => (updatedAt.value
  ? updatedAt.value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  : ''))

/** Reload the list in place, without the page's first-load skeleton. */
async function refresh() {
  refreshing.value = true
  try {
    await loadRequests({ quiet: true })
  } finally {
    refreshing.value = false
  }
}

async function loadRequests({ quiet = false } = {}) {
  if (!quiet) loading.value = true
  loadError.value = null
  try {
    // Filtered and paged here on the client, so take the most one page may
    // hold rather than the API's default of fifteen.
    const res = await hospitalService.listTransfusionRequests({ per_page: 100 })
    allRequests.value = (res?.data ?? []).map(normalizeTransfusion)
    updatedAt.value = new Date()
  } catch (err) {
    console.error('Failed to load blood requests:', err)
    loadError.value = err
    if (!quiet) allRequests.value = []
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
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<!-- The list: the blood centre's Donor Management structure (project owner, 2026-10-30). -->
<style scoped src="~/assets/css/list-ui.css"></style>

<style scoped>
.requests-page {
  --primary: var(--rb-primary);
  --surface: var(--rb-surface);
  --border: var(--rb-border);
  --text-primary: var(--rb-text-primary);
  --text-secondary: var(--rb-text-secondary);
  --text-muted: var(--rb-text-muted);
  --danger: var(--rb-accent);
  --success: var(--rb-success);
  font-family: var(--rb-font-sans);
  max-width: var(--rb-content-max, 1600px);
  background: var(--rb-page-bg);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
}

.page-inner { display: flex; flex-direction: column; gap: 16px; }

/* First-load skeleton */
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
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }

.fade-in { animation: fadeInUp 0.4s ease both; animation-delay: var(--delay, 0ms); }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .fade-in, .skeleton { animation: none !important; } }

.restock-note { margin: 0; font-size: 13px; color: var(--rb-text-secondary); }
.restock-note a { color: var(--rb-primary-text); font-weight: 600; }

/* The reference opens the quick view, as the eye does. */
.code-btn { align-self: flex-start; padding: 0; border: 0; background: none; cursor: pointer; }
.code-btn:hover { text-decoration: underline; }
.code-btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); border-radius: 4px; }

/* Receive: the row's one call to action, while units are on their way. */
.btn-receive { color: var(--rb-primary-text); border-color: rgba(var(--rb-primary-rgb), 0.45); background: rgba(var(--rb-primary-rgb), 0.06); }
.btn-receive:hover:not(:disabled) { background: rgba(var(--rb-primary-rgb), 0.12); }

.step-dots { display: inline-flex; align-items: center; gap: 3px; }
.step-dot { width: 7px; height: 7px; border-radius: 999px; background: var(--rb-border-strong); transition: background 0.2s ease, transform 0.2s ease; }
.step-dot--done { background: var(--success); }
.step-dot--current { background: var(--primary); transform: scale(1.3); }
.step-dot--halted { background: var(--danger); }

/* ---------- Cancel confirmation ---------- */
.confirm-backdrop {
  position: fixed; inset: 0; z-index: 320;
  display: grid; place-items: center; padding: 16px;
  background: var(--rb-overlay);
}
.confirm {
  width: min(440px, 100%);
  display: flex; flex-direction: column; gap: 12px;
  padding: 20px; border-radius: 14px;
  background: var(--rb-surface); border: 1px solid var(--rb-border);
  color: var(--rb-text-primary);
}
.confirm:focus { outline: none; }
.confirm__title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 16px; font-weight: 700; }
.confirm__text { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--rb-text-secondary); }
.confirm__actions { display: flex; justify-content: flex-end; gap: 10px; }
.btn-primary--danger { background: var(--rb-accent); border-color: var(--rb-accent); }
.btn-primary--danger:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-accent) 88%, #000); }

/* ---------- Drawer ---------- */
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
@media (max-width: 1024px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .requests-page { padding: 20px 16px 32px; }
  .stats-grid { grid-template-columns: 1fr; }
  .drawer { width: 100vw; }
  .confirm__actions { flex-direction: column-reverse; }
  .confirm__actions > * { width: 100%; }
}

/* The trend under a figure, beside its note. */
.stat-trend {
  display: flex; width: fit-content; align-items: center; gap: 3px; margin-top: 6px;
  font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 999px;
}
.stat-trend.up { color: var(--rb-success-text); background: rgba(var(--rb-success-rgb), 0.1); }
.stat-trend.down { color: var(--rb-accent-text); background: rgba(var(--rb-accent-rgb), 0.09); }
</style>
