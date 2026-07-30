<template>
  <div class="inventory-page">
    <!-- Header Row -->
    <div class="header-row fade-in" style="--delay: 0ms">
      <div>
        <h1 class="page-title">Inventory Management</h1>
        <p class="page-subtitle">Monitor current blood stock levels and storage status.</p>
      </div>
      <button class="btn-primary" @click="openAddModal">
        <AssetIcon name="plus" :size="16" />
        Add New Batch
      </button>
    </div>

    <!-- Reusable Modal for Add & Edit -->
    <addbatchModal
      :is-open="isaddbatchModalOpen"
      :edit-item="selectedItem"
      @close="closeModal"
      @save="handleSaveBatch"
    />

    <!-- ===== ENHANCED STATS CARDS ===== -->
    <div class="stats-grid fade-in" style="--delay: 50ms">
      <div class="stat-card" v-for="stat in enhancedStats" :key="stat.label">
        <div class="stat-card__icon" :style="{ background: stat.iconBg }">
          <AssetIcon :name="stat.icon" :size="20" />
        </div>
        <div class="stat-card__body">
          <span class="stat-label">{{ stat.label }}</span>
          <span class="stat-value" :style="{ color: stat.color }">{{ stat.value }}</span>
          <span class="stat-sub">{{ stat.sub }}</span>
        </div>
      </div>
    </div>

    <!-- Filter Panel (Expiry Date) -->
    <div class="filter-panel fade-in" style="--delay: 75ms">
      <div class="filter-left">
        <AssetIcon name="calendar" :size="16" class="filter-icon" />
        <span class="filter-title">Filter by Expiry Date</span>
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

    <!-- Inventory Table Panel -->
    <div class="panel fade-in" style="--delay: 100ms">
      <div class="inventory-list">
        <!-- Header -->
        <div class="inventory-row inventory-row--header">
          <div class="col-main">Blood Unit / ID</div>
          <div class="col-side text-center">Type</div>
          <div class="col-side">Expiry</div>
          <div class="col-side">Status</div>
          <div class="col-side text-right">Actions</div>
        </div>

        <!-- Data Rows -->
        <div v-for="item in filteredInventory" :key="item.id" class="inventory-row">
          <div class="col-main">
            <p class="notif-row__title">{{ item.name }}</p>
            <p class="notif-row__meta">Ref: {{ item.id }}</p>
          </div>
          
          <div class="col-side text-center">
            <span class="notif-tag notif-tag--primary">{{ item.type }}</span>
          </div>
          
          <div class="col-side expiry-text">{{ item.expiry }}</div>
          
          <div class="col-side">
            <span class="notif-tag" :class="`notif-tag--${item.status.toLowerCase()}`">
              <span class="status-dot" :class="`status-dot--${item.status.toLowerCase()}`"></span>
              {{ item.status }}
            </span>
          </div>
          
          <div class="col-side text-right">
            <button class="notif-row__action" @click="openEditModal(item)">Edit</button>
          </div>
        </div>

        <div v-if="filteredInventory.length === 0" class="empty-state">
          <AssetIcon name="inbox" :size="32" class="empty-icon" />
          <p>No blood units found within the selected expiry dates.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import addbatchModal from '~/components/BloodCenter/addbatchModal.vue'

definePageMeta({
  middleware: 'auth',
  layout: 'blood-centerdashboard'
})

const isaddbatchModalOpen = ref(false)
const selectedItem = ref(null)

const filterStartDate = ref('')
const filterEndDate = ref('')

// Base stats (will be recalculated dynamically)
const totalUnits = ref(128)
const criticalLow = ref(4)
const expiringSoon = ref(12)

const inventory = ref([
  { id: 'BLD-9981', name: 'Packed Red Blood Cells', type: 'O+', expiry: 'Jul 25, 2026', rawExpiry: '2026-07-25', status: 'Available' },
  { id: 'BLD-9982', name: 'Platelet Concentrate', type: 'A-', expiry: 'Jul 20, 2026', rawExpiry: '2026-07-20', status: 'Reserved' }
])

// ===== ENHANCED STATS with icons and sub-text =====
const enhancedStats = computed(() => {
  // You could also compute these values from the actual inventory array, but we keep the static ones for simplicity.
  return [
    {
      label: 'Total Units',
      value: totalUnits.value.toString(),
      color: '#1565c0',
      icon: 'package',
      iconBg: '#e0f2fe',
      sub: 'Available stock'
    },
    {
      label: 'Critical Low',
      value: criticalLow.value.toString(),
      color: '#b91c1c',
      icon: 'alert-triangle',
      iconBg: '#fee2e2',
      sub: 'Needs immediate restock'
    },
    {
      label: 'Expiring Soon',
      value: expiringSoon.value.toString(),
      color: '#f57c00',
      icon: 'clock',
      iconBg: '#ffedd5',
      sub: 'Within 7 days'
    }
  ]
})

