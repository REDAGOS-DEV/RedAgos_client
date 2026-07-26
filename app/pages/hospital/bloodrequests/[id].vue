<script setup>

definePageMeta({
  layout: 'hospitaldashboard',
})

const route = useRoute()
const requestId = route.params.id

const {
  request,
  history,
  bloodAvailability,
  timeline,
  progressPercent,
  isLoadingRequest,
  isLoadingAvailability,
  requestError,
  fetchRequest,
  fetchAvailability,
} = useBloodRequestDetails(requestId)

onMounted(() => {
  fetchRequest()
  fetchAvailability()
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
  if (p.toLowerCase() === 'urgent' || p.toLowerCase() === 'critical') return 'badge--danger'
  if (p.toLowerCase() === 'high') return 'badge--warning'
  return 'badge--neutral'
})

const canEdit = computed(() => request.value?.status === 'Pending')

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function goBack() {
  navigateTo('/hospital/blood-requests')
}

function handlePrint() {
  window.print()
}

async function handleDownloadPdf() {
  if (!request.value) return
  try {
    const { data, error } = await useApi().get(
      `/hospital/blood-requests/${requestId}/download`,
      { responseType: 'blob' }
    )
    if (error?.value) throw error.value
    const blob = data?.value
    if (!blob) return
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `blood-request-${request.value.reference_number || requestId}.pdf`
    link.click()
    window.URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Failed to download PDF', err)
  }
}

