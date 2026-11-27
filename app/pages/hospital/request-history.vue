<template>
  <div class="ia">
    <PageHeader title="Request History" :subtitle="hospitalPageSubtitle('requestHistory', can)">
      <template #actions>
        <button type="button" class="btn-outline" :disabled="loading" @click="loadAll">
          <AssetIcon name="refresh-cw" :size="14" :class="{ spin: loading }" />
          Refresh
        </button>
      </template>
    </PageHeader>

    <!-- Today at a glance: what came onto the shelf, what reached a patient, what was lost, what arrived. -->
    <section class="ia-today" aria-label="Today">
      <div v-for="tile in todayTiles" :key="tile.key" class="ia-tile">
        <span class="ia-tile__icon" :class="`tone--${tile.tone}`" aria-hidden="true"><AssetIcon :name="tile.icon" :size="17" /></span>
        <span class="ia-tile__text">
          <span class="ia-tile__label">{{ tile.label }}</span>
          <span class="ia-tile__num">{{ firstLoad ? '–' : tile.count }}</span>
          <span class="ia-tile__sub">today</span>
        </span>
      </div>
    </section>

    <section class="ia-panel">
      <div class="ia-toolbar">
        <label class="ia-search">
          <AssetIcon name="search" :size="15" class="ia-search__icon" />
          <input
            v-model="search"
            type="search"
            class="ia-search__input"
            placeholder="Search bag, request, patient or staff…"
            aria-label="Search by bag number, request reference, patient or staff name"
          >
        </label>
        <div class="ia-range" role="group" aria-label="Quick dates">
          <button
            v-for="preset in PRESETS"
            :key="preset.key"
            type="button"
            class="ia-range__btn"
            :class="{ 'ia-range__btn--on': activePreset === preset.key }"
            :aria-pressed="activePreset === preset.key"
            @click="applyPreset(preset.key)"
          >
            {{ preset.label }}
          </button>
        </div>
        <DateRangeFilter v-model:from="fromDate" v-model:to="toDate" aria-label="Filter by date" />
        <SelectField v-model="bloodType" class="ia-sel" size="sm" aria-label="Filter by blood type"
          :options="[{ value: '', label: 'All groups' }, ...bloodTypeOptions]" />
        <SelectField v-model="component" class="ia-sel ia-sel--wide" size="sm" aria-label="Filter by component"
          :options="[{ value: '', label: 'All components' }, ...componentOptions]" />
      </div>

      <!-- What happened: the groups with how many each holds, and one list for a single type. -->
      <div class="ia-kinds">
        <div class="ia-groups" role="group" aria-label="Show">
          <button
            v-for="g in GROUP_CHIPS"
            :key="g.key"
            type="button"
            class="ia-kind"
            :class="{ 'ia-kind--on': group === g.key }"
            :aria-pressed="group === g.key"
            @click="setGroup(g.key)"
          >
            {{ g.label }}
            <span class="ia-kind__count">{{ groupCount(g.key) }}</span>
          </button>
        </div>
        <SelectField v-model="kind" class="ia-sel ia-sel--type" size="sm" aria-label="Filter by type" :options="typeOptions" />
      </div>

      <p v-if="error" class="ia-error" role="alert">{{ error }}</p>

      <div v-if="firstLoad" class="ia-body"><SkeletonList :rows="6" /></div>

      <div v-else-if="!shown.length" class="ia-empty">
        <span class="ia-empty__icon" aria-hidden="true"><AssetIcon name="activity" :size="22" /></span>
        <p class="ia-empty__title">{{ filtered ? 'Nothing matches' : 'No history yet' }}</p>
        <p class="ia-empty__text">{{ filtered ? 'Try other dates, another category or clear the search.' : canSeeStock ? 'Your patient requests and weekly restock, and what became of the bags they brought, appear here.' : 'Your patient requests and weekly restock appear here.' }}</p>
        <button v-if="filtered" type="button" class="btn-outline btn-outline--sm" @click="clearFilters">Clear filters</button>
      </div>

      <div v-else class="ia-body">
        <section v-for="day in days" :key="day.date" class="ia-day" :aria-label="day.label">
          <h2 class="ia-day__label">
            {{ day.label }}
            <span class="ia-day__count">{{ day.rows.length }}</span>
          </h2>
          <ol class="ia-list">
            <li
              v-for="row in day.rows"
              :key="row.key"
              class="ia-row"
              tabindex="0"
              :aria-label="`Open ${kindMeta(row.kind).label}: ${row.bag_number || row.reference || ''}`"
              @click="opened = row"
              @keydown.enter.self="opened = row"
            >
              <span class="ia-row__icon" :class="`tone--${kindMeta(row.kind).tone}`" aria-hidden="true">
                <AssetIcon :name="kindMeta(row.kind).icon" :size="16" />
              </span>
              <span class="ia-row__main">
                <span class="ia-row__title">
                  {{ kindMeta(row.kind).label }}
                  <span v-if="row.source === 'request'" class="ia-row__tag">Request</span>
                  <span v-if="row.source === 'weekly'" class="ia-row__tag">Weekly</span>
                  <span v-if="row.emergency" class="ia-row__tag ia-row__tag--crit">STAT</span>
                </span>
                <span class="ia-row__meta">
                  <span v-if="row.bag_number" class="mono">{{ row.bag_number }}</span>
                  <span v-if="row.reference" class="mono">{{ row.reference }}</span>
                  <span v-if="row.blood_type" class="ia-row__type">{{ row.blood_type }}</span>
                  <span v-if="row.component">{{ row.component }}</span>
                  <span v-if="row.patient"><AssetIcon name="user" :size="12" />{{ row.patient }}</span>
                  <span v-if="row.center"><AssetIcon name="building-2" :size="12" />{{ row.center }}</span>
                  <span v-if="row.detail">{{ row.detail }}</span>
                </span>
              </span>
              <span class="ia-row__end">
                <time :datetime="row.at">{{ timeLabel(row.at) }}</time>
                <span>{{ row.actor || (row.source !== 'stock' ? (row.requested_by ? `by ${row.requested_by}` : '') : 'System') }}</span>
              </span>
              <AssetIcon name="chevron-right" :size="16" class="ia-row__go" />
            </li>
          </ol>
        </section>

        <div v-if="shown.length < afterKind.length" class="ia-more">
          <button type="button" class="btn-outline btn-outline--sm" @click="limit += PAGE">
            Show more ({{ afterKind.length - shown.length }} left)
          </button>
        </div>
      </div>

      <footer class="ia-foot">
        <span>{{ afterKind.length }} event(s)<template v-if="loading"> · loading older activity…</template></span>
        <span v-if="!loading && capped" class="ia-foot__note">Showing the latest {{ stockCount }} bag movements.</span>
      </footer>
    </section>

    <!-- One event, opened: the bag or the request now, and all that happened to it. -->
    <HospitalRequestHistoryEventDetail v-if="opened" :event="opened" :request-kinds="REQUEST_KINDS" @close="opened = null" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import SelectField from '~/components/common/SelectField.vue'
