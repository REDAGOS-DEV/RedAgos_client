<template>
  <div class="billing-page">
    <!-- Header Section -->
    <div class="header-row fade-in" style="--delay: 0ms">
      <div>
        <h1 class="page-title">Billing & Payments</h1>
        <p class="page-subtitle">Process payments and verify transactions.</p>
      </div>
      <button class="btn-primary" @click="openNewBillingModal">
        <AssetIcon name="plus" :size="16" />
        New Billing
      </button>
    </div>

    <!-- Reusable Process/View/Create Billing Modal -->
    <ProcessBillingModal
      :is-open="isModalOpen"
      :bill-data="selectedBill"
      @close="closeModal"
      @save="handleSaveBilling"
      @confirm-payment="handleConfirmPayment"
    />

    <!-- ===== ENHANCED STATS CARDS ===== -->
    <div class="stats-grid fade-in" style="--delay: 50ms">
      <div class="stat-card" v-for="stat in billingStats" :key="stat.label">
        <div class="stat-card__icon" :style="{ background: stat.iconBg }">
          <AssetIcon :name="stat.icon" :size="20" />
        </div>
        <div class="stat-card__body">
          <span class="stat-label">{{ stat.label }}</span>
          <span class="stat-value" :style="{ color: stat.color }">{{ stat.value }}</span>
          <span v-if="stat.sub" class="stat-sub">{{ stat.sub }}</span>
        </div>
      </div>
    </div>

    <!-- Filter Panel (Calendar) -->
    <div class="filter-panel fade-in" style="--delay: 75ms">
      <div class="filter-left">
        <AssetIcon name="calendar" :size="16" class="filter-icon" />
        <span class="filter-title">Filter by Billing Date</span>
      </div>
      <div class="filter-right">
        <div class="date-inputs">
          <div class="input-wrapper">
            <label>From</label>
            <input type="date" v-model="filterStartDate" class="calendar-input" />
          </div>
          <div class="input-wrapper">
            <label>To</label>
            <input type="date" v-model="filterEndDate" class="calendar-input" />
          </div>
          <button v-if="filterStartDate || filterEndDate" class="btn-clear" @click="clearDateFilter">
            Clear
          </button>
        </div>
      </div>
    </div>

    <!-- Bill List Panel -->
    <div class="panel fade-in" style="--delay: 100ms">
      <div v-if="filteredBills.length === 0" class="empty-state">
        <AssetIcon name="inbox" :size="32" />
        <p>No billing records found within the selected date range.</p>
      </div>
      <div v-for="bill in filteredBills" :key="bill.id" class="notif-row">
        <div class="notif-row__icon" :class="`notif-row__icon--${bill.status.toLowerCase()}`">
          <AssetIcon :name="bill.status === 'PAID' ? 'check' : 'alert-circle'" :size="16" />
        </div>

        <div class="notif-row__content">
          <p class="notif-row__title">Request #{{ bill.requestId }} — {{ bill.requesterName }}</p>
          <p class="notif-row__meta">Total: ₱{{ bill.totalAmount.toLocaleString() }} • {{ bill.date }}</p>
        </div>

        <div class="notif-row__side">
          <span class="notif-tag" :class="`notif-tag--${bill.status.toLowerCase()}`">
            {{ bill.status }}
          </span>
          <button class="notif-row__action" @click="openViewProcessModal(bill)">
            {{ bill.status === 'UNPAID' ? 'Process' : 'View' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import ProcessBillingModal from '~/components/BloodCenter/ProcessBillingModal.vue'

definePageMeta({
  middleware: 'auth',
  layout: 'blood-centerdashboard',
})

const isModalOpen = ref(false)
const selectedBill = ref(null)

// Date Range states
const filterStartDate = ref('')
const filterEndDate = ref('')

const bills = ref([
  { id: 1, requestId: 'BILL-001', requesterName: 'Saint Mary Hospital', totalAmount: 14200, date: 'Jul 10, 2026', rawDate: '2026-07-10', status: 'UNPAID' },
  { id: 2, requestId: 'BILL-002', requesterName: 'City General Clinic', totalAmount: 8200, date: 'Jul 8, 2026', rawDate: '2026-07-08', status: 'PAID' },
  { id: 3, requestId: 'BILL-003', requesterName: 'Green Cross Lab', totalAmount: 5400, date: 'Jul 5, 2026', rawDate: '2026-07-05', status: 'PAID' },
])

const filteredBills = computed(() => {
  return bills.value.filter(bill => {
    if (!bill.rawDate) return true
    const billDate = new Date(bill.rawDate)
    if (filterStartDate.value && new Date(filterStartDate.value) > billDate) return false
    if (filterEndDate.value && new Date(filterEndDate.value) < billDate) return false
    return true
  })
})

// ===== ENHANCED STATS with icons and sub-text =====
const billingStats = computed(() => {
  const unpaidTotal = filteredBills.value.filter(b => b.status === 'UNPAID').reduce((sum, b) => sum + b.totalAmount, 0)
  const paidTotal = filteredBills.value.filter(b => b.status === 'PAID').reduce((sum, b) => sum + b.totalAmount, 0)
  const pendingCount = filteredBills.value.filter(b => b.status === 'UNPAID').length
  const totalCount = filteredBills.value.length

  return [
    { 
      label: 'Total Collected', 
      value: `₱${paidTotal.toLocaleString()}`, 
      color: '#15803d',
      icon: 'cash',
      iconBg: '#dcfce7',
      sub: `${filteredBills.value.filter(b => b.status === 'PAID').length} paid invoices`
    },
    { 
      label: 'Outstanding Balance', 
      value: `₱${unpaidTotal.toLocaleString()}`, 
      color: '#b91c1c',
      icon: 'alert-circle',
      iconBg: '#fee2e2',
      sub: `${pendingCount} pending invoices`
    },
    { 
      label: 'Total Invoices', 
      value: totalCount.toString(), 
      color: '#1f2937',
      icon: 'file-text',
      iconBg: '#e0f2fe',
      sub: `${filteredBills.value.length} records`
    }
  ]
})

function clearDateFilter() {
  filterStartDate.value = ''
  filterEndDate.value = ''
}

function openNewBillingModal() {
  selectedBill.value = null
  isModalOpen.value = true
}

function openViewProcessModal(bill) {
  selectedBill.value = { ...bill }
  isModalOpen.value = true
}

function closeModal() {
  isModalOpen.value = false
  selectedBill.value = null
}

function handleSaveBilling(newBill) {
  const today = new Date()
  const rawDateString = today.toISOString().split('T')[0]
  const formattedDateString = today.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  bills.value.unshift({
    id: bills.value.length + 1,
    ...newBill,
    date: formattedDateString,
    rawDate: rawDateString,
    status: 'UNPAID' // default
  })
  closeModal()
}

function handleConfirmPayment(billId) {
  const index = bills.value.findIndex(b => b.id === billId)
  if (index !== -1) {
    bills.value[index].status = 'PAID'
  }
  closeModal()
}
</script>

<style scoped>
/* ===== BASE LAYOUT ===== */
.billing-page {
  max-width: 1152px;
  margin: 0 auto;
  padding: 24px 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background: #f5f7fa; /* subtle background */
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}
.page-subtitle {
  font-size: 13.5px;
  color: #6b7280;
  margin: 4px 0 0;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #1565c0;
  color: white;
  padding: 10px 20px;
  border-radius: 10px;
  border: none;
  font-weight: 600;
  font-size: 13.5px;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}
.btn-primary:hover { background: #0d47a1; transform: scale(1.02); }

/* ===== ENHANCED STATS CARDS ===== */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stat-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #eef0f3;
  padding: 20px 24px;
  display: flex;
  align-items: center;
  gap: 18px;
  transition: all 0.25s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
}
.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px -8px rgba(0,0,0,0.08);
  border-color: #d1d9e6;
}

.stat-card__icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-card__body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.stat-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6b7280;
}

