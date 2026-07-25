<template>
  <div class="dashboard">
    <!-- Skeleton loading state -->
    <div v-if="loading" class="dashboard-inner">
      <div class="skeleton skeleton--header" />
      <div class="skeleton skeleton--filters" />
      <div class="panel">
        <div class="skeleton-row" v-for="n in 6" :key="n">
          <div class="skeleton skeleton--avatar" />
          <div class="skeleton-row__lines">
            <div class="skeleton skeleton--line-wide" />
            <div class="skeleton skeleton--line-narrow" />
          </div>
          <div class="skeleton skeleton--badge" />
        </div>
      </div>
    </div>

    <div v-else class="dashboard-inner">
      <!-- Header -->
      <div class="header-row fade-in" style="--delay: 0ms">
        <div>
          <h1 class="page-title">Blood Requests</h1>
          <p class="page-subtitle">Track and manage all your submitted blood requests</p>
        </div>
        <button type="button" class="btn-primary" @click="showModal = true">
          <AssetIcon name="file-plus" :size="15" />
          New Request
        </button>
      </div>

      <!-- Filters -->
      <div class="filters-row fade-in" style="--delay: 60ms">
        <div class="search-box">
          <AssetIcon name="search" :size="15" class="search-box__icon" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by reference number or patient name..."
            class="search-box__input"
          />
        </div>

        <div class="filter-chips">
          <button
            v-for="opt in statusFilters"
            :key="opt.value"
            class="filter-chip"
            :class="{ 'filter-chip--active': activeStatus === opt.value }"
            @click="activeStatus = opt.value"
          >
            {{ opt.label }}
            <span v-if="opt.value !== 'all'" class="filter-chip__count">{{ statusCounts[opt.value] || 0 }}</span>
          </button>
        </div>

        <select v-model="urgencyFilter" class="select-input">
          <option value="all">All Urgency</option>
          <option value="emergency">Emergency</option>
          <option value="routine">Routine</option>
        </select>
      </div>

      <!-- Requests list -->
      <div class="panel fade-in" style="--delay: 100ms">
        <div v-if="filteredRequests.length" class="request-list">
          <NuxtLink
            v-for="req in filteredRequests"
            :key="req.id"
            :to="`/hospital/bloodrequests/${req.id}`"
            class="request-row"
          >
            <div class="request-row__left">
              <div class="donation-icon" :style="{ background: '#1565C014' }">
                <span class="blood-type-label" style="color:#1565C0">{{ req.blood_type }}</span>
              </div>
              <div class="min-w-0">
                <p class="request-row__title">
                  {{ req.reference_number }} &middot; {{ req.quantity }} unit{{ req.quantity !== 1 ? 's' : '' }} {{ req.component_name }}
                </p>
                <p class="request-row__meta">
                  {{ req.patient_name }} &middot; {{ req.ward || '—' }} &middot; Submitted {{ req.submitted_at_relative }}
                </p>
              </div>
            </div>

            <div class="request-row__right">
              <span v-if="req.urgency_level === 'emergency'" class="badge badge--urgent">Emergency</span>
              <span class="badge capitalize" :style="{
                background: statusMap[req.status]?.bg || '#f1f5f9',
                color: statusMap[req.status]?.color || '#64748b',
              }">
                {{ statusMap[req.status]?.label || req.status }}
              </span>
              <AssetIcon name="chevron-right" :size="15" class="request-row__chevron" />
            </div>
          </NuxtLink>
        </div>

        <div v-else class="empty-state">
          <AssetIcon name="inbox" :size="36" style="color:#e5e7eb" />
          <p>{{ searchQuery || activeStatus !== 'all' || urgencyFilter !== 'all' ? 'No matching requests found' : 'No blood requests yet' }}</p>
          <button
            v-if="!searchQuery && activeStatus === 'all'"
            type="button"
            class="btn-primary btn-primary--sm"
            @click="showModal = true"
          >
            Create Request
          </button>
        </div>
      </div>
    </div>

    <Newrequest v-model="showModal" @created="handleCreated" />
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import Newrequest from '~/components/hospital/newrequest.vue'
import { ref, computed, onMounted } from 'vue'
import { hospitalService } from '~/api/hospital/HospitalService'

definePageMeta({ middleware: 'auth', layout: 'hospitaldashboard' })

const loading = ref(true)
const allRequests = ref([])
const showModal = ref(false)

const searchQuery = ref('')
const activeStatus = ref('all')
const urgencyFilter = ref('all')

const statusFilters = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'approved', label: 'Approved' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'rejected', label: 'Rejected' },
]

const statusMap = {
  pending: { label: 'Pending', bg: '#F57C0014', color: '#F57C00' },
  processing: { label: 'Processing', bg: '#42A5F514', color: '#1565C0' },
  approved: { label: 'Approved', bg: '#2E7D3214', color: '#2E7D32' },
  dispatched: { label: 'Dispatched', bg: '#1565C014', color: '#1565C0' },
  received: { label: 'Received', bg: '#2E7D3214', color: '#2E7D32' },
  rejected: { label: 'Rejected', bg: '#D32F2F14', color: '#D32F2F' },
}

const statusCounts = computed(() => {
  const counts = {}
  for (const r of allRequests.value) {
    counts[r.status] = (counts[r.status] || 0) + 1
  }
  return counts
})

const filteredRequests = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return allRequests.value.filter(r => {
    const matchesQuery = !q ||
      r.reference_number?.toLowerCase().includes(q) ||
      r.patient_name?.toLowerCase().includes(q)
    const matchesStatus = activeStatus.value === 'all' || r.status === activeStatus.value
    const matchesUrgency = urgencyFilter.value === 'all' || r.urgency_level === urgencyFilter.value
    return matchesQuery && matchesStatus && matchesUrgency
  })
})

