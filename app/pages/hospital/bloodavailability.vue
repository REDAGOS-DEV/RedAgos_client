<template>
  <div class="ba-page">
    <!-- ===================== LOADING SKELETON ===================== -->
    <template v-if="isLoading">
      <div class="ba-inner">
        <div class="ba-header skeleton-block">
          <div>
            <div class="skeleton-line" style="width:220px;height:32px;margin-bottom:10px;"></div>
            <div class="skeleton-line" style="width:340px;height:16px;"></div>
          </div>
          <div class="skeleton-line" style="width:260px;height:44px;border-radius:12px;"></div>
        </div>

        <div class="ba-filter-panel skeleton-block">
          <div class="skeleton-line" style="width:100%;height:44px;border-radius:12px;"></div>
        </div>

        <div class="ba-summary-grid">
          <div v-for="n in 4" :key="n" class="ba-summary-card skeleton-block">
            <div class="skeleton-line" style="width:32px;height:32px;border-radius:10px;margin-bottom:12px;"></div>
            <div class="skeleton-line" style="width:70%;height:44px;margin-bottom:8px;"></div>
            <div class="skeleton-line" style="width:50%;height:12px;"></div>
          </div>
        </div>

        <div class="ba-type-grid">
          <div v-for="n in 8" :key="n" class="ba-type-card skeleton-block">
            <div class="skeleton-line" style="width:40%;height:22px;margin-bottom:14px;"></div>
            <div class="skeleton-line" style="width:60%;height:40px;margin-bottom:16px;"></div>
            <div class="skeleton-line" style="width:100%;height:10px;border-radius:6px;margin-bottom:14px;"></div>
            <div class="skeleton-line" style="width:50%;height:12px;"></div>
          </div>
        </div>
      </div>
    </template>

    <!-- ===================== EMPTY STATE ===================== -->
    <template v-else-if="!hasData">
      <div class="ba-empty-state fade-in">
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
      <div class="ba-inner">
        <!-- PAGE HEADER -->
        <header class="ba-header fade-in" style="--delay: 0ms">
          <div>
            <h1 class="ba-title">Blood Availability</h1>
            <p class="ba-subtitle">View the latest available blood units provided by the Blood Center.</p>
          </div>
          <div class="ba-header-actions">
            <span class="ba-sync-badge" role="status">
              <span class="ba-sync-dot" aria-hidden="true"></span>
              Synced {{ syncedLabel }}
            </span>
            <button
              class="ba-theme-toggle"
              type="button"
              :aria-pressed="isDark"
              :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
              :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
              @click="toggleTheme"
            >
              <AssetIcon :name="isDark ? 'sun' : 'moon'" :size="18" />
            </button>
            <button
              class="ba-btn-primary"
              :class="{ 'is-refreshing': isRefreshing }"
              :disabled="isRefreshing"
              @click="fetchInventory"
            >
              <AssetIcon name="refresh-cw" :size="16" />
              Refresh Availability
            </button>
          </div>
        </header>

        <!-- SEARCH & FILTER PANEL -->
        <section class="ba-filter-panel fade-in" style="--delay: 60ms" aria-labelledby="ba-filter-title">
          <div class="ba-filter-panel-head">
            <h2 id="ba-filter-title" class="ba-panel-title">Inventory Filters</h2>
            <p class="ba-panel-subtitle">Search and filter available blood inventory.</p>
          </div>

          <div class="ba-filter-body">
            <div class="ba-search-wrap">
              <AssetIcon name="search" :size="18" class="ba-search-icon" />
              <input
                v-model="searchQuery"
                type="text"
                class="ba-search-input"
                placeholder="Search blood type or component..."
                aria-label="Search blood type or component"
                @keyup.enter="fetchInventory"
              />
            </div>

            <button class="ba-filter-toggle" :aria-expanded="filtersOpen" @click="filtersOpen = !filtersOpen">
              <AssetIcon name="sliders-horizontal" :size="16" />
              Filters
              <AssetIcon :name="filtersOpen ? 'chevron-up' : 'chevron-down'" :size="16" />
            </button>

            <div class="ba-filter-fields" :class="{ 'is-open': filtersOpen }">
              <select v-model="filters.bloodType" class="ba-select" aria-label="Filter by blood type">
                <option value="">Blood Type</option>
                <option v-for="t in bloodTypeOptions" :key="t" :value="t">{{ t }}</option>
              </select>

              <select v-model="filters.component" class="ba-select" aria-label="Filter by blood component">
                <option value="">Blood Component</option>
                <option v-for="c in componentOptions" :key="c" :value="c">{{ c }}</option>
              </select>

              <select v-model="filters.status" class="ba-select" aria-label="Filter by availability status">
                <option value="">Availability Status</option>
                <option value="Healthy">Healthy</option>
                <option value="Low">Low</option>
                <option value="Critical">Critical</option>
                <option value="Unavailable">Unavailable</option>
              </select>

              <select v-model="filters.center" class="ba-select" aria-label="Filter by blood center">
                <option value="">Blood Center</option>
                <option v-for="c in centerOptions" :key="c" :value="c">{{ c }}</option>
              </select>

              <div class="ba-filter-actions">
                <button class="ba-btn-ghost" @click="resetFilters">Reset Filters</button>
                <button class="ba-btn-primary ba-btn-sm" @click="filtersOpen = false; fetchInventory()">Apply Filters</button>
              </div>
            </div>
          </div>
        </section>

        <!-- SUMMARY KPI CARDS -->
        <div class="ba-summary-grid">
          <div class="ba-summary-card fade-in" style="--delay: 100ms">
            <div class="ba-summary-top">
              <div class="ba-summary-icon" style="background:#1565C014">
                <AssetIcon name="droplets" :size="22" style="color:#1565C0" />
              </div>
              <span class="ba-summary-label">Total Available Units</span>
            </div>
            <p class="ba-summary-value">{{ totalUnitsDisplay }}</p>
            <p class="ba-summary-helper">Across all blood types</p>
          </div>

          <div class="ba-summary-card fade-in" style="--delay: 150ms">
            <div class="ba-summary-top">
              <div class="ba-summary-icon" style="background:#2E7D3214">
                <AssetIcon name="check-circle-2" :size="22" style="color:#2E7D32" />
              </div>
              <span class="ba-summary-label">Blood Types Available</span>
            </div>
            <p class="ba-summary-value" style="color:#2E7D32">{{ typesAvailableDisplay }}</p>
            <p class="ba-summary-helper">Out of {{ bloodTypeOptions.length }} tracked types</p>
          </div>

          <div class="ba-summary-card fade-in" style="--delay: 200ms">
            <div class="ba-summary-top">
              <div class="ba-summary-icon" style="background:#D32F2F14">
                <AssetIcon name="triangle-alert" :size="22" style="color:#D32F2F" />
              </div>
              <span class="ba-summary-label">Critical Blood Types</span>
            </div>
            <p class="ba-summary-value" style="color:#D32F2F">{{ criticalTypesDisplay }}</p>
            <p class="ba-summary-helper">Needs urgent restocking</p>
          </div>

          <div class="ba-summary-card fade-in" style="--delay: 250ms">
            <div class="ba-summary-top">
              <div class="ba-summary-icon" style="background:#7C3AED14">
                <AssetIcon name="clock" :size="22" style="color:#7C3AED" />
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
            <section class="ba-panel fade-in" style="--delay: 300ms">
              <div class="ba-panel-header">
                <h2 class="ba-section-title">Blood Availability</h2>
              </div>
              <div class="ba-type-grid">
                <div
                  v-for="type in filteredBloodTypes"
                  :key="type.bloodType"
                  class="ba-type-card"
                  :class="`status-${type.status.toLowerCase()}`"
                  tabindex="0"
                  @click="viewDetails(type)"
                  @keyup.enter="viewDetails(type)"
                >
                  <div class="ba-type-card-top">
                    <span class="ba-type-name">{{ type.bloodType }}</span>
                    <span class="ba-status-badge ba-status-badge--lg" :class="`badge-${type.status.toLowerCase()}`">{{ type.status }}</span>
                  </div>
                  <div class="ba-type-units">{{ type.units }} <span>Units</span></div>
                  <div class="ba-progress-track">
                    <div
                      class="ba-progress-fill"
                      :class="`fill-${type.status.toLowerCase()}`"
                      :style="{ width: (progressReady ? progressWidth(type.units) : 0) + '%' }"
                    ></div>
                  </div>
                  <div class="ba-type-meta">
                    <span class="ba-type-component">{{ type.componentSummary }}</span>
                    <span class="ba-type-footer">Updated {{ type.lastUpdated }}</span>
                  </div>
                  <button class="ba-type-view" @click.stop="viewDetails(type)">
                    View Details
                    <AssetIcon name="arrow-right" :size="14" class="ba-type-view-arrow" />
                  </button>
                </div>
              </div>
              <p v-if="filteredBloodTypes.length === 0" class="ba-no-results">
                No blood types match your search or filters.
              </p>
            </section>

            <!-- DETAILED INVENTORY TABLE -->
            <section ref="detailedTableRef" class="ba-panel fade-in" style="--delay: 340ms">
              <div class="ba-panel-header">
                <h2 class="ba-section-title">Detailed Inventory</h2>
              </div>
              <div class="ba-table-wrap">
                <table class="ba-table">
                  <thead>
                    <tr>
                      <th scope="col">Blood Type</th>
                      <th scope="col">Blood Component</th>
                      <th scope="col">Available Units</th>
                      <th scope="col">Availability Status</th>
                      <th scope="col">Last Updated</th>
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

            <!-- CRITICAL BLOOD AVAILABILITY -->
            <section v-if="criticalAlerts.length" class="ba-panel ba-alert-panel fade-in" style="--delay: 380ms">
              <div class="ba-panel-header">
                <div class="ba-alert-header">
                  <AssetIcon name="alert-triangle" :size="20" class="ba-alert-header-icon" />
                  <h2 class="ba-section-title" style="margin:0;">Critical Blood Availability</h2>
                </div>
              </div>
              <div class="ba-alert-list">
                <div
                  v-for="a in criticalAlerts"
                  :key="a.bloodType"
                  class="ba-alert-card"
                  :class="`alert-${a.status.toLowerCase()}`"
                >
                  <div class="ba-alert-card-main">
                    <span class="ba-alert-type">{{ a.bloodType }}</span>
                    <span class="ba-alert-units">{{ a.units }} Unit{{ a.units === 1 ? '' : 's' }}</span>
                    <span class="ba-status-badge" :class="`badge-${a.status.toLowerCase()}`">{{ a.status }}</span>
                  </div>
                  <p class="ba-alert-action">{{ a.recommendedAction }}</p>
                  <p v-if="a.eta" class="ba-alert-eta">
                    <AssetIcon name="clock" :size="13" />
                    Expected restock: <strong>{{ a.eta }}</strong>
                  </p>
                </div>
              </div>
            </section>

            <!-- CHARTS -->
            <div class="ba-chart-row">
              <section class="ba-panel ba-chart-card fade-in" style="--delay: 420ms">
                <div class="ba-chart-header">
                  <h2 class="ba-section-title" style="margin:0;">Blood Availability Trends</h2>
                  <div class="ba-segmented" role="tablist" aria-label="Trend period">
                    <button
                      type="button"
                      role="tab"
                      :aria-selected="trendPeriod === 'weekly'"
                      class="ba-segmented-btn"
                      :class="{ active: trendPeriod === 'weekly' }"
                      @click="trendPeriod = 'weekly'"
                    >Weekly</button>
                    <button
                      type="button"
                      role="tab"
                      :aria-selected="trendPeriod === 'monthly'"
                      class="ba-segmented-btn"
                      :class="{ active: trendPeriod === 'monthly' }"
                      @click="trendPeriod = 'monthly'"
                    >Monthly</button>
                  </div>
                </div>

                <div class="ba-trend-body">
                  <svg v-if="trendPointCoords.length" viewBox="0 0 320 160" class="ba-line-chart" preserveAspectRatio="none" role="img" aria-label="Blood availability trend chart">
                    <defs>
                      <linearGradient id="baTrendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="var(--ba-primary)" stop-opacity="0.28" />
                        <stop offset="100%" stop-color="var(--ba-primary)" stop-opacity="0" />
                      </linearGradient>
                    </defs>
                    <line v-for="g in trendGridLines" :key="g" x1="0" x2="320" :y1="g" :y2="g" class="ba-trend-grid" />
                    <path :d="trendAreaPath" fill="url(#baTrendGradient)" :class="{ 'ba-area-animate': chartAnimateKey }" />
                    <path :d="trendLinePath" fill="none" stroke="var(--ba-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" :class="{ 'ba-line-animate': chartAnimateKey }" />
                    <g v-for="(p, i) in trendPointCoords" :key="i">
                      <circle :cx="p.x" :cy="p.y" r="3.5" class="ba-trend-dot" :class="{ 'ba-trend-dot--active': hoveredPoint === i }" />
                      <rect :x="p.x - 14" y="0" width="28" height="160" fill="transparent" tabindex="0" role="button" :aria-label="`${currentTrendData.labels[i]}: ${currentTrendData.values[i]} units`"
                        @mouseenter="hoveredPoint = i" @mouseleave="hoveredPoint = null" @focus="hoveredPoint = i" @blur="hoveredPoint = null" />
                    </g>
                  </svg>
                  <p v-else class="ba-no-results">Not enough data yet to show a trend.</p>

                  <div v-if="hoveredPoint !== null" class="ba-trend-tooltip" :style="{ left: trendTooltipLeft + '%' }">
                    <span class="ba-trend-tooltip-value">{{ currentTrendData.values[hoveredPoint] }} units</span>
                    <span class="ba-trend-tooltip-label">{{ currentTrendData.labels[hoveredPoint] }}</span>
                  </div>

                  <div class="ba-chart-xlabels">
                    <span v-for="(label, i) in currentTrendData.labels" :key="i">{{ label }}</span>
                  </div>
                </div>
              </section>

              <section class="ba-panel ba-chart-card fade-in" style="--delay: 460ms">
                <h2 class="ba-section-title">Blood Component Distribution</h2>
                <div v-if="donutSegments.length" class="ba-donut-wrap">
                  <div class="ba-donut-svg-wrap">
                    <svg viewBox="0 0 100 100" class="ba-donut">
                      <circle
                        v-for="(seg, i) in donutSegments"
                        :key="i"
                        cx="50"
                        cy="50"
                        r="38"
                        fill="none"
                        :stroke="seg.color"
                        stroke-width="20"
                        :stroke-dasharray="`${seg.length} ${circumference - seg.length}`"
                        :stroke-dashoffset="seg.offset"
                        transform="rotate(-90 50 50)"
                      />
                    </svg>
                    <div class="ba-donut-center">
                      <span class="ba-donut-center-value">{{ componentTotalUnits }}</span>
                      <span class="ba-donut-center-label">Total Units</span>
                    </div>
                  </div>
                  <ul class="ba-donut-legend">
                    <li v-for="(seg, i) in donutSegments" :key="i">
                      <span class="ba-legend-dot" :style="{ background: seg.color }"></span>
                      <span class="ba-legend-name">{{ seg.label }}</span>
                      <strong class="ba-legend-percent">{{ seg.percent }}%</strong>
                    </li>
                  </ul>
                </div>
                <p v-else class="ba-no-results">No component distribution data yet.</p>
              </section>
            </div>

            <!-- RECENT INVENTORY UPDATES -->
            <section class="ba-panel fade-in" style="--delay: 500ms">
              <div class="ba-panel-header">
                <h2 class="ba-section-title">Recent Inventory Updates</h2>
              </div>
              <ul v-if="recentUpdates.length" class="ba-timeline">
                <li v-for="(u, i) in recentUpdates" :key="i" class="ba-timeline-item">
                  <div class="ba-timeline-rail">
                    <span class="ba-timeline-dot" :class="`ba-timeline-dot--${u.tone}`"></span>
                    <span v-if="i !== recentUpdates.length - 1" class="ba-timeline-line"></span>
                  </div>
                  <div class="ba-timeline-body">
                    <div class="ba-timeline-time">{{ u.time }}</div>
                    <div class="ba-timeline-title">{{ u.title }}</div>
                    <div class="ba-timeline-desc">{{ u.description }}</div>
                  </div>
                </li>
              </ul>
              <p v-else class="ba-no-results">No recent inventory updates.</p>
            </section>
          </div>

          <!-- RIGHT SIDEBAR -->
          <aside class="ba-sidebar">
            <div class="ba-side-card fade-in" style="--delay: 340ms">
              <h3 class="ba-side-title">
                <AssetIcon name="building-2" :size="16" />
                Blood Center Information
              </h3>
              <div class="ba-side-row">
                <AssetIcon name="clock" :size="16" />
                <span>{{ bloodCenter.hours || '—' }}</span>
              </div>
              <div class="ba-side-row">
                <AssetIcon name="phone" :size="16" />
                <span>{{ bloodCenter.contact || '—' }}</span>
              </div>
              <div class="ba-side-row">
                <AssetIcon name="mail" :size="16" />
                <span>{{ bloodCenter.email || '—' }}</span>
              </div>
              <div class="ba-side-row">
                <AssetIcon name="map-pin" :size="16" />
                <span>{{ bloodCenter.address || '—' }}</span>
              </div>
            </div>

            <div class="ba-side-card fade-in" style="--delay: 380ms">
              <h3 class="ba-side-title">Quick Actions</h3>
              <NuxtLink to="/hospital/bloodrequest/" class="ba-side-action">
                <span class="ba-side-action-icon">
                  <AssetIcon name="circle-plus" :size="16" />
                </span>
                <span class="ba-side-action-title">Create Blood Request</span>
                <AssetIcon name="chevron-right" :size="16" class="ba-side-action-chevron" />
              </NuxtLink>
              <NuxtLink to="/hospital/trackrequests" class="ba-side-action">
                <span class="ba-side-action-icon">
                  <AssetIcon name="search" :size="16" />
                </span>
                <span class="ba-side-action-title">Track Request</span>
                <AssetIcon name="chevron-right" :size="16" class="ba-side-action-chevron" />
              </NuxtLink>
              <NuxtLink to="/hospital/bloodrequests" class="ba-side-action">
                <span class="ba-side-action-icon">
                  <AssetIcon name="list" :size="16" />
                </span>
                <span class="ba-side-action-title">View Blood Requests</span>
                <AssetIcon name="chevron-right" :size="16" class="ba-side-action-chevron" />
              </NuxtLink>
            </div>

            <div class="ba-side-card fade-in" style="--delay: 420ms">
              <h3 class="ba-side-title">Availability Legend</h3>
              <div class="ba-legend-chips">
                <span class="ba-legend-chip badge-healthy">
                  <span class="ba-legend-dot" style="background:#2E7D32;"></span> Healthy
                </span>
                <span class="ba-legend-chip badge-low">
                  <span class="ba-legend-dot" style="background:#F59E0B;"></span> Low
                </span>
                <span class="ba-legend-chip badge-critical">
                  <span class="ba-legend-dot" style="background:#D32F2F;"></span> Critical
                </span>
                <span class="ba-legend-chip badge-unavailable">
                  <span class="ba-legend-dot" style="background:#94A3B8;"></span> Unavailable
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { hospitalService } from '~/api/hospital/HospitalService'