.stat-value {
  font-size: 28px;
  font-weight: 800;
  line-height: 1.2;
  margin-top: 2px;
}

.stat-sub {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 2px;
  font-weight: 500;
}

/* ===== FILTER PANEL (modernised) ===== */
.filter-panel {
  background: white;
  border-radius: 14px;
  border: 1px solid #eef0f3;
  padding: 14px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
}

.filter-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.filter-icon { color: #6b7280; }
.filter-title { font-weight: 600; color: #1f2937; font-size: 14px; }

.filter-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.date-inputs {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.input-wrapper label {
  font-size: 10.5px;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.calendar-input {
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  color: #1f2937;
  background: #f9fafb;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.calendar-input:focus {
  border-color: #1565c0;
  box-shadow: 0 0 0 3px rgba(21,101,192,0.1);
  background: white;
}

.btn-clear {
  background: none;
  border: none;
  color: #d32f2f;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 8px;
  transition: background 0.15s;
}
.btn-clear:hover { background: #fef2f2; }

/* ===== BILL LIST ===== */
.panel {
  background: white;
  border-radius: 14px;
  border: 1px solid #eef0f3;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
}

.notif-row {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #f3f4f6;
  transition: background 0.15s;
}
.notif-row:last-child { border-bottom: none; }
.notif-row:hover { background: #f9fafb; }

.notif-row__icon {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 18px;
  flex-shrink: 0;
}
.notif-row__icon--unpaid { background: #fee2e2; color: #b91c1c; }
.notif-row__icon--paid { background: #dcfce7; color: #15803d; }

.notif-row__content { flex: 1; min-width: 0; }
.notif-row__title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}
.notif-row__meta {
  font-size: 12.5px;
  color: #6b7280;
  margin: 3px 0 0;
}

.notif-row__side {
  display: flex;
  align-items: center;
  gap: 16px;
}

.notif-tag {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.notif-tag--unpaid { background: #fef2f2; color: #991b1b; }
.notif-tag--paid { background: #f0fdf4; color: #166534; }

.notif-row__action {
  border: none;
  background: none;
  color: #1565c0;
  font-weight: 700;
  cursor: pointer;
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 8px;
  transition: background 0.15s, color 0.15s;
}
.notif-row__action:hover {
  background: #f0f6ff;
  text-decoration: underline;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  color: #9ca3af;
  gap: 12px;
}
.empty-state p { margin: 0; font-size: 14px; }

/* ===== ANIMATIONS ===== */
.fade-in {
  animation: fadeIn 0.4s ease forwards;
  opacity: 0;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ===== RESPONSIVE ===== */
@media (max-width: 768px) {
  .billing-page { padding: 16px; }
  .stats-grid { grid-template-columns: 1fr; }
  .stat-card { padding: 16px 20px; }
  .stat-value { font-size: 24px; }
  .filter-panel { flex-direction: column; align-items: stretch; }
  .filter-right { width: 100%; }
  .date-inputs { flex-wrap: wrap; }
  .input-wrapper { flex: 1; min-width: 120px; }
  .notif-row { flex-wrap: wrap; gap: 12px; }
  .notif-row__side { margin-left: auto; }
}
</style>