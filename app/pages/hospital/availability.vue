<template>
  <div class="ba-page">
    <!-- ===================== LOADING SKELETON ===================== -->
    <template v-if="isLoading">
      <div class="ba-header skeleton-block">
        <div>
          <div class="skeleton-line" style="width:220px;height:30px;margin-bottom:10px;"></div>
          <div class="skeleton-line" style="width:340px;height:15px;"></div>
        </div>
        <div class="skeleton-line" style="width:190px;height:48px;border-radius:14px;"></div>
      </div>

      <div class="ba-filter-card skeleton-block">
        <div class="skeleton-line" style="width:100%;height:44px;border-radius:12px;"></div>
      </div>

      <div class="ba-summary-grid">
        <div v-for="n in 4" :key="n" class="ba-summary-card skeleton-block">
          <div class="skeleton-line" style="width:26px;height:26px;border-radius:8px;margin-bottom:10px;"></div>
          <div class="skeleton-line" style="width:70%;height:36px;margin-bottom:8px;"></div>
          <div class="skeleton-line" style="width:50%;height:12px;"></div>
        </div>
      </div>

      <div class="ba-type-grid">
        <div v-for="n in 8" :key="n" class="ba-type-card skeleton-block">
          <div class="skeleton-line" style="width:40%;height:20px;margin-bottom:12px;"></div>
          <div class="skeleton-line" style="width:60%;height:34px;margin-bottom:14px;"></div>
          <div class="skeleton-line" style="width:100%;height:8px;border-radius:4px;margin-bottom:12px;"></div>
          <div class="skeleton-line" style="width:50%;height:12px;"></div>
        </div>
      </div>
    </template>

    <!-- ===================== EMPTY STATE ===================== -->
    <template v-else-if="!hasData">
      <div class="ba-empty-state">
        <div class="ba-empty-illustration">
          <AssetIcon name="droplet-off" :size="56" />
        </div>
        <h2 class="ba-empty-title">No Blood Availability Data</h2>
        <p class="ba-empty-desc">
          {{ loadError || 'Blood availability information is currently unavailable.' }}<br />
          Please refresh the page or try again later.
        </p>
        <button class="ba-btn-primary" @click="fetchInventory">
          <AssetIcon name="refresh-cw" :size="18" />
          Refresh Availability
        </button>
      </div>
    </template>

    <!-- ===================== MAIN CONTENT ===================== -->
    <template v-else>
      <!-- PAGE HEADER -->
      <div class="ba-header">
        <div>
          <h1 class="ba-title">Blood Availability</h1>
          <p class="ba-subtitle">View the latest available blood units provided by the Blood Center.</p>
        </div>
        <div class="ba-header-right">
          <span class="ba-last-updated">Last Updated: {{ lastUpdatedLabel || '—' }}</span>
          <button class="ba-btn-primary" :class="{ 'is-refreshing': isRefreshing }" @click="fetchInventory">
            <AssetIcon name="refresh-cw" :size="18" />
            Refresh Availability
          </button>
        </div>
      </div>

      <!-- SEARCH & FILTER -->
      <div class="ba-filter-card">
        <div class="ba-search-wrap">
          <AssetIcon name="search" :size="18" class="ba-search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            class="ba-search-input"
            placeholder="Search blood type or component..."
            @keyup.enter="fetchInventory"
          />
        </div>

        <button class="ba-filter-toggle" @click="filtersOpen = !filtersOpen">
          <AssetIcon name="sliders-horizontal" :size="16" />
          Filters
          <AssetIcon :name="filtersOpen ? 'chevron-up' : 'chevron-down'" :size="16" />
        </button>

        <div class="ba-filter-fields" :class="{ 'is-open': filtersOpen }">
          <select v-model="filters.bloodType" class="ba-select">
            <option value="">Blood Type</option>
            <option v-for="t in bloodTypeOptions" :key="t" :value="t">{{ t }}</option>
          </select>

          <select v-model="filters.component" class="ba-select">
            <option value="">Blood Component</option>
            <option v-for="c in componentOptions" :key="c" :value="c">{{ c }}</option>
          </select>

          <select v-model="filters.status" class="ba-select">
            <option value="">Availability Status</option>
            <option value="Healthy">Healthy</option>
            <option value="Low">Low</option>
            <option value="Critical">Critical</option>
            <option value="Unavailable">Unavailable</option>
          </select>

          <select v-model="filters.center" class="ba-select">
            <option value="">Blood Center</option>
            <option v-for="c in centerOptions" :key="c" :value="c">{{ c }}</option>
          </select>

          <div class="ba-filter-actions">
            <button class="ba-btn-ghost" @click="resetFilters">Reset Filters</button>
            <button class="ba-btn-primary ba-btn-sm" @click="filtersOpen = false; fetchInventory()">Apply Filters</button>
          </div>
        </div>
      </div>

      <!-- SUMMARY CARDS -->
      <div class="ba-summary-grid">
        <div class="ba-summary-card">
          <div class="ba-summary-top">
            <div class="ba-summary-icon" style="background:#1565C014">
              <AssetIcon name="droplets" :size="16" style="color:#1565C0" />
            </div>
            <span class="ba-summary-label">Total Available Units</span>
          </div>
          <p class="ba-summary-value">{{ summary.totalUnits }}</p>
          <p class="ba-summary-helper">Across all blood types</p>
        </div>

        <div class="ba-summary-card">
          <div class="ba-summary-top">
            <div class="ba-summary-icon" style="background:#2E7D3214">
              <AssetIcon name="check-circle-2" :size="16" style="color:#2E7D32" />
            </div>
            <span class="ba-summary-label">Blood Types Available</span>
          </div>
          <p class="ba-summary-value" style="color:#2E7D32">{{ summary.typesAvailable }}</p>
          <p class="ba-summary-helper">Out of {{ bloodTypeOptions.length }} tracked types</p>
        </div>

        <div class="ba-summary-card">
          <div class="ba-summary-top">
            <div class="ba-summary-icon" style="background:#D32F2F14">
              <AssetIcon name="triangle-alert" :size="16" style="color:#D32F2F" />
            </div>
            <span class="ba-summary-label">Critical Blood Types</span>
          </div>
          <p class="ba-summary-value" style="color:#D32F2F">{{ summary.criticalTypes }}</p>
          <p class="ba-summary-helper">Needs urgent restocking</p>
        </div>

        <div class="ba-summary-card">
          <div class="ba-summary-top">
            <div class="ba-summary-icon" style="background:#7C3AED14">
              <AssetIcon name="clock" :size="16" style="color:#7C3AED" />
            </div>
            <span class="ba-summary-label">Last Inventory Update</span>
          </div>
          <p class="ba-summary-value ba-summary-value--sm">{{ lastUpdatedLabel || '—' }}</p>
          <p class="ba-summary-helper">Synced from Blood Center</p>
        </div>
      </div>

      <div class="ba-layout">
        <!-- MAIN COLUMN -->
        <div class="ba-main-col">
          <!-- BLOOD AVAILABILITY GRID -->
          <section class="ba-section">
            <h2 class="ba-section-title">Blood Availability</h2>
            <div class="ba-type-grid">
              <div
                v-for="type in filteredBloodTypes"
                :key="type.bloodType"
                class="ba-type-card"
                :class="`status-${type.status.toLowerCase()}`"
              >
                <div class="ba-type-card-top">
                  <span class="ba-type-name">{{ type.bloodType }}</span>
                  <span class="ba-status-badge" :class="`badge-${type.status.toLowerCase()}`">{{ type.status }}</span>
                </div>
                <div class="ba-type-units">{{ type.units }} <span>Units</span></div>
                <div class="ba-progress-track">
                  <div
                    class="ba-progress-fill"
                    :class="`fill-${type.status.toLowerCase()}`"
                    :style="{ width: progressWidth(type.units) + '%' }"
                  ></div>
                </div>
                <div class="ba-type-footer">Updated {{ type.lastUpdated }}</div>
              </div>
            </div>
            <p v-if="filteredBloodTypes.length === 0" class="ba-no-results">
              No blood types match your search or filters.
            </p>
          </section>

          <!-- DETAILED INVENTORY TABLE -->
          <section class="ba-section">
            <h2 class="ba-section-title">Detailed Inventory</h2>
            <div class="ba-table-wrap">
              <table class="ba-table">
                <thead>
                  <tr>
                    <th>Blood Type</th>
                    <th>Blood Component</th>
                    <th>Available Units</th>
                    <th>Availability Status</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in filteredTableRows" :key="idx">
                    <td class="ba-td-strong">{{ row.bloodType }}</td>
                    <td>{{ row.component }}</td>
                    <td>{{ row.units }}</td>
                    <td>
                      <span class="ba-status-badge" :class="`badge-${row.status.toLowerCase()}`">{{ row.status }}</span>
                    </td>
                    <td>{{ row.lastUpdated }}</td>
                  </tr>
                  <tr v-if="filteredTableRows.length === 0">
                    <td colspan="5" class="ba-table-empty">No matching inventory records.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <!-- LOW STOCK ALERTS -->
          <section v-if="lowStockAlerts.length" class="ba-section">
            <div class="ba-alert-card">
              <div class="ba-alert-header">
                <AssetIcon name="alert-triangle" :size="20" class="ba-alert-header-icon" />
                <h2 class="ba-section-title" style="margin:0;">Critical Blood Availability</h2>
              </div>
              <div class="ba-alert-list">
                <div v-for="a in lowStockAlerts" :key="a.bloodType" class="ba-alert-row" :class="`alert-${a.status.toLowerCase()}`">
                  <AssetIcon name="circle-alert" :size="18" />
                  <span class="ba-alert-type">{{ a.bloodType }}</span>
                  <span class="ba-alert-units">{{ a.units }} Unit{{ a.units === 1 ? '' : 's' }}</span>
                  <span class="ba-status-badge" :class="`badge-${a.status.toLowerCase()}`">{{ a.status }}</span>
                </div>
              </div>
            </div>
          </section>

          <!-- CHARTS -->
          <div class="ba-chart-row">
            <section class="ba-section ba-chart-card">
              <div class="ba-chart-header">
                <h2 class="ba-section-title" style="margin:0;">Blood Availability Trends</h2>
                <div class="ba-segmented">
                  <button
                    :class="{ active: trendPeriod === 'weekly' }"
                    @click="trendPeriod = 'weekly'"
                  >Weekly</button>
                  <button
                    :class="{ active: trendPeriod === 'monthly' }"
                    @click="trendPeriod = 'monthly'"
                  >Monthly</button>
                </div>
              </div>
              <svg v-if="trendPointCoords.length" viewBox="0 0 320 140" class="ba-line-chart" preserveAspectRatio="none">
                <polyline
                  :points="trendLinePoints"
                  fill="none"
                  stroke="var(--ba-primary)"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <polygon :points="trendAreaPoints" fill="var(--ba-primary)" opacity="0.08" />
                <circle
                  v-for="(p, i) in trendPointCoords"
                  :key="i"
                  :cx="p.x"
                  :cy="p.y"
                  r="3"
                  fill="var(--ba-primary)"
                />
              </svg>
              <p v-else class="ba-no-results">Not enough data yet to show a trend.</p>
              <div class="ba-chart-xlabels">
                <span v-for="(label, i) in currentTrendData.labels" :key="i">{{ label }}</span>
              </div>
            </section>

            <section class="ba-section ba-chart-card">
              <h2 class="ba-section-title">Blood Component Distribution</h2>
              <div v-if="donutSegments.length" class="ba-donut-wrap">
                <svg viewBox="0 0 100 100" class="ba-donut">
                  <circle
                    v-for="(seg, i) in donutSegments"
                    :key="i"
                    cx="50"
                    cy="50"
                    r="35"
                    fill="none"
                    :stroke="seg.color"
                    stroke-width="16"
                    :stroke-dasharray="`${seg.length} ${circumference - seg.length}`"
                    :stroke-dashoffset="seg.offset"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <ul class="ba-donut-legend">
                  <li v-for="(seg, i) in donutSegments" :key="i">
                    <span class="ba-legend-dot" :style="{ background: seg.color }"></span>
                    {{ seg.label }} <strong>{{ seg.percent }}%</strong>
                  </li>
                </ul>
              </div>
              <p v-else class="ba-no-results">No component distribution data yet.</p>
            </section>
          </div>

          <!-- RECENT INVENTORY UPDATES -->
          <section class="ba-section">
            <h2 class="ba-section-title">Recent Inventory Updates</h2>
            <ul v-if="recentUpdates.length" class="ba-timeline">
              <li v-for="(u, i) in recentUpdates" :key="i" class="ba-timeline-item">
                <span class="ba-timeline-dot"></span>
                <div>
                  <div class="ba-timeline-time">{{ u.time }}</div>
                  <div class="ba-timeline-desc">{{ u.description }}</div>
                </div>
              </li>
            </ul>
            <p v-else class="ba-no-results">No recent inventory updates.</p>
          </section>
        </div>

        <!-- RIGHT SIDEBAR -->
        <aside class="ba-sidebar">
          <div class="ba-side-card">
            <h3 class="ba-side-title">Blood Center Information</h3>
            <div class="ba-side-row">
              <AssetIcon name="clock" :size="16" />
              <span>{{ bloodCenter.hours || '—' }}</span>
            </div>
            <div class="ba-side-row">
              <AssetIcon name="map-pin" :size="16" />
              <span>{{ bloodCenter.address || '—' }}</span>
            </div>
            <div class="ba-side-row">
              <AssetIcon name="phone" :size="16" />
              <span>{{ bloodCenter.contact || '—' }}</span>
            </div>
          </div>

          <div class="ba-side-card">
            <h3 class="ba-side-title">Quick Actions</h3>
            <NuxtLink to="/hospital/bloodrequest/" class="ba-side-action">
              <AssetIcon name="circle-plus" :size="16" />
              Create Blood Request
            </NuxtLink>
            <NuxtLink to="/hospital/trackrequests" class="ba-side-action">
              <AssetIcon name="search" :size="16" />
              Track Request
            </NuxtLink>
            <NuxtLink to="/hospital/bloodrequests" class="ba-side-action">
              <AssetIcon name="list" :size="16" />
              View Blood Requests
            </NuxtLink>
          </div>

          <div class="ba-side-card">
            <h3 class="ba-side-title">Availability Legend</h3>
            <div class="ba-legend-row"><span class="ba-legend-dot" style="background:#2E7D32;"></span> Healthy</div>
            <div class="ba-legend-row"><span class="ba-legend-dot" style="background:#F59E0B;"></span> Low</div>
            <div class="ba-legend-row"><span class="ba-legend-dot" style="background:#D32F2F;"></span> Critical</div>
            <div class="ba-legend-row"><span class="ba-legend-dot" style="background:#94A3B8;"></span> Unavailable</div>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { ref, reactive, computed, onMounted } from 'vue'
