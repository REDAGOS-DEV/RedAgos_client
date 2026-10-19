<template>
  <div class="iss">
    <header class="iss__header">
      <div>
        <h1 class="iss__title">Issuance</h1>
        <p class="iss__subtitle">Stock on hand, what is about to expire, and hospital requests waiting on this department.</p>
      </div>
      <NuxtLink to="/blood-center/inventory-intake" class="btn-primary">
        <AssetIcon name="package-check" :size="15" />
        Stock Intake
      </NuxtLink>
    </header>

    <!-- ============ HEADLINE LEVELS ============ -->
    <section class="kpis" aria-label="Stock at a glance" :aria-busy="loading">
      <template v-if="loading">
        <div v-for="n in 4" :key="n" class="kpi skeleton" />
      </template>
      <template v-else>
        <component
          :is="kpi.to ? NuxtLink : 'article'"
          v-for="kpi in kpis"
          :key="kpi.key"
          :to="kpi.to"
          class="kpi"
          :class="[`kpi--${kpi.key}`, { 'kpi--link': kpi.to }]"
        >
          <span class="kpi__icon"><AssetIcon :name="kpi.icon" :size="20" /></span>
          <div class="kpi__body">
            <p class="kpi__label">{{ kpi.label }}</p>
            <div class="kpi__main">
              <p class="kpi__value" :class="{ 'kpi__value--empty': kpi.value === null }">
                {{ kpi.value === null ? 'No data' : formatCount(kpi.value) }}
              </p>
              <!-- The last eight days, ending on the number beside it. -->
              <svg
                v-if="kpi.spark"
                class="kpi__spark"
                viewBox="0 0 96 34"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path :d="kpi.spark.line" class="kpi__spark-line" vector-effect="non-scaling-stroke" />
              </svg>
            </div>
            <p class="kpi__caption">{{ kpi.caption }}</p>
            <p v-if="kpi.alert" class="kpi__alert signal--critical">
              <span class="kpi__alert-dot" aria-hidden="true" />
              {{ kpi.alert }}
            </p>
            <p v-if="kpi.change" class="kpi__change">
              <AssetIcon v-if="kpi.change.direction !== 'flat'" :name="kpi.change.direction === 'up' ? 'trending-up' : 'trending-down'" :size="13" />
              <span v-else class="kpi__change-flat" aria-hidden="true">—</span>
              <strong>{{ kpi.change.text }}</strong>
              <span class="kpi__change-note">vs. last week</span>
            </p>
          </div>
        </component>
      </template>
    </section>

    <LowStockBanner :cells="lowStock" to="/blood-center/stock-thresholds" class="stock-banner" />

    <!-- ============ BLOOD INVENTORY ============ -->
    <section class="panel" aria-labelledby="inventory-title">
      <header class="panel__head panel__head--wrap">
        <div class="panel__titles">
          <AssetIcon name="blood-drop" :size="20" class="panel__icon" />
          <div>
            <h2 id="inventory-title" class="panel__title">Blood Inventory</h2>
            <p class="panel__sub">Stock levels by blood type (units). Open a type to see its units, oldest expiry first.</p>
          </div>
        </div>
        <div class="panel__aside">
          <NuxtLink to="/blood-center/inventory" class="panel__link">
            View full inventory
            <AssetIcon name="arrow-right" :size="13" />
          </NuxtLink>
          <ul class="legend" aria-label="Legend">
            <li v-for="item in SEGMENTS" :key="item.key">
              <span class="legend__dot" :class="`seg--${item.key}`" aria-hidden="true" />
              {{ item.label }}
            </li>
          </ul>
        </div>
      </header>

      <div v-if="loading" class="types">
        <div v-for="n in 8" :key="n" class="tcard tcard--skeleton skeleton" />
      </div>

      <div v-else-if="!summary" class="empty">
        <AssetIcon name="droplets" :size="22" />
        <p class="empty__title">Stock could not be loaded</p>
        <p class="empty__body">Refresh the page to try again.</p>
      </div>

      <div v-else class="types">
        <NuxtLink
          v-for="card in typeCards"
          :key="card.code"
          :to="`/blood-center/inventory?type=${encodeURIComponent(card.code)}`"
          class="tcard"
          :title="card.status.title"
        >
          <span class="tcard__code">{{ card.label }}</span>
          <span class="tcard__value">{{ formatCount(card.available) }}</span>

          <!-- The shelf in its four parts; the counts below carry the numbers. -->
          <span class="tcard__bar" aria-hidden="true">
            <span
              v-for="seg in card.segments.filter((s) => s.count > 0)"
              :key="seg.key"
              class="tcard__seg"
              :class="`seg--${seg.key}`"
              :style="{ flexGrow: seg.count }"
            />
          </span>

          <span class="tcard__counts">
            <span
              v-for="seg in card.segments"
              :key="seg.key"
              class="tcard__count"
              :title="`${seg.count} ${SEGMENT_LABEL[seg.key].toLowerCase()}`"
            >
              <span class="tcard__dot" :class="`seg--${seg.key}`" aria-hidden="true" />
              {{ seg.count }}
              <span class="sr-only">{{ SEGMENT_LABEL[seg.key] }}</span>
            </span>
          </span>

          <!-- Only a type that needs attention says so, naming the component
               by its bag-label code; the full names are in the tooltip. -->
          <span v-if="card.status.tone !== 'neutral'" class="tcard__status" :class="`signal--${card.status.tone}`">
            <AssetIcon :name="card.status.icon" :size="12" />
            <span aria-hidden="true">{{ card.status.short }}</span>
            <span class="sr-only">{{ card.status.full }}</span>
          </span>
        </NuxtLink>
      </div>
    </section>

    <div class="row">
      <!-- ============ INCOMING REQUESTS ============ -->
      <section class="panel" aria-labelledby="requests-title">
        <header class="panel__head">
          <div class="panel__titles">
            <AssetIcon name="clipboard-check" :size="20" class="panel__icon" />
            <h2 id="requests-title" class="panel__title">Incoming Requests</h2>
          </div>
          <NuxtLink v-if="canSeeRequests" to="/blood-center/bloodrequests" class="panel__link">
            View all
            <AssetIcon name="arrow-right" :size="13" />
          </NuxtLink>
        </header>

        <div v-if="loading" class="panel-skeleton skeleton" />
        <div v-else-if="!canSeeRequests" class="empty">
          <AssetIcon name="clipboard-check" :size="22" />
          <p class="empty__title">Not part of your role</p>
          <p class="empty__body">Ask your supervisor if you need to see hospital requests.</p>
        </div>
        <div v-else-if="requestList === null" class="empty">
          <AssetIcon name="clipboard-check" :size="22" />
          <p class="empty__title">Requests could not be loaded</p>
          <p class="empty__body">Refresh the page to try again.</p>
        </div>
        <div v-else-if="!requestRows.length" class="empty">
          <AssetIcon name="clipboard-check" :size="22" />
          <p class="empty__title">No open requests</p>
          <p class="empty__body">New hospital requests will appear here.</p>
        </div>
        <div v-else class="req-wrap">
          <table class="req">
            <caption class="sr-only">Open requests, emergencies first, then the oldest</caption>
            <thead>
              <tr>
                <th scope="col"><span class="sr-only">Status</span></th>
                <th scope="col">From</th>
                <th scope="col">Units / Priority</th>
                <th scope="col">Received</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in requestRows" :key="row.id">
                <td><span class="pill" :class="`pill--${row.tone}`">{{ row.status }}</span></td>
                <td class="req__from" :title="row.reference">{{ row.from }}</td>
                <td class="req__units">
                  {{ row.units }} ·
                  <span :class="{ 'req__urgent signal--critical': row.emergency }">{{ row.priority }}</span>
                </td>
                <td class="req__when">{{ row.received }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ============ READY FOR RELEASE ============ -->
      <section class="panel release" aria-labelledby="release-title">
        <header class="panel__head">
          <div class="panel__titles">
            <AssetIcon name="clock" :size="20" class="panel__icon" />
            <h2 id="release-title" class="panel__title">Ready for Release</h2>
          </div>
          <NuxtLink v-if="canRelease" to="/blood-center/fulfillment" class="panel__link">
            View all
            <AssetIcon name="arrow-right" :size="13" />
          </NuxtLink>
        </header>

        <div v-if="loading" class="panel-skeleton skeleton" />
        <div v-else-if="!canSeeRequests" class="empty">
          <AssetIcon name="building-2" :size="22" />
          <p class="empty__title">Not part of your role</p>
          <p class="empty__body">Ask your supervisor if you need to see what is waiting to go out.</p>
        </div>
        <div v-else-if="!requests" class="empty">
          <AssetIcon name="building-2" :size="22" />
          <p class="empty__title">Releases could not be loaded</p>
          <p class="empty__body">Refresh the page to try again.</p>
        </div>
        <template v-else>
          <p class="release__value">{{ awaitingRelease }}</p>
          <p class="release__label">
            {{ awaitingRelease === 1 ? 'request has' : 'requests have' }} units allocated and waiting to be released.
          </p>
          <p class="release__note">
            <AssetIcon name="info" :size="15" />
            Units go out once paid or met by the government subsidy.
          </p>
          <NuxtLink v-if="canRelease" to="/blood-center/fulfillment" class="btn-primary btn-primary--block">
            View pending releases
            <AssetIcon name="arrow-right" :size="14" />
          </NuxtLink>
        </template>
      </section>

      <!-- ============ STOCK BY BLOOD GROUP ============ -->
      <section class="panel" aria-labelledby="groups-title">
        <header class="panel__head">
          <div class="panel__titles">
            <AssetIcon name="bar-chart" :size="20" class="panel__icon" />
            <div>
              <h2 id="groups-title" class="panel__title">Stock by Blood Group</h2>
              <p class="panel__sub">Available units per type. Select a column to see its units.</p>
            </div>
          </div>
          <NuxtLink to="/blood-center/inventory" class="panel__link">
            View inventory
            <AssetIcon name="arrow-right" :size="13" />
          </NuxtLink>
        </header>

        <div v-if="loading" class="panel-skeleton skeleton" />
        <div v-else-if="!summary || !hasAvailable" class="empty">
          <AssetIcon name="bar-chart" :size="22" />
          <p class="empty__title">{{ summary ? 'No units available' : 'Stock could not be loaded' }}</p>
          <p class="empty__body">
            {{ summary ? 'Columns appear once units are booked in at Stock Intake.' : 'Refresh the page to try again.' }}
          </p>
        </div>

        <!-- Available units per blood type as columns, the same counts as the
             cards above. A column opens that type's units, as its card does. -->
        <div v-else ref="chartBox" class="stock-chart">
          <svg
            v-if="chart"
            :width="chart.width"
            :height="chart.height"
            class="stock-chart__svg"
            role="img"
            tabindex="0"
            :aria-label="chartLabel"
            @keydown="onChartKey"
            @blur="activeIndex = null"
            @pointerleave="activeIndex = null"
          >
            <g class="stock-chart__grid">
              <g v-for="tick in chart.ticks" :key="tick.value">
                <line :x1="chart.left" :x2="chart.width - chart.right" :y1="tick.y" :y2="tick.y" />
                <text :x="chart.left - 8" :y="tick.y" text-anchor="end" dominant-baseline="middle">{{ formatCount(tick.value) }}</text>
              </g>
            </g>

            <g
              v-for="(col, i) in chart.columns"
              :key="col.code"
              class="stock-chart__col"
              :class="{ 'stock-chart__col--dim': activeIndex !== null && activeIndex !== i }"
            >
              <path v-if="col.path" :d="col.path" class="stock-chart__bar" />
              <!-- The value on the cap: the bar's light colour needs it. -->
              <text :x="col.center" :y="col.top - 6" text-anchor="middle" class="stock-chart__cap">{{ formatCount(col.available) }}</text>
              <rect
                :x="col.bandX"
                :y="chart.top"
                :width="col.bandWidth"
                :height="chart.height - chart.top"
                class="stock-chart__hit"
                @pointerenter="activeIndex = i"
                @pointermove="activeIndex = i"
                @click="openType(col.code)"
              />
            </g>

            <g class="stock-chart__axis">
              <text v-for="col in chart.columns" :key="col.code" :x="col.center" :y="chart.height - 6" text-anchor="middle">{{ col.label }}</text>
            </g>
          </svg>

          <div v-if="activeColumn" class="stock-chart__tip" :style="tooltipStyle" role="status">
            <p class="stock-chart__tip-title">{{ activeColumn.label }}</p>
            <p class="stock-chart__tip-row"><strong>{{ formatCount(activeColumn.available) }}</strong> available</p>
            <p
              v-if="activeColumn.available > 0 && activeColumn.status.tone !== 'neutral'"
              class="stock-chart__tip-status"
              :class="`signal--${activeColumn.status.tone}`"
            >
              <AssetIcon :name="activeColumn.status.icon" :size="12" />
              {{ activeColumn.status.full }}
            </p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import LowStockBanner from '~/components/common/LowStockBanner.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { columnPath, niceScale } from '~/utils/collectionDashboard'
import { stockSparkline, stockTypeAlert, stockTypeCards, stockWeekChange } from '~/utils/issuanceDashboard'
import { REQUEST_STATUS_TONES, requestStatusLabel } from '~/types/bloodRequest'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'inventory.create',
})

