<template>
  <div class="inventory-page">
    <!-- Header Row -->
    <div class="header-row fade-in" style="--delay: 0ms">
      <div>
        <h1 class="page-title">Inventory Management</h1>
        <p class="page-subtitle">Monitor current blood stock levels and storage status.</p>
      </div>
      <button class="btn-primary">
        + Add New Batch
      </button>
    </div>

    <!-- Inventory Stats / Summary -->
    <div class="stats-grid fade-in" style="--delay: 50ms">
      <div class="stat-card" v-for="stat in stats" :key="stat.label">
        <span class="stat-label">{{ stat.label }}</span>
        <span class="stat-value" :style="{ color: stat.color }">{{ stat.value }}</span>
      </div>
    </div>

    <!-- Inventory Table Panel -->
    <div class="panel fade-in" style="--delay: 100ms">
      <div class="inventory-list">
        <div class="inventory-row inventory-row--header">
          <div class="col-main">Blood Unit / ID</div>
          <div class="col-side">Type</div>
          <div class="col-side">Expiry</div>
          <div class="col-side">Status</div>
          <div class="col-side">Actions</div>
        </div>

        <div v-for="item in inventory" :key="item.id" class="inventory-row">
          <div class="col-main">
            <p class="notif-row__title">{{ item.name }}</p>
            <p class="notif-row__meta">Ref: {{ item.id }}</p>
          </div>
          <div class="col-side"><span class="notif-tag notif-tag--primary">{{ item.type }}</span></div>
          <div class="col-side">{{ item.expiry }}</div>
          <div class="col-side">
            <span class="status-dot" :class="item.status"></span> {{ item.status }}
          </div>
          <div class="col-side">
            <button class="notif-row__action">Edit</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const stats = [
  { label: 'Total Units', value: '128', color: '#1565c0' },
  { label: 'Critical Low', value: '4', color: '#d32f2f' },
  { label: 'Expiring Soon', value: '12', color: '#f57c00' }
]

const inventory = ref([
  { id: 'BLD-9981', name: 'Packed Red Blood Cells', type: 'O+', expiry: 'Jul 25, 2026', status: 'Available' },
  { id: 'BLD-9982', name: 'Platelet Concentrate', type: 'A-', expiry: 'Jul 20, 2026', status: 'Reserved' }
])
definePageMeta({
  layout: 'blood-centerdashboard'
})
</script>

<style scoped>
/* Gi-import/Re-use nato ang global layout variables gikan sa Notifications page */
.inventory-page { max-width: 1152px; margin: 0 auto; padding: 24px 32px; display: flex; flex-direction: column; gap: 20px; background: #F5F7FA; min-height: 100vh; }

.header-row { display: flex; justify-content: space-between; align-items: flex-start; }
.page-title { font-size: 20px; font-weight: 700; color: #1f2937; margin: 0; }
.page-subtitle { font-size: 13px; color: #9ca3af; margin: 2px 0 0; }

.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.stat-card { background: white; padding: 20px; border-radius: 14px; border: 1px solid #eef0f3; display: flex; flex-direction: column; }
.stat-value { font-size: 24px; font-weight: 800; margin-top: 4px; }

.panel { background: white; border-radius: 14px; border: 1px solid #eef0f3; overflow: hidden; }
.inventory-row { display: flex; padding: 16px 20px; border-bottom: 1px solid #f3f4f6; align-items: center; }
.inventory-row--header { background: #f9fafb; font-weight: 700; font-size: 12px; color: #6b7280; }
.col-main { flex: 2; }
.col-side { flex: 1; font-size: 13px; }

.status-dot { height: 8px; width: 8px; border-radius: 50%; display: inline-block; background: #2e7d32; margin-right: 6px; }
.btn-primary { background: #1565c0; color: white; padding: 10px 16px; border-radius: 10px; border: none; font-weight: 600; cursor: pointer; }

/* Re-using Notification Styles */
.notif-row__title { font-size: 13.5px; font-weight: 700; color: #1f2937; margin: 0; }
.notif-row__meta { font-size: 11.5px; color: #b7bec9; margin: 2px 0 0; }
.notif-tag { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; }
.notif-tag--primary { background: #eaf3fc; color: #1565c0; }
.notif-row__action { border: none; background: none; color: #1565c0; font-weight: 600; cursor: pointer; }
</style>