import { hospitalService } from '~/api/hospital/HospitalService'

definePageMeta({
  layout: 'hospitaldashboard',
})

// ======================= MOCK DATA TOGGLE =======================
// Set to false once the real /hospital/blood-availability endpoint is wired up.
const USE_MOCK_DATA = true

// ======================= STATE =======================
const isLoading = ref(true)
const isRefreshing = ref(false)
const hasData = ref(false)
const loadError = ref(null)

const searchQuery = ref('')
const filtersOpen = ref(false)
const filters = reactive({
  bloodType: '',
  component: '',
  status: '',
  center: '',
})

const trendPeriod = ref('weekly')

const lastUpdatedLabel = ref('')

const bloodTypes = ref([]) // grid data: { bloodType, units, status, lastUpdated }
const tableRows = ref([])  // detailed table rows: { bloodType, component, units, status, lastUpdated, center }
const recentUpdates = ref([])
const bloodCenter = reactive({
  hours: '',
  address: '',
  contact: '',
})

const trendData = reactive({
  weekly: { labels: [], values: [] },
  monthly: { labels: [], values: [] },
})

const componentDistributionRaw = ref([]) // { label, value, color }

// ======================= OPTIONS =======================
const bloodTypeOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const componentOptions = ['Packed RBC', 'Whole Blood', 'Platelets', 'Fresh Frozen Plasma', 'Cryoprecipitate']
const centerOptions = ref([]) // populated from API response

