<template>
  <div class="track-page">
    <!-- ============== PAGE HEADER ============== -->
    <PageHeader class="page-header" title="Track Requests" :subtitle="hospitalPageSubtitle('track', can)">
      <template #actions>
        <button
          class="ui-btn"
          type="button"
          :disabled="!request || isRefreshing"
          @click="handleRefresh"
        >
          <AssetIcon name="refresh-cw" :size="15" :class="{ spin: isRefreshing }" />
          <span>Refresh Status</span>
        </button>
      </template>
    </PageHeader>

    <!-- ============== SEARCH SECTION ============== -->
    <section class="card search-card">
      <div class="search-head">
        <h2 class="search-title">
          <span class="search-title__icon" aria-hidden="true"><AssetIcon name="route" :size="15" /></span>
          Track a request
        </h2>
        <p class="search-hint">Type or scan its reference: <span class="mono">RQ-…</span> for a blood center's share, <span class="mono">PTR-…</span> for a patient request.</p>
      </div>
      <form class="search-form" @submit.prevent="handleSearchSubmit">
        <div class="search-input-wrap">
          <AssetIcon name="search" class="search-icon" />
          <input
            v-model="referenceInput"
            type="text"
            class="search-input"
            @input="onSearchInput"
            placeholder="Reference, patient, or blood center"
            aria-label="Search by reference number"
            @focus="showRecentDropdown = true"
          />
          <button
            v-if="recentRequests.length"
            type="button"
            class="recent-toggle"
            aria-label="Show recent tracked requests"
            @click="showRecentDropdown = !showRecentDropdown"
          >
            <AssetIcon name="chevron-down" />
          </button>

          <div v-if="showRecentDropdown && recentRequests.length" class="recent-dropdown">
            <span class="recent-dropdown__label">Recent Tracked Requests</span>
            <button
              v-for="item in recentRequests"
              :key="item.reference_number"
              type="button"
              class="recent-item"
              @click="handleSelectRecent(item.reference_number)"
            >
              <span class="recent-item__ref">{{ item.reference_number }}</span>
              <span class="status-badge status-badge--sm" :class="`badge--${TONE_BADGES[REQUEST_STATUS_TONES[item.status]] ?? 'neutral'}`">
                {{ requestStatusLabel(item) }}
              </span>
            </button>
          </div>
        </div>
        <button type="submit" class="ui-btn ui-btn--primary search-btn" :disabled="isSearching">
          {{ isSearching ? 'Searching…' : 'Search' }}
        </button>
      </form>

      <SkeletonList v-if="isLoadingRecent" class="recent-loading" :rows="2" />
    </section>

    <!-- ============== EVERY REQUEST ============== -->
    <!-- Every request this blood bank raised, newest first, to open and follow
         (project owner, 2026-11-27): the search above narrows it as you type. -->
    <section v-if="!hasSearched" class="card list-card" aria-labelledby="all-title">
      <header class="list-card__head">
        <h2 id="all-title" class="section-title list-card__title">
          All requests
          <span class="list-card__count">{{ listMeta.total }}</span>
        </h2>
        <div class="status-tabs" role="group" aria-label="Show requests by status">
          <button
            v-for="tab in STATUS_TABS"
            :key="tab.value || 'all'"
            type="button"
            class="status-tab"
            :class="[`status-tab--${tab.tone}`, { 'status-tab--on': listStatus === tab.value }]"
            :aria-pressed="listStatus === tab.value"
            @click="setListStatus(tab.value)"
          >
            <span class="status-tab__dot" aria-hidden="true" />
            {{ tab.label }}
          </button>
        </div>
      </header>

      <p v-if="listError" class="list-card__error" role="alert">
        {{ listError }}
        <button type="button" class="btn-link" @click="loadList(listMeta.page)">Try again</button>
      </p>

      <div class="all-wrap" :class="{ 'all-wrap--busy': listLoading && listRows.length }">
        <table class="all-table">
          <caption class="sr-only">Every blood request from this blood bank</caption>
          <thead>
            <tr>
              <th scope="col">Reference</th>
              <th scope="col">Blood</th>
              <th scope="col" class="num">Units</th>
              <th scope="col">Blood center</th>
              <th scope="col">Submitted</th>
              <th scope="col">Status</th>
              <th scope="col"><span class="sr-only">Track</span></th>
            </tr>
          </thead>
          <tbody v-if="listLoading && !listRows.length">
            <tr v-for="n in 6" :key="n" aria-hidden="true">
              <td v-for="c in 7" :key="c"><span class="sk sk--line" :style="{ width: c === 7 ? '40px' : '70%' }" /></td>
            </tr>
          </tbody>
          <tbody v-else-if="!listRows.length">
            <tr>
              <td colspan="7">
                <EmptyState
                  :icon="referenceInput.trim() || listStatus ? 'search-x' : 'package-search'"
                  :title="referenceInput.trim() || listStatus ? 'No requests match' : 'No requests yet'"
                  :description="referenceInput.trim() || listStatus ? 'Try another reference or status.' : 'Requests your blood bank raises appear here, to follow from submission to receipt.'"
                  compact
                />
              </td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr
              v-for="item in listRows"
              :key="item.reference_number"
              class="all-row"
              :class="{ 'all-row--stat': item.urgency_level === 'emergency' }"
              tabindex="0"
              :aria-label="`Track ${item.reference_number}`"
              @click="handleSelectRecent(item.reference_number)"
              @keydown.enter.self="handleSelectRecent(item.reference_number)"
            >
              <td>
                <span class="all-ref mono">{{ item.reference_number }}</span>
                <span v-if="item.urgency_level === 'emergency'" class="all-stat">STAT</span>
              </td>
              <td>
                <span class="all-blood">
                  <span class="all-type">{{ bloodTypeSummary(item) }}</span>
                  <span class="all-comp">{{ componentSummary(item) || '—' }}</span>
                </span>
              </td>
              <td class="num">{{ item.quantity ?? '—' }}</td>
              <td class="all-center">{{ item.target_facility?.name || '—' }}</td>
              <td class="all-date">{{ formatDate(item.request_date) }}</td>
              <td>
                <span class="status-badge status-badge--sm" :class="`badge--${TONE_BADGES[REQUEST_STATUS_TONES[item.status]] ?? 'neutral'}`">{{ requestStatusLabel(item) }}</span>
              </td>
              <td class="all-go"><span>Track</span><AssetIcon name="arrow-right" :size="14" /></td>
            </tr>
          </tbody>
        </table>
      </div>

      <ListPager
        v-if="listMeta.total"
        :page="listMeta.page"
        :last-page="listMeta.lastPage"
        :from="listMeta.from"
        :to="listMeta.to"
        :total="listMeta.total"
        :busy="listLoading"
        @go="loadList"
      />
    </section>

    <!-- ============== ERROR STATE ============== -->
    <section v-else-if="searchError" class="card">
      <EmptyState
        icon="triangle-alert"
        title="Request Not Found"
        :description="searchError">
        <button class="ui-btn ui-btn--primary" type="button" @click="handleSearchSubmit">Search Again</button>
      </EmptyState>
    </section>

    <!-- ============== SEARCHING SKELETON ============== -->
    <PageSkeleton v-else-if="isSearching && !request" :sections="[['form'], ['list', 'list']]" />

    <!-- ============== MAIN TRACKING VIEW ============== -->
    <template v-else-if="request">
      <!-- WHERE IT IS: the reference, what was asked, and each step with its time -->
      <button type="button" class="back-to-list" @click="backToList">
        <AssetIcon name="arrow-left" :size="14" />
        All requests
      </button>

      <section class="card hero-card">
        <div class="hero-card__top">
          <span class="hero-ref">{{ request.reference_number }}</span>
          <div class="hero-badges">
            <span class="status-badge status-badge--anim" :class="statusColorClass">{{ statusText }}</span>
            <span class="status-badge status-badge--sm" :class="priorityColorClass">{{ priorityText }} priority</span>
            <span v-if="request.is_walk_in" class="status-badge status-badge--sm badge--info">Walk-in</span>
            <span v-if="hasAttentionFlag" class="attention-chip">
              <AssetIcon name="circle-alert" />
              Needs attention
            </span>
          </div>
        </div>

        <div class="hero-grid">
          <div class="hero-item">
            <span class="hero-label">Blood Type</span>
            <span class="hero-value hero-value--emphasis">{{ bloodTypeSummary(request) }}</span>
          </div>
          <div class="hero-item">
            <span class="hero-label">Blood Component</span>
            <span class="hero-value">{{ componentSummary(request) || '—' }}</span>
          </div>
          <div class="hero-item">
            <span class="hero-label">Units Requested</span>
            <span class="hero-value">{{ request.quantity ?? '—' }}</span>
          </div>
          <div class="hero-item">
            <span class="hero-label">Blood Center</span>
            <span class="hero-value">{{ request.target_facility?.name || '—' }}</span>
          </div>
          <div class="hero-item">
            <span class="hero-label">Submitted</span>
            <span class="hero-value">{{ formatDate(request.request_date) }}</span>
          </div>
        </div>

        <ol class="stepper">
          <li
            v-for="(step, index) in timeline"
            :key="step.step || index"
            class="stepper-step"
            :class="`stepper-step--${step.status}`"
          >
            <span class="stepper-marker">
              <AssetIcon v-if="step.status === 'completed'" name="check" />
              <span v-else>{{ index + 1 }}</span>
            </span>
            <span class="stepper-label">{{ step.label }}</span>
            <span v-if="step.timestamp" class="stepper-time">{{ formatDateTime(step.timestamp) }}</span>
          </li>
        </ol>
      </section>

      <div class="content-grid">
        <div class="content-main">
          <section class="card">
            <h2 class="section-title">Requested vs Fulfilled</h2>
            <RequestFulfilmentTable :request="request" />
          </section>

          <!-- WHERE IT CAME FROM, AND WHAT IT IS A SHARE OF -->
          <section v-if="request.is_walk_in || request.transfusion_request" class="card">
            <h2 class="section-title">Source &amp; Blood Request</h2>
            <p v-if="request.is_walk_in" class="empty-hint track-walk-in">
              A watcher brought this request to {{ request.target_facility?.name || 'the blood center' }}, which recorded
              it<template v-if="request.walk_in?.verification"> after your blood bank confirmed it by phone</template><template v-else> on your behalf</template>.
            </p>
            <p v-if="request.transfusion_request" class="empty-hint track-walk-in">
              This is {{ request.target_facility?.name || 'one facility' }}'s share of
              <NuxtLink :to="`/hospital/transfusion-requests/${request.transfusion_request.id}`" class="track-ptr">{{ request.transfusion_request.reference_number }}</NuxtLink>
              ({{ requestStatusLabel(request.transfusion_request) }}), where every facility asked for this patient is followed.
            </p>
          </section>

          <section class="card">
            <h2 class="section-title">Request Information</h2>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Hospital</span>
                <span class="info-value">{{ request.requesting_facility?.name || '—' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Patient</span>
                <span class="info-value">{{ request.patient?.full_name || '—' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Requested by</span>
                <span class="info-value">{{ request.requester_name || request.recorder_name || '—' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Source</span>
                <span class="info-value">{{ request.source_label || '—' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Priority</span>
                <span class="info-value">{{ request.urgency_label || '—' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Purpose</span>
                <span class="info-value">{{ request.purpose_label || '—' }}</span>
              </div>
            </div>
          </section>

          <section class="card">
            <h2 class="section-title">Latest Updates</h2>
            <ul v-if="updates.length" class="updates-list">
              <li v-for="update in updates" :key="`${update.label}-${update.at}`" class="update-item">
                <span class="update-icon" :class="`update-icon--${update.tone}`">
                  <AssetIcon :name="update.tone === 'danger' ? 'circle-x' : update.tone === 'success' ? 'check' : 'clock'" />
                </span>
                <div class="update-body">
                  <p class="update-desc">{{ update.label }}</p>
                  <p v-if="update.detail" class="update-desc update-desc--note">{{ update.detail }}</p>
                  <span class="update-time">{{ formatDateTime(update.at) }}</span>
                </div>
              </li>
            </ul>
            <p v-else class="empty-hint">No updates yet from the Blood Center.</p>
          </section>
        </div>

        <aside class="content-side">
          <section class="card side-card">
            <h3 class="side-card__title">Progress</h3>
            <div class="progress-circle-wrap">
              <svg class="progress-circle" viewBox="0 0 100 100">
                <circle class="progress-circle__track" cx="50" cy="50" :r="circleRadius" />
                <circle
                  class="progress-circle__fill"
                  cx="50"
                  cy="50"
                  :r="circleRadius"
                  :stroke-dasharray="circleCircumference"
                  :stroke-dashoffset="circleOffset"
                />
              </svg>
              <span class="progress-circle__label">{{ progressPercent }}%</span>
            </div>
          </section>

          <!-- THE UNITS ON THEIR WAY: kept in view on every live request, saying
               so when nothing is released yet, rather than vanishing (2026-11-27).
               Laid out as a shipment: where from, how many, when (2026-11-27). -->
          <section v-if="pickup?.facility && !['rejected', 'cancelled'].includes(request?.status)" class="card side-card ship" aria-labelledby="ship-title">
            <header class="ship__head">
              <span class="ship__icon" aria-hidden="true"><AssetIcon name="truck" :size="16" /></span>
              <h3 id="ship-title" class="ship__title">On the way</h3>
              <span
                v-if="pickup.units_dispatched"
                class="ship__chip"
                :class="pickup.awaiting_confirmation ? 'ship__chip--wait' : 'ship__chip--done'"
              >
                <AssetIcon :name="pickup.awaiting_confirmation ? 'clock' : 'check'" :size="12" />
                {{ pickup.awaiting_confirmation ? 'To confirm' : 'All received' }}
              </span>
            </header>

            <div class="ship__from">
              <span class="ship__from-icon" aria-hidden="true"><AssetIcon name="hospital" :size="15" /></span>
              <div class="ship__from-text">
                <span class="ship__label">From</span>
                <span class="ship__name">{{ pickup.facility }}</span>
                <span v-if="pickup.address" class="ship__addr">{{ pickup.address }}</span>
              </div>
            </div>

            <p v-if="!pickup.units_dispatched" class="pickup-wait">
              <AssetIcon name="clock" :size="14" />
              Nothing released yet. The units show here once the blood center releases them.
            </p>
            <template v-else>
              <dl class="ship__figs">
                <div class="ship__fig">
                  <dt>Dispatched</dt>
                  <dd>{{ pickup.units_dispatched }} <span>unit{{ pickup.units_dispatched === 1 ? '' : 's' }}</span></dd>
                </div>
                <div class="ship__fig" :class="{ 'ship__fig--wait': pickup.awaiting_confirmation }">
                  <dt>To confirm</dt>
                  <dd>{{ pickup.awaiting_confirmation }} <span>unit{{ pickup.awaiting_confirmation === 1 ? '' : 's' }}</span></dd>
                </div>
              </dl>
              <p v-if="pickup.dispatched_at" class="ship__when">
                <AssetIcon name="clock" :size="13" />
                Released {{ formatDateTime(pickup.dispatched_at) }}
              </p>
            </template>
          </section>

          <section class="card side-card">
            <h3 class="side-card__title">Quick Actions</h3>
            <div class="quick-actions">
              <button class="ui-btn ui-btn--primary btn--full" type="button" @click="viewRequestDetails">
                <AssetIcon name="eye" />
                <span>View Request Details</span>
              </button>
              <button class="ui-btn ui-btn--download btn--full quick-btn" type="button" @click="handleDownloadPdf">
                <AssetIcon name="download" />
                <span>Download PDF</span>
              </button>
              <button class="ui-btn btn--full quick-btn" type="button" @click="handlePrint">
                <AssetIcon name="printer" />
                <span>Print</span>
              </button>
              <button
                class="ui-btn btn--full quick-btn"
                type="button"
                :disabled="!centerContact"
                @click="contactBloodCenter"
              >
                <AssetIcon name="phone" />
                <span>Contact Blood Center</span>
              </button>
            </div>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>

<script setup>
import SkeletonList from '~/components/ui/SkeletonList.vue'
import PageSkeleton from '~/components/ui/PageSkeleton.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import EmptyState from '~/components/ui/EmptyState.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import RequestFulfilmentTable from '~/components/common/RequestFulfilmentTable.vue'
import ListPager from '~/components/common/ListPager.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import { bloodTypeSummary, componentSummary, PRIORITY_LABELS, REQUEST_STATUS_TONES, requestStatusLabel } from '~/types/bloodRequest'
import { hospitalPageSubtitle } from '~/utils/hospitalPageSubtitles'
import { onPageReturn } from '~/composables/useKeptAlive'

const { can } = useUser()
/**
 * /hospital/track-requests
 * Tracking-only page (NOT a management page) for Hospital Blood Bank staff.
 *
 * - Sidebar / global header untouched (layout handles those).
 * - No routing or backend logic modified.
 * - Nothing is hardcoded: recent requests, searched request, timeline,
 *   updates, documents, and pickup info all come from useTrackRequests().
 */

definePageMeta({
  middleware: ['auth', 'hospital-portal'],
  layout: 'hospitaldashboard',
  requires: 'hospital.requests.view',
  keepalive: true,
})

const route = useRoute()

const {
  referenceInput,
  recentRequests,
  isLoadingRecent,
  request,
  timeline,
  updates,
  pickup,
  progressPercent,
  isSearching,
  hasSearched,
  searchError,
  fetchRecent,
  searchByReference,
  selectRecent,
  refreshStatus,
  clearSearch,
} = useTrackRequests()

// ── Every request, as a list (2026-11-27) ──
const STATUS_TABS = [
  { value: '', label: 'All', tone: 'neutral' },
  { value: 'pending', label: 'Pending', tone: 'info' },
  { value: 'processing', label: 'Processing', tone: 'progress' },
  { value: 'partial', label: 'Partially fulfilled', tone: 'warning' },
  { value: 'fulfilled', label: 'Fulfilled', tone: 'success' },
  { value: 'rejected', label: 'Rejected', tone: 'danger' },
  { value: 'cancelled', label: 'Cancelled', tone: 'muted' },
]
const LIST_PER_PAGE = 15
const listRows = ref([])
const listLoading = ref(false)
const listError = ref('')
const listStatus = ref('')
const listMeta = reactive({ page: 1, lastPage: 1, from: 0, to: 0, total: 0 })
let listSeq = 0

async function loadList(page = 1) {
  const seq = ++listSeq
  listLoading.value = true
  listError.value = ''
  try {
    const search = referenceInput.value.trim()
    const res = await hospitalService.listRequests({
      page,
      per_page: LIST_PER_PAGE,
      ...(listStatus.value ? { status: listStatus.value } : {}),
      ...(search ? { search } : {}),
    })
    if (seq !== listSeq) return
    listRows.value = res?.data ?? []
    listMeta.page = res?.current_page ?? page
    listMeta.lastPage = Math.max(1, res?.last_page ?? 1)
    listMeta.total = res?.total ?? listRows.value.length
    listMeta.from = listMeta.total ? (listMeta.page - 1) * (res?.per_page ?? LIST_PER_PAGE) + 1 : 0
    listMeta.to = Math.min(listMeta.page * (res?.per_page ?? LIST_PER_PAGE), listMeta.total)
  } catch (err) {
    if (seq === listSeq) listError.value = err?.message || 'Your requests could not be loaded.'
  } finally {
    if (seq === listSeq) listLoading.value = false
  }
}

function setListStatus(value) {
  listStatus.value = listStatus.value === value ? '' : value
  loadList(1)
}

// Typing narrows the list; a pause, then one call.
let searchTimer = null
function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { if (!hasSearched.value) loadList(1) }, 300)
}
onBeforeUnmount(() => clearTimeout(searchTimer))

/** From a request back to every request. */
function backToList() {
  clearSearch()
  loadList(listMeta.page)
}

const showRecentDropdown = ref(false)
const isRefreshing = ref(false)

// Allow deep-linking: /hospital/track-requests?ref=BBR-2026-000125
let appliedRef = ''
function openFromLink() {
  const prefill = typeof route.query.ref === 'string' ? route.query.ref : ''
  const fresh = prefill && prefill !== appliedRef
  appliedRef = prefill
  if (!fresh) return false
  referenceInput.value = prefill
  searchByReference(prefill)
  return true
}

onMounted(() => {
  fetchRecent()
  loadList(1)
  openFromLink()
})

// Kept alive: back here, the recent list reloads, and the request on screen
// is looked up again, unless a new link asks for another.
onPageReturn(() => {
  fetchRecent()
  loadList(listMeta.page)
  if (!openFromLink()) handleRefresh()
})

/*
 * Keyed on the stored status through the shared tone map. The map this page
 * carried was keyed on Title Case values the API has never sent, so every badge
 * fell through to neutral and a rejection never raised the attention flag.
 */
const TONE_BADGES = { info: 'info', progress: 'info', warning: 'warning', success: 'success', danger: 'danger', muted: 'neutral' }

const statusColorClass = computed(() => `badge--${TONE_BADGES[REQUEST_STATUS_TONES[request.value?.status]] ?? 'neutral'}`)

const statusText = computed(() => (request.value ? requestStatusLabel(request.value) : '—'))

const priorityText = computed(() => (request.value?.urgency_level ? PRIORITY_LABELS[request.value.urgency_level] : '—'))

const priorityColorClass = computed(() =>
  request.value?.urgency_level === 'emergency' ? 'badge--danger' : 'badge--neutral',
)

const hasAttentionFlag = computed(() => request.value?.status === 'rejected')

// Progress circle geometry
const circleRadius = 42
const circleCircumference = 2 * Math.PI * circleRadius
const circleOffset = computed(() => circleCircumference * (1 - progressPercent.value / 100))

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatTime(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return `${formatDate(value)} · ${formatTime(value)}`
}

function handleSearchSubmit() {
  showRecentDropdown.value = false
  searchByReference(referenceInput.value)
}

function handleSelectRecent(refNumber) {
  showRecentDropdown.value = false
  referenceInput.value = refNumber
  selectRecent(refNumber)
}

async function handleRefresh() {
  if (!request.value) return
  isRefreshing.value = true
  await refreshStatus()
  isRefreshing.value = false
}

function handlePrint() {
  window.print()
}

/**
 * Produce a copy of the tracked request.
 *
 * The browser's print dialogue, for the same reason as on the detail page: the
 * `/download` endpoint this used to call does not exist, and the helper it
 * called it through is not defined anywhere in the repository.
 */
function handleDownloadPdf() {
  if (!request.value) return
  window.print()
}

function viewRequestDetails() {
  if (!request.value) return
  navigateTo(`/hospital/bloodrequests/${request.value.id}`)
}

// The blood center's number, when the request carries one.
const centerContact = computed(() => request.value?.target_facility?.contact_number || request.value?.target_facility?.email || '')

function contactBloodCenter() {
  const contact = centerContact.value
  if (!contact) return
  const isEmail = contact.includes('@')
  window.location.href = isEmail ? `mailto:${contact}` : `tel:${contact.replace(/\s+/g, '')}`
}
</script>

<style scoped>
.track-page {
  max-width: var(--rb-content-max, 1600px);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  background: var(--rb-page-bg);
  min-height: 100%;
  animation: page-fade-in 0.25s ease;
}
@keyframes page-fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ---------- Header ---------- */
.page-header { margin-bottom: 20px; }
.page-header-old {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.page-title {
  font-family: var(--rb-font-sans);
  font-size: 30px;
  font-weight: 700;
  color: var(--rb-text-primary);
  margin: 0 0 4px;
}
.page-subtitle {
  font-size: 15px;
  color: var(--rb-text-secondary);
  margin: 0;
}

/* ---------- Buttons ---------- */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 10px;
  padding: 10px 18px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
  text-decoration: none;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn:active:not(:disabled) {
  transform: scale(0.98);
}
.btn--primary {
  background: var(--rb-primary);
  color: #fff;
}
.btn--primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--rb-primary) 88%, #000);
}
.btn--outline {
  background: var(--rb-surface);
  color: var(--rb-primary-text);
  border-color: var(--rb-border);
}
.btn--outline:hover:not(:disabled) {
  background: rgba(var(--rb-primary-rgb), 0.06);
  border-color: var(--rb-primary);
}
.btn--full {
  width: 100%;
}
.btn--sm {
  padding: 6px 12px;
  font-size: 13px;
}
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ---------- Cards ---------- */
.card {
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: var(--rb-radius-lg);
  padding: 24px;
  box-shadow: var(--rb-shadow-sm);
  margin-bottom: 20px;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.card:hover {
  box-shadow: var(--rb-shadow-sm);
}
.section-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--rb-text-primary);
  margin: 0 0 18px;
}

/* ---------- Search card ---------- */
.search-card {
  padding: 20px 24px;
}
.search-head { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }
.search-title { display: flex; align-items: center; gap: 9px; margin: 0; font-size: 15px; font-weight: 700; color: var(--rb-text-primary); }
.search-title__icon { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; background: rgba(var(--rb-primary-rgb), .1); color: var(--rb-primary-text); }
.search-hint { margin: 0; font-size: 12.5px; color: var(--rb-text-secondary); }
/* References keep the portal's font, with figures that line up (2026-11-27). */
.mono { font-variant-numeric: tabular-nums; }
.search-hint .mono { font-weight: 700; color: var(--rb-text-primary); }
.search-form {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.search-input-wrap {
  position: relative;
  flex: 1 1 320px;
  display: flex;
  align-items: center;
}
.search-icon {
  position: absolute;
  left: 14px;
  color: var(--rb-text-muted);
}
.search-input {
  width: 100%;
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  height: 44px;
  padding: 0 40px 0 42px;
  font: inherit;
  font-size: 14px;
  color: var(--rb-text-primary);
  background: var(--rb-surface-alt);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.search-input:focus {
  outline: none;
  border-color: var(--rb-primary);
  box-shadow: 0 0 0 3px rgba(21, 101, 192, 0.12);
}
.recent-toggle {
  position: absolute;
  right: 10px;
  background: none;
  border: none;
  color: var(--rb-text-muted);
  cursor: pointer;
  padding: 6px;
}
.search-btn {
  flex: 0 0 auto;
  min-width: 120px;
  height: 44px;
}
.recent-loading {
  margin-top: 10px;
  font-size: 13px;
  color: var(--rb-text-muted);
}

.recent-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  box-shadow: 0 12px 28px rgba(20, 30, 50, 0.14);
  padding: 10px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.recent-dropdown__label {
  font-size: 11px;
  font-weight: 700;
  color: var(--rb-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 6px 10px 2px;
}
.recent-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: none;
  border: none;
  border-radius: 10px;
  padding: 10px;
  font-size: 14px;
  color: var(--rb-text-primary);
  cursor: pointer;
  text-align: left;
}
.recent-item:hover {
  background: rgba(var(--rb-primary-rgb), 0.06);
}
.recent-item__ref {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

/* ---------- Status badges ---------- */
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}
.status-badge--sm {
  padding: 4px 10px;
  font-size: 12px;
}
.status-badge--anim {
  animation: badge-pop 0.35s ease;
}
@keyframes badge-pop {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.badge--success { background: rgba(var(--rb-success-rgb), .1); color: var(--rb-success-text); }
.badge--warning { background: rgba(var(--rb-warning-rgb), .14); color: var(--rb-warning-text); }
.badge--danger { background: rgba(var(--rb-accent-rgb), .09); color: var(--rb-accent-text); }
.badge--info { background: rgba(var(--rb-primary-rgb), .1); color: var(--rb-primary-text); }
.badge--neutral { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }

.attention-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(211, 47, 47, 0.1);
  color: var(--rb-accent-text);
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 600;
}

/* ---------- Hero card ---------- */
.hero-card {
  background: linear-gradient(135deg, var(--rb-surface) 0%, rgba(var(--rb-primary-rgb), 0.06) 100%);
}
.hero-ref {
  font-variant-numeric: tabular-nums;
  font-size: 20px;
  font-weight: 700;
  color: var(--rb-text-primary);
}
.hero-badges {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 10px;
}
.hero-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 20px;
  margin-top: 22px;
}
.hero-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hero-label {
  font-size: 12px;
  color: var(--rb-text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.hero-value {
  font-size: 15px;
  font-weight: 600;
  color: var(--rb-text-primary);
}
.hero-value--emphasis {
  font-size: 22px;
  font-weight: 700;
  color: var(--rb-primary-text);
}

/* ---------- Horizontal stepper ---------- */
.stepper {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
  gap: 0;
}
.stepper-step {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  position: relative;
  text-align: center;
}
.stepper-step:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 15px;
  left: 55%;
  width: 90%;
  height: 2px;
  background: var(--rb-border);
  z-index: 0;
}
.stepper-step--completed:not(:last-child)::after {
  background: var(--rb-success);
}
.stepper-marker {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--rb-surface-alt);
  color: var(--rb-text-muted);
  font-size: 13px;
  font-weight: 700;
  z-index: 1;
  transition: background 0.4s ease, color 0.4s ease, transform 0.2s ease;
}
.stepper-step--completed .stepper-marker {
  background: var(--rb-success);
  color: #fff;
}
.stepper-step--current .stepper-marker {
  background: var(--rb-primary);
  color: #fff;
  transform: scale(1.15);
  box-shadow: 0 0 0 5px rgba(21, 101, 192, 0.15);
}
.stepper-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  max-width: 100px;
}
.stepper-step--current .stepper-label {
  color: var(--rb-primary-text);
}
.stepper-step--completed .stepper-label {
  color: var(--rb-success-text);
}

/* ---------- Content grid ---------- */
.content-grid {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 20px;
  align-items: start;
}
.content-main { min-width: 0; }
.content-side { display: flex; flex-direction: column; }

/* ---------- Info grid ---------- */
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18px;
}
.info-item { display: flex; flex-direction: column; gap: 4px; }
.info-item--full { grid-column: 1 / -1; }
.info-label {
  font-size: 12px;
  color: var(--rb-text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.info-value { font-size: 14px; color: var(--rb-text-primary); line-height: 1.5; }
.info-value--mono { font-variant-numeric: tabular-nums; }

/* ---------- Vertical timeline ---------- */
.v-timeline { list-style: none; margin: 0; padding: 0; }
.v-timeline-step {
  display: flex;
  gap: 14px;
  position: relative;
  padding-bottom: 26px;
  animation: timeline-reveal 0.4s ease both;
}
@keyframes timeline-reveal {
  from { opacity: 0; transform: translateX(-6px); }
  to { opacity: 1; transform: translateX(0); }
}
.v-timeline-step:last-child { padding-bottom: 0; }
.v-timeline-step::before {
  content: '';
  position: absolute;
  left: 11px;
  top: 24px;
  bottom: 0;
  width: 2px;
  background: var(--rb-border);
}
.v-timeline-step:last-child::before { display: none; }
.v-timeline-marker {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--rb-surface-alt);
  color: var(--rb-text-muted);
  z-index: 1;
}
.v-timeline-dot { width: 8px; height: 8px; border-radius: 999px; background: currentColor; }
.v-timeline-step--completed .v-timeline-marker { background: var(--rb-success); color: #fff; }
.v-timeline-step--completed::before { background: var(--rb-success); }
.v-timeline-step--current .v-timeline-marker {
  background: var(--rb-primary);
  color: #fff;
  box-shadow: 0 0 0 4px rgba(21, 101, 192, 0.15);
}
.v-timeline-body { display: flex; flex-direction: column; gap: 3px; padding-top: 1px; }
.v-timeline-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.v-timeline-activity { font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.v-timeline-step--upcoming .v-timeline-activity { color: var(--rb-text-muted); font-weight: 600; }
.v-timeline-tag {
  font-size: 11px;
  font-weight: 700;
  color: var(--rb-primary-text);
  background: rgba(var(--rb-primary-rgb), 0.1);
  padding: 2px 8px;
  border-radius: 999px;
}
.v-timeline-tag--pending { color: var(--rb-text-secondary); background: var(--rb-surface-alt); }
.v-timeline-time { font-size: 12px; color: var(--rb-text-muted); }
.v-timeline-desc { font-size: 13px; color: var(--rb-text-secondary); margin: 2px 0 0; }

/* ---------- Updates / notifications ---------- */
.updates-list, .notif-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.update-item { display: flex; gap: 12px; }
.update-icon {
  width: 32px; height: 32px; border-radius: 999px;
  background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.update-body { display: flex; flex-direction: column; gap: 2px; }
.update-desc { font-size: 14px; color: var(--rb-text-primary); margin: 0; }
.update-time { font-size: 12px; color: var(--rb-text-muted); }

.notif-item { display: flex; gap: 10px; align-items: flex-start; }
.notif-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--rb-primary); margin-top: 6px; flex-shrink: 0; }
.notif-desc { font-size: 13px; color: var(--rb-text-primary); margin: 0; }
.notif-time { font-size: 11px; color: var(--rb-text-muted); }

.empty-hint { font-size: 13px; color: var(--rb-text-muted); margin: 0; }
.track-walk-in { margin-bottom: 10px; color: var(--rb-text-secondary); }
.track-ptr { font-variant-numeric: tabular-nums; font-weight: 700; color: var(--rb-primary-text); }

/* ---------- Documents ---------- */
.documents-table { display: flex; flex-direction: column; gap: 10px; }
.documents-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: var(--rb-surface-alt);
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  flex-wrap: wrap;
}
.documents-row__label { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--rb-text-primary); font-weight: 600; }
.documents-row__actions { display: flex; gap: 8px; }

/* ---------- Sidebar cards ---------- */
.side-card__title { font-size: 16px; font-weight: 700; color: var(--rb-text-primary); margin: 0 0 16px; }
.side-card__row { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; }

.progress-circle-wrap {
  position: relative;
  width: 120px;
  height: 120px;
  margin: 0 auto 12px;
}
.progress-circle { width: 100%; height: 100%; transform: rotate(-90deg); }
.progress-circle__track { fill: none; stroke: var(--rb-surface-alt); stroke-width: 8; }
.progress-circle__fill {
  fill: none;
  stroke: var(--rb-primary);
  stroke-width: 8;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.6s ease;
}
.progress-circle__label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  color: var(--rb-primary-text);
}

.pickup-rows { display: flex; flex-direction: column; gap: 12px; }
.pickup-row { display: flex; flex-direction: column; gap: 3px; }
/* On the way, as a shipment (2026-11-27). */
.ship { display: flex; flex-direction: column; gap: 14px; }
.ship__head { display: flex; align-items: center; gap: 10px; }
.ship__icon { display: grid; flex: none; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: rgba(var(--rb-primary-rgb), .1); color: var(--rb-primary-text); }
.ship__title { flex: 1; margin: 0; font-size: 16px; font-weight: 700; color: var(--rb-text-primary); }
.ship__chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
.ship__chip--wait { background: rgba(var(--rb-warning-rgb, 217, 119, 6), .12); color: var(--rb-warning-text, #B45309); }
.ship__chip--done { background: rgba(var(--rb-success-rgb, 22, 163, 74), .12); color: var(--rb-success-text, #15803D); }
.ship__from { display: flex; gap: 10px; padding: 12px; border: 1px solid var(--rb-border); border-radius: 12px; }
.ship__from-icon { display: grid; flex: none; place-items: center; width: 28px; height: 28px; border-radius: 8px; background: var(--rb-surface-alt); color: var(--rb-text-secondary); }
.ship__from-text { display: flex; flex-direction: column; min-width: 0; gap: 1px; }
.ship__label { font-size: 12px; color: var(--rb-text-muted); }
.ship__name { font-size: 14px; font-weight: 600; line-height: 1.35; color: var(--rb-text-primary); }
.ship__addr { font-size: 12.5px; color: var(--rb-text-secondary); }
.ship__figs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 0; }
.ship__fig { padding: 10px 12px; border-radius: 12px; background: var(--rb-surface-alt); }
.ship__fig dt { font-size: 12px; color: var(--rb-text-secondary); }
.ship__fig dd { margin: 2px 0 0; font-size: 20px; font-weight: 800; line-height: 1.2; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.ship__fig dd span { font-size: 12px; font-weight: 600; color: var(--rb-text-muted); }
.ship__fig--wait { background: rgba(var(--rb-warning-rgb, 217, 119, 6), .1); }
.ship__fig--wait dd { color: var(--rb-warning-text, #B45309); }
.ship__when { display: flex; align-items: center; gap: 6px; margin: 0; padding-top: 12px; border-top: 1px solid var(--rb-border); font-size: 12.5px; color: var(--rb-text-secondary); }
.ship__when :deep(svg) { color: var(--rb-text-muted); }
.pickup-wait { display: flex; align-items: flex-start; gap: 8px; margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--rb-surface-alt); font-size: 12.5px; line-height: 1.45; color: var(--rb-text-secondary); }
.pickup-wait :deep(svg) { flex: none; margin-top: 2px; color: var(--rb-text-muted); }
.countdown-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  background: rgba(124, 58, 237, 0.1);
  color: var(--rb-purple-text);
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 700;
}

.quick-actions { display: flex; flex-direction: column; gap: 10px; }
.quick-btn :deep(svg) { color: var(--rb-primary-text); }
.quick-btn:hover:not(:disabled) { border-color: rgba(var(--rb-primary-rgb), .45); color: var(--rb-primary-text); }

/* ---------- Empty / error states ---------- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 70px 20px;
  color: var(--rb-text-secondary);
}
.empty-state__icon { width: 48px; height: 48px; color: var(--rb-text-muted); margin-bottom: 14px; }
.empty-state h3 { font-size: 18px; color: var(--rb-text-primary); margin: 0 0 4px; }
.empty-state p { font-size: 14px; margin: 0 0 20px; }
.empty-state--error h3 { color: var(--rb-accent-text); }
.empty-state--error .empty-state__icon { color: var(--rb-accent-text); }

/* ---------- Skeletons ---------- */
.skeleton {
  background: linear-gradient(90deg, var(--rb-surface-alt) 25%, var(--rb-surface-hover) 37%, var(--rb-surface-alt) 63%);
  background-size: 400% 100%;
  animation: skeleton-shimmer 1.4s ease infinite;
  border-radius: 18px;
}
@keyframes skeleton-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}
.skeleton-stack { display: flex; flex-direction: column; gap: 20px; }
.skeleton--hero { height: 180px; }
.skeleton--stepper { height: 90px; }

/* ---------- Dark mode ---------- */

/* ---------- Responsive ---------- */
@media (max-width: 1080px) {
  .content-grid { grid-template-columns: 1fr; }
  .content-side { order: -1; }
}
@media (max-width: 900px) {
  .hero-grid { grid-template-columns: repeat(2, 1fr); }
  .stepper-label { display: none; }
}
@media (max-width: 640px) {
  .track-page { padding: 16px; }
  .info-grid { grid-template-columns: 1fr; }
  .search-form { flex-direction: column; }
  .search-btn { width: 100%; }
  .content-side { order: 0; }
  .content-main { order: 1; }
}

/* ---------- Accessibility ---------- */
.btn:focus-visible,
.search-input:focus-visible,
.recent-item:focus-visible,
.recent-toggle:focus-visible {
  outline: 2px solid var(--rb-primary);
  outline-offset: 2px;
}

/* ---------- Reduced motion ---------- */
@media (prefers-reduced-motion: reduce) {
  .track-page, .card, .status-badge--anim, .v-timeline-step,
  .skeleton, .spin, .progress-circle__fill, .stepper-marker {
    animation: none !important;
    transition: none !important;
  }
}

/* ---------- Print ---------- */
@media print {
  .page-header > .btn,
  .search-card,
  .content-side {
    display: none !important;
  }
  .content-grid { grid-template-columns: 1fr; }
}

/* Redone 2026-11-01: each fact once, from what the API really sends. */
.hero-card__top { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; }
.hero-card .stepper { margin: 22px 0 0; padding-top: 18px; border-top: 1px solid var(--rb-border); }
.stepper-time { font-size: 11.5px; color: var(--rb-text-secondary); text-align: center; }
.update-desc--note { color: var(--rb-text-secondary); }
/* ── Every request (2026-11-27) ── */
.list-card { display: flex; flex-direction: column; gap: 14px; }
.list-card__head { display: flex; flex-direction: column; gap: 10px; }
.list-card__title { display: flex; align-items: center; gap: 8px; margin: 0; }
.list-card__count { min-width: 22px; padding: 1px 8px; border-radius: 999px; background: var(--rb-surface-alt); font-size: 12px; font-weight: 700; text-align: center; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.list-card__error { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 13px; color: var(--rb-accent-text); }

.status-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
.status-tab {
  --tab: var(--rb-text-muted);
  display: inline-flex; align-items: center; gap: 7px; height: 30px; padding: 0 12px;
  border: 1px solid var(--rb-border); border-radius: 999px; background: var(--rb-surface);
  font: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); cursor: pointer;
}
.status-tab--info { --tab: var(--rb-primary); }
.status-tab--progress { --tab: var(--rb-purple, #7C3AED); }
.status-tab--warning { --tab: var(--rb-warning); }
.status-tab--success { --tab: var(--rb-success); }
.status-tab--danger { --tab: var(--rb-accent); }
.status-tab__dot { width: 7px; height: 7px; border-radius: 999px; background: var(--tab); }
.status-tab:hover { color: var(--rb-text-primary); border-color: var(--rb-border-strong); }
.status-tab--on { border-color: color-mix(in srgb, var(--tab) 55%, transparent); background: color-mix(in srgb, var(--tab) 9%, var(--rb-surface)); color: var(--rb-text-primary); }
.status-tab:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

.all-wrap { overflow-x: auto; border: 1px solid var(--rb-border); border-radius: 12px; transition: opacity .15s ease; }
.all-wrap--busy { opacity: .55; }
.all-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.all-table th {
  padding: 9px 14px; background: var(--rb-surface-alt); border-bottom: 1px solid var(--rb-border); text-align: left; white-space: nowrap;
  font-size: 10.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--rb-text-secondary);
}
.all-table td { padding: 11px 14px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); vertical-align: middle; }
.all-table tbody tr:last-child td { border-bottom: 0; }
.all-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.all-row { cursor: pointer; transition: background-color .12s ease; }
.all-row:hover { background: rgba(var(--rb-primary-rgb), .05); }
.all-row:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: -2px; }
.all-row--stat td:first-child { box-shadow: inset 3px 0 0 var(--rb-accent); }
.all-ref { font-weight: 700; color: var(--rb-primary-text); white-space: nowrap; }
.all-stat { margin-left: 6px; padding: 0 6px; border-radius: 999px; background: var(--rb-accent); color: #FFFFFF; font-size: 10.5px; font-weight: 700; }
.all-blood { display: flex; align-items: center; gap: 8px; }
.all-type { flex: none; padding: 1px 8px; border-radius: 999px; border: 1px solid rgba(var(--rb-accent-rgb), .35); background: rgba(var(--rb-accent-rgb), .07); color: var(--rb-accent-text); font-size: 12px; font-weight: 700; }
.all-comp { white-space: nowrap; }
.all-center, .all-date { white-space: nowrap; color: var(--rb-text-secondary); }
.all-go { display: flex; align-items: center; justify-content: flex-end; gap: 4px; white-space: nowrap; font-size: 12px; font-weight: 600; color: var(--rb-text-muted); }
.all-row:hover .all-go { color: var(--rb-primary-text); }

.back-to-list {
  display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; padding: 6px 10px; border: 1px solid var(--rb-border);
  border-radius: 9px; background: var(--rb-surface); font: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); cursor: pointer;
}
.back-to-list:hover { color: var(--rb-primary-text); border-color: rgba(var(--rb-primary-rgb), .45); }
.back-to-list:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

/* Recent requests: a grid of cards (2026-11-27). */
.recent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; margin: 0; padding: 0; list-style: none; }
.recent-card {
  display: flex; flex-direction: column; gap: 8px; width: 100%; height: 100%; padding: 14px 16px;
  border: 1px solid var(--rb-border); border-radius: 12px; background: var(--rb-surface-alt);
  font: inherit; text-align: left; color: var(--rb-text-primary); cursor: pointer;
  transition: border-color .15s ease, background-color .15s ease, box-shadow .2s ease;
}
.recent-card:hover { border-color: rgba(var(--rb-primary-rgb), .45); background: var(--rb-surface); box-shadow: 0 8px 20px -12px rgba(15, 23, 42, .25); }
.recent-card:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.recent-card__top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.recent-card__ref { font-size: 13px; font-weight: 700; color: var(--rb-primary-text); }
.recent-card__what { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 13px; color: var(--rb-text-secondary); }
.recent-card__type {
  flex: none; padding: 1px 8px; border-radius: 999px; border: 1px solid rgba(var(--rb-accent-rgb), .35);
  background: rgba(var(--rb-accent-rgb), .07); color: var(--rb-accent-text); font-size: 12px; font-weight: 700;
}
.recent-card__go { display: inline-flex; align-items: center; gap: 4px; align-self: flex-end; font-size: 12px; font-weight: 600; color: var(--rb-text-muted); transition: color .15s ease, gap .15s ease; }
.recent-card:hover .recent-card__go { color: var(--rb-primary-text); gap: 7px; }
.recent-list { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
.recent-list li + li { border-top: 1px solid var(--rb-border); }
.recent-row { display: flex; align-items: center; gap: 14px; width: 100%; padding: 11px 4px; border: 0; background: none; font: inherit; font-size: 13px; text-align: left; color: var(--rb-text-primary); cursor: pointer; }
.recent-row:hover { background: var(--rb-surface-hover); }
.recent-row:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: -2px; }
.recent-row__ref { font-variant-numeric: tabular-nums; font-size: 12.5px; color: var(--rb-primary-text); }
.recent-row__what { flex: 1; min-width: 0; color: var(--rb-text-secondary); }
.recent-row__go { flex-shrink: 0; color: var(--rb-text-muted); }
</style>
