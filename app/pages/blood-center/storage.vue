<template>
  <BloodCenterDepartmentDashboard
    title="Issuance"
    subtitle="Stock on hand, what is about to expire, and hospital requests waiting on this department."
    :loading="loading"
    :stats="stats"
    :panels="panels"
  >
    <template #actions>
      <NuxtLink to="/blood-center/inventory-intake" class="btn-primary">
        <AssetIcon name="package-check" :size="15" />
        Stock Intake
      </NuxtLink>
    </template>

    <!-- Stock by blood type: one tile per type, in the usual order -->
    <template #stock>
      <LowStockBanner :cells="lowStock" to="/blood-center/stock-thresholds" class="stock-banner" />

      <div class="type-grid">
        <NuxtLink
          v-for="tile in typeTiles"
          :key="tile.code"
          :to="`/blood-center/inventory?type=${encodeURIComponent(tile.code)}`"
          class="type-tile"
          :title="tile.status.title"
        >
          <span class="type-tile__code">{{ tile.code.replace('-', '−') }}</span>
          <span class="type-tile__value">{{ tile.available }}</span>
          <!-- Every type wears the same tile; only this line says how it stands. -->
          <span class="type-tile__status" :class="`signal--${tile.status.tone}`">
            <AssetIcon :name="tile.status.icon" :size="12" />
            {{ tile.status.label }}
          </span>
        </NuxtLink>
      </div>

      <!-- Expiry, in the order it should be acted on -->
      <ul class="expiry">
        <li class="expiry__row" :class="{ 'signal--critical expiry__row--flag': nearExpiry.within_3_days }">
          <span>Expire within 3 days</span>
          <strong>{{ nearExpiry.within_3_days }}</strong>
        </li>
        <li class="expiry__row" :class="{ 'signal--warning expiry__row--flag': nearExpiry.within_7_days }">
          <span>Expire within 7 days</span>
          <strong>{{ nearExpiry.within_7_days }}</strong>
        </li>
        <li class="expiry__row" :class="{ 'signal--critical expiry__row--flag': nearExpiry.expired }">
          <span>Expired, awaiting discard</span>
          <strong>{{ nearExpiry.expired }}</strong>
        </li>
      </ul>
    </template>

    <!-- Requests by state -->
    <template #requests>
      <div v-if="requestSummary.open_emergencies" class="callout signal--critical" role="status">
        <AssetIcon name="alert" :size="15" class="callout__icon" />
        <span>
          <strong class="callout__count">{{ requestSummary.open_emergencies }}</strong>
          {{ requestSummary.open_emergencies === 1 ? 'emergency request' : 'emergency requests' }} open
        </span>
      </div>
      <ul class="counts">
        <li v-for="row in requestRows" :key="row.key" class="counts__row">
          <!-- Neutral, unless requests are waiting for someone to look at them. -->
          <span class="counts__dot" :class="{ 'signal--warning counts__dot--flag': row.key === 'pending' && row.value > 0 }" aria-hidden="true" />
          <span class="counts__label">{{ row.label }}</span>
          <strong class="counts__value">{{ row.value }}</strong>
        </li>
      </ul>
    </template>

    <!-- Allocated and waiting to go out -->
    <template #release>
      <div class="release">
        <p class="release__value">{{ requestSummary.awaiting_release }}</p>
        <p class="release__label">
          {{ requestSummary.awaiting_release === 1 ? 'request has' : 'requests have' }} units allocated and waiting to be released.
        </p>
        <p class="release__note">Units go out only after payment is confirmed.</p>
      </div>
    </template>

    <!-- Available units by component -->
    <template #components>
      <ul class="bars">
        <li v-for="row in componentRows" :key="row.name" class="bars__row">
          <span class="bars__label">{{ row.name }}</span>
          <span class="bars__track" aria-hidden="true">
            <span class="bars__fill" :style="{ width: `${row.share}%` }" />
          </span>
          <strong class="bars__value">{{ row.available }}</strong>
        </li>
      </ul>
    </template>
  </BloodCenterDepartmentDashboard>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import BloodCenterDepartmentDashboard from '~/components/BloodCenter/DepartmentDashboard.vue'
import LowStockBanner from '~/components/common/LowStockBanner.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { typeHealthByCode } from '~/utils/stockThreshold'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'inventory.create',
})

