<template>
  <div class="dashboard">
    <!-- Skeleton loading state -->
    <div v-if="loading" class="dashboard-inner">
      <div class="skeleton skeleton--header" />
      <div class="stats-grid">
        <div class="skeleton skeleton--card" v-for="n in 4" :key="n" />
      </div>
      <div class="skeleton skeleton--panel" style="height:280px" />
      <div class="skeleton skeleton--panel" style="height:260px" />
    </div>

    <div v-else class="dashboard-inner">
      <!-- Header -->
      <div class="header-row fade-in" style="--delay: 0ms">
        <div>
          <h1 class="page-title">Blood Center Dashboard</h1>
          <p class="page-subtitle">Monitor blood inventory, manage hospital requests, coordinate donor activities, and oversee daily operations.</p>
        </div>
        <div class="header-actions">
          <button type="button" class="btn-outline" @click="exportReport">
            <AssetIcon name="arrow-up-right" :size="14" />
            Export Report
          </button>
          <button type="button" class="btn-primary" @click="openRecordDonation">
            <AssetIcon name="plus" :size="15" />
            Record Donation
          </button>
        </div>
      </div>

      <!-- Stat cards -->
      <div class="stats-grid">
        <div class="stat-card fade-in" style="--delay: 60ms">
          <div class="stat-card__top">
            <p class="stat-card__label">Total Blood Units</p>
            <div class="stat-card__badge" :style="{ background: 'rgba(var(--rb-primary-rgb), 0.08)' }">
              <AssetIcon name="droplets" :size="14" style="color: var(--rb-primary)" />
            </div>
          </div>
          <p class="stat-card__value">{{ totalUnits }}</p>
          <span class="stat-chip stat-chip--neutral">Across all components</span>
          <span v-if="weeklyChangePercent !== null" class="stat-trend stat-trend--up">
            <AssetIcon name="arrow-up-right" :size="11" />
            {{ weeklyChangePercent }}% this week
          </span>
        </div>

        <div class="stat-card fade-in" style="--delay: 110ms">
          <div class="stat-card__top">
            <p class="stat-card__label">Donations Today</p>
            <div class="stat-card__badge" :style="{ background: 'rgba(var(--rb-success-rgb), 0.08)' }">
              <AssetIcon name="trending-up" :size="14" style="color: var(--rb-success)" />
            </div>
          </div>
          <p class="stat-card__value">{{ donationsToday }}</p>
          <span class="stat-chip stat-chip--neutral">Goal: {{ dailyGoal }} units/day</span>
          <span v-if="vsYesterdayPercent !== null" class="stat-trend stat-trend--up">
            <AssetIcon name="arrow-up-right" :size="11" />
            {{ vsYesterdayPercent }}% vs yesterday
          </span>
        </div>

        <div class="stat-card fade-in" style="--delay: 160ms">
          <div class="stat-card__top">
            <p class="stat-card__label">Pending Requests</p>
            <div class="stat-card__badge" :style="{ background: 'rgba(var(--rb-warning-rgb), 0.08)' }">
              <AssetIcon name="package" :size="14" style="color: var(--rb-warning)" />
            </div>
          </div>
          <p class="stat-card__value">{{ pendingRequestsCount }}</p>
          <span class="stat-chip stat-chip--neutral">Needs fulfillment</span>
        </div>

        <div class="stat-card fade-in" :class="{ 'stat-card--emphasized': criticalTypesCount > 0 }"
          style="--delay: 210ms">
          <div class="stat-card__top">
            <p class="stat-card__label">Critical Types</p>
            <div class="stat-card__badge" :style="{ background: 'rgba(var(--rb-accent-rgb), 0.08)' }">
              <AssetIcon name="alert" :size="14" style="color: var(--rb-accent)" />
            </div>
          </div>
          <p class="stat-card__value" style="color: var(--rb-accent)">{{ criticalTypesCount }}</p>
          <span class="stat-chip stat-chip--neutral truncate-chip">
            {{ criticalTypesLabel }}
          </span>
        </div>
      </div>

      <!-- Blood Inventory Overview -->
      <div class="panel fade-in" style="--delay: 260ms">
        <div class="panel-header">
          <h2 class="panel-title">Blood Inventory Overview</h2>
          <div class="search-box">
            <AssetIcon name="search" :size="14" class="search-box__icon" />
            <input v-model="inventorySearch" type="text" placeholder="Search blood type" class="search-box__input" />
          </div>
        </div>

        <div class="inventory-table-wrap">
          <table class="inventory-table">
            <thead>
              <tr>
                <th>Blood Type</th>
                <th>Whole Blood</th>
                <th>Red Blood Cells</th>
                <th>Plasma</th>
                <th>Platelets</th>
                <th>Total Units</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filteredInventory" :key="row.blood_type">
                <td>
                  <span class="type-pill">{{ row.blood_type }}</span>
                </td>
                <td>{{ row.whole_blood }}</td>
                <td>{{ row.red_blood_cells }}</td>
                <td>{{ row.plasma }}</td>
                <td>{{ row.platelets }}</td>
                <td class="inventory-table__total">{{ row.total }}</td>
                <td>
                  <span class="status-pill" :class="`status-pill--${row.status}`">
                    <span class="status-pill__dot" />
                    {{ row.status }}
                  </span>
                </td>
              </tr>
              <tr v-if="!filteredInventory.length">
                <td colspan="7" class="inventory-table__empty">No blood types match "{{ inventorySearch }}"</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Incoming Hospital Requests -->
      <div class="panel fade-in" style="--delay: 310ms">
        <div class="panel-header">
          <h2 class="panel-title">Incoming Hospital Requests</h2>
          <NuxtLink to="/blood-center/hospital-requests" class="panel-link">View all</NuxtLink>
        </div>

        <div v-if="requests.length" class="request-list">
          <div v-for="req in requests" :key="req.id" class="request-item">
            <div class="request-item__left">
              <div class="request-icon" :style="{ background: urgencyIconBg(req.urgency) }">
                <AssetIcon name="droplets" :size="15" :style="{ color: urgencyIconColor(req.urgency) }" />
              </div>
              <div class="request-info">
                <div class="request-info__row">
                  <p class="request-hospital">{{ req.hospital }}</p>
                  <span class="urgency-pill" :class="`urgency-pill--${req.urgency}`">{{ req.urgency }}</span>
                </div>
                <p class="request-meta">
                  {{ req.code }} &middot;
                  <span class="type-pill type-pill--sm">{{ req.blood_type }}</span>
                  &middot; {{ req.units }} unit{{ req.units !== 1 ? 's' : '' }} &middot; {{ req.time_ago }}
                </p>
              </div>
            </div>
            <div class="request-item__right">
              <span class="status-pill status-pill--sm" :class="`status-pill--${req.status}`">
                <span class="status-pill__dot" />
                {{ req.status }}
              </span>
              <button type="button" class="btn-primary btn-primary--sm" @click="openConfirmModal(req)">
                {{ req.status === 'processing' ? 'Fulfill' : 'Process' }}
              </button>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <AssetIcon name="clipboard-check" :size="36" style="color: var(--rb-border-strong)" />
          <p>No pending hospital requests</p>
        </div>
      </div>
    </div>

    <!-- Confirm process/fulfill modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="confirmModalOpen" class="modal-overlay" @click.self="closeConfirmModal">
          <div class="modal-card" role="dialog" aria-modal="true">
            <button type="button" class="modal-close" @click="closeConfirmModal">
              <AssetIcon name="x" :size="16" />
            </button>

            <div class="modal-icon">
              <AssetIcon name="alert" :size="18" style="color: var(--rb-primary)" />
            </div>

            <h3 class="modal-title">
              {{ selectedRequest?.status === 'processing' ? 'Mark as fulfilled?' : 'Process this request?' }}
            </h3>
            <p class="modal-subtitle" v-if="selectedRequest">
              {{ selectedRequest.code }} &middot; {{ selectedRequest.hospital }} &middot;
              {{ selectedRequest.units }} unit{{ selectedRequest.units !== 1 ? 's' : '' }} {{ selectedRequest.blood_type }}
            </p>

            <div class="modal-actions">
              <button type="button" class="btn-primary modal-actions__btn" :disabled="confirmSubmitting"
                @click="confirmAction">
                {{ confirmSubmitting ? 'Please wait…' : (selectedRequest?.status === 'processing' ? 'Fulfill' : 'Process') }}
              </button>
              <button type="button" class="btn-outline modal-actions__btn" @click="closeConfirmModal"
                :disabled="confirmSubmitting">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Record donation modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="recordModalOpen" class="modal-overlay" @click.self="closeRecordDonation">
          <div class="modal-card modal-card--form" role="dialog" aria-modal="true">
            <button type="button" class="modal-close" @click="closeRecordDonation">
              <AssetIcon name="x" :size="16" />
            </button>

            <h3 class="modal-title modal-title--left">Record Donation</h3>
            <p class="modal-subtitle modal-subtitle--left">Log a new blood donation at this center.</p>

            <form class="donation-form" @submit.prevent="submitDonation">
              <label class="form-field">
                <span class="form-field__label">Donor ID or Name *</span>
                <input v-model="donationForm.donorIdOrName" type="text" required
                  placeholder="e.g. DNR-001 or Maria Santos" class="form-field__input" />
              </label>

              <div class="form-row">
                <label class="form-field">
                  <span class="form-field__label">Blood Type *</span>
                  <select v-model="donationForm.bloodType" required class="form-field__input form-field__select">
                    <option value="" disabled>Select</option>
                    <option v-for="t in bloodTypeOptions" :key="t" :value="t">{{ t }}</option>
                  </select>
                </label>

                <label class="form-field">
                  <span class="form-field__label">Component</span>
                  <select v-model="donationForm.component" class="form-field__input form-field__select">
                    <option value="" disabled>Select</option>
                    <option v-for="c in componentOptions" :key="c.value" :value="c.value">{{ c.label }}</option>
                  </select>
                </label>
              </div>

              <label class="form-field">
                <span class="form-field__label">Volume Collected</span>
                <input v-model="donationForm.volume" type="text" placeholder="e.g. 450 mL" class="form-field__input" />
              </label>

              <label class="form-field">
                <span class="form-field__label">Notes</span>
                <textarea v-model="donationForm.notes" rows="3" placeholder="Optional remarks…"
                  class="form-field__input form-field__textarea" />
              </label>

              <p v-if="donationError" class="form-error">{{ donationError }}</p>

              <div class="modal-actions">
                <button type="submit" class="btn-primary modal-actions__btn" :disabled="donationSubmitting">
                  <AssetIcon name="check-circle" :size="15" />
                  {{ donationSubmitting ? 'Saving…' : 'Record Donation' }}
                </button>
                <button type="button" class="btn-outline modal-actions__btn" @click="closeRecordDonation"
                  :disabled="donationSubmitting">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { ref, reactive, computed, onMounted } from 'vue'