import DateRangeFilter from '~/components/common/DateRangeFilter.vue'
import SkeletonList from '~/components/ui/SkeletonList.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import HospitalRequestHistoryEventDetail from '~/components/Hospital/RequestHistoryEventDetail.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import { hospitalActivityKindMeta } from '~/utils/hospitalInventoryDashboard'
import { hospitalPageSubtitle } from '~/utils/hospitalPageSubtitles'
import { bloodTypeCodes, componentSummary } from '~/types/bloodRequest'
import { onPageReturn } from '~/composables/useKeptAlive'

/**
 * The blood bank's Request History (project owner, 2026-11-26): laid out as
 * the blood centre's Inventory History, named for what a blood bank follows,
 * its own requests, with what became of the bags they brought. Filtered by
 * what happened, when, blood type and component. Its contents:
 *  - every bag movement here (GET /hospital/inventory/activity, 50 a page):
 *    arrived, stocked in, tagged, crossmatched, transfused, tag released,
 *    reserved for a partner, back in storage, discarded, expired;
 *  - this blood bank's patient requests (GET /hospital/transfusion-requests)
 *    as the moments their list rows carry: sent, units approved, dispatched,
 *    delivery received (step_times), cancelled or rejected.
 * The filters run here, over what was loaded (the latest 1,000 movements).
 */