useHead({ title: 'Issuance · RedAgos' })

const { can } = useUser()

// GET /blood-center/inventory/summary and /blood-center/blood-requests/summary.
// Both exist; a failure leaves that half empty rather than breaking the page.
const summary = ref(null)
const requests = ref(null)
// The facility's minimums against its stock. Supplementary, like the rest: a
// failure leaves no banner and no tile grading rather than breaking the page.
const stockCells = ref([])
const lowStock = ref([])
const loading = ref(true)

const canSeeRequests = computed(() => can('requests.view'))

onMounted(async () => {
  const [inventoryResult, requestResult, thresholdResult] = await Promise.allSettled([
    bloodCenterService.inventorySummary(),
    canSeeRequests.value ? bloodCenterService.incomingRequestsSummary() : Promise.resolve(null),
    bloodCenterService.stockThresholds(),
  ])

  if (inventoryResult.status === 'fulfilled') summary.value = inventoryResult.value
  else console.error('Failed to load inventory summary:', inventoryResult.reason)

  if (requestResult.status === 'fulfilled') requests.value = requestResult.value
  else console.error('Failed to load request summary:', requestResult.reason)

  if (thresholdResult.status === 'fulfilled') {
    stockCells.value = thresholdResult.value?.cells ?? []
    lowStock.value = thresholdResult.value?.low ?? []
  } else {
    console.error('Failed to load stock thresholds:', thresholdResult.reason)
  }

  loading.value = false
})

// ---- Inventory ----
const BLOOD_TYPE_ORDER = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

/** Every type gets a tile, so a type with no stock shows as 0, not as missing. */
const typeTiles = computed(() => {
  const rows = summary.value?.by_blood_type ?? []
  const byCode = new Map(rows.map((row) => [row.code, row.available]))
  const codes = [...BLOOD_TYPE_ORDER, ...rows.map((row) => row.code).filter((code) => !BLOOD_TYPE_ORDER.includes(code))]

  return codes.map((code) => {
    const available = byCode.get(code) ?? 0
    const health = typeHealthByCode(stockCells.value, code)

    return { code, available, health, status: tileStatus(code, available, health) }
  })
})

/**
 * How one type stands, as a word and an icon. Colour only for what needs
 * attention; a healthy type reads as plainly available.
 *
 * A type whose worst component is empty under its critical level is graded
 * `critical` even with hundreds of other units on the shelf, and says so.
 */
function tileStatus(code, available, health) {
  if (available === 0) {
    return { label: 'None available', icon: 'circle-x', tone: 'critical', title: `${code}: no units available` }
  }
  if (health === 'critical') {
    return { label: 'Component empty', icon: 'circle-alert', tone: 'critical', title: `${code}: ${available} available, but a component is out under its critical level` }
  }
  if (health === 'low') {
    return { label: 'Below critical', icon: 'triangle-alert', tone: 'warning', title: `${code}: ${available} available, with a component below its critical level` }
  }

  return { label: 'Available', icon: 'check-circle', tone: 'neutral', title: `${code}: ${available} available` }
}

const nearExpiry = computed(() => ({
  within_3_days: summary.value?.near_expiry?.within_3_days ?? 0,
  within_7_days: summary.value?.near_expiry?.within_7_days ?? 0,
  expired: summary.value?.near_expiry?.expired ?? 0,
}))

const componentRows = computed(() => {
  const rows = summary.value?.by_component ?? []
  const max = Math.max(1, ...rows.map((row) => row.available))
  return [...rows]
    .sort((a, b) => b.available - a.available)
    .map((row) => ({ ...row, share: Math.round((row.available / max) * 100) }))
})

const hasStock = computed(() => (summary.value?.totals?.available ?? 0) + (summary.value?.totals?.reserved ?? 0) > 0)

// ---- Requests ----
const requestSummary = computed(() => ({
  open_emergencies: requests.value?.open_emergencies ?? 0,
  awaiting_release: requests.value?.awaiting_release ?? 0,
  totals: requests.value?.totals ?? {},
}))

const requestRows = computed(() => [
  { key: 'pending', label: 'Pending review', value: requestSummary.value.totals.pending ?? 0 },
  { key: 'processing', label: 'Processing', value: requestSummary.value.totals.processing ?? 0 },
  { key: 'partial', label: 'Partly fulfilled', value: requestSummary.value.totals.partial ?? 0 },
])