import { useUser } from '~/composables/useUser.js'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

definePageMeta({
    middleware: 'auth',
    layout: 'blood-centerdashboard',
})
const { user } = useUser()
const facilityLabel = computed(() => user.value?.facility?.facility_name || user.value?.facility_name || 'Blood Center')

const loading = ref(true)

// --- Top-level stats ---
const totalUnits = ref(0)
const donationsToday = ref(0)
const dailyGoal = ref(20)
const weeklyChangePercent = ref(null)
const vsYesterdayPercent = ref(null)

// --- Inventory ---
const inventory = ref([])
const inventorySearch = ref('')

const filteredInventory = computed(() => {
  const q = inventorySearch.value.trim().toLowerCase()
  if (!q) return inventory.value
  return inventory.value.filter(row => row.blood_type.toLowerCase().includes(q))
})

const pendingRequestsCount = computed(() => requests.value.filter(r => r.status === 'pending').length)

const criticalTypes = computed(() => inventory.value.filter(r => r.status === 'critical').map(r => r.blood_type))
const criticalTypesCount = computed(() => criticalTypes.value.length)
const criticalTypesLabel = computed(() => {
  if (!criticalTypesCount.value) return 'No critical types'
  return `${criticalTypes.value.join(' and ')} at critical`
})

const bloodTypeOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const componentOptions = [
  { value: 'whole_blood', label: 'Whole Blood' },
  { value: 'red_blood_cells', label: 'Red Blood Cells' },
  { value: 'plasma', label: 'Plasma' },
  { value: 'platelets', label: 'Platelets' }
]