useHead({ title: 'Issuance · RedAgos' })

// The headline cards with a `to` render as links; the rest as plain articles.
const NuxtLink = resolveComponent('NuxtLink')

const { can } = useUser()

// GET /blood-center/inventory/summary, and the request queue's summary and
// first open page. A failure leaves that part empty rather than breaking the page.
const summary = ref(null)
const requests = ref(null)
const requestList = ref(null)
// The facility's minimums against its stock. Supplementary, like the rest: a
// failure leaves no banner and no card grading rather than breaking the page.
const stockCells = ref([])
const lowStock = ref([])
// Component id → the code printed on its bag label (PC, FFP...), from the same response.
const componentCodes = ref(new Map())
const loading = ref(true)

// The server renders without the signed-in user, so anything gated on an
// ability waits for the browser; otherwise the server's markup and the
// client's disagree and Vue patches the difference on hydration.
const hydrated = ref(false)
const canSeeRequests = computed(() => hydrated.value && can('requests.view'))
const canRelease = computed(() => hydrated.value && can('requests.release'))

/** The open requests listed here: the queue's own order, emergencies first. */
const REQUEST_ROWS = 5

onMounted(async () => {
  hydrated.value = true

  const [inventoryResult, requestResult, listResult, thresholdResult] = await Promise.allSettled([
    bloodCenterService.inventorySummary(),
    canSeeRequests.value ? bloodCenterService.incomingRequestsSummary() : Promise.resolve(null),
    canSeeRequests.value ? bloodCenterService.incomingRequests({ open: 1, per_page: REQUEST_ROWS }) : Promise.resolve(null),
    bloodCenterService.stockThresholds(),
  ])

  if (inventoryResult.status === 'fulfilled') summary.value = inventoryResult.value
  else console.error('Failed to load inventory summary:', inventoryResult.reason)

  if (requestResult.status === 'fulfilled') requests.value = requestResult.value
  else console.error('Failed to load request summary:', requestResult.reason)

  if (listResult.status === 'fulfilled') requestList.value = listResult.value?.data ?? null
  else console.error('Failed to load open requests:', listResult.reason)

  if (thresholdResult.status === 'fulfilled') {
    stockCells.value = thresholdResult.value?.cells ?? []
    lowStock.value = thresholdResult.value?.low ?? []
    componentCodes.value = new Map((thresholdResult.value?.components ?? []).map((component) => [component.id, component.code]))
  } else {
    console.error('Failed to load stock thresholds:', thresholdResult.reason)
  }

  loading.value = false
})

