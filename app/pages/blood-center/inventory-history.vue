<template>
  <div class="ia">
    <header class="ia__head">
      <h1 class="ia__title">Inventory History</h1>
      <button type="button" class="btn-outline" :disabled="loading" @click="loadAll">
        <AssetIcon name="refresh-cw" :size="14" :class="{ spin: loading }" />
        Refresh
      </button>
    </header>

    <!-- Today at a glance: what went out, what came in, what was lost, what was fulfilled. -->
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
            placeholder="Search unit, request, hospital or staff…"
            aria-label="Search by unit ID, request reference, hospital or staff name"
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

      <!-- What happened: five groups with how many each holds, and one list for a single type. -->
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
        <p class="ia-empty__title">{{ filtered ? 'Nothing matches' : 'No activity yet' }}</p>
        <p class="ia-empty__text">{{ filtered ? 'Try other dates, another category or clear the search.' : 'Stock movements and request updates appear here.' }}</p>
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
              :aria-label="`Open ${kindMeta(row.kind).label}: ${row.unit_id || row.reference || ''}`"
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
                  <span v-if="row.emergency" class="ia-row__tag ia-row__tag--crit">Emergency</span>
                  <span v-if="row.status_label" class="ia-row__tag">{{ row.status_label }}</span>
                </span>
                <span class="ia-row__meta">
                  <span v-if="row.unit_id" class="mono">{{ row.unit_id }}</span>
                  <span v-if="row.reference" class="mono">{{ row.reference }}</span>
                  <span v-if="row.blood_type" class="ia-row__type">{{ row.blood_type }}</span>
                  <span v-if="row.component">{{ row.component }}</span>
                  <span v-if="row.hospital" class="ia-row__hosp"><AssetIcon name="hospital" :size="12" />{{ row.hospital }}</span>
                  <span v-if="row.patient"><AssetIcon name="users" :size="12" />{{ row.patient }}</span>
                  <span v-if="row.detail">{{ row.detail }}</span>
                </span>
              </span>
              <span class="ia-row__end">
                <time :datetime="row.at">{{ timeLabel(row.at) }}</time>
                <span>{{ row.actor || (row.source === 'request' ? (row.requested_by ? `by ${row.requested_by}` : '') : 'System') }}</span>
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
        <span v-if="!loading && capped" class="ia-foot__note">Showing the latest {{ events.length }} events.</span>
      </footer>
    </section>

    <!-- One event, opened: the unit or the request now, and all that happened to it. -->
    <InventoryEventDetail v-if="opened" :event="opened" :request-kinds="REQUEST_KINDS" @close="opened = null" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import SelectField from '~/components/common/SelectField.vue'
import DateRangeFilter from '~/components/common/DateRangeFilter.vue'
import SkeletonList from '~/components/ui/SkeletonList.vue'
import InventoryEventDetail from '~/components/BloodCenter/InventoryEventDetail.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { activityKindMeta } from '~/utils/inventoryDashboard'
import { onPageReturn } from '~/composables/useKeptAlive'

/**
 * Inventory History (project owner, 2026-11-11): everything that moved, on
 * one page, filtered by what happened, when, blood type and component.
 *
 * Read from the client only, from what the server already sends:
 *  - every stock movement (GET /inventory/activity, 50 a page), complete;
 *  - the requests addressed to this centre (GET /blood-requests) as the
 *    moments they carry: reviewed, fulfilled, closed. A request has no
 *    submitted time on its list row, so a new one shows once reviewed.
 * The filters run here, over what was loaded (the latest 1,000 movements).
 */

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'inventory.view',
  keepalive: true,
})

const { can } = useUser()
const canSeeRequests = computed(() => can('requests.view'))

const STOCK_PAGES = 20
const STOCK_PER_PAGE = 50
const REQUEST_PAGES = 5
const PAGE = 60

const REQUEST_KINDS = {
  request_reviewed: { label: 'Request Reviewed', icon: 'clipboard-list', tone: 'neutral' },
  request_fulfilled: { label: 'Request Fulfilled', icon: 'circle-check-big', tone: 'success' },
  request_closed: { label: 'Request Closed', icon: 'circle-x', tone: 'neutral' },
}