// ======================= MOCK DATA BUILDER =======================
function buildMockData() {
  const now = new Date()

  const statusForUnits = (units) => {
    if (units === 0) return 'Unavailable'
    if (units <= 5) return 'Critical'
    if (units <= 15) return 'Low'
    return 'Healthy'
  }

  const mockUnitsByType = {
    'A+': 34,
    'A-': 9,
    'B+': 22,
    'B-': 4,
    'AB+': 12,
    'AB-': 0,
    'O+': 41,
    'O-': 3,
  }

  const relativeTime = (hoursAgo) => {
    const d = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000)
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const mockBloodTypes = bloodTypeOptions.map((type, i) => ({
    blood_type: type,
    units: mockUnitsByType[type],
    status: statusForUnits(mockUnitsByType[type]),
    last_updated: relativeTime(i + 1),
  }))

  const mockCenters = ['Davao Blood Center', 'Southern Mindanao Regional Blood Center', 'Red Cross - Davao Chapter']

  const componentSplit = {
    'Packed RBC': 0.4,
    'Whole Blood': 0.15,
    'Platelets': 0.2,
    'Fresh Frozen Plasma': 0.18,
    'Cryoprecipitate': 0.07,
  }

  const mockTableRows = []
  bloodTypeOptions.forEach((type, i) => {
    const totalUnits = mockUnitsByType[type]
    componentOptions.forEach((component, j) => {
      const units = Math.round(totalUnits * componentSplit[component] * (0.8 + Math.random() * 0.4))
      mockTableRows.push({
        blood_type: type,
        component,
        units,
        status: statusForUnits(units),
        last_updated: relativeTime(i + j),
        center: mockCenters[(i + j) % mockCenters.length],
      })
    })
  })

  const mockRecentUpdates = [
    { time: relativeTime(1), description: 'O- inventory restocked with 12 new units from weekend donation drive.' },
    { time: relativeTime(4), description: 'AB- fully depleted after emergency transfusion request was fulfilled.' },
    { time: relativeTime(9), description: 'A+ Packed RBC units flagged for quality check, 5 units quarantined.' },
    { time: relativeTime(18), description: 'B- dropped to critical level following two large hospital requests.' },
    { time: relativeTime(30), description: 'Weekly inventory reconciliation completed across all blood centers.' },
    { time: relativeTime(48), description: 'O+ Whole Blood units expired and removed from active inventory.' },
  ]

  const mockBloodCenter = {
    hours: 'Mon–Sat, 8:00 AM – 5:00 PM',
    address: 'Davao Blood Center, J.P. Laurel Ave, Davao City',
    contact: '(082) 555-0173',
  }

  const weeklyLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const weeklyValues = [120, 132, 118, 145, 138, 150, 165]

  const monthlyLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul']
  const monthlyValues = [480, 512, 460, 530, 495, 560, 165]

  const mockComponentDistribution = [
    { label: 'Packed RBC', value: 40, color: '#1565C0' },
    { label: 'Whole Blood', value: 15, color: '#2E7D32' },
    { label: 'Platelets', value: 20, color: '#F59E0B' },
    { label: 'Fresh Frozen Plasma', value: 18, color: '#7C3AED' },
    { label: 'Cryoprecipitate', value: 7, color: '#D32F2F' },
  ]

  return {
    blood_types: mockBloodTypes,
    table_rows: mockTableRows,
    recent_updates: mockRecentUpdates,
    blood_center: mockBloodCenter,
    trends: {
      weekly: { labels: weeklyLabels, values: weeklyValues },
      monthly: { labels: monthlyLabels, values: monthlyValues },
    },
    component_distribution: mockComponentDistribution,
    centers: mockCenters,
    last_updated_label: relativeTime(1),
  }
}