definePageMeta({
  middleware: ['auth', 'hospital-portal'],
  layout: 'hospitaldashboard',
})

// ======================= STATE =======================
const isLoading = ref(true)
const isRefreshing = ref(false)
const hasData = ref(false)
const loadError = ref(null)
const progressReady = ref(false)
const chartAnimateKey = ref(false)

const searchQuery = ref('')
const filtersOpen = ref(false)
const filters = reactive({
  bloodType: '',
  component: '',
  status: '',
  center: '',
})

const trendPeriod = ref('weekly')
const hoveredPoint = ref(null)
const detailedTableRef = ref(null)

const lastUpdatedLabel = ref('')
const lastUpdatedAt = ref(null)
const now = ref(Date.now())
let syncTimer = null

const isDark = ref(false)

const bloodTypesRaw = ref([]) // grid data: { bloodType, units, status, lastUpdated, eta, componentSummary }
const tableRows = ref([])     // detailed table rows: { bloodType, component, units, status, lastUpdated, center }
const recentUpdates = ref([]) // { time, title, description, tone }
const bloodCenter = reactive({
  hours: '',
  address: '',
  contact: '',
  email: '',
})

const trendData = reactive({
  weekly: { labels: [], values: [] },
  monthly: { labels: [], values: [] },
})

