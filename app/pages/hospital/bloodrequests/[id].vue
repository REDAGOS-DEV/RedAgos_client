<template>
  <div class="request-details-page">
    <!-- ============== PAGE HEADER ============== -->
    <div class="page-header">
      <button class="back-link" type="button" @click="goBack">
        <AssetIcon name="arrow-left" />
        <span>Back to Blood Requests</span>
      </button>
<!--
    <nav class="breadcrumb" aria-label="Breadcrumb">
        <span>Hospital Portal</span>
        <span class="crumb-sep">/</span>
        <span>Blood Requests</span>
        <span class="crumb-sep">/</span>
        <span class="crumb-current">Request Details</span>
      </nav> -->

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

          <!-- SECTION: BILLING & PAYMENT -->
          <section id="request-billing" class="card billing-card">
            <div class="billing-card__header">
              <h2 class="section-title">Billing &amp; Payment</h2>
              <span
                v-if="showBillingSection && billing"
                class="status-badge status-badge--sm"
                :class="billingStatusColorClass"
              >
                {{ billing.status }}
              </span>
            </div>

            <div v-if="!showBillingSection" class="billing-gated">
              <AssetIcon name="clock" />
              <p>Billing becomes available once blood availability is confirmed for this request.</p>
            </div>

            <div v-else-if="isLoadingBilling" class="availability-skeleton">
              <div class="skeleton skeleton--row" v-for="n in 3" :key="n" />
            </div>

            <template v-else-if="billing">
              <div class="billing-summary">
                <div class="summary-item">
                  <span class="summary-label">Billing Reference</span>
                  <span class="summary-value summary-value--mono">{{ billing.billing_id }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Billing Date</span>
                  <span class="summary-value">{{ formatDate(billing.billing_date) }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Total Amount</span>
                  <span class="summary-value info-value--emphasis">{{ formatCurrency(billing.total_amount) }}</span>
                </div>
              </div>

              <div class="table-wrapper">
                <table class="history-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in lineItemsWithSubtotal" :key="item.component_id">
                      <td>{{ item.component_name }}</td>
                      <td>{{ item.quantity }}</td>
                      <td>{{ formatCurrency(item.price) }}</td>
                      <td>{{ formatCurrency(item.subtotal) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div v-if="billing.status !== 'PAID'" class="payment-panel">
                <span class="info-label">Select Payment Method</span>
                <div class="payment-chips" role="radiogroup" aria-label="Payment method">
                  <button
                    type="button"
                    class="payment-chip"
                    :class="{ 'payment-chip--active': selectedPaymentMethod === 'CASH' }"
                    role="radio"
                    :aria-checked="selectedPaymentMethod === 'CASH'"
                    @click="selectedPaymentMethod = 'CASH'"
                  >
                    <AssetIcon name="box" :size="16" />
                    <span>Cash</span>
                  </button>
                  <button
                    type="button"
                    class="payment-chip"
                    :class="{ 'payment-chip--active': selectedPaymentMethod === 'GCASH' }"
                    role="radio"
                    :aria-checked="selectedPaymentMethod === 'GCASH'"
                    @click="selectedPaymentMethod = 'GCASH'"
                  >
                    <AssetIcon name="phone" :size="16" />
                    <span>GCash</span>
                  </button>
                </div>
                <button
                  class="btn btn--primary"
                  type="button"
                  :disabled="!selectedPaymentMethod || isPaying"
                  @click="handlePay"
                >
                  <span v-if="isPaying">Processing…</span>
                  <span v-else>Pay Now</span>
                </button>
              </div>

              <div v-if="billing.status === 'PAID' && payments.length" class="receipt-block">
                <AssetIcon name="check-circle" />
                <div class="receipt-block__body">
                  <span class="receipt-block__title">Payment received</span>
                  <span class="receipt-block__meta">
                    {{ formatCurrency(payments[payments.length - 1].amount_paid) }}
                    &middot; {{ payments[payments.length - 1].payment_method }}
                    &middot; {{ formatDateTime(payments[payments.length - 1].paid_at) }}
                  </span>
                </div>
                <button
                  class="btn btn--outline btn--sm"
                  type="button"
                  @click="showToast('Receipt download will be available once connected to the billing system.')"
                >
                  <AssetIcon name="download" :size="16" />
                  <span>Download Receipt</span>
                </button>
              </div>

              <div v-if="payments.length" class="payment-history">
                <span class="info-label">Payment History</span>
                <div class="table-wrapper">
                  <table class="history-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Method</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="p in payments" :key="p.payment_id">
                        <td>{{ formatDateTime(p.paid_at) }}</td>
                        <td>{{ p.payment_method }}</td>
                        <td>{{ formatCurrency(p.amount_paid) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>
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
              <button v-if="showBillingSection" class="btn btn--outline btn--full" type="button" @click="scrollToBilling">
                <AssetIcon name="clipboard-list" />
                <span>View Billing</span>
              </button>
            </div>
          </section>
        </aside>
      </div>

      <!-- ============== PAYMENT TOAST ============== -->
      <Transition name="toast">
        <div v-if="toastMessage" class="toast" role="status">
          <AssetIcon name="check-circle" :size="16" style="color:#346538" />
          {{ toastMessage }}
        </div>
      </Transition>

      <!-- ============== BOTTOM ACTIONS ============== -->
      <div class="bottom-actions">
        <button class="btn btn--outline" type="button" @click="goBack">Back to Blood Requests</button>
        <button class="btn btn--outline" type="button" @click="scrollToTimeline">Track Request</button>
        <button class="btn btn--outline" type="button" @click="handleDownloadPdf">Download PDF</button>
        <button class="btn btn--outline" type="button" @click="handlePrint">Print</button>
        <NuxtLink
          v-if="canEdit"
          :to="`/hospital/bloodrequests/edit/${requestId}`"
          class="btn btn--primary"
        >
          Edit
        </NuxtLink>
      </div>
    </template>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'

definePageMeta({
  middleware: ['auth', 'hospital-portal'],
  layout: 'hospitaldashboard',
})

// Editorial serif for headings only — scoped to this page, does not touch
// the app-wide font set in nuxt.config.ts.
useHead({
  link: [
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,500;0,6..72,600;1,6..72,500&display=swap',
    },
  ],
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

const {
  billing,
  lineItems,
  payments,
  isLoadingBilling,
  isPaying,
  fetchBilling,
  payBilling,
} = useBloodRequestBilling(requestId)

onMounted(() => {
  fetchRequest()
  fetchAvailability()
  fetchBilling()
})

// Billing only becomes relevant once blood availability has been confirmed
// for the request — see the Billing BPMN in the proposal (Fig. 10).
const showBillingSection = computed(() => !!request.value?.status && request.value.status !== 'Pending')

const lineItemsWithSubtotal = computed(() =>
  lineItems.value.map((item) => ({ ...item, subtotal: item.quantity * item.price }))
)

const selectedPaymentMethod = ref(null)

const billingStatusMap = { UNPAID: 'warning', PARTIAL: 'info', PAID: 'success' }
const billingStatusColorClass = computed(() => {
  const s = billing.value?.status
  return s ? `badge--${billingStatusMap[s] ?? 'neutral'}` : 'badge--neutral'
})

async function handlePay() {
  if (!selectedPaymentMethod.value || !billing.value) return
  const ok = await payBilling({ amount: billing.value.total_amount, method: selectedPaymentMethod.value })
  if (ok) showToast('Payment successful.')
}

function scrollToBilling() {
  document.getElementById('request-billing')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function formatCurrency(value) {
  if (value === null || value === undefined) return '—'
  return `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const toastMessage = ref('')
let toastTimer = null
function showToast(msg) {
  toastMessage.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMessage.value = '' }, 3000)
}

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
  navigateTo('/hospital/bloodrequests')
}

function handlePrint() {
  window.print()
}

async function handleDownloadPdf() {
  if (!request.value) return
  try {
    const { data, error } = await useApi().get(
      `/hospital/bloodrequests/${requestId}/download`,
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

<style scoped>
.request-details-page {
  --rb-canvas: #FBF9F6;
  --rb-surface: #FFFFFF;
  --rb-border: #EAE7E1;
  --rb-text: #1F1D1B;
  --rb-text-muted: #78746D;
  padding: 24px;
  background: var(--rb-canvas);
  min-height: 100%;
}
:global(.dark .request-details-page) {
  --rb-canvas: #14120F;
  --rb-surface: #1C1A17;
  --rb-border: #2E2B26;
  --rb-text: #EDEAE5;
  --rb-text-muted: #A19C93;
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
  font-family: 'Newsreader', var(--rb-font-sans);
  font-size: 32px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.1;
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
  border-radius: 6px;
  padding: 10px 16px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
  text-decoration: none;
}
.btn:active {
  transform: scale(0.98);
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn--primary {
  background: #1565c0;
  color: #fff;
}
.btn--primary:hover:not(:disabled) {
  background: #0f4f9c;
}
.btn--outline {
  background: var(--rb-surface);
  color: #1565c0;
  border-color: var(--rb-border);
}
.btn--outline:hover {
  background: #f1f6fb;
  border-color: #1565c0;
}
.btn--full {
  width: 100%;
  justify-content: center;
}
.btn--sm {
  padding: 6px 12px;
  font-size: 13px;
}

/* ---------- Status badges ---------- */
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
}
.status-badge--sm {
  padding: 4px 10px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.badge--success {
  background: #EDF3EC;
  color: #346538;
}
.badge--warning {
  background: #FBF3DB;
  color: #956400;
}
.badge--danger {
  background: #FDEBEC;
  color: #9F2F2D;
}
.badge--info {
  background: #E1F3FE;
  color: #1F6C9F;
}
.badge--neutral {
  background: #F0EEE9;
  color: #6B675F;
}
:global(.dark .badge--success) { background: #1D2B1E; color: #8FCB94; }
:global(.dark .badge--warning) { background: #322A12; color: #E4B54B; }
:global(.dark .badge--danger) { background: #331A19; color: #E58E8B; }
:global(.dark .badge--info) { background: #122733; color: #7EC1EE; }
:global(.dark .badge--neutral) { background: #2A2721; color: #B3AEA4; }

/* ---------- Cards ---------- */
.card {
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  padding: 24px;
  box-shadow: none;
  margin-bottom: 20px;
  transition: box-shadow 0.2s ease;
}
.card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
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
  font-family: 'Newsreader', var(--rb-font-sans);
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -0.01em;
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
  background: #1565c0;
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

/* ---------- Billing & Payment ---------- */
.billing-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}
.billing-card__header .section-title {
  margin: 0;
}
.billing-gated {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
  padding: 28px 12px;
  color: var(--rb-text-muted);
}
.billing-gated p {
  margin: 0;
  font-size: 13.5px;
  max-width: 34ch;
}
.billing-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  margin-bottom: 20px;
}
.payment-panel {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--rb-border);
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}
.payment-chips {
  display: flex;
  gap: 10px;
}
.payment-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 999px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface);
  color: var(--rb-text);
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.payment-chip--active {
  border-color: #1565c0;
  background: #E1F3FE;
  color: #1F6C9F;
}
.receipt-block {
  margin-top: 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: 10px;
  background: #EDF3EC;
  color: #346538;
}
.receipt-block__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}
.receipt-block__title {
  font-size: 14px;
  font-weight: 700;
}
.receipt-block__meta {
  font-size: 12.5px;
  opacity: 0.85;
}
.payment-history {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ---------- Toast ---------- */
.toast {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  padding: 12px 18px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  font-size: 13.5px;
  font-weight: 600;
  color: var(--rb-text);
}
.toast-enter-active,
.toast-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  transform: translate(-50%, 8px);
  opacity: 0;
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
  background: linear-gradient(90deg, var(--rb-border) 25%, var(--rb-canvas) 37%, var(--rb-border) 63%);
  background-size: 400% 100%;
  animation: skeleton-shimmer 1.4s ease infinite;
  border-radius: 12px;
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
/* .request-details-page / .card / .skeleton already read the warm --rb-*
   tokens redefined near the top of this file, so no hardcoded overrides
   are needed for those here. */
:global(.dark .page-title),
:global(.dark .crumb-current),
:global(.dark .section-title),
:global(.dark .side-card__title),
:global(.dark .summary-value),
:global(.dark .info-value),
:global(.dark .timeline-label) {
  color: var(--rb-text);
}
:global(.dark .page-subtitle),
:global(.dark .breadcrumb),
:global(.dark .info-label),
:global(.dark .summary-label),
:global(.dark .documents-empty),
:global(.dark .timeline-timestamp),
:global(.dark .progress-percent) {
  color: var(--rb-text-muted);
}
:global(.dark .btn--outline) {
  background: var(--rb-surface);
  border-color: var(--rb-border);
  color: #6fa8dc;
}
:global(.dark .btn--outline:hover) {
  background: #262319;
}
:global(.dark .history-table th) {
  color: var(--rb-text-muted);
  border-color: var(--rb-border);
}
:global(.dark .history-table td) {
  color: var(--rb-text);
  border-color: var(--rb-border);
}
:global(.dark .document-chip),
:global(.dark .availability-item) {
  background: #262319;
  border-color: var(--rb-border);
}
:global(.dark) .timeline-step::before {
  background: var(--rb-border);
}
:global(.dark .timeline-marker) {
  background: #262319;
}
:global(.dark .billing-gated) {
  color: var(--rb-text-muted);
}
:global(.dark .payment-chip) {
  background: var(--rb-surface);
  border-color: var(--rb-border);
  color: var(--rb-text);
}
:global(.dark .payment-chip--active) {
  border-color: #7EC1EE;
  background: #122733;
  color: #7EC1EE;
}
:global(.dark .receipt-block) {
  background: #1D2B1E;
  color: #8FCB94;
}
:global(.dark .toast) {
  background: var(--rb-surface);
  border-color: var(--rb-border);
  color: var(--rb-text);
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
  .info-grid,
  .billing-summary {
    grid-template-columns: 1fr;
  }
  .payment-chips {
    flex-wrap: wrap;
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
