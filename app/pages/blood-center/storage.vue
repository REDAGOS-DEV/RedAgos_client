<template>
  <div class="iss">
    <header class="iss__header">
      <div>
        <h1 class="iss__title">Issuance dashboard</h1>
      </div>
      <NuxtLink to="/blood-center/inventory-intake" class="btn-primary">
        <AssetIcon name="package-check" :size="15" />
        Stock Intake
      </NuxtLink>
    </header>

    <!-- What waits for this person now (useBloodCenterTasks), first on every dashboard. -->
    <TaskStrip class="needs-you" />

    <!-- ============ HEADLINE LEVELS ============ -->
    <section class="kpis" aria-label="Stock at a glance" :aria-busy="loading">
      <template v-if="loading">
        <div v-for="n in 3" :key="n" class="kpi skeleton" />
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
                <path :d="kpi.spark.area" class="kpi__spark-area" />
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

      <p v-else-if="shelfEmpty" class="shelf-empty">
        <AssetIcon name="droplets" :size="16" />
        <span><strong>No units in stock yet.</strong> Units recorded through Stock Intake appear here by blood type.</span>
      </p>

      <div v-if="!loading && summary" class="types">
        <NuxtLink
          v-for="card in typeCards"
          :key="card.code"
          :to="`/blood-center/inventory?type=${encodeURIComponent(card.code)}`"
          class="tcard"
          :class="shelfEmpty ? 'tcard--quiet' : `tcard--${card.status.tone}`"
          :title="card.status.title"
        >
          <span class="tcard__head">
            <span class="tcard__code">{{ card.label }}</span>
            <!-- The type's level against the fullest shelf: a vial that empties. -->
            <span class="tcard__vial" aria-hidden="true">
              <span class="tcard__vial-fill" :style="{ height: `${vialLevel(card.available)}%` }" />
            </span>
          </span>
          <span class="tcard__value">{{ formatCount(card.available) }}<small>units</small></span>

          <!-- The shelf in its three parts; the counts below carry the numbers. -->
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
          <span v-if="!shelfEmpty && card.status.tone !== 'neutral'" class="tcard__status" :class="`signal--${card.status.tone}`">
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
          <!-- The whole open queue, not only the rows below. -->
          <ul v-if="canSeeRequests && requests" class="req-chips" aria-label="Open requests">
            <li v-if="requests.open_emergencies" class="req-chip req-chip--crit">
              <AssetIcon name="circle-alert" :size="12" /> {{ requests.open_emergencies }} emergency
            </li>
            <li v-for="chip in requestChips" :key="chip.key" class="req-chip" :class="`req-chip--${chip.tone}`">
              <strong>{{ chip.count }}</strong> {{ chip.label }}
            </li>
          </ul>
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
              <tr v-for="row in requestRows" :key="row.id" :class="{ 'req__row--emergency': row.emergency }">
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
          <div class="release__hero">
            <span class="release__badge" :class="{ 'release__badge--zero': !awaitingRelease }">
              <strong>{{ awaitingRelease }}</strong>
              <small>to release</small>
            </span>
            <p class="release__label">
              {{ awaitingRelease === 1 ? 'request has' : 'requests have' }} units allocated and waiting to be released.
            </p>
          </div>
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

      <!-- ============ STOCK, LAST 8 DAYS ============ -->
      <!--
        Each type's count is on its tile above; what the tiles cannot show is
        how the shelf has moved. Available, expiring and reserved, day by day,
        in the tiles' colours.
      -->
      <section class="panel trend-panel" aria-labelledby="trend-title">
        <header class="panel__head">
          <div class="panel__titles">
            <AssetIcon name="bar-chart" :size="20" class="panel__icon" />
            <div>
              <h2 id="trend-title" class="panel__title">Stock, last 8 days</h2>
            </div>
          </div>
          <div class="panel__aside panel__aside--row">
            <ul class="legend" aria-label="Legend">
              <li v-for="item in TREND_SERIES" :key="item.key">
                <span class="legend__dot" :class="`seg--${item.seg}`" aria-hidden="true" />
                {{ item.label }}
              </li>
            </ul>
            <NuxtLink to="/blood-center/inventory" class="panel__link">
              View inventory
              <AssetIcon name="arrow-right" :size="13" />
            </NuxtLink>
          </div>
        </header>

        <div v-if="loading" class="panel-skeleton skeleton" />
        <div v-else-if="trend.length < 2" class="empty">
          <AssetIcon name="bar-chart" :size="22" />
          <p class="empty__title">{{ summary ? 'Not enough days yet' : 'Stock could not be loaded' }}</p>
          <p class="empty__body">{{ summary ? 'The chart fills in as the days pass.' : 'Refresh the page to try again.' }}</p>
        </div>
        <div v-else class="tchart">
          <div class="tchart__y" aria-hidden="true">
            <span v-for="tick in [...trendScale.ticks].reverse()" :key="tick">{{ formatCount(tick) }}</span>
          </div>
          <div class="tchart__area">
            <div class="tchart__grid" aria-hidden="true">
              <span v-for="tick in trendScale.ticks" :key="tick" />
            </div>
            <svg class="tchart__svg" viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="iss-trend-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" class="tchart__stop tchart__stop--top" />
                  <stop offset="100%" class="tchart__stop tchart__stop--bottom" />
                </linearGradient>
              </defs>
              <path v-if="trendLines[0]" :d="trendLines[0].area" fill="url(#iss-trend-fill)" />
              <path v-for="line in trendLines" :key="line.key" :d="line.line" class="tchart__line" :class="`seg--${line.seg}`" vector-effect="non-scaling-stroke" />
            </svg>
            <div class="tchart__cols" role="img" :aria-label="trendLabel">
              <div v-for="(point, i) in trend" :key="point.date ?? i" class="tchart__col">
                <span v-for="line in TREND_SERIES" :key="line.key" class="tchart__dot" :class="`seg--${line.seg}`"
                  :style="{ bottom: `${trendHeight(point[line.key])}%` }" />
                <span class="tchart__tip">
                  <strong>{{ trendDay(point.date) }}</strong>
                  <span v-for="line in TREND_SERIES" :key="line.key"><i :class="`seg--${line.seg}`" />{{ formatCount(point[line.key]) }} {{ line.short }}</span>
                </span>
                <span class="tchart__x">{{ i === trend.length - 1 ? 'Today' : trendDay(point.date) }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ============ DEMAND, NEXT 4 WEEKS ============ -->
      <!--
        The Issuance part of the forecast (2026-10-31), as Billing has its own on
        its dashboard: units asked for a week, the curve ahead, and the pairs
        about to run short. The whole forecast is on Demand Forecast.
      -->
      <section v-if="demand" class="panel ahead" aria-labelledby="ahead-title">
        <header class="panel__head">
          <div class="panel__titles">
            <AssetIcon name="trending-up" :size="20" class="panel__icon" />
            <div>
              <h2 id="ahead-title" class="panel__title">Demand, next {{ demand.weeks }} weeks</h2>
            </div>
          </div>
          <NuxtLink to="/blood-center/forecast" class="panel__link">
            Demand Forecast
            <AssetIcon name="arrow-right" :size="13" />
          </NuxtLink>
        </header>

        <p class="ahead__figure">
          <strong>{{ formatCount(demand.total.per_week) }}</strong>
          units a week
        </p>
        <p class="ahead__sub">Range {{ demand.total.low }} to {{ demand.total.high }}, from the last 12 weeks of requests</p>

        <ForecastWeekChart :series="demand.total.series" :estimate="demand.total" :weeks="demand.history" :horizon="demand.horizon" unit="units" compact />

        <dl class="ahead__facts">
          <div :class="{ 'ahead__fact--bad': demand.short }"><dt>Short within a week</dt><dd>{{ demand.short }}</dd></div>
          <div :class="{ 'ahead__fact--warn': demand.watch }"><dt>Under two weeks of stock</dt><dd>{{ demand.watch }}</dd></div>
          <div><dt>Emergencies a week</dt><dd>{{ formatCount(demand.emergency) }}</dd></div>
        </dl>
      </section>
    </div>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import TaskStrip from '~/components/BloodCenter/TaskStrip.vue'
import LowStockBanner from '~/components/common/LowStockBanner.vue'
import ForecastWeekChart from '~/components/BloodCenter/ForecastWeekChart.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { niceScale } from '~/utils/collectionDashboard'
import { stockSparkline, stockTypeAlert, stockTypeCards, stockWeekChange } from '~/utils/issuanceDashboard'
import { REQUEST_STATUS_TONES, requestStatusLabel } from '~/types/bloodRequest'
import { smoothPath } from '~/utils/smoothPath'

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

// ---- Demand, next 4 weeks (the demand part of the forecast) ----
const forecastData = ref(null)
const demand = computed(() => {
  const f = forecastData.value
  const d = f?.demand
  if (!d?.total?.series?.length) return null
  return {
    weeks: f.method?.horizon_weeks ?? 4,
    history: f.weeks ?? [],
    horizon: f.horizon ?? [],
    total: d.total,
    short: d.short ?? 0,
    watch: d.watch ?? 0,
    emergency: d.emergency?.per_week ?? 0,
  }
})

onMounted(async () => {
  hydrated.value = true

  const [inventoryResult, requestResult, listResult, thresholdResult, forecastResult] = await Promise.allSettled([
    bloodCenterService.inventorySummary(),
    canSeeRequests.value ? bloodCenterService.incomingRequestsSummary() : Promise.resolve(null),
    canSeeRequests.value ? bloodCenterService.incomingRequests({ open: 1, per_page: REQUEST_ROWS }) : Promise.resolve(null),
    bloodCenterService.stockThresholds(),
    bloodCenterService.forecast(),
  ])

  // The panel is left out when the forecast cannot be had.
  forecastData.value = forecastResult.status === 'fulfilled' ? forecastResult.value : null

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
    // No "In Quarantine" card (project owner, 2026-10-22): bags reach
    // Issuance cleared and labelled, so nothing waits in quarantine here.
  ]
})