// --- Hospital requests ---
const requests = ref([])

// Dev note: gigamit na CSS custom properties (--rb-primary-rgb, etc.) imbes hardcoded hex
// para consistent ang color bisan sa teleported modals.
const urgencyIconBg = (urgency) => {
  if (urgency === 'emergency') return 'rgba(var(--rb-accent-rgb), 0.08)'
  if (urgency === 'urgent') return 'rgba(var(--rb-warning-rgb), 0.08)'
  return 'rgba(var(--rb-primary-rgb), 0.08)'
}
const urgencyIconColor = (urgency) => {
  if (urgency === 'emergency') return 'var(--rb-accent)'
  if (urgency === 'urgent') return 'var(--rb-warning)'
  return 'var(--rb-primary)'
}

// --- Confirm process/fulfill modal ---
const confirmModalOpen = ref(false)
const selectedRequest = ref(null)
const confirmSubmitting = ref(false)

const openConfirmModal = (req) => {
  selectedRequest.value = req
  confirmModalOpen.value = true
}

const closeConfirmModal = () => {
  if (confirmSubmitting.value) return
  confirmModalOpen.value = false
  selectedRequest.value = null
}

const confirmAction = async () => {
  if (!selectedRequest.value) return
  confirmSubmitting.value = true
  const req = selectedRequest.value
  try {
    if (req.status === 'processing') {
      // Dev note: i-connect sa /blood-center/hospital-requests/:id/fulfill endpoint
      await bloodCenterService.fulfillRequest?.(req.id)
      req.status = 'fulfilled'
      requests.value = requests.value.filter(r => r.id !== req.id)
    } else {
      // Dev note: i-connect sa /blood-center/hospital-requests/:id/process endpoint
      await bloodCenterService.processRequest?.(req.id)
      req.status = 'processing'
    }
    confirmModalOpen.value = false
    selectedRequest.value = null
  } catch (err) {
    console.error('Failed to update hospital request:', err)
  } finally {
    confirmSubmitting.value = false
  }
}

