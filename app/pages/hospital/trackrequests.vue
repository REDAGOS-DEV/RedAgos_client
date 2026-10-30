<template>
  <div class="track-page">
    <!-- ============== PAGE HEADER ============== -->
    <PageHeader class="page-header" title="Track Requests" subtitle="Monitor the real-time progress and fulfillment status of submitted blood requests.">
      <template #actions>
        <button
          class="ui-btn ui-btn--primary"
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
      <form class="search-form" @submit.prevent="handleSearchSubmit">
        <div class="search-input-wrap">
          <AssetIcon name="search" class="search-icon" />
          <input
            v-model="referenceInput"
            type="text"
            class="search-input"
            placeholder="Search by Reference Number..."
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
              <span class="status-badge status-badge--sm" :class="`badge--${statusColorMap[item.status] ?? 'neutral'}`">
                {{ item.status }}
              </span>
            </button>
          </div>
        </div>
        <button type="submit" class="ui-btn ui-btn--primary search-btn" :disabled="isSearching">
          {{ isSearching ? 'Searching…' : 'Search' }}
        </button>
      </form>

      <div v-if="isLoadingRecent" class="recent-loading">Loading recent tracked requests…</div>
    </section>

    <!-- ============== EMPTY STATE ============== -->
    <section v-if="!hasSearched" class="card">
      <EmptyState icon="package-search" title="No Request Selected" description="Search using a blood request reference number to begin tracking." />
    </section>

    <!-- ============== ERROR STATE ============== -->
    <section v-else-if="searchError" class="card">
      <EmptyState
        icon="triangle-alert"
        title="Request Not Found"
        :description="searchError === 'not_found'
          ? 'The entered reference number could not be located.'
          : 'Something went wrong while searching. Please try again.'">
        <button class="ui-btn ui-btn--primary" type="button" @click="handleSearchSubmit">Search Again</button>
      </EmptyState>
    </section>

    <!-- ============== SEARCHING SKELETON ============== -->
    <div v-else-if="isSearching && !request" class="skeleton-stack">
      <div class="skeleton skeleton--hero" />
      <div class="skeleton skeleton--stepper" />
    </div>

    <!-- ============== MAIN TRACKING VIEW ============== -->
    <template v-else-if="request">
      <!-- CURRENT STATUS CARD -->
      <section class="card hero-card">
        <div class="hero-card__top">
          <div>
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
        </div>

        <div class="hero-grid">
          <div class="hero-item">
            <span class="hero-label">Blood Type</span>
            <span class="hero-value hero-value--emphasis">{{ bloodTypeSummary(request) }}</span>
          </div>
          <div class="hero-item">
            <span class="hero-label">Blood Component</span>
            <span class="hero-value">{{ request.blood_component || '—' }}</span>
          </div>
          <div class="hero-item">
            <span class="hero-label">Units Requested</span>
            <span class="hero-value">{{ request.units_requested ?? '—' }}</span>
          </div>
          <div class="hero-item">
            <span class="hero-label">Submitted Date</span>
            <span class="hero-value">{{ formatDate(request.request_date) }}</span>
          </div>
          <div class="hero-item">
            <span class="hero-label">Estimated Completion</span>
            <span class="hero-value">{{ formatDate(request.estimated_completion) }}</span>
          </div>
        </div>
      </section>

      <!-- FULFILLMENT PROGRESS (horizontal stepper) -->
      <section class="card">
        <h2 class="section-title">Fulfillment Progress</h2>
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
          </li>
        </ol>
      </section>

      <!-- REQUESTED VERSUS FULFILLED, PER COMPONENT -->
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

      <div class="content-grid">
        <!-- ============== LEFT COLUMN ============== -->
        <div class="content-main">
          <!-- TIMELINE -->
          <section class="card">
            <h2 class="section-title">Timeline</h2>
            <ol class="v-timeline">
              <li
                v-for="(step, index) in timeline"
                :key="step.step || index"
                class="v-timeline-step"
                :class="`v-timeline-step--${step.status}`"
                :style="{ animationDelay: `${index * 0.06}s` }"
              >
                <span class="v-timeline-marker">
                  <AssetIcon v-if="step.status === 'completed'" name="check" />
                  <span v-else class="v-timeline-dot" />
                </span>
                <div class="v-timeline-body">
                  <div class="v-timeline-head">
                    <span class="v-timeline-activity">{{ step.label }}</span>
                    <span v-if="step.status === 'current'" class="v-timeline-tag">Current Step</span>
                    <span v-else-if="step.status === 'upcoming'" class="v-timeline-tag v-timeline-tag--pending">Pending</span>
                  </div>
                  <span v-if="step.timestamp" class="v-timeline-time">{{ formatDateTime(step.timestamp) }}</span>
                  <p v-if="step.description" class="v-timeline-desc">{{ step.description }}</p>
                </div>
              </li>
            </ol>
          </section>

          <!-- REQUEST INFORMATION -->
          <section class="card">
            <h2 class="section-title">Request Information</h2>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Reference Number</span>
                <span class="info-value info-value--mono">{{ request.reference_number }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Hospital</span>
                <span class="info-value">{{ request.hospital || '—' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Department</span>
                <span class="info-value">{{ request.department || '—' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Requesting Physician</span>
                <span class="info-value">{{ request.requesting_physician || '—' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Blood Type</span>
                <span class="info-value">{{ bloodTypeSummary(request) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Blood Component</span>
                <span class="info-value">{{ request.blood_component || '—' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Units Requested</span>
                <span class="info-value">{{ request.units_requested ?? '—' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Priority</span>
                <span class="info-value">{{ request.priority || '—' }}</span>
              </div>
              <div class="info-item info-item--full">
                <span class="info-label">Purpose of Request</span>
                <span class="info-value">{{ request.purpose || '—' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Submitted Date</span>
                <span class="info-value">{{ formatDate(request.request_date) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Required Date</span>
                <span class="info-value">{{ formatDate(request.required_date) }}</span>
              </div>
            </div>
          </section>

          <!-- LATEST UPDATES -->
          <section class="card">
            <h2 class="section-title">Latest Updates</h2>
            <ul v-if="updates.length" class="updates-list">
              <li v-for="update in updates" :key="update.id" class="update-item">
                <span class="update-icon">
                  <AssetIcon :name="update.icon || 'bell'" />
                </span>
                <div class="update-body">
                  <p class="update-desc">{{ update.description }}</p>
                  <span class="update-time">{{ formatDateTime(update.timestamp) }}</span>
                </div>
              </li>
            </ul>
            <p v-else class="empty-hint">No updates yet from the Blood Center.</p>
          </section>

          <!-- DOCUMENTS -->
          <section class="card">
            <h2 class="section-title">Documents</h2>
            <div v-if="documents.length" class="documents-table">
              <div v-for="doc in documents" :key="doc.id" class="documents-row">
                <div class="documents-row__label">
                  <AssetIcon name="file-text" />
                  <span>{{ doc.label || doc.name }}</span>
                </div>
                <div class="documents-row__actions">
                  <a :href="doc.url" target="_blank" rel="noopener" class="ui-btn ui-btn--sm">View</a>
                  <a :href="doc.url" download class="ui-btn ui-btn--sm">Download</a>
                </div>
              </div>
            </div>
            <p v-else class="empty-hint">No documents have been generated for this request yet.</p>
          </section>
        </div>

        <!-- ============== RIGHT SIDEBAR ============== -->
        <aside class="content-side">
          <!-- Card 1: Current Request Status -->
          <section class="card side-card">
            <h3 class="side-card__title">Current Request Status</h3>
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
            <div class="side-card__row">
              <span class="info-label">Estimated Completion</span>
              <span class="info-value">{{ formatDate(request.estimated_completion) }}</span>
            </div>
          </section>

          <!-- ESTIMATED PICKUP -->
          <section v-if="pickup" class="card side-card">
            <h3 class="side-card__title">Estimated Pickup</h3>
            <div class="pickup-rows">
              <div class="pickup-row">
                <span class="info-label">Estimated Pickup Time</span>
                <span class="info-value">{{ formatDateTime(pickup.estimated_pickup_time) }}</span>
              </div>
              <div v-if="countdownLabel" class="countdown-chip">
                <AssetIcon name="clock" />
                <span>{{ countdownLabel }}</span>
              </div>
              <div class="pickup-row">
                <span class="info-label">Pickup Location</span>
                <span class="info-value">{{ pickup.pickup_location || '—' }}</span>
              </div>
              <div class="pickup-row">
                <span class="info-label">Blood Center Contact</span>
                <span class="info-value">{{ pickup.blood_center_contact || '—' }}</span>
              </div>
              <div class="pickup-row">
                <span class="info-label">Operating Hours</span>
                <span class="info-value">{{ pickup.operating_hours || '—' }}</span>
              </div>
            </div>
          </section>

          <!-- Card 2: Quick Actions -->
          <section class="card side-card">
            <h3 class="side-card__title">Quick Actions</h3>
            <div class="quick-actions">
              <button class="ui-btn btn--full" type="button" @click="viewRequestDetails">
                <AssetIcon name="eye" />
                <span>View Request Details</span>
              </button>
              <button class="ui-btn btn--full" type="button" @click="handleDownloadPdf">
                <AssetIcon name="download" />
                <span>Download PDF</span>
              </button>
              <button class="ui-btn btn--full" type="button" @click="handlePrint">
                <AssetIcon name="printer" />
                <span>Print</span>
              </button>
              <button
                class="ui-btn btn--full"
                type="button"
                :disabled="!pickup?.blood_center_contact"
                @click="contactBloodCenter"
              >
                <AssetIcon name="phone" />
                <span>Contact Blood Center</span>
              </button>
            </div>
          </section>

          <!-- Card 3: Notifications -->
          <section class="card side-card">
            <h3 class="side-card__title">Notifications</h3>
            <ul v-if="updates.length" class="notif-list">
              <li v-for="update in updates.slice(0, 4)" :key="update.id" class="notif-item">
                <span class="notif-dot" />
                <div>
                  <p class="notif-desc">{{ update.description }}</p>
                  <span class="notif-time">{{ formatDateTime(update.timestamp) }}</span>
                </div>
              </li>
            </ul>
            <p v-else class="empty-hint">No recent notifications.</p>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>

<script setup>
import PageHeader from '~/components/ui/PageHeader.vue'
import EmptyState from '~/components/ui/EmptyState.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import RequestFulfilmentTable from '~/components/common/RequestFulfilmentTable.vue'
import { bloodTypeSummary, PRIORITY_LABELS, REQUEST_STATUS_TONES, requestStatusLabel } from '~/types/bloodRequest'
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
})

const route = useRoute()

const {
  referenceInput,
  recentRequests,
  isLoadingRecent,
  request,
  timeline,
  updates,
  documents,
  pickup,
  progressPercent,
  isSearching,
  hasSearched,
  searchError,
  fetchRecent,
  searchByReference,
  selectRecent,
  refreshStatus,
} = useTrackRequests()

const showRecentDropdown = ref(false)
const isRefreshing = ref(false)

onMounted(() => {
  fetchRecent()
  // Allow deep-linking: /hospital/track-requests?ref=BBR-2026-000125
  const prefill = route.query.ref
  if (prefill) {
    referenceInput.value = prefill
    searchByReference(prefill)
  }
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

// Countdown to estimated pickup, ticks every minute while the page is open
const now = ref(Date.now())
let countdownTimer = null
onMounted(() => {
  countdownTimer = setInterval(() => {
    now.value = Date.now()
  }, 60_000)
})
onUnmounted(() => {
  if (countdownTimer) clearInterval(countdownTimer)
})

const countdownLabel = computed(() => {
  const target = pickup.value?.estimated_pickup_time
  if (!target) return null
  const targetTime = new Date(target).getTime()
  if (Number.isNaN(targetTime)) return null
  const diffMs = targetTime - now.value
  if (diffMs <= 0) return 'Ready now'
  const totalMinutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours <= 0) return `${minutes}m remaining`
  return `${hours}h ${minutes}m remaining`
})

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

function contactBloodCenter() {
  const contact = pickup.value?.blood_center_contact
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
  padding: 14px 40px 14px 42px;
  font-size: 15px;
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
  font-family: 'SFMono-Regular', Consolas, monospace;
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
  font-family: 'SFMono-Regular', Consolas, monospace;
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
.info-value--mono { font-family: 'SFMono-Regular', Consolas, monospace; }

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
.track-ptr { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 700; color: var(--rb-primary-text); }

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
</style>