// ---- Blood inventory ----
const SEGMENTS = [
  { key: 'fresh', label: 'Available' },
  { key: 'expiring', label: 'Expiring (≤7 days)' },
  { key: 'reserved', label: 'Reserved' },
]

const SEGMENT_LABEL = Object.fromEntries(SEGMENTS.map((segment) => [segment.key, segment.label]))

// Every type at nothing, reserved and expiring too: the whole shelf is empty, said once above the tiles.
const shelfEmpty = computed(() => typeCards.value.length > 0 && typeCards.value.every(card => card.segments.every(seg => !seg.count)))

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

// ---- Type tiles: each type's level against the fullest shelf ----
const vialMax = computed(() => Math.max(1, ...typeCards.value.map(card => card.available)))
const vialLevel = available => (available ? Math.max(6, (available / vialMax.value) * 100) : 0)

// ---- The request queue's counts ----
const requestChips = computed(() => {
  const totals = requests.value?.totals ?? {}
  return [
    { key: 'pending', label: 'pending', count: totals.pending ?? 0, tone: 'info' },
    { key: 'processing', label: 'processing', count: totals.processing ?? 0, tone: 'progress' },
    { key: 'partial', label: 'partly filled', count: totals.partial ?? 0, tone: 'warning' },
  ].filter(chip => chip.count > 0)
})