function formatCount(value) {
  return Number(value ?? 0).toLocaleString('en-US')
}

// ---- Headline levels ----
const trend = computed(() => summary.value?.trend ?? [])

function sparkFor(key) {
  return stockSparkline(trend.value.map((point) => point[key]), 96, 34)
}

const kpis = computed(() => {
  const totals = summary.value?.totals
  const nearExpiry = summary.value?.near_expiry
  const expired = nearExpiry?.expired ?? 0

  return [
    {
      key: 'available', label: 'Total Available Units', value: totals?.available ?? null,
      caption: 'Ready for allocation', icon: 'droplets', to: '/blood-center/inventory',
      change: stockWeekChange(trend.value, 'available'), spark: sparkFor('available'),
    },
    {
      key: 'expiring', label: 'Expiring Soon', value: nearExpiry?.within_7_days ?? null,
      caption: 'Within 7 days', icon: 'clock', to: '/blood-center/inventory',
      change: stockWeekChange(trend.value, 'expiring_soon'), spark: sparkFor('expiring_soon'),
      // Past its date and still on the shelf: the one thing here to act on now.
      alert: expired > 0 ? `${formatCount(expired)} expired, awaiting discard` : null,
    },
    {
      key: 'reserved', label: 'Reserved', value: totals?.reserved ?? null,
      caption: 'Allocated to requests', icon: 'package', to: canRelease.value ? '/blood-center/fulfillment' : null,
      change: stockWeekChange(trend.value, 'reserved'), spark: sparkFor('reserved'),
    },
    {
      // Booked in but not yet cleared by testing. Released, with their final
      // labels, at Stock Intake.
      key: 'quarantine', label: 'In Quarantine', value: totals?.quarantined ?? null,
      caption: 'Awaiting testing clearance', icon: 'shield-check', to: '/blood-center/inventory-intake',
      change: stockWeekChange(trend.value, 'quarantined'), spark: sparkFor('quarantined'),
    },
  ]
})