// Either ability opens it: requesting staff see their requests, inventory
// staff the bags, the Head both (project owner, 2026-11-26).
definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard', requires: ['hospital.requests.view', 'hospital.inventory.view'], keepalive: true })

const { can } = useUser()
const canSeeRequests = computed(() => can('hospital.requests.view'))
// The bags' movements are inventory's to read; without it, the requests alone.
const canSeeStock = computed(() => can('hospital.inventory.view'))

const STOCK_PAGES = 20
const STOCK_PER_PAGE = 50
const REQUEST_PER_PAGE = 100
const PAGE = 60

// A patient request's moments, from the hospital's side of it.
const REQUEST_KINDS = {
  request_sent: { label: 'Request Sent', icon: 'send', tone: 'neutral' },
  request_approved: { label: 'Units Approved', icon: 'check-circle', tone: 'neutral' },
  request_dispatched: { label: 'Units Dispatched', icon: 'truck', tone: 'neutral' },
  request_received: { label: 'Delivery Received', icon: 'package-check', tone: 'success' },
  request_cancelled: { label: 'Request Cancelled', icon: 'circle-x', tone: 'neutral' },
  request_rejected: { label: 'Request Rejected', icon: 'circle-x', tone: 'danger' },
  // A weekly restock's moments (2026-11-26).
  weekly_sent: { label: 'Weekly Request Sent', icon: 'calendar-check', tone: 'neutral' },
  weekly_confirmed: { label: 'Weekly Order Confirmed', icon: 'check-circle', tone: 'neutral' },
  weekly_dispatched: { label: 'Weekly Delivery Dispatched', icon: 'truck', tone: 'neutral' },
  weekly_received: { label: 'Weekly Delivery Received', icon: 'package-check', tone: 'success' },
}

// The requests first, as the page is named for them; then the bags they brought.
const KIND_GROUPS = computed(() => [
  ...(canSeeRequests.value
    ? [
        { key: 'requests', label: 'Patient requests', kinds: Object.keys(REQUEST_KINDS).filter((k) => k.startsWith('request_')) },
        { key: 'weekly', label: 'Weekly restock', kinds: Object.keys(REQUEST_KINDS).filter((k) => k.startsWith('weekly_')) },
      ]
    : []),
  ...(canSeeStock.value
    ? [
        { key: 'in', label: 'Bags in', kinds: ['received', 'stocked', 'returned'] },
        { key: 'patients', label: 'Tagged & transfused', kinds: ['tagged', 'crossmatched', 'untagged', 'transfused'] },
        { key: 'lost', label: 'Discarded & expired', kinds: ['discarded', 'expired'] },
        { key: 'partner', label: 'Reservations', kinds: ['reserved', 'unreserved'] },
      ]
    : []),
])

const GROUP_CHIPS = computed(() => [{ key: '', label: 'All' }, ...KIND_GROUPS.value])
const group = ref('')

function kindsOf(key) {
  return KIND_GROUPS.value.find((g) => g.key === key)?.kinds ?? null
}

function groupCount(key) {
  const kinds = kindsOf(key)
  return kinds ? kinds.reduce((sum, k) => sum + (kindCounts.value[k] ?? 0), 0) : baseFiltered.value.length
}

function setGroup(key) {
  group.value = group.value === key ? '' : key
  // A type from another group no longer fits.
  if (kind.value && group.value && !kindsOf(group.value).includes(kind.value)) kind.value = ''
}

// The types of the chosen group (or all), each with its count.
const typeOptions = computed(() => [
  { value: '', label: group.value ? `All ${GROUP_CHIPS.value.find((g) => g.key === group.value)?.label.toLowerCase()}` : 'All types' },
  ...(kindsOf(group.value) ?? KIND_GROUPS.value.flatMap((g) => g.kinds))
    .map((k) => ({ value: k, label: `${kindMeta(k).label} (${kindCounts.value[k] ?? 0})` })),
])

function kindMeta(kind) {
  return REQUEST_KINDS[kind] ?? hospitalActivityKindMeta(kind)
}

const events = ref([])
// The event opened in the detail dialog.
const opened = ref(null)
const loading = ref(false)
const firstLoad = ref(true)
const error = ref('')
const capped = ref(false)
const stockCount = ref(0)