// ======================= FETCH =======================
async function fetchInventory() {
  isRefreshing.value = true
  loadError.value = null
  try {
    let data

    if (USE_MOCK_DATA) {
      // Simulate network latency so loading/refresh states are visible
      await new Promise((resolve) => setTimeout(resolve, 500))
      data = buildMockData()
    } else {
      // GET /hospital/blood-availability
      // Expected response shape:
      // {
      //   blood_types: [{ blood_type, units, status, last_updated }],
      //   table_rows: [{ blood_type, component, units, status, last_updated, center }],
      //   recent_updates: [{ time, description }],
      //   blood_center: { hours, address, contact },
      //   trends: { weekly: { labels, values }, monthly: { labels, values } },
      //   component_distribution: [{ label, value, color }],
      //   centers: [string],
      //   last_updated_label: string
      // }
      data = await hospitalService.bloodAvailability({
        search: searchQuery.value,
        blood_type: filters.bloodType,
        component: filters.component,
        status: filters.status,
        center: filters.center,
      })
    }

    bloodTypes.value = (data.blood_types ?? []).map((t) => ({
      bloodType: t.blood_type,
      units: t.units,
      status: t.status,
      lastUpdated: t.last_updated,
    }))

    tableRows.value = (data.table_rows ?? []).map((r) => ({
      bloodType: r.blood_type,
      component: r.component,
      units: r.units,
      status: r.status,
      lastUpdated: r.last_updated,
      center: r.center,
    }))

    recentUpdates.value = data.recent_updates ?? []
    Object.assign(bloodCenter, data.blood_center ?? { hours: '', address: '', contact: '' })
    trendData.weekly = data.trends?.weekly ?? { labels: [], values: [] }
    trendData.monthly = data.trends?.monthly ?? { labels: [], values: [] }
    componentDistributionRaw.value = data.component_distribution ?? []
    centerOptions.value = data.centers ?? []
    lastUpdatedLabel.value = data.last_updated_label ?? ''

    hasData.value = bloodTypes.value.length > 0
  } catch (err) {
    console.error('Failed to load blood availability:', err)
    hasData.value = false
    loadError.value = 'Failed to load blood availability data.'
  } finally {
    isLoading.value = false
    isRefreshing.value = false
  }
}