// --- Record donation modal ---
const recordModalOpen = ref(false)
const donationSubmitting = ref(false)
const donationError = ref('')

const emptyDonationForm = () => ({
  donorIdOrName: '',
  bloodType: '',
  component: '',
  volume: '',
  notes: ''
})

const donationForm = reactive(emptyDonationForm())

const openRecordDonation = () => {
  Object.assign(donationForm, emptyDonationForm())
  donationError.value = ''
  recordModalOpen.value = true
}

const closeRecordDonation = () => {
  if (donationSubmitting.value) return
  recordModalOpen.value = false
}

const submitDonation = async () => {
  if (!donationForm.donorIdOrName.trim() || !donationForm.bloodType) {
    donationError.value = 'Donor and blood type are required.'
    return
  }
  donationSubmitting.value = true
  donationError.value = ''
  try {
    // Dev note: i-connect sa /blood-center/donations endpoint para ma-log ang bag-ong donation
    await bloodCenterService.recordDonation?.({ ...donationForm })
    donationsToday.value += 1
    recordModalOpen.value = false
  } catch (err) {
    console.error('Failed to record donation:', err)
    donationError.value = 'Something went wrong while saving. Please try again.'
  } finally {
    donationSubmitting.value = false
  }
}

const exportReport = async () => {
  try {
    // Dev note: i-connect sa /blood-center/reports/export endpoint
    await bloodCenterService.exportReport?.()
  } catch (err) {
    console.error('Failed to export report:', err)
  }
}