const search = ref('')
const fromDate = ref('')
const toDate = ref('')
const bloodType = ref('')
const component = ref('')
const kind = ref('')
const limit = ref(PAGE)

const bloodTypeOptions = ref([])
const componentOptions = ref([])

// ── loading ──

let requestEvents = []
let stockEvents = []

function merge() {
  events.value = [...stockEvents, ...requestEvents].sort((a, b) => String(b.at).localeCompare(String(a.at)))
}

async function loadStock() {
  if (!canSeeStock.value) return []
  const out = []
  for (let page = 1; page <= STOCK_PAGES; page++) {
    const res = await hospitalService.inventoryActivity({ page, per_page: STOCK_PER_PAGE })
    for (const item of res?.data ?? []) {
      out.push({
        key: `s-${item.id}`,
        source: 'stock',
        kind: item.kind,
        at: item.at,
        unit_id: item.unit_id,
        bag_number: item.bag_number || item.unit_id,
        blood_type: item.blood_type,
        component: item.component,
        actor: item.actor,
      })
    }
    // The first page shows at once; the rest follow.
    if (page === 1) { stockEvents = [...out]; merge(); firstLoad.value = false }
    const last = res?.last_page ?? page
    if (page >= last) return out
    if (page === STOCK_PAGES) capped.value = true
  }
  return out
}

/** Each patient request as the moments it carries. */
async function loadRequests() {
  if (!canSeeRequests.value) return []
  const res = await hospitalService.listTransfusionRequests({ per_page: REQUEST_PER_PAGE })
  const out = []
  for (const r of res?.data ?? []) {
    const units = r.totals?.required ?? 0
    const base = {
      source: 'request',
      raw: r,
      request_id: r.id,
      reference: r.reference_number,
      patient: r.patient?.full_name || '',
      blood_type: r.blood_type?.code || '',
      component: componentSummary({ items: r.lines ?? [] }).replace(/^—$/, ''),
      units_label: units ? `${units} unit${units === 1 ? '' : 's'}` : '',
      detail: units ? `${units} unit${units === 1 ? '' : 's'}` : '',
      emergency: Boolean(r.is_emergency),
      status_label: r.status_label || '',
      facilities: (r.facilities ?? []).join(', '),
      requested_by: r.requester_name || (r.is_walk_in ? 'Walk-in' : ''),
    }
    const times = r.step_times ?? {}
    const push = (kind, at, extra = {}) => { if (at) out.push({ ...base, ...extra, key: `r-${r.id}-${kind}`, kind, at }) }
    push('request_sent', r.request_date)
    push('request_approved', times.approved)
    push('request_dispatched', times.released)
    push('request_received', times.received)
    if (r.status === 'cancelled') push('request_cancelled', r.cancelled_at)
    if (r.status === 'rejected') push('request_rejected', r.closed_at)
  }
  return out
}

/** Each weekly restock as the moments it carries: sent, confirmed, dispatched, received. */
async function loadWeekly() {
  if (!canSeeRequests.value) return []
  const res = await hospitalService.weeklyRequests({ per_page: REQUEST_PER_PAGE })
  const out = []
  for (const w of res?.data ?? []) {
    const units = w.totals?.requested ?? 0
    const lines = (w.requests ?? []).flatMap((r) => r.items ?? [])
    const base = {
      source: 'weekly',
      raw: w,
      weekly_id: w.id,
      reference: w.reference_number,
      center: w.target_facility?.name || '',
      blood_type: [...new Set((w.requests ?? []).flatMap((r) => bloodTypeCodes(r)))].join(', '),
      component: [...new Set(lines.map((i) => i.component?.name).filter(Boolean))].join(', '),
      detail: units ? `${units} unit${units === 1 ? '' : 's'}` : '',
      status_label: w.status_label || '',
      requested_by: w.requester_name || '',
    }
    const times = w.step_times ?? {}
    const push = (kind, at) => { if (at) out.push({ ...base, key: `w-${w.id}-${kind}`, kind, at }) }
    push('weekly_sent', w.submitted_at)
    push('weekly_confirmed', times.confirmed)
    push('weekly_dispatched', times.released)
    push('weekly_received', times.received)
  }
  return out
}