function scrollToTimeline() {
  document.getElementById('request-timeline')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="request-details-page">
    <!-- ============== PAGE HEADER ============== -->
    <div class="page-header">
      <button class="back-link" type="button" @click="goBack">
        <AssetIcon name="arrow-left" />
        <span>Back to Blood Requests</span>
      </button>

      <nav class="breadcrumb" aria-label="Breadcrumb">
        <span>Hospital Portal</span>
        <span class="crumb-sep">/</span>
        <span>Blood Requests</span>
        <span class="crumb-sep">/</span>
        <span class="crumb-current">Request Details</span>
      </nav>

      <div class="page-header__row">
        <div class="page-header__titles">
          <h1 class="page-title">Blood Request Details</h1>
          <p class="page-subtitle">View the complete information and progress of this blood request.</p>
        </div>

        <div class="page-header__actions" v-if="!isLoadingRequest && request">
          <span class="status-badge" :class="statusColorClass">{{ request.status }}</span>
          <button class="btn btn--outline" type="button" @click="handleDownloadPdf">
            <AssetIcon name="download" />
            <span>Download PDF</span>
          </button>
          <button class="btn btn--outline" type="button" @click="handlePrint">
            <AssetIcon name="printer" />
            <span>Print</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ============== LOADING SKELETON ============== -->
    <div v-if="isLoadingRequest" class="skeleton-stack">
      <div class="skeleton skeleton--summary" />
      <div class="skeleton-grid">
        <div class="skeleton-grid__main">
          <div class="skeleton skeleton--card" v-for="n in 4" :key="n" />
        </div>
        <div class="skeleton-grid__side">
          <div class="skeleton skeleton--card-sm" v-for="n in 3" :key="n" />
        </div>
      </div>
    </div>

    <!-- ============== ERROR STATE ============== -->
    <div v-else-if="requestError" class="empty-state empty-state--error">
      <AssetIcon name="alert-triangle" />
      <h3>We couldn't load this request</h3>
      <p>Something went wrong while fetching the request details. Please try again.</p>
      <button class="btn btn--primary" type="button" @click="fetchRequest">Retry</button>
    </div>

    <!-- ============== EMPTY STATE (not found) ============== -->
    <div v-else-if="!request" class="empty-state">
      <AssetIcon name="file-search" />
      <h3>Request not found</h3>
      <p>This blood request may have been removed, or the link is incorrect.</p>
      <button class="btn btn--primary" type="button" @click="goBack">Back to Blood Requests</button>
    </div>

    <!-- ============== MAIN CONTENT ============== -->
    <template v-else>
      <!-- SUMMARY CARD -->
      <section class="card summary-card">
        <div class="summary-item">
          <span class="summary-label">Reference Number</span>
          <span class="summary-value summary-value--mono">{{ request.reference_number || '—' }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Request Date</span>
          <span class="summary-value">{{ formatDate(request.request_date) }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Priority</span>
          <span class="status-badge status-badge--sm" :class="priorityColorClass">
            {{ request.priority || '—' }}
          </span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Current Status</span>
          <span class="status-badge status-badge--sm" :class="statusColorClass">
            {{ request.status }}
          </span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Required Date</span>
          <span class="summary-value">{{ formatDate(request.required_date) }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Estimated Completion</span>
          <span class="summary-value">{{ formatDate(request.estimated_completion) }}</span>
        </div>
      </section>

      <div class="content-grid">
        <!-- ============== MAIN COLUMN ============== -->
        <div class="content-main">
          <!-- SECTION 1: REQUEST INFORMATION -->
          <section class="card">
            <h2 class="section-title">Request Information</h2>
            <div class="info-grid">
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
                <span class="info-label">Patient Reference Number</span>
                <span class="info-value info-value--mono">{{ request.patient_reference_number || '—' }}</span>
              </div>
              <div class="info-item info-item--full">
                <span class="info-label">Purpose of Request</span>
                <span class="info-value">{{ request.purpose || '—' }}</span>
              </div>
              <div class="info-item info-item--full">
                <span class="info-label">Notes</span>
                <span class="info-value">{{ request.notes || 'No additional notes.' }}</span>
              </div>
            </div>
          </section>

          <!-- SECTION 2: BLOOD DETAILS -->
          <section class="card">
            <h2 class="section-title">Blood Details</h2>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Blood Type</span>
                <span class="info-value info-value--emphasis">{{ request.blood_type || '—' }}</span>
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
                <span class="info-label">Compatibility</span>
                <span class="info-value">{{ request.compatibility || '—' }}</span>
              </div>
              <div class="info-item info-item--full">
                <span class="info-label">Special Requirements</span>
                <span class="info-value">{{ request.special_requirements || 'None specified.' }}</span>
              </div>
            </div>
          </section>

          <!-- SECTION 3: CLINICAL INFORMATION -->
          <section class="card">
            <h2 class="section-title">Clinical Information</h2>
            <div class="info-grid">
              <div class="info-item info-item--full">
                <span class="info-label">Clinical Indication</span>
                <span class="info-value">{{ request.clinical_indication || '—' }}</span>
              </div>
              <div class="info-item info-item--full">
                <span class="info-label">Diagnosis</span>
                <span class="info-value">{{ request.diagnosis || '—' }}</span>
              </div>
              <div class="info-item info-item--full">
                <span class="info-label">Additional Notes</span>
                <span class="info-value">{{ request.additional_notes || 'No additional notes.' }}</span>
              </div>
            </div>

            <div class="documents-block">
              <span class="info-label">Supporting Documents</span>
              <div v-if="request.documents && request.documents.length" class="documents-list">
                <a
                  v-for="doc in request.documents"
                  :key="doc.id"
                  :href="doc.url"
                  target="_blank"
                  rel="noopener"
                  class="document-chip"
                >
                  <AssetIcon name="file-text" />
                  <span>{{ doc.name }}</span>
                </a>
              </div>
              <p v-else class="documents-empty">No supporting documents were attached to this request.</p>
            </div>
          </section>

          <!-- SECTION 4: REQUEST TIMELINE -->
          <section id="request-timeline" class="card">
            <h2 class="section-title">Request Timeline</h2>
            <ol class="timeline">
              <li
                v-for="(step, index) in timeline"
                :key="step.step || index"
                class="timeline-step"
                :class="`timeline-step--${step.status}`"
              >
                <span class="timeline-marker">
                  <AssetIcon v-if="step.status === 'completed'" name="check" />
                  <span v-else class="timeline-dot" />
                </span>
                <div class="timeline-body">
                  <span class="timeline-label">{{ step.label }}</span>
                  <span class="timeline-timestamp">{{ step.timestamp ? formatDateTime(step.timestamp) : '—' }}</span>
                </div>
              </li>
            </ol>
            <p v-if="!timeline.length" class="documents-empty">Timeline data is not available yet.</p>
          </section>

          <!-- SECTION 5: REQUEST HISTORY -->
          <section class="card">
            <h2 class="section-title">Request History</h2>
            <div class="table-wrapper">
              <table class="history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Activity</th>
                    <th>Performed By</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="entry in history" :key="entry.id">
                    <td>{{ formatDateTime(entry.date) }}</td>
                    <td>{{ entry.activity }}</td>
                    <td>{{ entry.performed_by || '—' }}</td>
                    <td>{{ entry.remarks || '—' }}</td>
                  </tr>
                  <tr v-if="!history.length">
                    <td colspan="4" class="table-empty">No history entries yet for this request.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <!-- ============== RIGHT SIDEBAR ============== -->
        <aside class="content-side">
          <!-- Card 1: Current Request Status -->
          <section class="card side-card">
            <h3 class="side-card__title">Current Request Status</h3>
            <div class="progress-bar">
              <div class="progress-bar__fill" :style="{ width: progressPercent + '%' }" />
            </div>
            <span class="progress-percent">{{ progressPercent }}% complete</span>
            <div class="side-card__row">
              <span class="info-label">Estimated Completion</span>
              <span class="info-value">{{ formatDate(request.estimated_completion) }}</span>
            </div>
          </section>

          <!-- Card 2: Blood Availability -->
          <section class="card side-card">
            <h3 class="side-card__title">Blood Availability</h3>
            <div v-if="isLoadingAvailability" class="availability-skeleton">
              <div class="skeleton skeleton--row" v-for="n in 4" :key="n" />
            </div>
            <ul v-else-if="bloodAvailability.length" class="availability-list">
              <li v-for="item in bloodAvailability" :key="item.blood_type" class="availability-item">
                <span class="availability-type">{{ item.blood_type }}</span>
                <span class="availability-units">{{ item.units_available }} units</span>
              </li>
            </ul>
            <p v-else class="documents-empty">Blood availability data is not available right now.</p>
          </section>

          <!-- Card 3: Quick Actions -->
          <section class="card side-card">
            <h3 class="side-card__title">Quick Actions</h3>
            <div class="quick-actions">
              <button class="btn btn--outline btn--full" type="button" @click="handleDownloadPdf">
                <AssetIcon name="download" />
                <span>Download PDF</span>
              </button>
              <button class="btn btn--outline btn--full" type="button" @click="handlePrint">
                <AssetIcon name="printer" />
                <span>Print</span>
              </button>
              <button class="btn btn--outline btn--full" type="button" @click="scrollToTimeline">
                <AssetIcon name="map-pin" />
                <span>Track Request</span>
              </button>
            </div>
          </section>
        </aside>
      </div>

      <!-- ============== BOTTOM ACTIONS ============== -->
      <div class="bottom-actions">
        <button class="btn btn--outline" type="button" @click="goBack">Back to Blood Requests</button>
        <button class="btn btn--outline" type="button" @click="scrollToTimeline">Track Request</button>
        <button class="btn btn--outline" type="button" @click="handleDownloadPdf">Download PDF</button>
        <button class="btn btn--outline" type="button" @click="handlePrint">Print</button>
        <NuxtLink
          v-if="canEdit"
          :to="`/hospital/blood-requests/${requestId}/edit`"
          class="btn btn--primary"
        >
          Edit
        </NuxtLink>
      </div>
    </template>
  </div>
</template>

<style scoped>
.request-details-page {
  padding: 24px;
  background: #f7f9fc;
  min-height: 100%;
}

/* ---------- Header ---------- */
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: #1565c0;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  margin-bottom: 10px;
}
.back-link:hover {
  text-decoration: underline;
}

.breadcrumb {
  font-size: 13px;
  color: #6b7686;
  margin-bottom: 16px;
  display: flex;
  gap: 6px;
}
.crumb-sep {
  color: #b7c0cc;
}
.crumb-current {
  color: #1a2233;
  font-weight: 600;
}

.page-header__row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}
.page-title {
  font-family: 'Inter', sans-serif;
  font-size: 30px;
  font-weight: 700;
  color: #1a2233;
  margin: 0 0 4px;
}
.page-subtitle {
  font-size: 14px;
  color: #6b7686;
  margin: 0;
}
.page-header__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* ---------- Buttons ---------- */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 10px;
  padding: 10px 16px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
  text-decoration: none;
}
.btn:active {
  transform: scale(0.98);
}
.btn--primary {
  background: #1565c0;
  color: #fff;
}
.btn--primary:hover {
  background: #0f4f9c;
}
.btn--outline {
  background: #fff;
  color: #1565c0;
  border-color: #e5eaf0;
}
.btn--outline:hover {
  background: #f1f6fb;
  border-color: #1565c0;
}
.btn--full {
  width: 100%;
  justify-content: center;
}

/* ---------- Status badges ---------- */
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
}
.status-badge--sm {
  padding: 4px 10px;
  font-size: 12px;
}
.badge--success {
  background: rgba(46, 125, 50, 0.12);
  color: #2e7d32;
}
.badge--warning {
  background: rgba(245, 158, 11, 0.14);
  color: #b8790a;
}
.badge--danger {
  background: rgba(211, 47, 47, 0.12);
  color: #d32f2f;
}
.badge--info {
  background: rgba(21, 101, 192, 0.12);
  color: #1565c0;
}
.badge--neutral {
  background: #eef0f3;
  color: #55606e;
}