// ---- Blood inventory ----
const SEGMENTS = [
  { key: 'fresh', label: 'Available' },
  { key: 'expiring', label: 'Expiring (≤7 days)' },
  { key: 'reserved', label: 'Reserved' },
  { key: 'quarantined', label: 'In quarantine' },
]

const SEGMENT_LABEL = Object.fromEntries(SEGMENTS.map((segment) => [segment.key, segment.label]))

const typeCards = computed(() => stockTypeCards(summary.value?.stock_by_blood_type ?? []).map((card) => {
  const alert = stockTypeAlert(stockCells.value, card.code, componentCodes.value)

  return { ...card, label: card.code.replace('-', '−'), status: typeStatus(card.code, card.available, alert) }
}))

/**
 * How one type stands, as a few words and an icon. Colour only for what needs
 * attention; a healthy type says nothing.
 *
 * A type with a component out of stock under its critical level is graded
 * `critical` even with hundreds of other units on the shelf, and names it.
 */
function typeStatus(code, available, alert) {
  if (available === 0) {
    return { short: 'None available', full: 'No units available', icon: 'circle-x', tone: 'critical', title: `${code}: no units available` }
  }
  if (alert) {
    return {
      short: alert.short,
      full: alert.full,
      icon: alert.tone === 'critical' ? 'circle-alert' : 'triangle-alert',
      tone: alert.tone,
      title: `${code}: ${available} available. ${alert.full}.`,
    }
  }

  return { short: 'Available', full: 'Available', icon: 'check-circle', tone: 'neutral', title: `${code}: ${available} available` }
}

const hasAvailable = computed(() => typeCards.value.some((card) => card.available > 0))

// ---- Requests ----
const awaitingRelease = computed(() => requests.value?.awaiting_release ?? 0)