async function loadReference() {
  try {
    const res = await hospitalService.referenceData()
    bloodTypeOptions.value = (res?.blood_types ?? []).map((t) => ({ value: t.code, label: t.code }))
    componentOptions.value = (res?.components ?? []).map((c) => ({ value: c.name, label: c.name }))
  } catch { /* the filters stay at All */ }
}

async function loadAll() {
  loading.value = true
  error.value = ''
  capped.value = false
  try {
    const [stock, requests, weekly] = await Promise.all([
      loadStock(),
      loadRequests().catch(() => []),
      loadWeekly().catch(() => []),
    ])
    stockEvents = stock
    requestEvents = [...requests, ...weekly]
    stockCount.value = stock.length
    merge()
  } catch (err) {
    error.value = err?.message || 'Activity could not be loaded.'
  } finally {
    loading.value = false
    firstLoad.value = false
  }
}

onMounted(() => {
  loadReference()
  loadAll()
})
onPageReturn(() => loadAll())

// ── filtering ──

function isoDay(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const todayIso = isoDay(new Date())

// Everything but the category: the category chips count under these.
const baseFiltered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return events.value.filter((e) => {
    const day = isoDay(e.at)
    if (fromDate.value && day < fromDate.value) return false
    if (toDate.value && day > toDate.value) return false
    if (bloodType.value && !String(e.blood_type ?? '').split(', ').includes(bloodType.value)) return false
    if (component.value && !String(e.component ?? '').split(', ').includes(component.value)) return false
    if (q && ![e.bag_number, e.unit_id, e.reference, e.actor, e.component, e.patient, e.center, e.requested_by].some((v) => String(v ?? '').toLowerCase().includes(q))) return false
    return true
  })
})

const kindCounts = computed(() => {
  const counts = {}
  for (const e of baseFiltered.value) counts[e.kind] = (counts[e.kind] ?? 0) + 1
  return counts
})

const afterKind = computed(() => {
  if (kind.value) return baseFiltered.value.filter((e) => e.kind === kind.value)
  const kinds = kindsOf(group.value)
  return kinds ? baseFiltered.value.filter((e) => kinds.includes(e.kind)) : baseFiltered.value
})
const shown = computed(() => afterKind.value.slice(0, limit.value))
const filtered = computed(() => Boolean(search.value.trim() || fromDate.value || toDate.value || bloodType.value || component.value || kind.value || group.value))

watch([search, fromDate, toDate, bloodType, component, kind, group], () => { limit.value = PAGE })

function clearFilters() {
  search.value = ''
  fromDate.value = ''
  toDate.value = ''
  bloodType.value = ''
  component.value = ''
  kind.value = ''
  group.value = ''
}

// ── quick dates ──

const PRESETS = [
  { key: 'today', label: 'Today', days: 0 },
  { key: '7', label: '7 days', days: 6 },
  { key: '30', label: '30 days', days: 29 },
]

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return isoDay(d)
}

const activePreset = computed(() => {
  if (toDate.value !== todayIso) return ''
  return PRESETS.find((p) => fromDate.value === daysAgo(p.days))?.key ?? ''
})

function applyPreset(key) {
  if (activePreset.value === key) {
    fromDate.value = ''
    toDate.value = ''
    return
  }
  const preset = PRESETS.find((p) => p.key === key)
  fromDate.value = daysAgo(preset.days)
  toDate.value = todayIso
}

// ── today's tiles ──

const todayTiles = computed(() => {
  const today = events.value.filter((e) => isoDay(e.at) === todayIso)
  const count = (kinds) => today.filter((e) => kinds.includes(e.kind)).length
  // Requests first: what went out, what came back; then what became of the bags.
  return [
    ...(canSeeRequests.value
      ? [
          { key: 'sent', label: 'Requests sent', icon: 'send', tone: 'neutral', count: count(['request_sent', 'weekly_sent']) },
          { key: 'received', label: 'Deliveries received', icon: 'truck', tone: 'success', count: count(['request_received', 'weekly_received']) },
        ]
      : []),
    ...(canSeeStock.value
      ? [
          { key: 'transfused', label: 'Transfused', icon: 'blood-drop', tone: 'neutral', count: count(['transfused']) },
          { key: 'lost', label: 'Discarded or expired', icon: 'trash-2', tone: 'danger', count: count(['discarded', 'expired']) },
        ]
      : [
          // Requests alone: what is still on its way, in place of the bags' tiles.
          { key: 'approved', label: 'Units approved', icon: 'check-circle', tone: 'neutral', count: count(['request_approved', 'weekly_confirmed']) },
          { key: 'dispatched', label: 'Dispatched', icon: 'truck', tone: 'neutral', count: count(['request_dispatched', 'weekly_dispatched']) },
        ]),
  ]
})