const KIND_GROUPS = computed(() => [
  { key: 'out', label: 'Out', kinds: ['issued', 'discarded', 'expired'] },
  { key: 'in', label: 'In', kinds: ['booked_in', 'released', 'reinstated', 'hold_returned'] },
  { key: 'holds', label: 'Holds & edits', kinds: ['reserved', 'updated'] },
  ...(canSeeRequests.value ? [{ key: 'requests', label: 'Requests', kinds: Object.keys(REQUEST_KINDS) }] : []),
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
  return REQUEST_KINDS[kind] ?? activityKindMeta(kind)
}

const events = ref([])
// The event opened in the detail dialog.
const opened = ref(null)
const loading = ref(false)
const firstLoad = ref(true)
const error = ref('')
const capped = ref(false)

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

async function loadStock() {
  const out = []
  for (let page = 1; page <= STOCK_PAGES; page++) {
    const res = await bloodCenterService.inventoryActivity({ page, per_page: STOCK_PER_PAGE })
    for (const item of res?.data ?? []) {
      out.push({
        key: `s-${item.id}`,
        source: 'stock',
        kind: item.kind,
        at: item.at,
        unit_id: item.unit_id,
        blood_type: item.blood_type,
        component: item.component,
        actor: item.actor,
      })
    }
    // The first page shows at once; the rest follow.
    if (page === 1) { mergeStock(out); firstLoad.value = false }
    const last = res?.last_page ?? page
    if (page >= last) return out
    if (page === STOCK_PAGES) capped.value = true
  }
  return out
}

let requestEvents = []
let stockEvents = []

function mergeStock(list) {
  stockEvents = [...list]
  events.value = [...stockEvents, ...requestEvents].sort((a, b) => String(b.at).localeCompare(String(a.at)))
}

async function loadRequests() {
  if (!canSeeRequests.value) return []
  const out = []
  for (let page = 1; page <= REQUEST_PAGES; page++) {
    const res = await bloodCenterService.incomingRequests({ page, per_page: 100 })
    for (const r of res?.data ?? []) {
      const base = {
        source: 'request',
        reference: r.reference_number,
        hospital: r.requesting_facility?.name,
        blood_type: (r.blood_types ?? []).join(', ') || r.blood_type?.code,
        component: (r.items ?? []).map((i) => i.component?.name).filter(Boolean).join(', '),
        detail: r.quantity ? `${r.quantity} unit${r.quantity === 1 ? '' : 's'}` : '',
        request_id: r.id,
        status_label: r.status_label || '',
        emergency: Boolean(r.is_emergency),
        patient: r.patient?.full_name || '',
        requested_by: r.requester_name || (r.is_walk_in ? 'Walk-in' : ''),
      }
      if (r.reviewed_at) out.push({ ...base, key: `r-${r.id}-rev`, kind: 'request_reviewed', at: r.reviewed_at })
      if (r.fulfilled_at) out.push({ ...base, key: `r-${r.id}-ful`, kind: 'request_fulfilled', at: r.fulfilled_at })
      if (r.closed_at && !r.fulfilled_at) {
        out.push({ ...base, key: `r-${r.id}-clo`, kind: 'request_closed', at: r.closed_at, detail: [base.detail, r.status_label].filter(Boolean).join(' · ') })
      }
    }
    if (page >= (res?.last_page ?? page)) break
  }
  return out
}

async function loadReference() {
  try {
    const res = await bloodCenterService.referenceData()
    bloodTypeOptions.value = (res?.blood_types ?? []).map((t) => ({ value: t.code, label: t.code }))
    componentOptions.value = (res?.components ?? []).map((c) => ({ value: c.name, label: c.name }))
  } catch { /* the filters stay at All */ }
}

async function loadAll() {
  loading.value = true
  error.value = ''
  capped.value = false
  try {
    const [stock, requests] = await Promise.all([
      loadStock(),
      loadRequests().catch(() => []),
    ])
    requestEvents = requests
    mergeStock(stock)
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
    if (q && ![e.unit_id, e.reference, e.hospital, e.actor, e.component, e.patient, e.requested_by].some((v) => String(v ?? '').toLowerCase().includes(q))) return false
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
  return [
    { key: 'issued', label: 'Issued', icon: 'send', tone: 'neutral', count: count(['issued']) },
    { key: 'in', label: 'Booked in', icon: 'circle-plus', tone: 'neutral', count: count(['booked_in', 'released']) },
    { key: 'lost', label: 'Discarded or expired', icon: 'trash-2', tone: 'danger', count: count(['discarded', 'expired']) },
    ...(canSeeRequests.value ? [{ key: 'fulfilled', label: 'Requests fulfilled', icon: 'circle-check-big', tone: 'success', count: count(['request_fulfilled']) }] : []),
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
.ia__head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.ia__title { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }

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