const requestRows = computed(() => (requestList.value ?? []).map((request) => {
  const units = request.quantity ?? 0

  return {
    id: request.id,
    reference: request.reference_number ?? `#${request.id}`,
    from: request.requesting_facility?.name ?? (request.is_walk_in ? 'Walk-in' : '—'),
    status: requestStatusLabel(request),
    tone: REQUEST_STATUS_TONES[request.status] ?? 'muted',
    units: `${units} ${units === 1 ? 'unit' : 'units'}`,
    priority: request.is_emergency ? 'Emergency' : 'Routine',
    emergency: Boolean(request.is_emergency),
    received: formatReceived(request.request_date),
  }
}))

/** 2026-10-16T06:12 → "Oct 16, 6:12 AM" */
function formatReceived(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// ---- Stock by blood group (column chart) ----
const chartBox = ref(null)
const chartWidth = ref(0)
const activeIndex = ref(null)
let resizeObserver = null

function measureChart() {
  if (chartBox.value) chartWidth.value = chartBox.value.clientWidth
}

const CHART_HEIGHT = 230

/**
 * The chart in pixels: one column per type, in the cards' order, capped at
 * 28px wide with the rounded end on top and its value above it. The axis
 * never drops below 4, so a single unit does not fill the chart.
 */
const chart = computed(() => {
  const width = chartWidth.value
  const cards = typeCards.value
  if (!width || !cards.length) return null

  const left = 34
  const right = 4
  const top = 22
  const bottom = 26
  const plotWidth = width - left - right
  const plotHeight = CHART_HEIGHT - top - bottom
  const scale = niceScale(Math.max(0, ...cards.map((card) => card.available)))
  const band = plotWidth / cards.length
  const barWidth = Math.max(6, Math.min(28, band * 0.62))
  const y = (value) => top + plotHeight - (value / scale.max) * plotHeight

  const columns = cards.map((card, i) => {
    const bandX = left + i * band
    const height = (card.available / scale.max) * plotHeight

    return {
      ...card,
      bandX,
      bandWidth: band,
      center: bandX + band / 2,
      top: y(card.available),
      path: columnPath(bandX + (band - barWidth) / 2, top + plotHeight - height, barWidth, height, true),
    }
  })

  return {
    width,
    height: CHART_HEIGHT,
    left,
    right,
    top,
    columns,
    ticks: scale.ticks.map((value) => ({ value, y: y(value) })),
  }
})

const chartLabel = computed(() => {
  const counts = typeCards.value.map((card) => `${card.code} ${card.available}`).join(', ')
  return `Available units per blood type: ${counts}. Use the left and right arrow keys to read each type, and Enter to open its units.`
})

const activeColumn = computed(() => (activeIndex.value === null ? null : chart.value?.columns[activeIndex.value] ?? null))

const tooltipStyle = computed(() => {
  const col = activeColumn.value
  if (!col || !chart.value) return {}
  const half = 60
  const x = Math.min(Math.max(col.center, half), chart.value.width - half)
  return { left: `${x}px`, top: `${Math.max(0, col.top - 22)}px` }
})

function openType(code) {
  navigateTo(`/blood-center/inventory?type=${encodeURIComponent(code)}`)
}

function onChartKey(event) {
  const last = typeCards.value.length - 1
  if (last < 0) return

  const moves = {
    ArrowLeft: () => Math.max(0, (activeIndex.value ?? last + 1) - 1),
    ArrowRight: () => Math.min(last, (activeIndex.value ?? -1) + 1),
    Home: () => 0,
    End: () => last,
  }

  if (event.key === 'Escape') {
    activeIndex.value = null
    return
  }

  if (event.key === 'Enter' && activeColumn.value) {
    openType(activeColumn.value.code)
    return
  }

  if (moves[event.key]) {
    event.preventDefault()
    activeIndex.value = moves[event.key]()
  }
}

// The chart's box only exists once the summary has loaded; follow it rather
// than looking once.
watch(chartBox, (el, previous) => {
  if (typeof ResizeObserver === 'undefined') return
  resizeObserver ??= new ResizeObserver(measureChart)
  if (previous) resizeObserver.unobserve(previous)
  if (el) {
    resizeObserver.observe(el)
    measureChart()
  }
})

onBeforeUnmount(() => resizeObserver?.disconnect())
</script>

<style scoped>
/* Laid out after the owner's mock-up (2026-10-19): headline cards with a
   week's trend, the shelf by blood type, then requests, releases and the
   column chart side by side. Content area only; the header and sidebar are
   the app's.

   Colour:
   - The four shelf parts (available, expiring, reserved, in quarantine) are
     categorical slots validated together for colour-blind separation on the
     light (#FFFFFF) and dark navy (#1E293B) surfaces. A headline card is
     neutral: its part's colour is on the sparkline's line alone, never on
     the container, its edge or its icon (project owner, 2026-10-19).
   - The light green, amber and pink sit under 3:1 on white, so every mark in
     them has its number printed beside it.
   - Text keeps the text inks, never a part's colour.
   - Red, amber and green signals (--iss-crit/-warn/-ok) are kept for what
     needs attention, on an icon, a dot or a word.
   - Blue is for what can be acted on: links and the primary buttons.

   Dark mode keeps the app's own navy surfaces, borders and ink, the
   sidebar's, so the page reads as one with it (project owner, 2026-10-19;
   it had a charcoal palette of its own). Only the accents are lifted, on
   this root. The selector sits whole inside :global(): `:global(.dark) .iss`
   would compile to plain `.dark` and repaint the whole app. */
.iss {
  --iss-ok: #15803D;
  --iss-warn: #B45309;
  --iss-crit: #B91C1C;
  --iss-elevated: var(--rb-surface-alt);

  --seg-fresh: #1baf7a;
  --seg-expiring: #eda100;
  --seg-reserved: #e87ba4;
  --seg-quarantined: #2a78d6;

  font-family: var(--rb-font-sans);
  max-width: var(--rb-content-max, 1600px);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  background: var(--rb-page-bg);
  /* The page background carried past the column to the content area's edges.
     A shadow, not clip-path, which would clip fixed overlays rendered in place. */
  box-shadow: 0 0 0 100vmax var(--rb-page-bg);
  color: var(--rb-text-primary);
  transition: background-color 0.2s ease;
  /* The grids below follow the room the page actually has, not the window:
     the sidebar can be open or collapsed at the same window width. A size
     container also contains fixed-position children, so a dialog added to
     this page should be teleported to the body. */
  container: issuance / inline-size;
}

:global(.dark .iss) {
  --iss-ok: #4ADE80;
  --iss-warn: #FBBF24;
  --iss-crit: #F87171;
  --seg-fresh: #199e70;
  --seg-expiring: #c98500;
  --seg-reserved: #d55181;
  --seg-quarantined: #3987e5;
  color-scheme: dark;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.signal--critical { --signal: var(--iss-crit); }
.signal--warning { --signal: var(--iss-warn); }
.signal--ok { --signal: var(--iss-ok); }
.signal--neutral { --signal: var(--rb-text-secondary); }

.seg--fresh { --seg: var(--seg-fresh); }
.seg--expiring { --seg: var(--seg-expiring); }
.seg--reserved { --seg: var(--seg-reserved); }
.seg--quarantined { --seg: var(--seg-quarantined); }

/* ---------- header ---------- */
.iss__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.iss__title { margin: 0; font-size: 20px; font-weight: 650; letter-spacing: -0.015em; color: var(--rb-text-primary); }
.iss__subtitle { margin: 4px 0 0; font-size: 13px; color: var(--rb-text-secondary); max-width: 70ch; }

/* The primary action: solid blue. */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 9px 15px;
  border-radius: 8px;
  background: var(--rb-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: background-color 0.15s ease;
}

.btn-primary:hover { background: #0D47A1; }
.btn-primary:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.btn-primary--block { width: 100%; padding: 11px 15px; }

/* ---------- skeletons and empty states ---------- */
.skeleton {
  border: 0;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  animation: iss-shimmer 1.4s ease infinite;
}

.panel-skeleton { height: 180px; border-radius: 10px; }

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
  padding: 28px 12px;
  border: 1px dashed var(--rb-border-strong);
  border-radius: 10px;
  color: var(--rb-text-secondary);
}

.empty__title { margin: 4px 0 0; font-size: 13px; font-weight: 600; color: var(--rb-text-primary); }
.empty__body { margin: 0; font-size: 12px; line-height: 1.5; max-width: 44ch; }

/* ---------- headline cards ---------- */
.kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

/* A neutral card, as on Blood Inventory: the part's colour is only on the
   sparkline's line. */
.kpi {
  --kpi-mark: var(--rb-text-secondary);

  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-height: 124px;
  padding: 16px;
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  background: var(--rb-surface);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.kpi--available { --kpi-mark: var(--seg-fresh); }
.kpi--expiring { --kpi-mark: var(--seg-expiring); }
.kpi--reserved { --kpi-mark: var(--seg-reserved); }
.kpi--quarantine { --kpi-mark: var(--seg-quarantined); }

.kpi--link:hover { border-color: var(--rb-border-hover); background: var(--rb-surface-hover); }
.kpi--link:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }

.kpi__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid var(--rb-border);
  background: var(--iss-elevated);
  color: var(--rb-text-secondary);
}

.kpi__body { flex: 1; min-width: 0; }

.kpi__label { margin: 0; font-size: 12.5px; font-weight: 500; color: var(--rb-text-secondary); }

.kpi__main {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
  margin-top: 4px;
}

.kpi__value {
  margin: 0;
  font-size: 26px;
  font-weight: 650;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--rb-text-primary);
}