onMounted(async () => {
  try {
    // Dev note: gikan sa /blood-center/dashboard-summary, /inventory, /hospital-requests endpoints
    const data = await bloodCenterService.dashboardOverview?.()
    totalUnits.value = data?.total_units ?? 417
    donationsToday.value = data?.donations_today ?? 12
    dailyGoal.value = data?.daily_goal ?? 20
    weeklyChangePercent.value = data?.weekly_change_percent ?? 3.2
    vsYesterdayPercent.value = data?.vs_yesterday_percent ?? 20
    inventory.value = data?.inventory ?? [
      { blood_type: 'A+', whole_blood: 45, red_blood_cells: 23, plasma: 18, platelets: 12, total: 98, status: 'adequate' },
      { blood_type: 'A-', whole_blood: 8, red_blood_cells: 5, plasma: 3, platelets: 2, total: 18, status: 'low' },
      { blood_type: 'B+', whole_blood: 32, red_blood_cells: 19, plasma: 14, platelets: 8, total: 73, status: 'adequate' },
      { blood_type: 'B-', whole_blood: 4, red_blood_cells: 2, plasma: 2, platelets: 1, total: 9, status: 'critical' },
      { blood_type: 'AB+', whole_blood: 15, red_blood_cells: 9, plasma: 7, platelets: 4, total: 35, status: 'adequate' },
      { blood_type: 'AB-', whole_blood: 3, red_blood_cells: 1, plasma: 1, platelets: 1, total: 6, status: 'critical' },
      { blood_type: 'O+', whole_blood: 67, red_blood_cells: 41, plasma: 28, platelets: 16, total: 152, status: 'adequate' },
      { blood_type: 'O-', whole_blood: 11, red_blood_cells: 7, plasma: 5, platelets: 3, total: 26, status: 'low' }
    ]
    requests.value = data?.hospital_requests ?? [
      { id: 1, code: 'REQ-2025-0045', hospital: "St. Luke's Medical Center", urgency: 'urgent', blood_type: 'O-', units: 4, time_ago: '2h ago', status: 'pending' },
      { id: 2, code: 'REQ-2025-0044', hospital: 'Philippine General Hospital', urgency: 'routine', blood_type: 'A+', units: 2, time_ago: '5h ago', status: 'processing' },
      { id: 3, code: 'REQ-2025-0043', hospital: 'Makati Medical Center', urgency: 'emergency', blood_type: 'B+', units: 3, time_ago: '1d ago', status: 'pending' }
    ]
  } catch (err) {
    console.error('Failed to load blood center dashboard:', err)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
/*
 * Dev note: Color tokens gibalhin sa :global(:root) / :global(.dark) imbes .dashboard scope.
 * Kay ang mga modal naa sa <Teleport to="body">, dili na sila DOM descendant sa .dashboard,
 * so ang CSS vars nga gi-declare sa .dashboard { } dili ma-inherit sa teleported content.
 * Kung naa nay laing page (e.g. donor dashboard) nga naga-declare og parehas nga --rb-* names
 * sa iyang kaugalingong :root, i-check lang para dili mag-conflict — mas maayo unta ni ibutang
 * sa usa ka shared global.css/app.vue sa umaabot.
 */
:global(:root) {
  --rb-primary: #1565C0;
  --rb-primary-rgb: 21, 101, 192;
  --rb-secondary: #42A5F5;
  --rb-accent: #D32F2F;
  --rb-accent-rgb: 211, 47, 47;
  --rb-success: #2E7D32;
  --rb-success-rgb: 46, 125, 50;
  --rb-warning: #F57C00;
  --rb-warning-rgb: 245, 124, 0;

  --rb-text-primary: #1F2937;
  --rb-text-secondary: #94A3B8;
  --rb-border: #EEF1F5;
  --rb-border-strong: #E2E8F0;
  --rb-border-hover: #E2E8F0;
  --rb-surface: #FFFFFF;
  --rb-surface-alt: #FAFBFC;
  --rb-surface-hover: #F8FAFC;
  --rb-page-bg: #F7F8FA;
  --rb-placeholder: #B0BAC5;
  --rb-skeleton-a: #EEF1F5;
  --rb-skeleton-b: #F6F8FA;
  --rb-overlay: rgba(15, 23, 42, 0.45);
  --rb-shadow-rgb: 15, 23, 42;
}

:global(.dark) {
  --rb-text-primary: #F1F5F9;
  --rb-text-secondary: #94A3B8;
  --rb-border: #334155;
  --rb-border-strong: #334155;
  --rb-border-hover: #475569;
  --rb-surface: #1E293B;
  --rb-surface-alt: #182234;
  --rb-surface-hover: #263449;
  --rb-page-bg: #0F172A;
  --rb-skeleton-a: #1E293B;
  --rb-skeleton-b: #263449;
}

.dashboard {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  max-width: 1200px;
  background: var(--rb-page-bg);
  margin: 0 auto;
  padding: 24px 32px 40px;
  transition: background-color 0.2s ease;
}

/* Skeleton loading */
.skeleton {
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  border-radius: 14px;
  animation: shimmer 1.4s ease infinite;
}

.skeleton--header { height: 44px; max-width: 320px; }
.skeleton--card { height: 108px; }
.skeleton--panel { border-radius: 14px; }

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

.fade-in {
  animation: fadeInUp 0.45s ease both;
  animation-delay: var(--delay, 0ms);
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .fade-in, .skeleton { animation: none !important; }
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
  font-size: 21px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--rb-text-primary);
  margin: 0;
}

.page-subtitle {
  font-size: 13px;
  color: var(--rb-text-secondary);
  margin: 3px 0 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 9px 15px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  background: var(--rb-primary);
  border: 1px solid var(--rb-primary);
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.06);
  transition: opacity 0.15s ease, transform 0.15s ease;
  border: none;
  cursor: pointer;
  text-decoration: none;
  line-height: 1.2;
  font-family: inherit;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.92;
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary:focus-visible {
  outline: 2px solid var(--rb-primary);
  outline-offset: 2px;
}

.btn-primary--sm {
  padding: 7px 13px;
  font-size: 12px;
}

.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 15px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--rb-text-primary);
  background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
  line-height: 1.2;
  font-family: inherit;
}