const filteredInventory = computed(() => {
  return inventory.value.filter(item => {
    if (!item.rawExpiry) return true
    const itemDate = new Date(item.rawExpiry)
    if (filterStartDate.value && new Date(filterStartDate.value) > itemDate) return false
    if (filterEndDate.value && new Date(filterEndDate.value) < itemDate) return false
    return true
  })
})

function clearDateFilter() {
  filterStartDate.value = ''
  filterEndDate.value = ''
}

function openAddModal() {
  selectedItem.value = null
  isaddbatchModalOpen.value = true
}

function openEditModal(item) {
  selectedItem.value = { ...item }
  isaddbatchModalOpen.value = true
}

function closeModal() {
  isaddbatchModalOpen.value = false
  selectedItem.value = null
}

function handleSaveBatch(batchData) {
  const dateObj = new Date(batchData.expiry)
  const rawDate = isNaN(dateObj.getTime()) ? batchData.rawExpiry : dateObj.toISOString().split('T')[0]
  
  const formattedBatch = {
    ...batchData,
    rawExpiry: rawDate
  }

  if (selectedItem.value) {
    // EDIT
    const index = inventory.value.findIndex(i => i.id === selectedItem.value.id)
    if (index !== -1) {
      inventory.value[index] = formattedBatch
    }
  } else {
    // ADD
    inventory.value.unshift(formattedBatch)
    totalUnits.value = parseInt(totalUnits.value) + 1
  }
  
  closeModal()
}
</script>

<style scoped>
/* ===== BASE ===== */
.inventory-page {
  max-width: 1152px;
  margin: 0 auto;
  padding: 24px 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background: #f5f7fa;
}

/* ===== HEADER ===== */
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
  padding: 10px 18px;
  border-radius: 10px;
  border: none;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.1s;
}
.btn-primary:hover { background: #0d47a1; transform: scale(1.02); }

/* ===== ENHANCED STATS ===== */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stat-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #eef0f3;
  padding: 18px 22px;
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

/* ===== FILTER PANEL ===== */
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

/* ===== TABLE / INVENTORY LIST ===== */
.panel {
  background: white;
  border-radius: 14px;
  border: 1px solid #eef0f3;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
}

.inventory-row {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #f3f4f6;
  transition: background 0.15s ease;
}
.inventory-row:last-child { border-bottom: none; }
.inventory-row:hover:not(.inventory-row--header) { background: #f9fafb; }

.inventory-row--header {
  background: #f9fafb;
  font-weight: 700;
  font-size: 12px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 12px 24px;
}

.col-main { flex: 2.5; }
.col-side { flex: 1; font-size: 13.5px; color: #4b5563; }
.text-center { text-align: center; justify-content: center; }
.text-right { text-align: right; justify-content: flex-end; }

.notif-row__title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}
.notif-row__meta {
  font-size: 12.5px;
  color: #9ca3af;
  margin: 3px 0 0;
}
.expiry-text { font-weight: 500; color: #4b5563; }

.notif-tag {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.notif-tag--primary { background: #eaf3fc; color: #1565c0; }
.notif-tag--available { background: #dcfce7; color: #166534; }
.notif-tag--reserved { background: #fef3c7; color: #92400e; }

.status-dot {
  height: 6px;
  width: 6px;
  border-radius: 50%;
  margin-right: 6px;
  display: inline-block;
}
.status-dot--available { background: #166534; }
.status-dot--reserved { background: #b45309; }

.notif-row__action {
  border: none;
  background: none;
  color: #1565c0;
  font-weight: 700;
  cursor: pointer;
  font-size: 13px;
  padding: 6px 12px;
  border-radius: 6px;
  transition: background 0.15s ease;
}
.notif-row__action:hover { background: #eaf3fc; }

/* ===== EMPTY STATE ===== */
.empty-state {
  padding: 48px 24px;
  text-align: center;
  font-size: 14px;
  color: #6b7280;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.empty-icon { color: #d1d5db; }

/* ===== ANIMATIONS ===== */
.fade-in {
  animation: fadeIn 0.4s ease-out forwards;
  opacity: 0;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ===== RESPONSIVE ===== */
@media (max-width: 768px) {
  .inventory-page { padding: 16px; }
  .stats-grid { grid-template-columns: 1fr; }
  .filter-panel { flex-direction: column; align-items: stretch; }
  .filter-right { width: 100%; }
  .date-inputs { flex-wrap: wrap; }
  .input-wrapper { flex: 1; min-width: 120px; }
  .inventory-row { flex-wrap: wrap; gap: 8px; }
  .col-side { flex: auto; min-width: 80px; }
}
</style>