.kpi__value--empty { font-size: 15px; font-weight: 500; line-height: 28px; color: var(--rb-text-secondary); }

.kpi__spark { flex: 0 1 96px; min-width: 48px; height: 34px; overflow: visible; }
.kpi__spark-line { fill: none; stroke: var(--kpi-mark); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }

.kpi__caption { margin: 4px 0 0; font-size: 12px; color: var(--rb-text-secondary); }

.kpi__alert { display: flex; align-items: center; gap: 6px; margin: 4px 0 0; font-size: 12px; font-weight: 500; color: var(--rb-text-primary); }
.kpi__alert-dot { width: 6px; height: 6px; border-radius: 999px; flex-shrink: 0; background: var(--signal); }

.kpi__change {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--rb-text-secondary);
}

.kpi__change strong { font-weight: 600; font-variant-numeric: tabular-nums; color: var(--rb-text-primary); }
.kpi__change-flat { font-weight: 600; }
.kpi__change-note { color: var(--rb-text-secondary); }

/* ---------- panels ---------- */
.panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 18px 18px 20px;
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  background: var(--rb-surface);
}

/* The title takes the room and its subtitle wraps; the link stays top right.
   Only the inventory's head, which carries the legend, drops to two rows. */
.panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px 16px;
  margin-bottom: 16px;
}