// ---- Stock, last 8 days: a curve a part, in the tiles' colours ----
const TREND_SERIES = [
  { key: 'available', label: 'Available', short: 'available', seg: 'fresh' },
  { key: 'expiring_soon', label: 'Expiring (≤7 days)', short: 'expiring', seg: 'expiring' },
  { key: 'reserved', label: 'Reserved', short: 'reserved', seg: 'reserved' },
]
const trendScale = computed(() => niceScale(Math.max(0, ...trend.value.flatMap(p => TREND_SERIES.map(sr => p[sr.key] ?? 0)))))
const trendHeight = v => Math.min(100, ((v ?? 0) / trendScale.value.max) * 100)
const trendLines = computed(() => {
  const n = trend.value.length
  if (n < 2) return []
  return TREND_SERIES.map((sr) => {
    const points = trend.value.map((p, i) => ({ x: ((i + 0.5) / n) * 1000, y: 200 - trendHeight(p[sr.key]) * 2 }))
    const line = smoothPath(points)
    return { ...sr, line, area: `${line} L${points[n - 1].x},200 L${points[0].x},200 Z` }
  })
})
const trendDay = d => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')
const trendLabel = computed(() => `Stock over the last ${trend.value.length} days: ${trend.value.map(p => `${trendDay(p.date)} ${p.available ?? 0} available, ${p.expiring_soon ?? 0} expiring, ${p.reserved ?? 0} reserved`).join('; ')}.`)
</script>