onMounted(() => {
  isLoading.value = true
  fetchInventory()
})

// ======================= FILTERED VIEWS =======================
const filteredBloodTypes = computed(() => {
  return bloodTypes.value.filter((t) => {
    const q = searchQuery.value.trim().toLowerCase()
    const matchesSearch = !q || t.bloodType.toLowerCase().includes(q)
    const matchesType = !filters.bloodType || t.bloodType === filters.bloodType
    const matchesStatus = !filters.status || t.status === filters.status
    return matchesSearch && matchesType && matchesStatus
  })
})

const filteredTableRows = computed(() => {
  return tableRows.value.filter((r) => {
    const q = searchQuery.value.trim().toLowerCase()
    const matchesSearch =
      !q || r.bloodType.toLowerCase().includes(q) || r.component.toLowerCase().includes(q)
    const matchesType = !filters.bloodType || r.bloodType === filters.bloodType
    const matchesComponent = !filters.component || r.component === filters.component
    const matchesStatus = !filters.status || r.status === filters.status
    const matchesCenter = !filters.center || r.center === filters.center
    return matchesSearch && matchesType && matchesComponent && matchesStatus && matchesCenter
  })
})

const lowStockAlerts = computed(() =>
  bloodTypes.value
    .filter((t) => t.status === 'Critical' || t.status === 'Low')
    .sort((a, b) => a.units - b.units)
)

function resetFilters() {
  searchQuery.value = ''
  filters.bloodType = ''
  filters.component = ''
  filters.status = ''
  filters.center = ''
  fetchInventory()
}

// ======================= SUMMARY CARDS =======================
const summary = computed(() => {
  const totalUnits = bloodTypes.value.reduce((sum, t) => sum + t.units, 0)
  const typesAvailable = bloodTypes.value.filter((t) => t.units > 0).length
  const criticalTypes = bloodTypes.value.filter((t) => t.status === 'Critical').length
  return { totalUnits, typesAvailable, criticalTypes }
})