const componentDistributionRaw = ref([]) // { label, value, color }

// Animated KPI counter displays
const totalUnitsDisplay = ref(0)
const typesAvailableDisplay = ref(0)
const criticalTypesDisplay = ref(0)

// ======================= OPTIONS =======================
const bloodTypeOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const componentOptions = ['Packed RBC', 'Whole Blood', 'Platelets', 'Fresh Frozen Plasma', 'Cryoprecipitate']
const centerOptions = ref([]) // populated from API response

// ======================= RECOMMENDED ACTIONS =======================
const recommendedActionMap = {
  Critical: 'Recommend immediate replenishment.',
  Low: 'Monitor closely and prepare a restock request.',
  Unavailable: 'Coordinate with the Blood Center for emergency supply.',
}

// ======================= ANIMATED COUNTERS =======================
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function animateCounter(targetRef, endValue, duration = 800) {
  const end = Number(endValue) || 0
  if (prefersReducedMotion()) {
    targetRef.value = end
    return
  }
  const start = 0
  const startTime = performance.now()
  function tick(t) {
    const elapsed = t - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    targetRef.value = Math.round(start + (end - start) * eased)
    if (progress < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

// ======================= FETCH =======================
async function fetchInventory() {
  isRefreshing.value = true
  loadError.value = null
  progressReady.value = false
  chartAnimateKey.value = false
  try {
    // GET /hospital/blood-availability
    // Expected response shape:
    // {
    //   blood_types: [{ blood_type, units, status, last_updated, eta }],
    //   table_rows: [{ blood_type, component, units, status, last_updated, center }],
    //   recent_updates: [{ time, title, description, tone }],
    //   blood_center: { hours, address, contact, email },
    //   trends: { weekly: { labels, values }, monthly: { labels, values } },
    //   component_distribution: [{ label, value, color }],
    //   centers: [string],
    //   last_updated_label: string,
    //   last_updated_at: ISOString
    // }
    const data = await hospitalService.bloodAvailability({
      search: searchQuery.value,
      blood_type: filters.bloodType,
      component: filters.component,
      status: filters.status,
      center: filters.center,
    })

    bloodTypesRaw.value = (data.blood_types ?? []).map((t) => ({
      bloodType: t.blood_type,
      units: t.units,
      status: t.status,
      lastUpdated: t.last_updated,
      eta: t.eta ?? null,
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
    Object.assign(bloodCenter, data.blood_center ?? { hours: '', address: '', contact: '', email: '' })
    trendData.weekly = data.trends?.weekly ?? { labels: [], values: [] }
    trendData.monthly = data.trends?.monthly ?? { labels: [], values: [] }
    componentDistributionRaw.value = data.component_distribution ?? []
    centerOptions.value = data.centers ?? []
    lastUpdatedLabel.value = data.last_updated_label ?? ''
    lastUpdatedAt.value = data.last_updated_at ? new Date(data.last_updated_at) : new Date()

    hasData.value = bloodTypesRaw.value.length > 0

    await nextTick()
    chartAnimateKey.value = true
    animateCounter(totalUnitsDisplay, summary.value.totalUnits)
    animateCounter(typesAvailableDisplay, summary.value.typesAvailable)
    animateCounter(criticalTypesDisplay, summary.value.criticalTypes)
    requestAnimationFrame(() => { progressReady.value = true })
  } catch (err) {
    console.error('Failed to load blood availability:', err)
    hasData.value = false
    loadError.value = 'Failed to load blood availability data.'
  } finally {
    isLoading.value = false
    isRefreshing.value = false
  }
}

// ======================= THEME (LIGHT / DARK) =======================
function applyTheme(dark) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', dark)
}

function toggleTheme() {
  isDark.value = !isDark.value
  applyTheme(isDark.value)
  try {
    localStorage.setItem('redagos-theme', isDark.value ? 'dark' : 'light')
  } catch {
    // localStorage unavailable (e.g. private browsing) — theme just won't persist
  }
}

function initTheme() {
  let stored = null
  try {
    stored = localStorage.getItem('redagos-theme')
  } catch {
    // ignore
  }

  if (stored === 'dark' || stored === 'light') {
    isDark.value = stored === 'dark'
  } else if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
    isDark.value = true
  } else if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    isDark.value = true
  }

  applyTheme(isDark.value)
}

onMounted(() => {
  initTheme()
  isLoading.value = true
  fetchInventory()
  syncTimer = setInterval(() => { now.value = Date.now() }, 30000)
})

onUnmounted(() => {
  if (syncTimer) clearInterval(syncTimer)
})

// ======================= SYNC BADGE =======================
const syncedLabel = computed(() => {
  if (!lastUpdatedAt.value) return '—'
  const diffMs = now.value - lastUpdatedAt.value.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin === 1) return '1 minute ago'
  if (diffMin < 60) return `${diffMin} minutes ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr === 1) return '1 hour ago'
  return `${diffHr} hours ago`
})

// ======================= BLOOD TYPES WITH COMPONENT SUMMARY =======================
const bloodTypes = computed(() => {
  return bloodTypesRaw.value.map((t) => {
    const rowsForType = tableRows.value.filter((r) => r.bloodType === t.bloodType && r.units > 0)
    let componentSummary = 'No components in stock'
    if (rowsForType.length === 1) {
      componentSummary = rowsForType[0].component
    } else if (rowsForType.length > 1) {
      const top = rowsForType.reduce((best, r) => (r.units > best.units ? r : best), rowsForType[0])
      componentSummary = `${top.component} + ${rowsForType.length - 1} more`
    }
    return { ...t, componentSummary }
  })
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

const criticalAlerts = computed(() =>
  bloodTypes.value
    .filter((t) => t.status === 'Critical' || t.status === 'Low' || t.status === 'Unavailable')
    .sort((a, b) => a.units - b.units)
    .map((t) => ({
      ...t,
      recommendedAction: recommendedActionMap[t.status] || 'Monitor stock levels.',
    }))
)

function resetFilters() {
  searchQuery.value = ''
  filters.bloodType = ''
  filters.component = ''
  filters.status = ''
  filters.center = ''
  fetchInventory()
}

function viewDetails(type) {
  filters.bloodType = type.bloodType
  nextTick(() => {
    detailedTableRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

// ======================= SUMMARY CARDS =======================
const summary = computed(() => {
  const totalUnits = bloodTypesRaw.value.reduce((sum, t) => sum + t.units, 0)
  const typesAvailable = bloodTypesRaw.value.filter((t) => t.units > 0).length
  const criticalTypes = bloodTypesRaw.value.filter((t) => t.status === 'Critical').length
  return { totalUnits, typesAvailable, criticalTypes }
})

function progressWidth(units) {
  const max = 50 // reference max units for a "full" bar
  return Math.min(100, Math.round((units / max) * 100))
}

// ======================= TRENDS CHART (SVG, gradient area + tooltip) =======================
const currentTrendData = computed(() => trendData[trendPeriod.value])
const trendGridLines = [20, 60, 100, 140]

const trendPointCoords = computed(() => {
  const values = currentTrendData.value.values
  if (!values.length) return []
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const stepX = values.length > 1 ? 320 / (values.length - 1) : 0
  return values.map((v, i) => ({
    x: i * stepX,
    y: 16 + (140 - 16) * (1 - (v - min) / range),
  }))
})

function buildSmoothPath(points) {
  if (points.length < 2) return points.length === 1 ? `M ${points[0].x} ${points[0].y}` : ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }
  return d
}

const trendLinePath = computed(() => buildSmoothPath(trendPointCoords.value))

const trendAreaPath = computed(() => {
  const pts = trendPointCoords.value
  if (pts.length < 2) return ''
  const base = buildSmoothPath(pts)
  const first = pts[0]
  const last = pts[pts.length - 1]
  return `${base} L ${last.x} 160 L ${first.x} 160 Z`
})

const trendTooltipLeft = computed(() => {
  if (hoveredPoint.value === null || !trendPointCoords.value.length) return 0
  return (trendPointCoords.value[hoveredPoint.value].x / 320) * 100
})

// ======================= DOUGHNUT CHART (SVG) =======================
const circumference = 2 * Math.PI * 38

const componentTotalUnits = computed(() =>
  componentDistributionRaw.value.reduce((sum, c) => sum + c.value, 0)
)

const donutSegments = computed(() => {
  const total = componentTotalUnits.value
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
  --ba-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);
  --ba-shadow-hover: 0 10px 28px rgba(15, 23, 42, 0.08);

  font-family: var(--rb-font-sans);
  color: var(--ba-text);
  background: var(--ba-bg); 
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 32px 40px;
 /* box-sizing: border-box; */
}

:global(.dark .ba-page) {
  --ba-bg: #0F172A;
  --ba-card: #1E293B;
  --ba-border: #2A3447;
  --ba-text: #F1F5F9;
  --ba-text-secondary: #94A3B8;
  --ba-text-muted: #64748B;
  --ba-shadow: 0 4px 18px rgba(0, 0, 0, 0.25);
  --ba-shadow-hover: 0 10px 28px rgba(0, 0, 0, 0.32);
}

.ba-inner {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
/*
.ba-page * {
  box-sizing: border-box; 
} */

/* ---------- MICRO-INTERACTIONS ---------- */
.fade-in {
  animation: ba-fade-in-up 0.45s ease both;
  animation-delay: var(--delay, 0ms);
}
@keyframes ba-fade-in-up {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .fade-in, .skeleton-line, .ba-btn-primary.is-refreshing svg, .ba-progress-fill, .ba-area-animate, .ba-line-animate {
    animation: none !important;
    transition: none !important;
  }
}

/* ---------- FOCUS STATES ---------- */
.ba-page button:focus-visible,
.ba-page a:focus-visible,
.ba-page input:focus-visible,
.ba-page select:focus-visible,
.ba-type-card:focus-visible {
  outline: 2px solid var(--ba-primary);
  outline-offset: 2px;
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
  font-size: 32px;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.01em;
}
.ba-subtitle {
  font-size: 16px;
  font-weight: 400;
  color: var(--ba-text-secondary);
  margin: 6px 0 0;
}
.ba-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.ba-sync-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  background: rgba(46, 125, 50, 0.1);
  color: var(--ba-success);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}
.ba-sync-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--ba-success);
  box-shadow: 0 0 0 3px rgba(46, 125, 50, 0.18);
}

.ba-theme-toggle {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid var(--ba-border);
  background: var(--ba-card);
  color: var(--ba-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
}
.ba-theme-toggle:hover {
  color: var(--ba-primary);
  border-color: var(--ba-primary);
  transform: translateY(-1px);
}

.ba-btn-primary {
  height: 44px;
  padding: 0 20px;
  background: var(--ba-primary);
  color: #fff;
  border: none;
  border-radius: 12px;
  font-family: var(--rb-font-sans);
  font-size: 14px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.15s ease;
}
.ba-btn-primary:hover {
  background: var(--ba-primary-hover);
  transform: translateY(-1px);
}
.ba-btn-primary:disabled {
  opacity: 0.75;
  cursor: default;
  transform: none;
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
  transition: background 0.15s ease;
}
.ba-btn-ghost:hover {
  background: var(--ba-bg);
}

/* ---------- SHARED PANEL / CARD BASE ---------- */
.ba-panel,
.ba-filter-panel,
.ba-summary-card,
.ba-type-card,
.ba-side-card,
.ba-alert-card {
  background: var(--ba-card);
  border: 1px solid var(--ba-border);
  border-radius: 18px;
  box-shadow: var(--ba-shadow);
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

/* ---------- FILTER PANEL ---------- */
.ba-filter-panel {
  padding: 20px 24px 24px;
}
.ba-filter-panel-head {
  margin-bottom: 16px;
}
.ba-panel-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
}
.ba-panel-subtitle {
  font-size: 13px;
  color: var(--ba-text-secondary);
  margin: 4px 0 0;
}
.ba-filter-body {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--ba-border);
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
  font-family: var(--rb-font-sans);
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
  font-family: var(--rb-font-sans);
}
.ba-filter-actions {
  display: flex;
  gap: 10px;
  margin-left: auto;
}

/* ---------- SUMMARY KPI CARDS ---------- */
.ba-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}
.ba-summary-card {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ba-summary-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--ba-shadow-hover);
}
.ba-summary-top {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ba-summary-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
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
  font-size: 52px;
  font-weight: 800;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--ba-text);
  margin: 6px 0 0;
  line-height: 1;
}
.ba-summary-value--sm {
  font-size: 20px;
}
.ba-summary-helper {
  font-size: 12px;
  font-weight: 500;
  color: var(--ba-text-muted);
  margin: 8px 0 0;
}

/* ---------- LAYOUT ---------- */
.ba-layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 20px;
  align-items: start;
}
.ba-main-col {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}
.ba-panel {
  padding: 24px;
}
.ba-panel-header {
  margin-bottom: 16px;
}
.ba-section-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}

/* ---------- BLOOD TYPE GRID ---------- */
.ba-type-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 16px;
}
.ba-type-card {
  padding: 20px;
  cursor: pointer;
  position: relative;
  min-width: 0;
}
.ba-type-card-top {
  min-width: 0;
}
.ba-type-name {
  min-width: 0;
}
.ba-type-card:hover,
.ba-type-card:focus-visible {
  transform: translateY(-2px);
  box-shadow: var(--ba-shadow-hover);
  border-color: var(--ba-primary);
}
.ba-type-card:hover .ba-type-view,
.ba-type-card:focus-visible .ba-type-view {
  opacity: 1;
  transform: translateX(0);
}
.ba-type-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.ba-type-name {
  font-size: 32px;
  font-weight: 700;
}
.ba-type-units {
  font-size: 46px;
  font-weight: 800;
  margin: 8px 0 14px;
  line-height: 1;
}
.ba-type-units span {
  font-size: 14px;
  font-weight: 500;
  color: var(--ba-text-secondary);
}
.ba-progress-track {
  height: 6px;
  border-radius: 999px;
  background: var(--ba-bg);
  overflow: hidden;
  margin-bottom: 14px;
}
.ba-progress-fill {
  height: 100%;
  border-radius: 999px;
  width: 0%;
  transition: width 0.8s cubic-bezier(0.22, 1, 0.36, 1);
}
.fill-healthy { background: var(--ba-success); }
.fill-low { background: var(--ba-warning); }
.fill-critical { background: var(--ba-danger); }
.fill-unavailable { background: #94A3B8; }
.ba-type-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 10px;
}
.ba-type-component {
  font-size: 12px;
  font-weight: 600;
  color: var(--ba-text-secondary);
}
.ba-type-footer {
  font-size: 12px;
  color: var(--ba-text-muted);
}
.ba-type-view {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  color: var(--ba-primary);
  font-size: 13px;
  font-weight: 600;
  padding: 0;
  cursor: pointer;
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.ba-type-view-arrow {
  transition: transform 0.15s ease;
}
.ba-type-view:hover .ba-type-view-arrow {
  transform: translateX(2px);
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
.ba-status-badge--lg {
  height: 28px;
  display: inline-flex;
  align-items: center;
  padding: 0 14px;
  font-size: 13px;
}
.badge-healthy { background: rgba(46, 125, 50, 0.08); color: var(--ba-success); }
.badge-low { background: rgba(245, 158, 11, 0.1); color: var(--ba-warning); }
.badge-critical { background: rgba(211, 47, 47, 0.08); color: var(--ba-danger); }
.badge-unavailable { background: rgba(148, 163, 184, 0.12); color: #64748B; }

/* ---------- TABLE ---------- */
.ba-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--ba-border);
  border-radius: 14px;
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
  background: var(--ba-bg);
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

/* ---------- CRITICAL ALERTS ---------- */
.ba-alert-header {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ba-alert-header-icon {
  color: var(--ba-danger);
}
.ba-alert-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.ba-alert-card {
  padding: 16px 18px;
  border-left-width: 4px;
  border-left-style: solid;
  box-shadow: none;
}
.ba-alert-card.alert-critical { border-left-color: var(--ba-danger); }
.ba-alert-card.alert-low { border-left-color: var(--ba-warning); }
.ba-alert-card.alert-unavailable { border-left-color: #94A3B8; }
.ba-alert-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--ba-shadow-hover);
}
.ba-alert-card-main {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.ba-alert-type {
  font-weight: 700;
  font-size: 15px;
  min-width: 34px;
}
.ba-alert-units {
  flex: 1;
  font-size: 13px;
  color: var(--ba-text-secondary);
}
.ba-alert-action {
  font-size: 13px;
  color: var(--ba-text);
  margin: 0 0 6px;
  line-height: 1.5;
}
.ba-alert-eta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--ba-text-secondary);
  margin: 0;
}

/* ---------- CHARTS ---------- */
.ba-chart-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.ba-chart-card {
  padding: 24px;
}
.ba-chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.ba-segmented {
  display: inline-flex;
  background: var(--ba-bg);
  border-radius: 10px;
  padding: 3px;
}
.ba-segmented-btn {
  border: none;
  background: transparent;
  color: var(--ba-text-secondary);
  font-size: 12.5px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.ba-segmented-btn.active {
  background: var(--ba-card);
  color: var(--ba-primary);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}
.ba-trend-body {
  position: relative;
}
.ba-line-chart {
  width: 100%;
  height: 160px;
  overflow: visible;
}
.ba-trend-grid {
  stroke: var(--ba-border);
  stroke-width: 1;
}
.ba-area-animate {
  animation: ba-fade-in 0.9s ease forwards;
}
@keyframes ba-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.ba-line-animate {
  stroke-dasharray: 900;
  stroke-dashoffset: 900;
  animation: ba-draw-line 0.9s ease forwards;
}
@keyframes ba-draw-line {
  to { stroke-dashoffset: 0; }
}
.ba-trend-dot {
  fill: var(--ba-card);
  stroke: var(--ba-primary);
  stroke-width: 2;
  transition: r 0.15s ease;
}
.ba-trend-dot--active {
  r: 5.5;
  fill: var(--ba-primary);
}
.ba-trend-tooltip {
  position: absolute;
  top: 4px;
  transform: translateX(-50%);
  background: var(--ba-text);
  color: var(--ba-card);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 11.5px;
  white-space: nowrap;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  z-index: 2;
}
.ba-trend-tooltip-value {
  font-weight: 700;
}
.ba-trend-tooltip-label {
  opacity: 0.75;
  font-size: 10.5px;
}
.ba-chart-xlabels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--ba-text-secondary);
  margin-top: 8px;
}
.ba-donut-wrap {
  display: flex;
  align-items: center;
  gap: 24px;
}
.ba-donut-svg-wrap {
  position: relative;
  width: 150px;
  height: 150px;
  flex-shrink: 0;
}
.ba-donut {
  width: 150px;
  height: 150px;
}
.ba-donut-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.ba-donut-center-value {
  font-size: 22px;
  font-weight: 800;
  color: var(--ba-text);
  line-height: 1;
}
.ba-donut-center-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ba-text-muted);
  margin-top: 4px;
}
.ba-donut-legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 13px;
  flex: 1;
}
.ba-donut-legend li {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ba-legend-name {
  flex: 1;
  color: var(--ba-text-secondary);
}
.ba-legend-percent {
  color: var(--ba-text);
}
.ba-legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ---------- TIMELINE ---------- */
.ba-timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.ba-timeline-item {
  display: flex;
  gap: 14px;
}
.ba-timeline-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 12px;
  flex-shrink: 0;
}
.ba-timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-top: 4px;
  flex-shrink: 0;
  background: var(--ba-primary);
}
.ba-timeline-dot--success { background: var(--ba-success); }
.ba-timeline-dot--warning { background: var(--ba-warning); }
.ba-timeline-dot--danger { background: var(--ba-danger); }
.ba-timeline-dot--info { background: var(--ba-primary); }
.ba-timeline-line {
  flex: 1;
  width: 2px;
  background: var(--ba-border);
  margin: 3px 0;
  min-height: 24px;
}
.ba-timeline-body {
  padding-bottom: 20px;
}
.ba-timeline-time {
  font-size: 12px;
  font-weight: 600;
  color: var(--ba-text-muted);
  margin-bottom: 2px;
}
.ba-timeline-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--ba-text);
  margin-bottom: 2px;
}
.ba-timeline-desc {
  font-size: 13px;
  color: var(--ba-text-secondary);
  line-height: 1.5;
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
  padding: 20px;
}
.ba-side-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 14px;
  display: flex;
  align-items: center;
  gap: 8px;
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
  padding: 12px;
  border: 1px solid var(--ba-border);
  border-radius: 12px;
  margin-bottom: 8px;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.ba-side-action:last-child {
  margin-bottom: 0;
}
.ba-side-action:hover {
  background: var(--ba-bg);
  border-color: var(--ba-primary);
}
.ba-side-action-icon {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--ba-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ba-primary);
  flex-shrink: 0;
}
.ba-side-action-title {
  flex: 1;
}
.ba-side-action-chevron {
  color: var(--ba-text-muted);
  transition: color 0.15s ease, transform 0.15s ease;
}
.ba-side-action:hover .ba-side-action-chevron {
  color: var(--ba-primary);
  transform: translateX(2px);
}
.ba-legend-chips {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ba-legend-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 600;
  width: fit-content;
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
  max-width: 1400px;
  margin: 24px auto 0;
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
:global(.dark .skeleton-line) {
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
  .ba-chart-row {
    grid-template-columns: 1fr;
  }
  .ba-alert-list {
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
  .ba-header-actions {
    justify-content: flex-end;
  }
}

@media (max-width: 640px) {
  .ba-page {
    padding: 16px 16px 32px;
  }
  .ba-title {
    font-size: 22px;
  }
  .ba-type-name {
    font-size: 26px;
  }
  .ba-type-units {
    font-size: 36px;
  }
  .ba-summary-value {
    font-size: 38px;
  }
}

@media (max-width: 560px) {
  .ba-summary-grid {
    grid-template-columns: 1fr;
  }
  .ba-sidebar {
    flex-direction: column;
  }
}
</style>