.btn-outline:hover:not(:disabled) {
  background: var(--rb-surface-hover);
  border-color: var(--rb-border-hover);
}

.btn-outline:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-outline:focus-visible {
  outline: 2px solid var(--rb-primary);
  outline-offset: 2px;
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.stat-card {
  background: var(--rb-surface);
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
  border: 1px solid var(--rb-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background-color 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(var(--rb-shadow-rgb), 0.06);
  border-color: var(--rb-border-hover);
}

.stat-card--emphasized {
  border-color: rgba(var(--rb-accent-rgb), 0.25);
  box-shadow: 0 0 0 1px rgba(var(--rb-accent-rgb), 0.13), 0 4px 14px rgba(var(--rb-accent-rgb), 0.08);
}

.stat-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stat-card__label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--rb-text-secondary);
  margin: 0;
}

.stat-card__badge {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-card__value {
  font-size: 24px;
  font-weight: 800;
  color: var(--rb-text-primary);
  margin: 0;
  line-height: 1;
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  max-width: 100%;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 999px;
}

.stat-chip--neutral {
  background: var(--rb-surface-alt);
  color: var(--rb-text-secondary);
}

.truncate-chip {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat-trend {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 700;
}

.stat-trend--up { color: var(--rb-success); }

/* Panels */
.panel {
  background: var(--rb-surface);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
  border: 1px solid var(--rb-border);
  overflow: hidden;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--rb-border);
}

.panel-title {
  font-weight: 700;
  font-size: 14px;
  color: var(--rb-text-primary);
  margin: 0;
}

.panel-link {
  font-size: 12px;
  font-weight: 600;
  color: var(--rb-primary);
  text-decoration: none;
  flex-shrink: 0;
}

.panel-link:hover { text-decoration: underline; }

.search-box {
  position: relative;
  flex-shrink: 0;
  width: 200px;
}

.search-box__icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--rb-text-secondary);
  pointer-events: none;
}

.search-box__input {
  width: 100%;
  padding: 7px 10px 7px 30px;
  border-radius: 999px;
  border: 1px solid var(--rb-border-strong);
  font-size: 12.5px;
  background: var(--rb-surface-alt);
  color: var(--rb-text-primary);
  transition: border-color 0.15s ease, background 0.15s ease;
}

.search-box__input:focus {
  outline: none;
  border-color: var(--rb-primary);
  background: var(--rb-surface);
}

/* Inventory table */
.inventory-table-wrap {
  overflow-x: auto;
}

.inventory-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.inventory-table thead th {
  text-align: left;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--rb-text-secondary);
  padding: 10px 18px;
  background: var(--rb-surface-alt);
  white-space: nowrap;
}

.inventory-table tbody td {
  padding: 12px 18px;
  border-top: 1px solid var(--rb-surface-alt);
  color: var(--rb-text-primary);
  white-space: nowrap;
}

.inventory-table__total {
  font-weight: 700;
}

.inventory-table__empty {
  text-align: center;
  color: var(--rb-text-secondary);
  padding: 28px;
  white-space: normal;
}

.type-pill {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(var(--rb-accent-rgb), 0.08);
  color: var(--rb-accent);
}