const openRequests = computed(() => requestRows.value.reduce((sum, row) => sum + row.value, 0))

// ---- Shell ----
const stats = computed(() => {
  const totals = summary.value?.totals
  const within7 = summary.value?.near_expiry?.within_7_days

  return [
    { label: 'Available Units', value: totals?.available ?? null, caption: 'Ready for allocation', icon: 'droplets', to: '/blood-center/inventory' },
    // The one card with a state: its icon turns amber while anything is about to expire.
    { label: 'Expiring Soon', value: within7 ?? null, caption: 'Within 7 days', icon: 'clock', to: '/blood-center/inventory', status: within7 > 0 ? 'warning' : undefined },
    { label: 'Reserved', value: totals?.reserved ?? null, caption: 'Allocated to requests', icon: 'package', to: '/blood-center/fulfillment' },
    // Booked in but not yet cleared by testing. Released, with their final labels, at Stock Intake.
    { label: 'In Quarantine', value: totals?.quarantined ?? null, caption: 'Awaiting testing clearance', icon: 'shield-check', to: '/blood-center/inventory-intake' },
  ]
})

const panels = computed(() => [
  {
    key: 'stock', wide: true,
    title: 'Stock by blood type', subtitle: 'Available units. Open a type to see its units, oldest expiry first.',
    icon: 'droplets', link: '/blood-center/inventory', linkLabel: 'Manage inventory',
    empty: !summary.value || !hasStock.value,
    emptyTitle: summary.value ? 'No stock yet' : 'Stock could not be loaded',
    emptyBody: summary.value
      ? 'Units appear here once donations clear testing and are booked in at Stock Intake.'
      : 'Refresh the page to try again.',
  },
  {
    key: 'requests',
    title: 'Incoming requests', subtitle: 'Open requests from hospitals.',
    icon: 'clipboard-check', link: canSeeRequests.value ? '/blood-center/bloodrequests' : null, linkLabel: 'Review requests',
    empty: !requests.value || openRequests.value === 0,
    emptyTitle: !canSeeRequests.value ? 'Not part of your role' : requests.value ? 'No open requests' : 'Requests could not be loaded',
    emptyBody: !canSeeRequests.value
      ? 'Ask your supervisor if you need to see hospital requests.'
      : requests.value ? 'New hospital requests will appear here.' : 'Refresh the page to try again.',
  },
  {
    key: 'release',
    title: 'Ready for release', subtitle: 'Allocated, waiting to go out.',
    icon: 'building-2', link: '/blood-center/fulfillment', linkLabel: 'Fulfillment',
    empty: !requests.value || requestSummary.value.awaiting_release === 0,
    emptyTitle: 'Nothing waiting for release',
    emptyBody: 'Requests appear here once units are allocated to them.',
  },
  {
    key: 'components',
    title: 'Stock by component', subtitle: 'Available units per component.',
    icon: 'flask-conical', link: '/blood-center/inventory', linkLabel: 'View inventory',
    empty: !componentRows.value.length,
    emptyTitle: 'No components in stock',
    emptyBody: 'Each processed unit is counted under its component.',
  },
])
</script>

<style scoped>
/* The palette, the semantic colours (--dept-ok, --dept-warn, --dept-crit) and
   the neutral bar colour come from the department shell this page fills. */

/* Signals: red, amber and green, only ever on an icon, a dot, a 3px marker or
   a number. Never on a container. */
.signal--critical { --signal: var(--dept-crit); }
.signal--warning { --signal: var(--dept-warn); }
.signal--ok { --signal: var(--dept-ok); }
.signal--neutral { --signal: var(--rb-text-secondary); }

/* The one primary action: the single solid blue on the page. */
.btn-primary {
  display: inline-flex;
  align-items: center;
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

/* Stock by blood type: eight identical tiles. */
.type-grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 10px;
}

.type-tile {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 11px 12px 12px;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  background: var(--rb-surface);
  text-decoration: none;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.type-tile:hover { border-color: var(--rb-border-hover); background: var(--rb-surface-hover); }
.type-tile:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }

.type-tile__code { font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); }
.type-tile__value { font-size: 21px; font-weight: 600; letter-spacing: -0.02em; color: var(--rb-text-primary); line-height: 1.2; font-variant-numeric: tabular-nums; }

.type-tile__status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 3px;
  font-size: 11.5px;
  color: var(--rb-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.type-tile__status :deep(.asset-icon) { color: var(--signal); flex-shrink: 0; }
/* What needs attention reads in full ink; what is fine stays quiet. */
.type-tile__status.signal--critical,
.type-tile__status.signal--warning { color: var(--rb-text-primary); font-weight: 500; }

.stock-banner { margin-bottom: 14px; }

/* Expiry, in the order it should be acted on. A row is marked only while it
   has something in it. */
.expiry {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.expiry__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  background: var(--rb-surface);
  font-size: 12.5px;
  color: var(--rb-text-secondary);
}

.expiry__row strong { font-size: 15px; font-weight: 600; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }

.expiry__row--flag { box-shadow: inset 3px 0 0 var(--signal); color: var(--rb-text-primary); }
.expiry__row--flag strong { color: var(--signal); }

/* Requests */
.callout {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 9px 12px;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  background: var(--rb-surface);
  font-size: 12.5px;
  color: var(--rb-text-primary);
}

.callout__icon { color: var(--signal); flex-shrink: 0; }
.callout__count { color: var(--signal); font-weight: 600; font-variant-numeric: tabular-nums; }

.counts { list-style: none; margin: 0; padding: 0; }

.counts__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid var(--rb-border);
  font-size: 13px;
}

.counts__row:first-child { border-top: 0; }

.counts__dot { width: 6px; height: 6px; border-radius: 999px; flex-shrink: 0; background: var(--rb-text-muted); }
.counts__dot--flag { background: var(--signal); }

.counts__label { flex: 1; color: var(--rb-text-primary); }
.counts__value { font-weight: 600; font-variant-numeric: tabular-nums; color: var(--rb-text-primary); }

/* Release */
.release { padding: 2px 0; }
.release__value { margin: 0; font-size: 30px; font-weight: 600; letter-spacing: -0.02em; line-height: 1; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.release__label { margin: 8px 0 0; font-size: 13px; line-height: 1.5; color: var(--rb-text-primary); }
.release__note { margin: 6px 0 0; font-size: 12px; color: var(--rb-text-secondary); }

/* Components: one neutral bar colour; the numbers carry the reading. */
.bars { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 11px; }

.bars__row {
  display: grid;
  grid-template-columns: minmax(110px, 1fr) minmax(0, 2fr) 36px;
  align-items: center;
  gap: 12px;
  font-size: 12.5px;
}

.bars__label { color: var(--rb-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bars__track { height: 6px; border-radius: 999px; background: var(--dept-elevated); overflow: hidden; }
.bars__fill { display: block; height: 100%; border-radius: inherit; background: var(--dept-bar); }
.bars__value { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--rb-text-primary); }

/* The threshold banner keeps its structure here, on the page's surface: its
   state moves into the icon and a dot on each chip. Anchored on its root
   class, so each rule outranks the banner's own. */
.stock-banner.low-banner { background: var(--rb-surface); border-color: var(--rb-border); border-radius: 10px; }
.stock-banner :deep(.low-banner__icon) { background: var(--dept-elevated); border: 1px solid var(--rb-border); color: var(--dept-warn); }
.stock-banner.low-banner--critical :deep(.low-banner__icon) { color: var(--dept-crit); }
.stock-banner :deep(.low-banner__title) { font-weight: 600; color: var(--rb-text-primary); }
.stock-banner :deep(.low-banner__chip) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--dept-elevated);
  border: 1px solid var(--rb-border);
  color: var(--rb-text-primary);
  font-weight: 500;
}
.stock-banner :deep(.low-banner__chip::before) { content: ''; width: 6px; height: 6px; border-radius: 999px; background: var(--dept-warn); }
.stock-banner :deep(.low-banner__chip--critical::before) { background: var(--dept-crit); }
.stock-banner :deep(.low-banner__chip--more) { color: var(--rb-text-secondary); }
.stock-banner :deep(.low-banner__chip--more::before) { display: none; }

@media (max-width: 1100px) {
  .type-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
  .type-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .expiry { grid-template-columns: 1fr; }
}
</style>