function progressWidth(units) {
  const max = 50 // reference max units for a "full" bar
  return Math.min(100, Math.round((units / max) * 100))
}

// ======================= TRENDS CHART (SVG) =======================
const currentTrendData = computed(() => trendData[trendPeriod.value])

const trendPointCoords = computed(() => {
  const values = currentTrendData.value.values
  if (!values.length) return []
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const stepX = 320 / (values.length - 1 || 1)
  return values.map((v, i) => ({
    x: i * stepX,
    y: 120 - ((v - min) / range) * 100,
  }))
})

const trendLinePoints = computed(() =>
  trendPointCoords.value.map((p) => `${p.x},${p.y}`).join(' ')
)

const trendAreaPoints = computed(() => {
  if (!trendPointCoords.value.length) return ''
  const first = trendPointCoords.value[0]
  const last = trendPointCoords.value[trendPointCoords.value.length - 1]
  return `${first.x},130 ${trendLinePoints.value} ${last.x},130`
})

// ======================= DOUGHNUT CHART (SVG) =======================
const circumference = 2 * Math.PI * 35

const donutSegments = computed(() => {
  const total = componentDistributionRaw.value.reduce((sum, c) => sum + c.value, 0)
  if (!total) return []
  let offsetAcc = 0
  return componentDistributionRaw.value.map((c) => {
    const percent = Math.round((c.value / total) * 100)
    const length = (c.value / total) * circumference
    const seg = {
      label: c.label,
      color: c.color,
      percent,
      length,
      offset: -offsetAcc,
    }
    offsetAcc += length
    return seg
  })
})
</script>

<style scoped>
.ba-page {
  --ba-primary: #1565C0;
  --ba-primary-hover: #0D47A1;
  --ba-bg: #F7F9FC;
  --ba-card: #FFFFFF;
  --ba-border: #E5EAF0;
  --ba-text: #1E293B;
  --ba-text-secondary: #64748B;
  --ba-text-muted: #94A3B8;
  --ba-success: #2E7D32;
  --ba-warning: #F59E0B;
  --ba-danger: #D32F2F;
  --ba-purple: #7C3AED;
  --ba-shadow: 0 4px 20px rgba(15, 23, 42, 0.05);

  font-family: 'Inter', sans-serif;
  color: var(--ba-text);
  display: flex;
  flex-direction: column;
  gap: 24px;
}

:global(.dark) .ba-page {
  --ba-bg: #0F172A;
  --ba-card: #1E293B;
  --ba-border: #2A3447;
  --ba-text: #F1F5F9;
  --ba-text-secondary: #94A3B8;
  --ba-text-muted: #64748B;
  --ba-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
}

/* ---------- HEADER ---------- */
.ba-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.ba-title {
  font-size: 30px;
  font-weight: 700;
  margin: 0;
}
.ba-subtitle {
  font-size: 15px;
  font-weight: 400;
  color: var(--ba-text-secondary);
  margin: 6px 0 0;
}
.ba-header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
.ba-last-updated {
  font-size: 13px;
  color: var(--ba-text-secondary);
}

.ba-btn-primary {
  height: 48px;
  padding: 0 20px;
  background: var(--ba-primary);
  color: #fff;
  border: none;
  border-radius: 14px;
  font-family: 'Inter', sans-serif;
  font-size: 15px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.15s ease;
}
.ba-btn-primary:hover {
  background: var(--ba-primary-hover);
}
.ba-btn-primary.is-refreshing svg {
  animation: ba-spin 0.8s linear infinite;
}
.ba-btn-sm {
  height: 40px;
  padding: 0 16px;
  border-radius: 10px;
}
@keyframes ba-spin {
  to { transform: rotate(360deg); }
}

.ba-btn-ghost {
  height: 40px;
  padding: 0 16px;
  background: transparent;
  border: 1px solid var(--ba-border);
  border-radius: 10px;
  color: var(--ba-text);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
}
.ba-btn-ghost:hover {
  background: var(--ba-bg);
}

/* ---------- SEARCH & FILTER ---------- */
.ba-filter-card {
  background: var(--ba-card);
  border: 1px solid var(--ba-border);
  border-radius: 18px;
  padding: 20px 24px;
  box-shadow: var(--ba-shadow);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
}
.ba-search-wrap {
  position: relative;
  flex: 1 1 280px;
}
.ba-search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--ba-text-secondary);
}
.ba-search-input {
  width: 100%;
  height: 44px;
  padding: 0 14px 0 42px;
  border-radius: 12px;
  border: 1px solid var(--ba-border);
  background: var(--ba-bg);
  color: var(--ba-text);
  font-size: 14px;
  font-family: 'Inter', sans-serif;
}
.ba-search-input:focus {
  outline: 2px solid var(--ba-primary);
  outline-offset: 1px;
}
.ba-filter-toggle {
  display: none;
  align-items: center;
  gap: 6px;
  height: 44px;
  padding: 0 16px;
  border-radius: 12px;
  border: 1px solid var(--ba-border);
  background: var(--ba-bg);
  color: var(--ba-text);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
}
.ba-filter-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}
.ba-select {
  height: 44px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid var(--ba-border);
  background: var(--ba-bg);
  color: var(--ba-text);
  font-size: 14px;
  font-family: 'Inter', sans-serif;
}
.ba-filter-actions {
  display: flex;
  gap: 10px;
  margin-left: auto;
}

