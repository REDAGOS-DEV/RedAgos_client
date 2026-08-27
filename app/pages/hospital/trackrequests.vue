<template>
  <div class="track-page">
    <!-- ============== PAGE HEADER ============== -->
    <div class="page-header">
      <div class="page-header__titles">
        <h1 class="page-title">Track Requests</h1>
        <p class="page-subtitle">
          Monitor the real-time progress and fulfillment status of submitted blood requests.
        </p>
      </div>
      <button
        class="btn btn--primary"
        type="button"
        :disabled="!request || isRefreshing"
        @click="handleRefresh"
      >
        <AssetIcon name="refresh-cw" :class="{ spin: isRefreshing }" />
        <span>Refresh Status</span>
      </button>
    </div>

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
        <button type="submit" class="btn btn--primary search-btn" :disabled="isSearching">
          {{ isSearching ? 'Searching…' : 'Search' }}
        </button>
      </form>

      <div v-if="isLoadingRecent" class="recent-loading">Loading recent tracked requests…</div>
    </section>

    <!-- ============== EMPTY STATE ============== -->
    <div v-if="!hasSearched" class="empty-state">
      <AssetIcon name="package-search" class="empty-state__icon" />
      <h3>No Request Selected</h3>
      <p>Search using a blood request reference number to begin tracking.</p>
    </div>

    <!-- ============== ERROR STATE ============== -->
    <div v-else-if="searchError" class="empty-state empty-state--error">
      <AssetIcon name="triangle-alert" class="empty-state__icon" />
      <h3>Request Not Found</h3>
      <p v-if="searchError === 'not_found'">
        The entered reference number could not be located.
      </p>
      <p v-else>Something went wrong while searching. Please try again.</p>
      <button class="btn btn--primary" type="button" @click="handleSearchSubmit">Search Again</button>
    </div>

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
              <span class="status-badge status-badge--anim" :class="statusColorClass">{{ request.status }}</span>
              <span class="status-badge status-badge--sm" :class="priorityColorClass">{{ request.priority || '—' }} priority</span>
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
            <span class="hero-value hero-value--emphasis">{{ request.blood_type || '—' }}</span>
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
                <span class="info-value">{{ request.blood_type || '—' }}</span>
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
                  <a :href="doc.url" target="_blank" rel="noopener" class="btn btn--outline btn--sm">View</a>
                  <a :href="doc.url" download class="btn btn--outline btn--sm">Download</a>
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
              <button class="btn btn--outline btn--full" type="button" @click="viewRequestDetails">
                <AssetIcon name="eye" />
                <span>View Request Details</span>
              </button>
              <button class="btn btn--outline btn--full" type="button" @click="handleDownloadPdf">
                <AssetIcon name="download" />
                <span>Download PDF</span>
              </button>
              <button class="btn btn--outline btn--full" type="button" @click="handlePrint">
                <AssetIcon name="printer" />
                <span>Print</span>
              </button>
              <button
                class="btn btn--outline btn--full"
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
import AssetIcon from '~/components/common/AssetIcon.vue'
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
  layout: 'hospitaldashboard',
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

const statusColorMap = {
  Pending: 'warning',
  Approved: 'success',
  Processing: 'warning',
  'Ready for Pickup': 'info',
  Completed: 'success',
  Rejected: 'danger',
  Cancelled: 'danger',
}

const statusColorClass = computed(() => {
  const s = request.value?.status
  return s ? `badge--${statusColorMap[s] ?? 'neutral'}` : 'badge--neutral'
})

const priorityColorClass = computed(() => {
  const p = request.value?.priority
  if (!p) return 'badge--neutral'
  const lower = p.toLowerCase()
  if (lower === 'urgent' || lower === 'critical') return 'badge--danger'
  if (lower === 'high') return 'badge--warning'
  return 'badge--neutral'
})

const hasAttentionFlag = computed(() => request.value?.status === 'Rejected')

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

async function handleDownloadPdf() {
  if (!request.value) return
  try {
    const { data, error } = await useApi().get(
      `/hospital/blood-requests/${request.value.id}/download`,
      { responseType: 'blob' }
    )
    if (error?.value) throw error.value
    const blob = data?.value
    if (!blob) return
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `blood-request-${request.value.reference_number}.pdf`
    link.click()
    window.URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Failed to download PDF', err)
  }
}