/* ---------- Cards ---------- */
.card {
  background: #fff;
  border: 1px solid #e5eaf0;
  border-radius: 18px;
  padding: 24px;
  box-shadow: 0 2px 10px rgba(20, 30, 50, 0.04);
  margin-bottom: 20px;
  transition: box-shadow 0.2s ease;
}
.card:hover {
  box-shadow: 0 6px 18px rgba(20, 30, 50, 0.07);
}

.summary-card {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
.summary-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.summary-label {
  font-size: 12px;
  color: #8792a2;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
}
.summary-value {
  font-size: 15px;
  font-weight: 600;
  color: #1a2233;
}
.summary-value--mono {
  font-family: 'SFMono-Regular', Consolas, monospace;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  color: #1a2233;
  margin: 0 0 18px;
}

/* ---------- Content grid ---------- */
.content-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 20px;
  align-items: start;
}
.content-main {
  min-width: 0;
}
.content-side {
  display: flex;
  flex-direction: column;
}

/* ---------- Info grid ---------- */
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18px;
}
.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.info-item--full {
  grid-column: 1 / -1;
}
.info-label {
  font-size: 12px;
  color: #8792a2;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.info-value {
  font-size: 14px;
  color: #2a3447;
  line-height: 1.5;
}
.info-value--mono {
  font-family: 'SFMono-Regular', Consolas, monospace;
}
.info-value--emphasis {
  font-size: 20px;
  font-weight: 700;
  color: #1565c0;
}