/* ---------- SUMMARY CARDS (matches dashboard .stat-card) ---------- */
.ba-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}
.ba-summary-card {
  background: var(--ba-card);
  border: 1px solid var(--ba-border);
  border-radius: 18px;
  padding: 22px 24px 20px;
  box-shadow: var(--ba-shadow);
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.ba-summary-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
}
.ba-summary-top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ba-summary-icon {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ba-summary-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ba-text-secondary);
}
.ba-summary-value {
  font-size: 42px;
  font-weight: 800;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--ba-text);
  margin: 4px 0 0;
  line-height: 1;
}
.ba-summary-value--sm {
  font-size: 20px;
}
.ba-summary-helper {
  font-size: 12px;
  font-weight: 500;
  color: var(--ba-text-muted);
  margin: 6px 0 0;
}

/* ---------- LAYOUT ---------- */
.ba-layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 24px;
  align-items: start;
}
.ba-main-col {
  display: flex;
  flex-direction: column;
  gap: 28px;
  min-width: 0;
}
.ba-section-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 16px;
}

/* ---------- BLOOD TYPE GRID ---------- */
.ba-type-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
}
.ba-type-card {
  background: var(--ba-card);
  border: 1px solid var(--ba-border);
  border-radius: 18px;
  padding: 20px;
  box-shadow: var(--ba-shadow);
  transition: transform 0.2s ease;
}
.ba-type-card:hover {
  transform: translateY(-2px);
}
.ba-type-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.ba-type-name {
  font-size: 20px;
  font-weight: 700;
}
.ba-type-units {
  font-size: 32px;
  font-weight: 800;
  margin: 10px 0 12px;
}
.ba-type-units span {
  font-size: 14px;
  font-weight: 500;
  color: var(--ba-text-secondary);
}
.ba-progress-track {
  height: 8px;
  border-radius: 4px;
  background: var(--ba-bg);
  overflow: hidden;
  margin-bottom: 12px;
}
.ba-progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}
.fill-healthy { background: var(--ba-success); }
.fill-low { background: var(--ba-warning); }
.fill-critical { background: var(--ba-danger); }
.fill-unavailable { background: #94A3B8; }
.ba-type-footer {
  font-size: 12px;
  color: var(--ba-text-secondary);
}
.ba-no-results {
  color: var(--ba-text-secondary);
  font-size: 14px;
  padding: 20px 0;
  text-align: center;
}

/* ---------- STATUS BADGE ---------- */
.ba-status-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  white-space: nowrap;
}
.badge-healthy { background: rgba(46, 125, 50, 0.12); color: var(--ba-success); }
.badge-low { background: rgba(245, 158, 11, 0.14); color: var(--ba-warning); }
.badge-critical { background: rgba(211, 47, 47, 0.12); color: var(--ba-danger); }
.badge-unavailable { background: rgba(148, 163, 184, 0.16); color: #64748B; }

/* ---------- TABLE ---------- */
.ba-table-wrap {
  background: var(--ba-card);
  border: 1px solid var(--ba-border);
  border-radius: 18px;
  box-shadow: var(--ba-shadow);
  overflow-x: auto;
}
.ba-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 560px;
}
.ba-table th {
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: var(--ba-text-secondary);
  padding: 14px 20px;
  border-bottom: 1px solid var(--ba-border);
}
.ba-table td {
  font-size: 14px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--ba-border);
}
.ba-table tr:last-child td {
  border-bottom: none;
}
.ba-td-strong {
  font-weight: 700;
}
.ba-table-empty {
  text-align: center;
  color: var(--ba-text-secondary);
  padding: 24px;
}

/* ---------- ALERTS ---------- */
.ba-alert-card {
  background: var(--ba-card);
  border: 1px solid var(--ba-border);
  border-left: 4px solid var(--ba-danger);
  border-radius: 18px;
  padding: 22px 24px;
  box-shadow: var(--ba-shadow);
}
.ba-alert-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.ba-alert-header-icon {
  color: var(--ba-danger);
}
.ba-alert-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ba-alert-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--ba-bg);
}
.alert-critical svg { color: var(--ba-danger); }
.alert-low svg { color: var(--ba-warning); }
.ba-alert-type {
  font-weight: 700;
  width: 44px;
}
.ba-alert-units {
  flex: 1;
  font-size: 14px;
  color: var(--ba-text-secondary);
}