.panel__head--wrap { flex-wrap: wrap; }

.panel__titles { display: flex; flex: 1 1 auto; align-items: flex-start; gap: 10px; min-width: 0; }
.panel__icon { flex-shrink: 0; margin-top: 1px; color: var(--rb-accent-text); }
.panel__title { margin: 0; font-size: 15px; font-weight: 650; color: var(--rb-text-primary); }
.panel__sub { margin: 3px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }

.panel__aside { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }

/* Links are the one place blue appears in a panel. */
.panel__link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--rb-primary-text);
  text-decoration: none;
  white-space: nowrap;
}

.panel__link:hover { text-decoration: underline; text-underline-offset: 3px; }
.panel__link:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; border-radius: 4px; }

.legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px 16px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 12px;
  color: var(--rb-text-secondary);
}

.legend li { display: inline-flex; align-items: center; gap: 6px; }
.legend__dot { width: 9px; height: 9px; border-radius: 999px; background: var(--seg); }

/* ---------- blood inventory: one card per type ---------- */
.types {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 10px;
}

.tcard {
  /* Its own container, so the counts can choose one row or two by its width. */
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 12px 12px 13px;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  background: var(--rb-surface);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.tcard--skeleton { height: 118px; }

.tcard:hover { border-color: var(--rb-border-hover); background: var(--rb-surface-hover); }
.tcard:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }

.tcard__code { font-size: 13px; font-weight: 650; color: var(--rb-text-primary); }
.tcard__value { font-size: 22px; font-weight: 650; line-height: 1.15; letter-spacing: -0.02em; color: var(--rb-text-primary); }

/* 2px of surface between the parts, the rounded ends on the bar itself. */
.tcard__bar {
  display: flex;
  gap: 2px;
  height: 8px;
  margin-top: 2px;
  border-radius: 999px;
  background: var(--iss-elevated);
  overflow: hidden;
}

.tcard__seg { flex-basis: 0; min-width: 3px; background: var(--seg); }

/* Two by two on a narrow card, so the four never break unevenly; one row
   once the card has room for it. */
.tcard__counts {
  display: grid;
  grid-template-columns: repeat(2, max-content);
  gap: 3px 12px;
  font-size: 11.5px;
  color: var(--rb-text-secondary);
  font-variant-numeric: tabular-nums;
}

@container (min-width: 172px) {
  .tcard__counts { display: flex; flex-wrap: wrap; gap: 3px 9px; }
}

.tcard__count { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.tcard__dot { width: 7px; height: 7px; border-radius: 999px; flex-shrink: 0; background: var(--seg); }

.tcard__status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 2px;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--rb-text-primary);
}

.tcard__status :deep(.asset-icon) { color: var(--signal); flex-shrink: 0; }

/* ---------- the bottom row ---------- */
.row {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1.15fr);
  gap: 16px;
  margin-top: 16px;
  align-items: stretch;
}

/* Requests */
.req-wrap { position: relative; overflow-x: auto; }

.req { width: 100%; border-collapse: collapse; font-size: 12.5px; }

.req th {
  padding: 0 8px 8px;
  font-size: 11.5px;
  font-weight: 500;
  text-align: left;
  color: var(--rb-text-secondary);
  white-space: nowrap;
}

.req td {
  padding: 10px 8px;
  border-top: 1px solid var(--rb-border);
  color: var(--rb-text-primary);
  white-space: nowrap;
}

.req th:first-child,
.req td:first-child { padding-left: 0; }

/* From takes what the other columns leave and shortens with an ellipsis
   (its full name is the cell's tooltip), so the table fits instead of
   scrolling. Zero max-width plus full width is what lets a nowrap cell give
   way in an auto-layout table. */
.req__from { width: 100%; max-width: 0; overflow: hidden; text-overflow: ellipsis; }
.req__units { color: var(--rb-text-secondary); }
.req__urgent { color: var(--signal); font-weight: 600; }
.req__when { color: var(--rb-text-secondary); font-variant-numeric: tabular-nums; }

/* Status pills: the hospital portal's tones, a tint and a darker ink. */
.pill {
  --pill: var(--rb-text-secondary);

  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--pill) 13%, transparent);
  color: var(--pill);
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
}