/* ---------- Documents ---------- */
.documents-block {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.documents-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.document-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #f1f6fb;
  border: 1px solid #e5eaf0;
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 13px;
  color: #1565c0;
  text-decoration: none;
}
.document-chip:hover {
  border-color: #1565c0;
}
.documents-empty {
  font-size: 13px;
  color: #8792a2;
  margin: 0;
}

/* ---------- Timeline ---------- */
.timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  position: relative;
}
.timeline-step {
  display: flex;
  gap: 14px;
  position: relative;
  padding-bottom: 28px;
}
.timeline-step:last-child {
  padding-bottom: 0;
}
.timeline-step::before {
  content: '';
  position: absolute;
  left: 11px;
  top: 24px;
  bottom: 0;
  width: 2px;
  background: #e5eaf0;
}
.timeline-step:last-child::before {
  display: none;
}
.timeline-marker {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eef0f3;
  color: #8792a2;
  z-index: 1;
  transition: background 0.3s ease, color 0.3s ease;
}
.timeline-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: currentColor;
}
.timeline-step--completed .timeline-marker {
  background: #2e7d32;
  color: #fff;
}
.timeline-step--completed::before {
  background: #2e7d32;
}
.timeline-step--current .timeline-marker {
  background: #1565c0;
  color: #fff;
  box-shadow: 0 0 0 4px rgba(21, 101, 192, 0.15);
}
.timeline-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 2px;
}
.timeline-label {
  font-size: 14px;
  font-weight: 600;
  color: #1a2233;
}
.timeline-step--upcoming .timeline-label {
  color: #8792a2;
  font-weight: 500;
}
.timeline-timestamp {
  font-size: 12px;
  color: #8792a2;
}

/* ---------- History table ---------- */
.table-wrapper {
  overflow-x: auto;
}
.history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.history-table th {
  text-align: left;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #8792a2;
  font-weight: 600;
  padding: 10px 12px;
  border-bottom: 1px solid #e5eaf0;
}
.history-table td {
  padding: 12px;
  border-bottom: 1px solid #f1f3f6;
  color: #2a3447;
}
.table-empty {
  text-align: center;
  color: #8792a2;
  padding: 24px 12px;
}