async function fetchRequests({ silent = false } = {}) {
  if (!silent) loading.value = true
  try {
    // // Dev note: listRequests() kay mag-fetch sa GET /hospital/requests endpoint
    // // nga mag-return og array sa blood request records nga naka-scope sa naka-login nga facility
    const data = await hospitalService.listRequests()
    allRequests.value = data.requests ?? data ?? []
  } catch (err) {
    console.error('Failed to load blood requests:', err)
  } finally {
    if (!silent) loading.value = false
  }
}

// Re-fetch the list after a new request is successfully created in the modal,
// so the row reflects full server-computed fields (reference_number, blood_type, etc.)
function handleCreated() {
  fetchRequests({ silent: true })
}

onMounted(() => {
  fetchRequests()
})
</script>

<style scoped>
.dashboard {
  --primary: #1565c0;
  --accent: #d32f2f;
  --success: #2e7d32;
  --warning: #f57c00;
  --text-primary: #1f2937;
  --text-secondary: #94a3b8;
  --border: #eef1f5;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  max-width: 1200px;
  background: #F7F8FA;
  margin: 0 auto;
  padding: 24px 32px 40px;
  transition: background-color 0.2s ease;
}

.skeleton {
  background: linear-gradient(90deg, #eef1f5 25%, #f6f8fa 37%, #eef1f5 63%);
  background-size: 400% 100%;
  border-radius: 14px;
  animation: shimmer 1.4s ease infinite;
}
.skeleton--header { height: 44px; max-width: 320px; margin-bottom: 20px; }
.skeleton--filters { height: 44px; margin-bottom: 20px; }
.skeleton--avatar { width: 34px; height: 34px; border-radius: 999px; flex-shrink: 0; }
.skeleton--line-wide { height: 13px; width: 60%; margin-bottom: 8px; }
.skeleton--line-narrow { height: 11px; width: 40%; }
.skeleton--badge { width: 70px; height: 22px; border-radius: 999px; flex-shrink: 0; }

.skeleton-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid #fafbfc;
}
.skeleton-row:last-child { border-bottom: none; }
.skeleton-row__lines { flex: 1; }

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
  color: var(--text-primary);
  margin: 0;
}
.page-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 3px 0 0;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 15px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: white;
  background: var(--primary);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  transition: opacity 0.15s ease, transform 0.15s ease;
  border: none;
  cursor: pointer;
  text-decoration: none;
  flex-shrink: 0;
}
.btn-primary:hover { opacity: 0.92; transform: translateY(-1px); }
.btn-primary:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.btn-primary--sm { padding: 8px 18px; font-size: 12px; margin-top: 4px; }

/* Filters */
.filters-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: white;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 9px 12px;
  flex: 1;
  min-width: 220px;
  transition: border-color 0.15s ease, background-color 0.2s ease;
}
.search-box:focus-within { border-color: #1565C050; }
.search-box__icon { color: var(--text-secondary); flex-shrink: 0; }
.search-box__input {
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  flex: 1;
  color: var(--text-primary);
}
.search-box__input::placeholder { color: var(--text-secondary); }

.filter-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: white;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}
.filter-chip:hover { border-color: #cbd5e1; }
.filter-chip--active {
  background: #1565C014;
  border-color: #1565C040;
  color: var(--primary);
}
.filter-chip__count {
  font-size: 10.5px;
  font-weight: 700;
  opacity: 0.75;
}

.select-input {
  padding: 9px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: white;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
  flex-shrink: 0;
}

/* Panel + list */
.panel {
  background: white;
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
  border: 1px solid var(--border);
  overflow: hidden;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.request-list {
  display: flex;
  flex-direction: column;
}

.request-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid #fafbfc;
  text-decoration: none;
  transition: background 0.15s ease;
}
.request-row:last-child { border-bottom: none; }
.request-row:hover { background: #f8fafc; }

.request-row__left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.donation-icon {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.blood-type-label { font-size: 11px; font-weight: 800; }

.request-row__title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}
.request-row__meta {
  font-size: 11.5px;
  color: var(--text-secondary);
  margin: 2px 0 0;
}

.request-row__right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.badge {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 999px;
  display: inline-block;
}
.badge--urgent {
  background: #D32F2F14;
  color: #D32F2F;
}
.capitalize { text-transform: capitalize; }

.request-row__chevron { color: #d1d5db; }

.empty-state {
  padding: 40px 20px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}

/* Responsive */
@media (max-width: 640px) {
  .dashboard { padding: 16px 16px 32px; }
  .header-row { flex-direction: column; align-items: stretch; }
  .filters-row { flex-direction: column; align-items: stretch; }
  .request-row { flex-wrap: wrap; }
}

/* Dark mode */
:global(.dark .dashboard) {
  --text-primary: #F1F5F9;
  --text-secondary: #94A3B8;
  --border: #334155;
  background: #0F172A;
}
:global(.dark .panel),
:global(.dark .search-box),
:global(.dark .filter-chip),
:global(.dark .select-input) {
  background: #1E293B;
  border-color: #334155;
}
:global(.dark .filter-chip--active) {
  background: #42A5F529;
  border-color: #42A5F550;
  color: #64B5F6;
}
:global(.dark .request-row:hover) { background: #263449; }
:global(.dark .request-row) { border-color: #263449; }
:global(.dark .search-box__input) { color: #F1F5F9; }
:global(.dark .skeleton) {
  background: linear-gradient(90deg, #1E293B 25%, #263449 37%, #1E293B 63%);
}
:global(.dark .skeleton-row) { border-color: #263449; }
</style>