.pill--info { --pill: #1D5FB0; }
.pill--progress { --pill: #6D28D9; }
.pill--warning { --pill: #A15C00; }
.pill--success { --pill: #15803D; }
.pill--danger { --pill: #B91C1C; }

:global(.dark .iss .pill--info) { --pill: #7FB2F0; }
:global(.dark .iss .pill--progress) { --pill: #C4B5FD; }
:global(.dark .iss .pill--warning) { --pill: #FBBF24; }
:global(.dark .iss .pill--success) { --pill: #4ADE80; }
:global(.dark .iss .pill--danger) { --pill: #F87171; }

/* Ready for release */
.release__value { margin: 0; font-size: 34px; font-weight: 650; letter-spacing: -0.02em; line-height: 1; color: var(--rb-text-primary); }
.release__label { margin: 8px 0 0; font-size: 13px; line-height: 1.5; color: var(--rb-text-primary); max-width: 34ch; }

.release__note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 16px 0;
  padding: 10px 12px;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  background: var(--iss-elevated);
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}

.release__note :deep(.asset-icon) { flex-shrink: 0; margin-top: 1px; }

/* Stock by blood group: one series, so one colour and no legend. It counts
   available units, so it wears the Available colour; its value sits on each
   cap because that colour is light on white. */
.stock-chart { position: relative; }

.stock-chart__svg { display: block; overflow: visible; }
.stock-chart__svg:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; border-radius: 8px; }

.stock-chart__grid line { stroke: var(--rb-border); stroke-width: 1; shape-rendering: crispEdges; }
.stock-chart__grid text,
.stock-chart__axis text { fill: var(--rb-text-secondary); font-size: 11px; font-variant-numeric: tabular-nums; }

.stock-chart__bar { fill: var(--seg-fresh); }
.stock-chart__cap { fill: var(--rb-text-primary); font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums; }
.stock-chart__col { transition: opacity 0.12s ease; }
.stock-chart__col--dim { opacity: 0.45; }
.stock-chart__hit { fill: transparent; cursor: pointer; }

.stock-chart__tip {
  position: absolute;
  transform: translate(-50%, -100%);
  min-width: 112px;
  max-width: 230px;
  padding: 8px 10px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  box-shadow: 0 6px 20px rgba(var(--rb-shadow-rgb), 0.18);
  pointer-events: none;
  font-size: 12px;
}

.stock-chart__tip-title { margin: 0 0 4px; font-weight: 600; color: var(--rb-text-secondary); }
.stock-chart__tip-row { margin: 0; color: var(--rb-text-secondary); }
.stock-chart__tip-row strong { color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.stock-chart__tip-status { display: flex; align-items: center; gap: 5px; margin: 4px 0 0; font-weight: 500; color: var(--rb-text-primary); }
.stock-chart__tip-status :deep(.asset-icon) { color: var(--signal); flex-shrink: 0; }

/* The threshold banner keeps its structure here, on the page's surface: its
   state moves into the icon and a dot on each chip. Anchored on its root
   class, so each rule outranks the banner's own. */
.stock-banner { margin-bottom: 16px; }
.stock-banner.low-banner { background: var(--rb-surface); border-color: var(--rb-border); border-radius: 10px; }
.stock-banner :deep(.low-banner__icon) { background: var(--iss-elevated); border: 1px solid var(--rb-border); color: var(--iss-warn); }
.stock-banner.low-banner--critical :deep(.low-banner__icon) { color: var(--iss-crit); }
.stock-banner :deep(.low-banner__title) { font-weight: 600; color: var(--rb-text-primary); }
.stock-banner :deep(.low-banner__chip) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--iss-elevated);
  border: 1px solid var(--rb-border);
  color: var(--rb-text-primary);
  font-weight: 500;
}
.stock-banner :deep(.low-banner__chip::before) { content: ''; width: 6px; height: 6px; border-radius: 999px; background: var(--iss-warn); }
.stock-banner :deep(.low-banner__chip--critical::before) { background: var(--iss-crit); }
.stock-banner :deep(.low-banner__chip--more) { color: var(--rb-text-secondary); }
.stock-banner :deep(.low-banner__chip--more::before) { display: none; }

@keyframes iss-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
  .stock-chart__col { transition: none; }
}

/* Widths are the page's content width (the container), not the window's.
   - Requests, releases and the chart share a row only where the table keeps
     its four columns without squeezing From to a stub; below that the table
     takes the full width and the other two pair up.
   - Eight type cards stay in a row while each is wide enough for its counts
     two by two; then four, then two. */
@container issuance (max-width: 1299px) {
  .row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .row > :first-child { grid-column: 1 / -1; }
}

@container issuance (max-width: 1059px) {
  .types { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

@container issuance (max-width: 979px) {
  .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@container issuance (max-width: 699px) {
  .row { grid-template-columns: 1fr; }
}

@container issuance (max-width: 579px) {
  .kpis { grid-template-columns: 1fr; }
  .types { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .panel__aside { align-items: flex-start; }
  .legend { justify-content: flex-start; }
}

/* The gutter is the page's own padding, so the window decides it. */
@media (max-width: 640px) {
  .iss { padding: 20px 16px 32px; }
}
</style>