/* ---------- CHARTS ---------- */
.ba-chart-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.ba-chart-card {
  background: var(--ba-card);
  border: 1px solid var(--ba-border);
  border-radius: 18px;
  padding: 22px 24px;
  box-shadow: var(--ba-shadow);
}
.ba-chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.ba-segmented {
  display: flex;
  border: 1px solid var(--ba-border);
  border-radius: 10px;
  overflow: hidden;
}
.ba-segmented button {
  border: none;
  background: transparent;
  color: var(--ba-text-secondary);
  font-size: 13px;
  font-weight: 600;
  padding: 6px 14px;
  cursor: pointer;
}
.ba-segmented button.active {
  background: var(--ba-primary);
  color: #fff;
}
.ba-line-chart {
  width: 100%;
  height: 140px;
}
.ba-chart-xlabels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--ba-text-secondary);
  margin-top: 6px;
}
.ba-donut-wrap {
  display: flex;
  align-items: center;
  gap: 20px;
}
.ba-donut {
  width: 130px;
  height: 130px;
  flex-shrink: 0;
}
.ba-donut-legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
}
.ba-legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 8px;
}

/* ---------- TIMELINE ---------- */
.ba-timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  border-left: 2px solid var(--ba-border);
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.ba-timeline-item {
  position: relative;
}
.ba-timeline-dot {
  position: absolute;
  left: -25px;
  top: 4px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--ba-primary);
}
.ba-timeline-time {
  font-size: 12px;
  font-weight: 600;
  color: var(--ba-text-secondary);
}
.ba-timeline-desc {
  font-size: 14px;
  margin-top: 2px;
}

/* ---------- SIDEBAR ---------- */
.ba-sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: sticky;
  top: 20px;
}
.ba-side-card {
  background: var(--ba-card);
  border: 1px solid var(--ba-border);
  border-radius: 18px;
  padding: 20px;
  box-shadow: var(--ba-shadow);
}
.ba-side-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 14px;
}
.ba-side-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  color: var(--ba-text-secondary);
  margin-bottom: 12px;
}
.ba-side-row:last-child {
  margin-bottom: 0;
}
.ba-side-action {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--ba-text);
  text-decoration: none;
  padding: 10px 12px;
  border-radius: 10px;
  margin-bottom: 6px;
}
.ba-side-action:last-child {
  margin-bottom: 0;
}
.ba-side-action:hover {
  background: var(--ba-bg);
  color: var(--ba-primary);
}
.ba-legend-row {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: var(--ba-text-secondary);
  margin-bottom: 10px;
}
.ba-legend-row:last-child {
  margin-bottom: 0;
}

/* ---------- EMPTY STATE ---------- */
.ba-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 80px 20px;
  background: var(--ba-card);
  border: 1px solid var(--ba-border);
  border-radius: 18px;
}
.ba-empty-illustration {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  background: var(--ba-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ba-text-secondary);
  margin-bottom: 20px;
}
.ba-empty-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 8px;
}
.ba-empty-desc {
  font-size: 14px;
  color: var(--ba-text-secondary);
  margin: 0 0 24px;
  line-height: 1.6;
}

/* ---------- SKELETON / SHIMMER ---------- */
.skeleton-block {
  pointer-events: none;
}
.skeleton-line {
  background: linear-gradient(
    90deg,
    var(--ba-border) 25%,
    rgba(255, 255, 255, 0.4) 37%,
    var(--ba-border) 63%
  );
  background-size: 400% 100%;
  border-radius: 6px;
  animation: ba-shimmer 1.4s ease infinite;
}
:global(.dark) .skeleton-line {
  background: linear-gradient(
    90deg,
    #2A3447 25%,
    #3A4763 37%,
    #2A3447 63%
  );
  background-size: 400% 100%;
}
@keyframes ba-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton-line {
    animation: none;
  }
  .ba-btn-primary.is-refreshing svg {
    animation: none;
  }
}

/* ---------- RESPONSIVE ---------- */
@media (max-width: 1200px) {
  .ba-layout {
    grid-template-columns: 1fr;
  }
  .ba-sidebar {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
  }
  .ba-side-card {
    flex: 1 1 260px;
  }
}

@media (max-width: 992px) {
  .ba-summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .ba-type-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .ba-chart-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .ba-filter-toggle {
    display: inline-flex;
  }
  .ba-filter-fields {
    display: none;
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }
  .ba-filter-fields.is-open {
    display: flex;
  }
  .ba-filter-actions {
    margin-left: 0;
  }
  .ba-header {
    flex-direction: column;
    align-items: stretch;
  }
  .ba-header-right {
    align-items: stretch;
  }
}

@media (max-width: 560px) {
  .ba-summary-grid {
    grid-template-columns: 1fr;
  }
  .ba-type-grid {
    grid-template-columns: 1fr;
  }
  .ba-sidebar {
    flex-direction: column;
  }
}
</style>