// ── by day ──

const days = computed(() => {
  const groups = []
  for (const row of shown.value) {
    const date = isoDay(row.at)
    const last = groups[groups.length - 1]
    if (last && last.date === date) last.rows.push(row)
    else groups.push({ date, label: dayLabel(date), rows: [row] })
  }
  return groups
})

function dayLabel(iso) {
  if (iso === todayIso) return 'Today'
  if (iso === daysAgo(1)) return 'Yesterday'
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function timeLabel(value) {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
</script>

<style scoped>
/* The blood centre's Inventory History look (pages/blood-center/inventory-history.vue). */
.ia {
  max-width: var(--rb-content-max, 1600px);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  font-family: var(--rb-font-sans);
  color: var(--rb-text-primary);
}

.btn-outline {
  display: inline-flex; align-items: center; gap: 7px; height: 36px; padding: 0 14px; border: 1px solid var(--rb-border-strong); border-radius: 10px;
  background: var(--rb-surface); font: inherit; font-size: 13px; font-weight: 600; color: var(--rb-text-primary); cursor: pointer;
}
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn-outline:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-outline:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.btn-outline--sm { height: 30px; padding: 0 11px; font-size: 12px; border-radius: 8px; }
.spin { animation: ia-spin 0.9s linear infinite; }
@keyframes ia-spin { to { transform: rotate(360deg); } }

/* Today */
.ia-today { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.ia-tile { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 1px solid var(--rb-border); border-radius: 14px; background: var(--rb-surface); }
.ia-tile__icon { display: grid; flex-shrink: 0; place-items: center; width: 38px; height: 38px; border-radius: 11px; background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); }
.ia-tile__icon.tone--danger { background: rgba(var(--rb-accent-rgb), 0.1); color: var(--rb-accent-text); }
.ia-tile__icon.tone--success { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); }
.ia-tile__text { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 6px; }
.ia-tile__label { flex-basis: 100%; font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); }
.ia-tile__num { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.ia-tile__sub { font-size: 12px; color: var(--rb-text-muted); }

/* Panel */
.ia-panel { border: 1px solid var(--rb-border); border-radius: 16px; background: var(--rb-surface); }
.ia-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 14px 18px 10px; }
.ia-search { position: relative; flex: 1 1 260px; max-width: 360px; }
.ia-search__icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--rb-text-muted); pointer-events: none; }
.ia-search__input {
  box-sizing: border-box; width: 100%; height: 36px; padding: 0 12px 0 34px; border: 1px solid var(--rb-border-strong); border-radius: 10px;
  background: var(--rb-surface); font: inherit; font-size: 13px; color: var(--rb-text-primary);
}
.ia-search__input::placeholder { color: var(--rb-placeholder); }
.ia-search__input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }
.ia-range { display: inline-flex; gap: 3px; padding: 3px; border: 1px solid var(--rb-border); border-radius: 10px; background: var(--rb-surface-alt); }
.ia-range__btn { height: 28px; padding: 0 10px; border: 0; border-radius: 7px; background: none; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); cursor: pointer; }
.ia-range__btn--on { background: var(--rb-surface); color: var(--rb-primary-text); box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.12); }
.ia-range__btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.ia-sel { width: 140px; }
.ia-sel--wide { width: 190px; }