<style scoped>
/* Laid out after the owner's mock-up (2026-10-19): headline cards with a
   week's trend, the shelf by blood type, then requests, releases and the
   column chart side by side. Content area only; the header and sidebar are
   the app's.

   Colour:
   - The three shelf parts (available, expiring, reserved) are
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
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

/* The three counts in one row, tighter on a narrow card. */
.tcard__counts {
  display: grid;
  grid-template-columns: repeat(3, max-content);
  gap: 3px 8px;
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

/* ===== Refresh (project owner, 2026-10-24) ===== */
.needs-you { margin-bottom: 16px; }

.kpi__spark-area { fill: var(--kpi-mark); opacity: 0.14; stroke: none; }

/* Type tiles: a vial of the type's level, coloured by how it stands. */
.tcard { --tone: var(--seg-fresh); position: relative; overflow: hidden; }
.tcard--warning { --tone: var(--seg-expiring); }
.tcard--critical { --tone: var(--iss-crit); }
/* Red is kept for the exception: an edge and the status line, never a filled
   tile, so one empty type stands out among healthy ones. */
.tcard--warning, .tcard--critical { border-color: color-mix(in srgb, var(--tone) 40%, var(--rb-border)); }
.tcard--warning::before, .tcard--critical::before { content: ''; position: absolute; inset: 0 0 auto; height: 3px; background: var(--tone); }
.tcard--quiet { --tone: var(--rb-text-secondary); }
.tcard--quiet .tcard__code { background: var(--iss-elevated); }

.shelf-empty {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 12px;
  padding: 10px 14px;
  border: 1px dashed var(--rb-border-strong, var(--rb-border));
  border-radius: 10px;
  font-size: 13px;
  color: var(--rb-text-secondary);
}
.shelf-empty strong { color: var(--rb-text-primary); }
.tcard__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.tcard__code {
  display: inline-grid;
  place-items: center;
  min-width: 38px;
  height: 26px;
  padding: 0 7px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--tone) 14%, transparent);
  font-size: 13px;
  font-weight: 800;
  color: var(--rb-text-primary);
}
.tcard__vial {
  position: relative;
  width: 12px;
  height: 34px;
  border: 1.5px solid color-mix(in srgb, var(--tone) 55%, var(--rb-border));
  border-radius: 3px 3px 7px 7px;
  overflow: hidden;
}
.tcard__vial-fill { position: absolute; inset: auto 0 0; background: var(--tone); transition: height 0.5s var(--rb-ease-out, ease); }
.tcard__value { display: flex; align-items: baseline; gap: 4px; font-size: 26px; font-weight: 800; }
.tcard__value small { font-size: 11.5px; font-weight: 600; color: var(--rb-text-secondary); }

/* Requests: the queue's counts, an emergency row marked down its edge. */
.panel__head { flex-wrap: wrap; }
.req-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 auto 0 12px; padding: 0; list-style: none; }
.req-chip { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 999px; font-size: 12px; color: var(--rb-text-secondary); background: var(--iss-elevated); }
.req-chip strong { color: var(--rb-text-primary); }
.req-chip--crit { font-weight: 700; color: var(--iss-crit); background: color-mix(in srgb, var(--iss-crit) 10%, transparent); }
.req__row--emergency td { background: color-mix(in srgb, var(--iss-crit) 5%, transparent); }
.req__row--emergency td:first-child { box-shadow: inset 3px 0 0 var(--iss-crit); }

/* Ready for release */
.release__hero { display: flex; align-items: center; gap: 16px; margin: 4px 0 14px; }
.release__badge {
  display: grid;
  flex: none;
  place-items: center;
  align-content: center;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--rb-primary) 18%, transparent), color-mix(in srgb, var(--rb-primary) 8%, transparent));
  box-shadow: inset 0 0 0 6px color-mix(in srgb, var(--rb-primary) 18%, transparent);
}
.release__badge strong { font-size: 32px; font-weight: 800; line-height: 1; color: var(--rb-primary-text, var(--rb-primary)); }
.release__badge small { margin-top: 2px; font-size: 11px; font-weight: 600; color: var(--rb-text-secondary); }
.release__badge--zero { background: var(--iss-elevated); box-shadow: none; }
.release__badge--zero strong { color: var(--rb-text-secondary); }
.release__hero .release__label { margin: 0; }