/* ---------- Sidebar cards ---------- */
.side-card__title {
  font-size: 16px;
  font-weight: 700;
  color: #1a2233;
  margin: 0 0 14px;
}
.side-card__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 14px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #eef0f3;
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 8px;
}
.progress-bar__fill {
  height: 100%;
  background: linear-gradient(90deg, #1565c0, #42a5f5);
  border-radius: 999px;
  transition: width 0.5s ease;
}
.progress-percent {
  font-size: 13px;
  color: #6b7686;
  font-weight: 600;
}

.availability-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.availability-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  border-radius: 10px;
  background: #f7f9fc;
  font-size: 13px;
}
.availability-type {
  font-weight: 700;
  color: #1565c0;
}
.availability-units {
  color: #55606e;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ---------- Bottom actions ---------- */
.bottom-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 8px;
}

/* ---------- Empty / error states ---------- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 80px 20px;
  color: #6b7686;
}
.empty-state h3 {
  font-size: 18px;
  color: #1a2233;
  margin: 12px 0 4px;
}
.empty-state p {
  font-size: 14px;
  margin: 0 0 20px;
}
.empty-state--error h3 {
  color: #d32f2f;
}

/* ---------- Skeletons ---------- */
.skeleton {
  background: linear-gradient(90deg, #eef0f3 25%, #f6f7f9 37%, #eef0f3 63%);
  background-size: 400% 100%;
  animation: skeleton-shimmer 1.4s ease infinite;
  border-radius: 14px;
}
@keyframes skeleton-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}
.skeleton-stack {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.skeleton--summary {
  height: 110px;
}
.skeleton-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 20px;
}
.skeleton--card {
  height: 160px;
  margin-bottom: 20px;
}
.skeleton--card-sm {
  height: 120px;
  margin-bottom: 20px;
}
.skeleton--row {
  height: 32px;
  margin-bottom: 10px;
}
.availability-skeleton {
  display: flex;
  flex-direction: column;
}

/* ---------- Motion ---------- */
.request-details-page {
  animation: page-fade-in 0.25s ease;
}
@keyframes page-fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ---------- Dark mode ---------- */
:global(.dark) .request-details-page {
  background: #0f1420;
}
:global(.dark) .card {
  background: #161d2e;
  border-color: #2a3447;
}
:global(.dark) .page-title,
:global(.dark) .crumb-current,
:global(.dark) .section-title,
:global(.dark) .side-card__title,
:global(.dark) .summary-value,
:global(.dark) .info-value,
:global(.dark) .timeline-label {
  color: #eef1f6;
}
:global(.dark) .page-subtitle,
:global(.dark) .breadcrumb,
:global(.dark) .info-label,
:global(.dark) .summary-label,
:global(.dark) .documents-empty,
:global(.dark) .timeline-timestamp,
:global(.dark) .progress-percent {
  color: #8a93a6;
}
:global(.dark) .btn--outline {
  background: #161d2e;
  border-color: #2a3447;
  color: #6fa8dc;
}
:global(.dark) .btn--outline:hover {
  background: #1c2438;
}
:global(.dark) .history-table th {
  color: #8a93a6;
  border-color: #2a3447;
}
:global(.dark) .history-table td {
  color: #d6dbe6;
  border-color: #232c40;
}
:global(.dark) .document-chip,
:global(.dark) .availability-item {
  background: #1c2438;
  border-color: #2a3447;
}
:global(.dark) .timeline-step::before {
  background: #2a3447;
}
:global(.dark) .timeline-marker {
  background: #232c40;
}
:global(.dark) .skeleton {
  background: linear-gradient(90deg, #1c2438 25%, #232c40 37%, #1c2438 63%);
  background-size: 400% 100%;
}

/* ---------- Responsive ---------- */
@media (max-width: 960px) {
  .content-grid,
  .skeleton-grid {
    grid-template-columns: 1fr;
  }
  .summary-card {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 640px) {
  .request-details-page {
    padding: 16px;
  }
  .summary-card,
  .info-grid {
    grid-template-columns: 1fr;
  }
  .bottom-actions {
    justify-content: stretch;
  }
  .bottom-actions .btn {
    flex: 1 1 auto;
    justify-content: center;
  }
}

/* ---------- Reduced motion ---------- */
@media (prefers-reduced-motion: reduce) {
  .request-details-page,
  .card,
  .progress-bar__fill,
  .skeleton {
    animation: none !important;
    transition: none !important;
  }
}

/* ---------- Print ---------- */
@media print {
  .back-link,
  .page-header__actions,
  .bottom-actions,
  .content-side {
    display: none !important;
  }
  .content-grid {
    grid-template-columns: 1fr;
  }
}
</style>