function viewRequestDetails() {
  if (!request.value) return
  navigateTo(`/hospital/blood-requests/${request.value.id}`)
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
  padding: 24px;
  background: #f7f9fc;
  min-height: 100%;
  animation: page-fade-in 0.25s ease;
}
@keyframes page-fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ---------- Header ---------- */
.page-header {
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
  color: #1e293b;
  margin: 0 0 4px;
}
.page-subtitle {
  font-size: 15px;
  color: #64748b;
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
  background: #1565c0;
  color: #fff;
}
.btn--primary:hover:not(:disabled) {
  background: #0d47a1;
}
.btn--outline {
  background: #fff;
  color: #1565c0;
  border-color: #e5eaf0;
}
.btn--outline:hover:not(:disabled) {
  background: #f1f6fb;
  border-color: #1565c0;
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
  background: #fff;
  border: 1px solid #e5eaf0;
  border-radius: 18px;
  padding: 24px;
  box-shadow: 0 2px 10px rgba(20, 30, 50, 0.04);
  margin-bottom: 20px;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.card:hover {
  box-shadow: 0 6px 18px rgba(20, 30, 50, 0.07);
}
.section-title {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
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
  color: #94a3b8;
}
.search-input {
  width: 100%;
  border: 1px solid #e5eaf0;
  border-radius: 12px;
  padding: 14px 40px 14px 42px;
  font-size: 15px;
  color: #1e293b;
  background: #f7f9fc;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.search-input:focus {
  outline: none;
  border-color: #1565c0;
  box-shadow: 0 0 0 3px rgba(21, 101, 192, 0.12);
}
.recent-toggle {
  position: absolute;
  right: 10px;
  background: none;
  border: none;
  color: #94a3b8;
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
  color: #94a3b8;
}

.recent-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid #e5eaf0;
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
  color: #94a3b8;
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
  color: #1e293b;
  cursor: pointer;
  text-align: left;
}
.recent-item:hover {
  background: #f1f6fb;
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
.badge--success { background: rgba(46, 125, 50, 0.12); color: #2e7d32; }
.badge--warning { background: rgba(245, 158, 11, 0.14); color: #b8790a; }
.badge--danger { background: rgba(211, 47, 47, 0.12); color: #d32f2f; }
.badge--info { background: rgba(21, 101, 192, 0.12); color: #1565c0; }
.badge--neutral { background: #eef0f3; color: #55606e; }

.attention-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(211, 47, 47, 0.1);
  color: #d32f2f;
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 600;
}

/* ---------- Hero card ---------- */
.hero-card {
  background: linear-gradient(135deg, #ffffff 0%, #f1f6fb 100%);
}
.hero-ref {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
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
  color: #64748b;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.hero-value {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
}
.hero-value--emphasis {
  font-size: 22px;
  font-weight: 700;
  color: #1565c0;
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
  background: #e5eaf0;
  z-index: 0;
}
.stepper-step--completed:not(:last-child)::after {
  background: #2e7d32;
}
.stepper-marker {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eef0f3;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 700;
  z-index: 1;
  transition: background 0.4s ease, color 0.4s ease, transform 0.2s ease;
}
.stepper-step--completed .stepper-marker {
  background: #2e7d32;
  color: #fff;
}
.stepper-step--current .stepper-marker {
  background: #1565c0;
  color: #fff;
  transform: scale(1.15);
  box-shadow: 0 0 0 5px rgba(21, 101, 192, 0.15);
}
.stepper-label {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  max-width: 100px;
}
.stepper-step--current .stepper-label {
  color: #1565c0;
}
.stepper-step--completed .stepper-label {
  color: #2e7d32;
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
  color: #64748b;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.info-value { font-size: 14px; color: #1e293b; line-height: 1.5; }
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
  background: #e5eaf0;
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
  background: #eef0f3;
  color: #94a3b8;
  z-index: 1;
}
.v-timeline-dot { width: 8px; height: 8px; border-radius: 999px; background: currentColor; }
.v-timeline-step--completed .v-timeline-marker { background: #2e7d32; color: #fff; }
.v-timeline-step--completed::before { background: #2e7d32; }
.v-timeline-step--current .v-timeline-marker {
  background: #1565c0;
  color: #fff;
  box-shadow: 0 0 0 4px rgba(21, 101, 192, 0.15);
}
.v-timeline-body { display: flex; flex-direction: column; gap: 3px; padding-top: 1px; }
.v-timeline-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.v-timeline-activity { font-size: 14px; font-weight: 700; color: #1e293b; }
.v-timeline-step--upcoming .v-timeline-activity { color: #94a3b8; font-weight: 600; }
.v-timeline-tag {
  font-size: 11px;
  font-weight: 700;
  color: #1565c0;
  background: rgba(21, 101, 192, 0.1);
  padding: 2px 8px;
  border-radius: 999px;
}
.v-timeline-tag--pending { color: #64748b; background: #eef0f3; }
.v-timeline-time { font-size: 12px; color: #94a3b8; }
.v-timeline-desc { font-size: 13px; color: #475569; margin: 2px 0 0; }

/* ---------- Updates / notifications ---------- */
.updates-list, .notif-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.update-item { display: flex; gap: 12px; }
.update-icon {
  width: 32px; height: 32px; border-radius: 999px;
  background: rgba(21, 101, 192, 0.1); color: #1565c0;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.update-body { display: flex; flex-direction: column; gap: 2px; }
.update-desc { font-size: 14px; color: #1e293b; margin: 0; }
.update-time { font-size: 12px; color: #94a3b8; }

.notif-item { display: flex; gap: 10px; align-items: flex-start; }
.notif-dot { width: 8px; height: 8px; border-radius: 999px; background: #1565c0; margin-top: 6px; flex-shrink: 0; }
.notif-desc { font-size: 13px; color: #1e293b; margin: 0; }
.notif-time { font-size: 11px; color: #94a3b8; }

.empty-hint { font-size: 13px; color: #94a3b8; margin: 0; }

/* ---------- Documents ---------- */
.documents-table { display: flex; flex-direction: column; gap: 10px; }
.documents-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: #f7f9fc;
  border: 1px solid #e5eaf0;
  border-radius: 12px;
  flex-wrap: wrap;
}
.documents-row__label { display: flex; align-items: center; gap: 10px; font-size: 14px; color: #1e293b; font-weight: 600; }
.documents-row__actions { display: flex; gap: 8px; }

/* ---------- Sidebar cards ---------- */
.side-card__title { font-size: 16px; font-weight: 700; color: #1e293b; margin: 0 0 16px; }
.side-card__row { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; }

.progress-circle-wrap {
  position: relative;
  width: 120px;
  height: 120px;
  margin: 0 auto 12px;
}
.progress-circle { width: 100%; height: 100%; transform: rotate(-90deg); }
.progress-circle__track { fill: none; stroke: #eef0f3; stroke-width: 8; }
.progress-circle__fill {
  fill: none;
  stroke: #1565c0;
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
  color: #1565c0;
}

.pickup-rows { display: flex; flex-direction: column; gap: 12px; }
.pickup-row { display: flex; flex-direction: column; gap: 3px; }
.countdown-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  background: rgba(124, 58, 237, 0.1);
  color: #7c3aed;
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
  color: #64748b;
}
.empty-state__icon { width: 48px; height: 48px; color: #94a3b8; margin-bottom: 14px; }
.empty-state h3 { font-size: 18px; color: #1e293b; margin: 0 0 4px; }
.empty-state p { font-size: 14px; margin: 0 0 20px; }
.empty-state--error h3 { color: #d32f2f; }
.empty-state--error .empty-state__icon { color: #d32f2f; }

/* ---------- Skeletons ---------- */
.skeleton {
  background: linear-gradient(90deg, #eef0f3 25%, #f6f7f9 37%, #eef0f3 63%);
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
:global(.dark .track-page) { background: #0f1420; }
:global(.dark .card) { background: #161d2e; border-color: #2a3447; }
:global(.dark .page-title),
:global(.dark .section-title),
:global(.dark .side-card__title),
:global(.dark .hero-ref),
:global(.dark .hero-value),
:global(.dark .info-value),
:global(.dark .v-timeline-activity),
:global(.dark .update-desc),
:global(.dark .notif-desc),
:global(.dark .documents-row__label),
:global(.dark .search-input) {
  color: #eef1f6;
}
:global(.dark .page-subtitle),
:global(.dark .info-label),
:global(.dark .hero-label),
:global(.dark .empty-hint),
:global(.dark .v-timeline-time),
:global(.dark .update-time),
:global(.dark .notif-time),
:global(.dark .stepper-label) {
  color: #8a93a6;
}
:global(.dark .hero-card) {
  background: linear-gradient(135deg, #161d2e 0%, #1c2438 100%);
}
:global(.dark .btn--outline) {
  background: #161d2e;
  border-color: #2a3447;
  color: #6fa8dc;
}
:global(.dark .btn--outline:hover:not(:disabled)) { background: #1c2438; }
:global(.dark .search-input) { background: #1c2438; border-color: #2a3447; }
:global(.dark .recent-dropdown) { background: #161d2e; border-color: #2a3447; }
:global(.dark .recent-item:hover) { background: #1c2438; }
:global(.dark .documents-row) { background: #1c2438; border-color: #2a3447; }
:global(.dark .v-timeline-step::before),
:global(.dark .stepper-step:not(:last-child)::after) { background: #2a3447; }
:global(.dark .v-timeline-marker),
:global(.dark .stepper-marker) { background: #232c40; }
:global(.dark .progress-circle__track) { stroke: #232c40; }
:global(.dark .skeleton) {
  background: linear-gradient(90deg, #1c2438 25%, #232c40 37%, #1c2438 63%);
  background-size: 400% 100%;
}

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
  outline: 2px solid #1565c0;
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