/* The bottom row: requests and releases side by side, the trend under them. */
.row { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
.trend-panel { grid-column: 1 / -1; }
/* Beside the stock chart when the forecast is there (2026-10-31). */
.row:has(.ahead) .trend-panel { grid-column: auto; }
.ahead { display: flex; flex-direction: column; gap: 10px; }
.ahead__figure { margin: 0; display: flex; align-items: baseline; gap: 8px; font-size: 13px; color: var(--rb-text-secondary); }
.ahead__figure strong { font-size: 28px; font-weight: 800; line-height: 1.05; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.ahead__sub { margin: -6px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.ahead__facts { display: grid; gap: 8px; margin: auto 0 0; padding-top: 10px; border-top: 1px solid var(--rb-border); }
.ahead__facts div { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; }
.ahead__facts dt { color: var(--rb-text-secondary); }
.ahead__facts dd { margin: 0; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--rb-text-primary); }
.ahead__fact--bad dd { color: var(--rb-accent-text); }
.ahead__fact--warn dd { color: var(--rb-warning-text, var(--rb-warning)); }
.panel__aside--row { flex-direction: row; align-items: center; gap: 18px; }

.tchart { display: grid; grid-template-columns: 40px minmax(0, 1fr); gap: 8px; }
.tchart__y { display: flex; flex-direction: column; justify-content: space-between; height: 220px; font-size: 11.5px; text-align: right; color: var(--rb-text-secondary); font-variant-numeric: tabular-nums; }
.tchart__y span { transform: translateY(-50%); }
.tchart__y span:last-child { transform: translateY(50%); }
.tchart__area { position: relative; }
.tchart__grid { position: absolute; inset: 0 0 auto; display: flex; flex-direction: column-reverse; justify-content: space-between; height: 220px; pointer-events: none; }
.tchart__grid span { height: 1px; background: var(--rb-border); }
.tchart__svg { position: absolute; inset: 0 0 auto; width: 100%; height: 220px; overflow: visible; pointer-events: none; }
.tchart__stop--top { stop-color: var(--seg-fresh); stop-opacity: 0.24; }
.tchart__stop--bottom { stop-color: var(--seg-fresh); stop-opacity: 0; }
.tchart__line { fill: none; stroke: var(--seg); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.tchart__cols { position: relative; display: flex; height: 220px; padding-bottom: 26px; box-sizing: content-box; }
.tchart__col { position: relative; flex: 1; height: 100%; }
.tchart__col::before { content: ''; position: absolute; top: 0; bottom: 0; left: 50%; border-left: 1px dashed var(--rb-border-strong, var(--rb-border)); opacity: 0; transition: opacity 120ms ease; }
.tchart__col:hover::before { opacity: 1; }
.tchart__dot { position: absolute; left: 50%; width: 8px; height: 8px; border: 2px solid var(--rb-surface); border-radius: 50%; background: var(--seg); transform: translate(-50%, 50%); }
.tchart__tip {
  position: absolute;
  top: 8px;
  left: 50%;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 7px 10px;
  border-radius: 10px;
  background: var(--rb-text-primary);
  font-size: 12px;
  white-space: nowrap;
  color: var(--rb-surface);
  opacity: 0;
  pointer-events: none;
  transform: translateX(-50%);
  transition: opacity 120ms ease;
}
.tchart__tip span { display: flex; align-items: center; gap: 6px; }
.tchart__tip i { width: 8px; height: 8px; border-radius: 50%; background: var(--seg); }
.tchart__col:hover .tchart__tip { opacity: 1; }
.tchart__col:first-child .tchart__tip { left: 0; transform: none; }
.tchart__col:last-child .tchart__tip { left: auto; right: 0; transform: none; }
.tchart__x { position: absolute; top: calc(100% + 8px); left: 50%; font-size: 11.5px; white-space: nowrap; color: var(--rb-text-secondary); transform: translateX(-50%); }

@media (prefers-reduced-motion: reduce) {
  .tcard__vial-fill, .tchart__col::before, .tchart__tip { transition: none; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
}

/* Widths are the page's content width (the container), not the window's.
   - Requests and releases share a row (2 : 1) while the table keeps its
     four columns without squeezing From to a stub; below that each takes
     the full width. The stock trend always has a row of its own.
   - Eight type cards stay in a row while each is wide enough for its three
     counts; then four, then two. */
@container issuance (max-width: 1059px) {
  .types { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .row { grid-template-columns: 1fr; }
}

@container issuance (max-width: 819px) {
  .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  /* Three cards: the last takes the row, so none is left half-empty. */
  .kpis > :last-child { grid-column: 1 / -1; }
}

@container issuance (max-width: 579px) {
  .kpis { grid-template-columns: 1fr; }
  .kpis > :last-child { grid-column: auto; }
  .types { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .panel__aside { align-items: flex-start; }
  .legend { justify-content: flex-start; }
}

/* The gutter is the page's own padding, so the window decides it. */
@media (max-width: 640px) {
  .iss { padding: 20px 16px 32px; }
}
</style>