.ia-kinds { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding: 0 18px 14px; border-bottom: 1px solid var(--rb-border); }
.ia-groups { display: flex; flex-wrap: wrap; gap: 8px; }
.ia-sel--type { width: 230px; }
.ia-kind {
  display: inline-flex; align-items: center; gap: 7px; padding: 3px 5px 3px 11px; border: 1px solid var(--rb-border-strong); border-radius: 999px;
  background: var(--rb-surface); font: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); cursor: pointer;
}
.ia-kind:hover { color: var(--rb-text-primary); border-color: var(--rb-border-hover); }
.ia-kind:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.ia-kind--on { opacity: 1; border-color: rgba(var(--rb-primary-rgb), 0.5); background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); }
.ia-kind__count { min-width: 22px; padding: 1px 7px; border-radius: 999px; background: var(--rb-surface-alt); font-size: 11.5px; font-weight: 700; line-height: 1.5; text-align: center; font-variant-numeric: tabular-nums; }
.ia-kind--on .ia-kind__count { background: rgba(var(--rb-primary-rgb), 0.14); }

.ia-error { margin: 12px 18px 0; padding: 10px 12px; border-radius: 10px; background: rgba(var(--rb-accent-rgb), 0.06); color: var(--rb-accent-text); font-size: 13px; }

/* By day */
.ia-body { padding: 4px 18px 12px; }
.ia-body > .sk-list { padding-top: 14px; }
.ia-day__label {
  position: sticky; top: 64px; z-index: 1; display: flex; align-items: center; gap: 8px; margin: 0; padding: 14px 0 6px; background: var(--rb-surface);
  font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--rb-text-secondary);
}
.ia-day__count { padding: 0 7px; border-radius: 999px; background: var(--rb-surface-alt); font-size: 11px; color: var(--rb-text-muted); }
.ia-list { margin: 0; padding: 0; list-style: none; }
.ia-row { display: flex; align-items: center; gap: 12px; padding: 12px 10px; margin: 0 -10px; border-radius: 10px; cursor: pointer; transition: background 0.12s ease; }
.ia-row:hover { background: rgba(var(--rb-primary-rgb), 0.05); }
.ia-row:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: -2px; }
.ia-row__go { flex-shrink: 0; color: var(--rb-text-muted); }
.ia-row:hover .ia-row__go { color: var(--rb-primary-text); }
.ia-row__tag--crit { border-color: rgba(var(--rb-accent-rgb), 0.4); color: var(--rb-accent-text); }
.ia-row__meta > span { display: inline-flex; align-items: center; gap: 4px; }
.ia-row__meta :deep(svg) { color: var(--rb-text-muted); }
.ia-row + .ia-row { border-top: 1px solid var(--rb-border); }
.ia-row__icon { display: grid; flex-shrink: 0; place-items: center; width: 34px; height: 34px; border-radius: 10px; background: var(--rb-surface-alt); color: var(--rb-text-secondary); }
.ia-row__icon.tone--danger { background: rgba(var(--rb-accent-rgb), 0.1); color: var(--rb-accent-text); }
.ia-row__icon.tone--success { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); }
.ia-row__main { flex: 1; min-width: 0; }
.ia-row__title { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 700; }
.ia-row__tag { padding: 0 7px; border-radius: 999px; border: 1px solid var(--rb-border); font-size: 10.5px; font-weight: 700; color: var(--rb-text-secondary); }
.ia-row__meta { display: flex; flex-wrap: wrap; gap: 2px 12px; margin-top: 2px; font-size: 12.5px; color: var(--rb-text-secondary); }
.ia-row__type { font-weight: 700; color: var(--rb-text-primary); }
.mono { font-family: var(--rb-font-mono); font-size: 12px; }
.ia-row__end { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; font-size: 12px; color: var(--rb-text-secondary); white-space: nowrap; }
.ia-row__end time { font-weight: 700; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }

.ia-more { display: flex; justify-content: center; padding: 12px 0 4px; }
.ia-foot { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--rb-border); font-size: 12.5px; color: var(--rb-text-secondary); }
.ia-foot__note { color: var(--rb-text-muted); }

.ia-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 48px 16px; text-align: center; }
.ia-empty__icon { display: grid; place-items: center; width: 52px; height: 52px; margin-bottom: 4px; border-radius: 16px; background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); box-shadow: 0 0 0 6px rgba(var(--rb-primary-rgb), 0.04); }
.ia-empty__title { margin: 0; font-size: 14px; font-weight: 700; }
.ia-empty__text { margin: 0 0 6px; font-size: 12.5px; color: var(--rb-text-secondary); }

@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
</style>
