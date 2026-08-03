<template>
  <div class="inventory-page">
    <!-- Toasts -->
    <div class="toast-stack">
      <transition-group name="toast">
        <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast--${t.variant}`">
          {{ t.message }}
        </div>
      </transition-group>
    </div>

    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Blood Inventory</h1>
        <p class="page-subtitle">Manage and monitor all blood units across all components and blood types.</p>
      </div>
      <div class="header-actions">
        <button class="btn btn--ghost" :disabled="syncing" @click="handleSync">
          <AssetIcon name="refresh-cw" :class="['icon-sm', { 'icon-spin': syncing }]" />
          {{ syncing ? 'Syncing...' : 'Sync' }}
        </button>
        <button class="btn btn--primary" @click="showAdd = true">
          <AssetIcon name="plus" class="icon-sm" />
          Add Blood Unit
        </button>
      </div>
    </div>

    <!-- ================= SKELETON LOADING STATE ================= -->
    <template v-if="loading">
      <div class="tile-grid">
        <div v-for="n in 8" :key="n" class="tile skeleton-card" :style="{ '--delay': `${n * 0.03}s` }">
          <div class="skeleton skeleton-badge" />
          <div class="skeleton skeleton-line" style="width: 40%; height: 20px; margin: 8px auto" />
          <div class="skeleton skeleton-line" style="width: 30%; height: 10px; margin: 0 auto" />
          <div class="skeleton skeleton-bar" />
        </div>
      </div>

      <div class="skeleton skeleton-line" style="width: 260px; height: 36px; border-radius: 14px; margin: 20px 0" />

      <div class="table-card skeleton-card">
        <div v-for="n in 6" :key="n" class="skeleton-row" :style="{ '--delay': `${n * 0.05}s` }">
          <div class="skeleton skeleton-line" style="width: 60px" />
          <div class="skeleton skeleton-badge" style="width: 40px" />
          <div class="skeleton skeleton-line" style="width: 120px" />
          <div class="skeleton skeleton-line" style="width: 30px" />
          <div class="skeleton skeleton-line" style="width: 80px" />
          <div class="skeleton skeleton-line" style="width: 40px" />
          <div class="skeleton skeleton-badge" style="width: 70px" />
        </div>
      </div>
    </template>

    <!-- ================= LOADED CONTENT ================= -->
    <template v-else>
      <!-- Expiring alert -->
      <div v-if="expiringUnits.length" class="alert alert--warning fade-in-up">
        <AssetIcon name="alert-triangle" class="icon-md alert-icon" />
        <div class="alert-body">
          <p class="alert-title">{{ expiringUnits.length }} blood unit batches expiring within 3 days</p>
          <p class="alert-text">
            {{ expiringUnits.map((u) => `${u.type} ${u.component}`).join(', ') }} need immediate attention.
          </p>
        </div>
        <button class="link-btn" @click="handleViewExpiring">
          View <AssetIcon name="trending-down" class="icon-xs" />
        </button>
      </div>

      <!-- Blood type summary tiles -->
      <div class="tile-grid">
        <div
          v-for="(type, i) in bloodTypes"
          :key="type"
          class="tile fade-in-up"
          :style="{ '--delay': `${i * 0.04}s` }"
          @click="filterByType(type)"
        >
          <span class="blood-badge">{{ type }}</span>
          <p class="tile-count">{{ totals[type] ?? 0 }}</p>
          <p class="tile-label">units</p>
          <div class="tile-bar-track">
            <div
              class="tile-bar-fill"
              :class="levelFor(totals[type] ?? 0) > 0.4 ? 'is-good' : levelFor(totals[type] ?? 0) > 0.15 ? 'is-warn' : 'is-low'"
              :style="{ width: `${Math.min(levelFor(totals[type] ?? 0) * 100, 100)}%` }"
            />
          </div>
        </div>
      </div>

      <!-- Filter bar -->
      <div class="filter-bar">
        <div class="search-field">
          <AssetIcon name="search" class="icon-sm search-icon" />
          <input v-model="search" type="text" placeholder="Search inventory..." class="search-input" />
          <button v-if="search" class="clear-btn" @click="search = ''">
            <AssetIcon name="x" class="icon-xs" />
          </button>
        </div>
        <div class="chip-group">
          <button
            v-for="f in statusFilters"
            :key="f"
            class="chip"
            :class="{ 'chip--active': statusFilter === f }"
            @click="statusFilter = f"
          >
            {{ f }}
          </button>
        </div>
      </div>

      <!-- Table -->
      <div class="table-card fade-in-up">
        <table class="data-table">
          <thead>
            <tr>
              <th>Unit ID</th>
              <th>Blood Type</th>
              <th>Component</th>
              <th>Units</th>
              <th>Collected</th>
              <th>Expires In</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="unit in filtered" :key="unit.id">
              <td><span class="mono muted">{{ unit.id }}</span></td>
              <td><span class="blood-badge blood-badge--sm">{{ unit.type }}</span></td>
              <td><span class="cell-strong">{{ unit.component }}</span></td>
              <td><span class="cell-bold">{{ unit.units }}</span></td>
              <td><span class="muted small">{{ unit.collected }}</span></td>
              <td>
                <span
                  class="small"
                  :class="unit.expiresIn <= 3 ? 'text-danger' : unit.expiresIn <= 7 ? 'text-warning' : 'muted'"
                >
                  {{ unit.expiresIn }}d
                </span>
              </td>
              <td>
                <span class="status-badge" :class="`status-badge--${statusVariant[unit.status]}`">
                  <span class="status-dot" /> {{ unit.status }}
                </span>
              </td>
              <td>
                <div class="row-actions">
                  <button class="link-btn link-btn--sm" @click="manageUnit = unit">Manage</button>
                  <button class="icon-btn" @click="editUnit = { ...unit }">
                    <AssetIcon name="edit" class="icon-xs" />
                  </button>
                  <button class="icon-btn icon-btn--danger" @click="deleteId = unit.id">
                    <AssetIcon name="trash-2" class="icon-xs" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!filtered.length">
              <td colspan="8" class="empty-row">No blood units match your filters.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- ============== Add Blood Unit Dialog ============== -->
    <div v-if="showAdd" class="modal-overlay" @click.self="showAdd = false">
      <div class="modal">
        <h2 class="modal-title">Add Blood Unit</h2>
        <p class="modal-desc">Register a new blood unit batch into inventory.</p>
        <form class="modal-form" @submit.prevent="handleAddUnit">
          <div class="form-row">
            <div class="field">
              <label class="field-label">Blood Type *</label>
              <select v-model="newUnit.type" class="field-select">
                <option value="" disabled>Select</option>
                <option v-for="t in bloodTypes" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div class="field">
              <label class="field-label">Units *</label>
              <input v-model="newUnit.units" type="number" min="1" class="field-input" placeholder="e.g. 10" />
            </div>
          </div>
          <div class="field">
            <label class="field-label">Component *</label>
            <select v-model="newUnit.component" class="field-select">
              <option value="" disabled>Select component</option>
              <option v-for="c in components" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label">Collection Date</label>
            <input v-model="newUnit.collectedAt" type="date" class="field-input" />
          </div>
          <div class="modal-actions">
            <button type="submit" class="btn btn--primary btn--block" :disabled="submitting">
              <AssetIcon name="check-circle" class="icon-sm" />
              {{ submitting ? 'Adding...' : 'Add to Inventory' }}
            </button>
            <button type="button" class="btn btn--ghost" @click="showAdd = false">Cancel</button>
          </div>
        </form>
      </div>
    </div>

    <!-- ============== Edit Unit Dialog ============== -->
    <div v-if="editUnit" class="modal-overlay" @click.self="editUnit = null">
      <div class="modal">
        <h2 class="modal-title">Edit Unit — {{ editUnit.id }}</h2>
        <p class="modal-desc">Update the details for this blood unit batch.</p>
        <div class="modal-form">
          <div class="form-row">
            <div class="field">
              <label class="field-label">Blood Type</label>
              <select v-model="editUnit.type" class="field-select">
                <option v-for="t in bloodTypes" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div class="field">
              <label class="field-label">Units</label>
              <input v-model.number="editUnit.units" type="number" class="field-input" />
            </div>
          </div>
          <div class="field">
            <label class="field-label">Component</label>
            <select v-model="editUnit.component" class="field-select">
              <option v-for="c in components" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label">Status</label>
            <select v-model="editUnit.status" class="field-select">
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="expiring">Expiring</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          <div class="modal-actions">
            <button class="btn btn--primary btn--block" @click="handleSaveEdit">Save Changes</button>
            <button class="btn btn--ghost" @click="editUnit = null">Cancel</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ============== Manage Unit Dialog ============== -->
    <div v-if="manageUnit" class="modal-overlay" @click.self="manageUnit = null">
      <div class="modal modal--sm">
        <h2 class="modal-title">Manage Unit — {{ manageUnit.id }}</h2>
        <p class="modal-desc">
          <span class="blood-badge blood-badge--sm">{{ manageUnit.type }}</span>
          · {{ manageUnit.component }} · {{ manageUnit.units }} units
        </p>
        <div class="manage-list">
          <button class="manage-item" @click="setUnitStatus(manageUnit, 'reserved', 'Unit marked as reserved.')">
            Mark as Reserved
          </button>
          <button class="manage-item" @click="setUnitStatus(manageUnit, 'available', 'Unit marked as available.')">
            Mark as Available
          </button>
          <button class="manage-item" @click="setUnitStatus(manageUnit, 'expiring', 'Unit flagged as expiring.', 'warning')">
            Flag as Expiring
          </button>
          <button class="manage-item manage-item--danger" @click="handleDelete(manageUnit.id)">
            Discard Unit
          </button>
        </div>
      </div>
    </div>

    <!-- ============== Delete Confirm ============== -->
    <div v-if="deleteId" class="modal-overlay" @click.self="deleteId = null">
      <div class="modal modal--sm">
        <h2 class="modal-title">Remove this blood unit?</h2>
        <p class="modal-desc">Unit {{ deleteId }} will be permanently removed from inventory. This cannot be undone.</p>
        <div class="modal-actions">
          <button class="btn btn--danger btn--block" @click="handleDelete(deleteId)">Remove Unit</button>
          <button class="btn btn--ghost" @click="deleteId = null">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'

definePageMeta({ layout: 'blood-centerdashboard' })

/* MOCK API LAYER (temporary — replace with real $fetch calls) */
const MOCK_DELAY = 500
const mockDelay = (ms = MOCK_DELAY) => new Promise((r) => setTimeout(r, ms))

let mockInventory = [
  { id: 'BU-001', type: 'A+', component: 'Whole Blood', units: 45, expiresIn: 28, collected: 'Jun 1, 2025', status: 'available' },
  { id: 'BU-002', type: 'A-', component: 'Packed RBC', units: 5, expiresIn: 35, collected: 'May 28, 2025', status: 'available' },
  { id: 'BU-003', type: 'B-', component: 'Whole Blood', units: 4, expiresIn: 3, collected: 'May 10, 2025', status: 'expiring' },
  { id: 'BU-004', type: 'AB-', component: 'Fresh Frozen Plasma', units: 3, expiresIn: 1, collected: 'May 8, 2025', status: 'expiring' },
  { id: 'BU-005', type: 'O+', component: 'Platelet Concentrate', units: 16, expiresIn: 5, collected: 'Jun 5, 2025', status: 'available' },
  { id: 'BU-006', type: 'O-', component: 'Packed RBC', units: 7, expiresIn: 42, collected: 'Jun 8, 2025', status: 'available' },
  { id: 'BU-007', type: 'A+', component: 'Fresh Frozen Plasma', units: 18, expiresIn: 180, collected: 'Jun 9, 2025', status: 'reserved' },
]
const mockBloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const mockComponents = ['Whole Blood', 'Packed RBC', 'Fresh Frozen Plasma', 'Platelet Concentrate', 'Cryoprecipitate']
const mockTotals = { 'A+': 98, 'A-': 18, 'B+': 73, 'B-': 9, 'AB+': 35, 'AB-': 6, 'O+': 152, 'O-': 26 }

function mockNextId() {
  return `BU-${String(mockInventory.length + 1).padStart(3, '0')}`
}

const api = {
  // GET /api/center/inventory
  async getInventory() {
    await mockDelay()
    return { units: [...mockInventory], totals: { ...mockTotals } }
  },
  // GET /api/reference/blood-types
  async getBloodTypes() {
    await mockDelay(200)
    return [...mockBloodTypes]
  },
  // GET /api/reference/components
  async getComponents() {
    await mockDelay(200)
    return [...mockComponents]
  },
  // POST /api/center/inventory/sync
  async syncInventory() {
    await mockDelay(800)
    return { synced: true }
  },
  // POST /api/center/inventory
  async addBloodUnit(payload) {
    await mockDelay(400)
    const unit = {
      id: mockNextId(),
      type: payload.type,
      component: payload.component,
      units: parseInt(payload.units) || 0,
      expiresIn: 42,
      collected: payload.collectedAt || 'Just now',
      status: 'available',
    }
    mockInventory.push(unit)
    return unit
  },
  // PUT /api/center/inventory/:id
  async updateBloodUnit(id, payload) {
    await mockDelay(300)
    mockInventory = mockInventory.map((u) => (u.id === id ? { ...u, ...payload } : u))
    return mockInventory.find((u) => u.id === id)
  },
  // DELETE /api/center/inventory/:id
  async deleteBloodUnit(id) {
    await mockDelay(300)
    mockInventory = mockInventory.filter((u) => u.id !== id)
    return { deleted: true }
  },
}

/* ---------- state ---------- */
const loading = ref(true)
const syncing = ref(false)
const submitting = ref(false)

const inventory = ref([])
const bloodTypes = ref([])     // fetched, e.g. ["A+","A-","B+", ...]
const components = ref([])     // fetched, e.g. ["Whole Blood", ...]
const totals = ref({})         // { "A+": 98, ... } fetched summary

const search = ref('')
const statusFilter = ref('All')
const statusFilters = ['All', 'Available', 'Expiring', 'Reserved']

const showAdd = ref(false)
const editUnit = ref(null)
const deleteId = ref(null)
const manageUnit = ref(null)

const newUnit = reactive({ type: '', component: '', units: '', collectedAt: '' })

/* ---------- toast (lightweight, matches project's toast pattern) ---------- */
const toasts = ref([])
let toastId = 0
function toast(message, variant = 'success') {
  const id = ++toastId
  toasts.value.push({ id, message, variant })
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, 3200)
}

/* ---------- status badge variant map ---------- */
const statusVariant = {
  available: 'success',
  expiring: 'warning',
  expired: 'danger',
  reserved: 'info',
}

/* ---------- computed ---------- */
const filtered = computed(() => {
  const q = search.value.toLowerCase()
  return inventory.value.filter((u) => {
    const matchSearch =
      u.id.toLowerCase().includes(q) ||
      u.type.toLowerCase().includes(q) ||
      u.component.toLowerCase().includes(q)
    const matchStatus =
      statusFilter.value === 'All' || u.status === statusFilter.value.toLowerCase()
    return matchSearch && matchStatus
  })
})

const expiringUnits = computed(() => inventory.value.filter((u) => u.status === 'expiring'))

/* ---------- data fetching ---------- */
async function loadInventory() {
  loading.value = true
  try {
    // GET /api/center/inventory
    // Expected response: { units: BloodUnit[], totals: Record<string, number> }
    const res = await centerService.getInventory()
    inventory.value = res.units ?? []
    totals.value = res.totals ?? {}
  } catch (err) {
    toast('Wa nato ma-load ang inventory. Palihug i-refresh.', 'danger')
    inventory.value = []
    totals.value = {}
  } finally {
    loading.value = false
  }
}

async function loadReferenceData() {
  try {
    // GET /api/reference/blood-types, GET /api/reference/components
    // TODO(dev): i-connect ni sa actual reference-data endpoints sa backend
    const [types, comps] = await Promise.all([
      centerService.getBloodTypes(),
      centerService.getComponents(),
    ])
    bloodTypes.value = types ?? []
    components.value = comps ?? []
  } catch (err) {
    bloodTypes.value = []
    components.value = []
  }
}

onMounted(() => {
  loadReferenceData()
  loadInventory()
})

/* ---------- actions ---------- */
async function handleSync() {
  syncing.value = true
  try {
    // POST /api/center/inventory/sync
    await centerService.syncInventory()
    await loadInventory()
    toast('Inventory synced with central system.')
  } catch (err) {
    toast('Sync failed. Try again later.', 'danger')
  } finally {
    syncing.value = false
  }
}

async function handleAddUnit() {
  if (!newUnit.type || !newUnit.component || !newUnit.units) {
    toast('Please fill in all required fields.', 'warning')
    return
  }
  submitting.value = true
  try {
    // POST /api/center/inventory
    // body: { type, component, units, collectedAt }
    const created = await centerService.addBloodUnit({ ...newUnit })
    inventory.value.push(created)
    toast(`${created.id} added to inventory.`)
    showAdd.value = false
    Object.assign(newUnit, { type: '', component: '', units: '', collectedAt: '' })
  } catch (err) {
    toast('Unable to add blood unit right now.', 'danger')
  } finally {
    submitting.value = false
  }
}

async function handleSaveEdit() {
  if (!editUnit.value) return
  try {
    // PUT /api/center/inventory/:id
    const updated = await centerService.updateBloodUnit(editUnit.value.id, editUnit.value)
    inventory.value = inventory.value.map((u) => (u.id === updated.id ? updated : u))
    toast('Unit updated successfully.')
    editUnit.value = null
  } catch (err) {
    toast('Unable to save changes.', 'danger')
  }
}

async function handleDelete(id) {
  try {
    // DELETE /api/center/inventory/:id
    await centerService.deleteBloodUnit(id)
    inventory.value = inventory.value.filter((u) => u.id !== id)
    toast(`Unit ${id} removed from inventory.`)
  } catch (err) {
    toast('Unable to remove unit.', 'danger')
  } finally {
    deleteId.value = null
    manageUnit.value = null
  }
}

async function setUnitStatus(unit, status, message, variant = 'success') {
  try {
    // PATCH /api/center/inventory/:id/status
    const updated = await centerService.updateBloodUnit(unit.id, { ...unit, status })
    inventory.value = inventory.value.map((u) => (u.id === updated.id ? updated : u))
    toast(message, variant)
  } catch (err) {
    toast('Unable to update unit status.', 'danger')
  } finally {
    manageUnit.value = null
  }
}

function handleViewExpiring() {
  statusFilter.value = 'Expiring'
  toast('Showing expiring units only.', 'info')
}

function filterByType(type) {
  search.value = type
  toast(`Filtering by ${type}`, 'info')
}

function levelFor(count) {
  const max = Math.max(...Object.values(totals.value), 1)
  return count / max
}
</script>

<style scoped>
.inventory-page {
  --primary: #1565c0;
  --accent: #d32f2f;
  --success: #2e7d32;
  --warning: #f57c00;
  --info: #0277bd;
  --danger: #d32f2f;
  --bg: #f1f6fb;
  --card-bg: #ffffff;
  --border: #e2e8f0;
  --text: #0f172a;
  --text-muted: #64748b;
  --radius: 14px;
  --radius-lg: 18px;

  padding: 24px;
  background: var(--bg);
  min-height: 100%;
  color: var(--text);
}

:global(.dark) .inventory-page {
  --bg: #0b1220;
  --card-bg: #131b2c;
  --border: #223049;
  --text: #e6ecf5;
  --text-muted: #93a2b8;
}

/* ---------- header ---------- */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.breadcrumb { font-size: 12px; color: var(--text-muted); margin-bottom: 4px; }
.page-title { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
.page-subtitle { font-size: 13px; color: var(--text-muted); margin: 0; }
.header-actions { display: flex; gap: 8px; }

/* ---------- buttons ---------- */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 16px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 600;
  border: 1px solid transparent;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.15s ease;
  background: none;
}
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn--primary { background: var(--primary); color: #fff; }
.btn--primary:hover:not(:disabled) { background: #0d4d9c; }
.btn--ghost { background: var(--card-bg); border-color: var(--border); color: var(--text); }
.btn--ghost:hover:not(:disabled) { background: var(--bg); }
.btn--danger { background: var(--danger); color: #fff; }
.btn--block { width: 100%; justify-content: center; }

.icon-sm { width: 14px; height: 14px; }
.icon-md { width: 18px; height: 18px; }
.icon-xs { width: 13px; height: 13px; }
.icon-spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ---------- alert ---------- */
.alert {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-radius: var(--radius);
  margin-bottom: 16px;
}
.alert--warning {
  background: #fff8e6;
  border: 1px solid #fbdf9d;
}
:global(.dark) .alert--warning {
  background: rgba(245, 124, 0, 0.12);
  border-color: rgba(245, 124, 0, 0.35);
}
.alert-icon { color: var(--warning); margin-top: 2px; flex-shrink: 0; }
.alert-body { flex: 1; }
.alert-title { font-size: 13px; font-weight: 600; color: #92620a; margin: 0; }
.alert-text { font-size: 13px; color: #a3720f; margin: 2px 0 0; }
:global(.dark) .alert-title, :global(.dark) .alert-text { color: #f5c168; }

/* ---------- tiles ---------- */
.tile-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}
@media (max-width: 720px) {
  .tile-grid { grid-template-columns: repeat(4, 1fr); }
}
.tile {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px;
  text-align: center;
  cursor: pointer;
  transition: transform 0.15s ease;
}
.tile:hover { transform: translateY(-2px); }
.tile-count { font-size: 18px; font-weight: 700; margin: 8px 0 0; }
.tile-label { font-size: 10px; color: var(--text-muted); margin: 0; }
.tile-bar-track {
  height: 4px;
  border-radius: 999px;
  background: var(--bg);
  margin-top: 8px;
  overflow: hidden;
}
.tile-bar-fill { height: 100%; border-radius: 999px; }
.tile-bar-fill.is-good { background: var(--success); }
.tile-bar-fill.is-warn { background: var(--warning); }
.tile-bar-fill.is-low { background: var(--danger); }

.blood-badge {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  background: rgba(211, 47, 47, 0.08);
  border-radius: 8px;
  padding: 2px 8px;
}
.blood-badge--sm { font-size: 11px; padding: 1px 7px; }

/* ---------- filter bar ---------- */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.search-field { position: relative; flex: 1; max-width: 280px; }
.search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); }
.search-input {
  width: 100%;
  height: 36px;
  padding: 0 32px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--card-bg);
  color: var(--text);
  font-size: 13px;
}
.clear-btn {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer; color: var(--text-muted);
}
.chip-group { display: flex; gap: 4px; margin-left: auto; }
.chip {
  height: 28px;
  padding: 0 12px;
  border-radius: 10px;
  font-size: 12px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}
.chip--active { background: var(--primary); color: #fff; }

/* ---------- table ---------- */
.table-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table thead th {
  text-align: left;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-muted);
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.data-table tbody td { padding: 12px 16px; border-bottom: 1px solid var(--border); }
.data-table tbody tr:last-child td { border-bottom: none; }
.mono { font-family: monospace; }
.muted { color: var(--text-muted); }
.small { font-size: 12px; }
.cell-strong { font-weight: 500; }
.cell-bold { font-weight: 700; }
.text-danger { color: var(--danger); font-weight: 600; }
.text-warning { color: var(--warning); font-weight: 600; }
.empty-row { text-align: center; padding: 32px; color: var(--text-muted); }

.status-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 600; text-transform: capitalize;
  padding: 3px 10px; border-radius: 999px;
}
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.status-badge--success { background: rgba(46,125,50,0.1); color: var(--success); }
.status-badge--warning { background: rgba(245,124,0,0.1); color: var(--warning); }
.status-badge--danger { background: rgba(211,47,47,0.1); color: var(--danger); }
.status-badge--info { background: rgba(2,119,189,0.1); color: var(--info); }

.row-actions { display: flex; align-items: center; gap: 4px; }
.link-btn {
  background: none; border: none; cursor: pointer;
  font-size: 12px; color: var(--primary); font-weight: 600;
  display: inline-flex; align-items: center; gap: 4px;
}
.link-btn--sm { padding: 4px 8px; border-radius: 8px; }
.icon-btn {
  width: 28px; height: 28px; border-radius: 8px; border: none;
  background: none; color: var(--text-muted); cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.icon-btn:hover { background: var(--bg); color: var(--text); }
.icon-btn--danger:hover { color: var(--danger); }

/* ---------- modal ---------- */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(15,23,42,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 100; padding: 16px;
}
.modal {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: 24px;
  width: 100%;
  max-width: 420px;
}
.modal--sm { max-width: 340px; }
.modal-title { font-size: 16px; font-weight: 700; margin: 0 0 4px; }
.modal-desc { font-size: 13px; color: var(--text-muted); margin: 0 0 16px; }
.modal-form { display: flex; flex-direction: column; gap: 14px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.field-label { font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px; }
.field-input, .field-select {
  width: 100%; height: 36px; padding: 0 12px;
  border-radius: var(--radius); border: 1px solid var(--border);
  background: var(--bg); color: var(--text); font-size: 13px;
}
.modal-actions { display: flex; gap: 10px; margin-top: 4px; }
.modal-actions .btn--ghost { border: 1px solid var(--border); }

.manage-list { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
.manage-item {
  text-align: left; padding: 10px 12px; border-radius: 12px;
  border: none; background: none; font-size: 13px; cursor: pointer; color: var(--text);
}
.manage-item:hover { background: var(--bg); }
.manage-item--danger { color: var(--danger); }

/* ---------- toast ---------- */
.toast-stack {
  position: fixed; top: 20px; right: 20px; z-index: 200;
  display: flex; flex-direction: column; gap: 8px;
}
.toast {
  padding: 10px 16px; border-radius: 12px; font-size: 13px;
  color: #fff; box-shadow: 0 8px 20px rgba(0,0,0,0.15);
}
.toast--success { background: var(--success); }
.toast--danger { background: var(--danger); }
.toast--warning { background: var(--warning); }
.toast--info { background: var(--info); }
.toast-enter-active, .toast-leave-active { transition: all 0.25s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(20px); }

/* ---------- animations ---------- */
.fade-in-up {
  animation: fadeInUp 0.4s ease both;
  animation-delay: var(--delay, 0s);
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ---------- skeleton ---------- */
.skeleton {
  background: linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 6px;
}
.skeleton-badge { width: 32px; height: 16px; border-radius: 8px; margin: 0 auto; }
.skeleton-line { height: 12px; border-radius: 6px; }
.skeleton-bar { height: 4px; border-radius: 999px; margin-top: 8px; }
.skeleton-card { animation: fadeInUp 0.4s ease both; animation-delay: var(--delay, 0s); }
.skeleton-row {
  display: grid;
  grid-template-columns: 60px 40px 1fr 30px 80px 40px 70px;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  animation: fadeInUp 0.4s ease both;
  animation-delay: var(--delay, 0s);
}
.skeleton-row:last-child { border-bottom: none; }

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton, .fade-in-up, .skeleton-card, .skeleton-row { animation: none !important; }
}
</style>