.type-pill--sm {
  font-size: 11px;
  padding: 2px 8px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  text-transform: capitalize;
}

.status-pill--sm {
  font-size: 11px;
  padding: 3px 9px;
}

.status-pill__dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
  flex-shrink: 0;
}

.status-pill--adequate { background: rgba(var(--rb-success-rgb), 0.08); color: var(--rb-success); }
.status-pill--low { background: rgba(var(--rb-warning-rgb), 0.08); color: var(--rb-warning); }
.status-pill--critical { background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent); }
.status-pill--pending { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }
.status-pill--processing { background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary); }

/* Hospital requests */
.request-list {
  display: flex;
  flex-direction: column;
}

.request-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 18px;
  border-top: 1px solid var(--rb-surface-alt);
}

.request-item:first-child { border-top: none; }

.request-item__left {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.request-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.request-info {
  min-width: 0;
}

.request-info__row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.request-hospital {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--rb-text-primary);
  margin: 0;
}

.urgency-pill {
  font-size: 10.5px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  text-transform: capitalize;
  flex-shrink: 0;
}

.urgency-pill--urgent { background: rgba(var(--rb-warning-rgb), 0.08); color: var(--rb-warning); }
.urgency-pill--routine { background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary); }
.urgency-pill--emergency { background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent); }

.request-meta {
  font-size: 11.5px;
  color: var(--rb-text-secondary);
  margin: 4px 0 0;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.request-item__right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.empty-state {
  padding: 28px;
  text-align: center;
  color: var(--rb-text-secondary);
  font-size: 13px;
}

/* Modals */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--rb-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 1000;
}

.modal-card {
  background: var(--rb-surface);
  border-radius: 16px;
  padding: 24px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 50px rgba(var(--rb-shadow-rgb), 0.25);
  position: relative;
}
.modal-card .btn-primary {
  color: #ffffff;
  background: var(--rb-primary);
  border: 1px solid var(--rb-primary);
}

.modal-card .btn-primary:hover:not(:disabled) {
  opacity: 0.92;
  transform: translateY(-1px);
}

.modal-card .btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-card .btn-outline {
  color: var(--rb-text-primary);
  background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong);
}

.modal-card .btn-outline:hover:not(:disabled) {
  background: var(--rb-surface-hover);
  border-color: var(--rb-border-hover);
}

.modal-card .btn-outline:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-card--form {
  max-width: 460px;
}

.modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--rb-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease;
}

.modal-close:hover { background: var(--rb-surface-alt); }

.modal-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(var(--rb-primary-rgb), 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}

.modal-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--rb-text-primary);
  margin: 0 0 6px;
}

.modal-title--left { margin-top: 4px; }

.modal-subtitle {
  font-size: 12.5px;
  color: var(--rb-text-secondary);
  margin: 0 0 20px;
}

.modal-subtitle--left { margin-bottom: 18px; }

.modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.modal-actions__btn {
  flex: 1;
}

/* Donation form */
.donation-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--rb-text-primary);
}

.form-field__input {
  padding: 9px 12px;
  border-radius: 9px;
  border: 1px solid var(--rb-border-strong);
  font-size: 13px;
  color: var(--rb-text-primary);
  background: var(--rb-surface);
  transition: border-color 0.15s ease;
  font-family: inherit;
}

.form-field__input:focus {
  outline: none;
  border-color: var(--rb-primary);
  box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.08);
}

.form-field__input::placeholder { color: var(--rb-placeholder); }

.form-field__select {
  appearance: none;
  background: var(--rb-surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E") no-repeat right 12px center;
}

.form-field__textarea {
  resize: vertical;
  min-height: 64px;
}

.form-error {
  font-size: 12px;
  color: var(--rb-accent);
  margin: -6px 0 0;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.15s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

/* Responsive */
@media (max-width: 1024px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 640px) {
  .dashboard { padding: 16px 16px 32px; }
  .header-row { flex-direction: column; align-items: stretch; }
  .header-actions { justify-content: space-between; }
  .panel-header { flex-direction: column; align-items: stretch; }
  .search-box { width: 100%; }
  .request-item { flex-direction: column; align-items: stretch; }
  .request-item__right { justify-content: space-between; }
  .form-row { grid-template-columns: 1fr; }
}
</style>