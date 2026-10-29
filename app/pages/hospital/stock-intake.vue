<template>
  <div class="si-page inv-tones">
    <div class="si-inner">
      <!-- ============ HEADER ============ -->
      <header class="page-head">
        <div>
          <h1 class="page-title">Stock Intake</h1>
          <p class="page-subtitle">Put the bags that arrived onto a shelf: scan each one, give it its storage location, and stock it in.</p>
        </div>
        <div class="page-head__meta">
          <span v-if="lastUpdatedLabel" class="live-note">
            <span class="live-note__dot" aria-hidden="true" />
            Updated {{ lastUpdatedLabel }}
          </span>
          <button type="button" class="btn-outline btn-outline--sm" :disabled="refreshing" @click="refresh()">
            <AssetIcon name="refresh-cw" :size="13" :class="{ 'spin-icon': refreshing }" />
            Refresh
          </button>
        </div>
      </header>

      <p v-if="loadError" class="load-error" role="alert">
        <AssetIcon name="circle-alert" :size="15" />
        <span>{{ loadError }}</span>
        <button type="button" class="link-btn" @click="refresh()">Try again</button>
      </p>

      <!-- ============ KPI ROW ============ -->
      <section class="kpi-row" aria-label="Stock intake at a glance">
        <div v-for="kpi in kpis" :key="kpi.key" class="kpi" :class="`tone--${kpi.tone}`">
          <span class="kpi__icon" aria-hidden="true">
            <AssetIcon :name="kpi.icon" :size="20" />
          </span>
          <span class="kpi__body">
            <span class="kpi__label">{{ kpi.label }}</span>
            <span class="kpi__value">{{ loading ? '—' : kpi.value }}</span>
            <span class="kpi__sub">{{ kpi.sub }}</span>
          </span>
        </div>
      </section>

      <!-- ============ ARRIVED BAGS ============ -->
      <!-- Receiving's second step (project owner, 2026-10-11): bags whose
           arrival was confirmed, or that came from outside RedAgos, wait here
           until inventory staff put them on a shelf. They are not stock until
           then. Its own page since 2026-10-28, apart from Blood Bank Inventory. -->
      <section class="panel" aria-labelledby="arrived-title">
        <header class="panel-head">
          <div>
            <h2 id="arrived-title" class="panel-title">Awaiting Stock-in</h2>
            <p class="panel-subtitle">Scan a fridge's bags, give them its location, stock them in; then the next fridge. A bag cannot be tagged until it is stocked in.</p>
          </div>
          <NuxtLink to="/hospital/inventory" class="btn-outline btn-outline--sm">
            <AssetIcon name="package" :size="13" />
            Blood Bank Inventory
          </NuxtLink>
        </header>

        <div v-if="arrived.length" class="tools">
          <form class="scan-field" @submit.prevent="scanBag">
            <AssetIcon name="scan-line" :size="15" class="scan-field__icon" />
            <input
              ref="scanInput"
              v-model="scanEntry"
              type="text"
              class="text-input text-input--scan mono"
              placeholder="Scan or type a bag number"
              aria-label="Scan a bag to stock in"
              autocomplete="off"
              spellcheck="false"
              autocapitalize="characters"
              maxlength="50"
            />
          </form>
          <p class="scan-note" :class="{ 'scan-note--alert': scanAlert }" aria-live="polite">
            {{ scanNote || `${ticked.length} of ${tickable.length} scanned` }}
          </p>
          <form class="bulk-field" @submit.prevent="applyBulkLocation">
            <input
              v-model="bulkLocation"
              list="si-storage-locations"
              maxlength="100"
              class="text-input"
              placeholder="Location for the scanned bags"
              aria-label="Storage location for the scanned bags"
            />
            <button type="submit" class="btn-outline" :disabled="!bulkLocation.trim() || !ticked.length">Apply</button>
          </form>
        </div>

        <div v-if="loading" class="list-state" aria-busy="true">
          <div class="skeleton skeleton--line" style="width:70%" />
          <div class="skeleton skeleton--line" style="width:90%" />
          <div class="skeleton skeleton--line" style="width:55%" />
        </div>

        <div v-else-if="!arrived.length" class="empty-state">
          <AssetIcon name="package-check" :size="36" />
          <p class="empty-state__title">Nothing awaiting stock-in</p>
          <p class="empty-state__desc">
            Bags appear here once their arrival is confirmed on a blood request, or they are recorded by direct distribution.
          </p>
        </div>

        <div v-else class="table-wrap">
          <table class="unit-table">
            <thead>
              <tr>
                <th class="check-col">
                  <input
                    type="checkbox"
                    :checked="allTicked"
                    :indeterminate.prop="ticked.length > 0 && !allTicked"
                    aria-label="Mark every bag in date, without scanning"
                    @change="toggleAllTicked"
                  />
                </th>
                <th>Bag</th>
                <th>Blood Type</th>
                <th>Component</th>
                <th>Expiry Date</th>
                <th>Remaining Days</th>
                <th>Arrived</th>
                <th>Storage Location</th>
                <th v-if="canDiscard" class="actions-col"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="unit in arrived" :key="unit.id" :class="{ 'row--expired': unit.bag_expired, 'row--scanned': ticked.includes(unit.unit_id) }">
                <td class="check-col">
                  <input
                    v-model="ticked"
                    type="checkbox"
                    :value="unit.unit_id"
                    :disabled="unit.bag_expired"
                    :aria-label="`Tick ${bagLabel(unit)}`"
                  />
                </td>
                <td>
                  <span class="mono">{{ bagLabel(unit) }}</span>
                  <span v-if="unit.source?.reference_number" class="cell-sub">from {{ unit.source.reference_number }}</span>
                  <span v-else-if="unit.source?.direct_distribution" class="cell-sub">from {{ unit.source.direct_distribution.source_name }}</span>
                </td>
                <td><span class="type-chip">{{ displayType(unit.blood_type?.code) }}</span></td>
                <td class="wrap-cell">
                  {{ unit.component?.name || '—' }}
                  <span v-if="unit.volume_ml" class="cell-sub">{{ unit.volume_ml }} mL</span>
                </td>
                <td class="num" :class="{ 'ink-danger': unit.bag_expired }">{{ unit.expiry_date || '—' }}</td>
                <td>
                  <span class="days" :class="[`tone--${remaining(unit).tone}`, { 'days--pill': remaining(unit).tone === 'warning' || remaining(unit).tone === 'danger' }]">{{ remaining(unit).label }}</span>
                </td>
                <td class="num">{{ formatDateTime(unit.received_at) }}</td>
                <td>
                  <input
                    v-if="!unit.bag_expired"
                    v-model="locations[unit.unit_id]"
                    list="si-storage-locations"
                    maxlength="100"
                    class="text-input text-input--cell"
                    placeholder="Optional"
                    :aria-label="`Storage location for ${bagLabel(unit)}`"
                  />
                  <span v-else class="ink-danger">Past its date — discard it</span>
                </td>
                <td v-if="canDiscard" class="actions-col">
                  <button
                    type="button"
                    class="btn-outline btn-outline--sm btn-outline--danger"
                    :disabled="dialogBusy"
                    @click="startDiscard(unit)"
                  >
                    Discard
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <datalist id="si-storage-locations">
            <option v-for="location in storageLocations" :key="location" :value="location" />
          </datalist>
        </div>

        <footer v-if="arrived.length" class="list-foot">
          <p v-if="stockInError" class="list-foot__error" role="alert">{{ stockInError }}</p>
          <p v-else class="list-foot__summary">{{ arrived.length }} bag{{ arrived.length === 1 ? '' : 's' }} awaiting stock-in</p>
          <button type="button" class="btn-primary" :disabled="!ticked.length || stockingIn" @click="stockInTicked">
            <AssetIcon name="package-check" :size="14" />
            {{ stockingIn ? 'Stocking in…' : `Stock in ${ticked.length} scanned bag${ticked.length === 1 ? '' : 's'}` }}
          </button>
        </footer>
      </section>
    </div>

    <HospitalUnitReasonDialog
      v-if="discardTarget"
      :title="`Discard ${bagLabel(discardTarget)}?`"
      label="Why is the bag being discarded?"
      confirm-label="Discard bag"
      icon="trash-2"
      :busy="dialogBusy"
      :error="dialogError"
      @confirm="runDiscard"
      @close="closeDiscard"
    >
      The bag leaves your stock for good. This cannot be undone.
    </HospitalUnitReasonDialog>

    <Teleport to="body">
      <Transition name="toast-fade">
        <div v-if="notice" class="inventory-toast inv-tones" role="status">
          <AssetIcon name="circle-alert" :size="15" />
          <span>{{ notice }}</span>
          <button type="button" class="inventory-toast__close" aria-label="Dismiss" @click="notice = ''">
            <AssetIcon name="x" :size="13" />
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
/**
 * Stock Intake: the hospital blood bank putting arrived bags onto its shelf.
 *
 * Receiving's second step (project owner, 2026-10-11). Confirming receipt, or
 * booking blood from outside RedAgos, leaves a bag awaiting stock-in; here
 * inventory staff scan each bag as they put it away, give the scanned bags
 * their storage location, and stock them in. Only then is a bag stock, free
 * to tag. Moved out of Blood Bank Inventory to a page of its own (project
 * owner, 2026-10-28), as the centre's Stock Intake is.
 */

import AssetIcon from '~/components/common/AssetIcon.vue'
import HospitalUnitReasonDialog from '~/components/Hospital/UnitReasonDialog.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import { UNIT_REFUSAL_MESSAGES } from '~/types/hospitalInventory'
import { hospitalRemainingDaysTag } from '~/utils/hospitalInventoryDashboard'
import { matchStockInScan } from '~/utils/stockIn'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard', requires: 'hospital.inventory.stock_in' })

/*
 * Stock-in is the inventory staff's and the Head's (hospital roles, project
 * owner 2026-10-11); the page itself needs it. The server refuses the
 * endpoints with `can:` either way.
 */
const { can } = useUser()
const canDiscard = computed(() => can('hospital.inventory.discard'))

const loading = ref(true)
const loadError = ref('')
const refreshing = ref(false)
const lastUpdated = ref(null)

const arrived = ref([])
const ticked = ref([])
const locations = reactive({})
const bulkLocation = ref('')
const stockingIn = ref(false)
const stockInError = ref('')
const storageLocations = ref([])

const tickable = computed(() => arrived.value.filter((unit) => !unit.bag_expired).map((unit) => unit.unit_id))
const allTicked = computed(() => tickable.value.length > 0 && tickable.value.every((id) => ticked.value.includes(id)))
const pastDate = computed(() => arrived.value.filter((unit) => unit.bag_expired).length)

const kpis = computed(() => [
  {
    key: 'waiting',
    label: 'Awaiting Stock-in',
    value: arrived.value.length,
    sub: `bag${arrived.value.length === 1 ? '' : 's'} arrived, not yet shelved`,
    icon: 'package',
    tone: 'neutral',
  },
  {
    key: 'scanned',
    label: 'Scanned',
    value: ticked.value.length,
    sub: `of ${tickable.value.length} in date`,
    icon: 'scan-line',
    tone: ticked.value.length ? 'success' : 'neutral',
  },
  {
    key: 'expired',
    label: 'Past Their Date',
    value: pastDate.value,
    sub: pastDate.value ? 'discard rather than stock in' : 'none on arrival',
    icon: 'triangle-alert',
    tone: pastDate.value ? 'danger' : 'muted',
  },
])

async function loadArrived() {
  const page = await hospitalService.inventory({ status: 'received', per_page: 100 })
  arrived.value = page?.data ?? []

  // Nothing is marked until it is scanned (or ticked by hand); a bag no
  // longer waiting drops out of the marks.
  const waiting = new Set(tickable.value)
  ticked.value = ticked.value.filter((id) => waiting.has(id))
}

// Suggestions for the location fields: the configured fridges and freezers,
// and places already used. A convenience; the page works without them.
async function loadLocations() {
  try {
    storageLocations.value = (await hospitalService.inventorySummary())?.storage_locations ?? []
  } catch {
    storageLocations.value = []
  }
}

async function refresh() {
  if (refreshing.value) return
  refreshing.value = true

  try {
    await Promise.all([loadArrived(), loadLocations()])
    loadError.value = ''
    lastUpdated.value = new Date()
  } catch (err) {
    loadError.value = err?.message || 'The arrived bags could not be loaded.'
  } finally {
    refreshing.value = false
    loading.value = false
  }
}

/* SCANNING: each bag's barcode as it is put away marks it for stock-in. */
const scanInput = ref(null)
const scanEntry = ref('')
const scanNote = ref('')
const scanAlert = ref(false)

function scanBag() {
  const code = scanEntry.value
  scanEntry.value = ''
  if (!code.trim()) return

  const result = matchStockInScan(code, arrived.value, ticked.value)
  scanAlert.value = result.kind !== 'scanned'

  if (result.kind === 'scanned') {
    ticked.value = [...ticked.value, result.unitId]
    scanNote.value = `${result.label} scanned — ${ticked.value.length} of ${tickable.value.length}.`
  } else if (result.kind === 'expired') {
    scanNote.value = `${result.code} is past its date. Discard it instead of stocking it in.`
  } else if (result.kind === 'already') {
    scanNote.value = `${result.code} is already scanned.`
  } else {
    scanNote.value = `${result.code} is not awaiting stock-in here.`
  }
}

function toggleAllTicked() {
  ticked.value = allTicked.value ? [] : [...tickable.value]
}

function applyBulkLocation() {
  const location = bulkLocation.value.trim()
  if (!location) return

  for (const id of ticked.value) locations[id] = location
  bulkLocation.value = ''
}

async function stockInTicked() {
  if (!ticked.value.length) return

  stockingIn.value = true
  stockInError.value = ''

  try {
    const response = await hospitalService.stockIn(ticked.value.map((id) => ({
      unit_id: id,
      storage_location: (locations[id] || '').trim() || null,
    })))

    for (const id of ticked.value) delete locations[id]
    ticked.value = []
    scanNote.value = ''
    scanAlert.value = false
    notice.value = response?.message || 'Stocked in.'
    await refresh()

    // Ready for the next fridge's bags.
    nextTick(() => scanInput.value?.focus())
  } catch (err) {
    stockInError.value = err?.status === 422 ? firstError(err) : refusalMessage(err)

    // Someone else stocked one in, or it was discarded: show the list as it stands.
    if (err?.status === 409 || err?.status === 404) await refresh()
  } finally {
    stockingIn.value = false
  }
}

/* DISCARD: a bag that arrived past its date leaves without being stocked. */
const discardTarget = ref(null)
const dialogBusy = ref(false)
const dialogError = ref('')

function startDiscard(unit) {
  discardTarget.value = unit
  dialogError.value = ''
}

function closeDiscard() {
  if (dialogBusy.value) return
  discardTarget.value = null
  dialogError.value = ''
}

async function runDiscard(reason) {
  const unit = discardTarget.value
  if (!unit) return

  dialogBusy.value = true
  dialogError.value = ''

  try {
    const response = await hospitalService.discardUnit(unit.unit_id, reason)
    discardTarget.value = null
    notice.value = response?.message || 'Discarded.'
    await refresh()
  } catch (err) {
    if (err?.status === 409 || err?.status === 404) {
      discardTarget.value = null
      notice.value = refusalMessage(err)
      await refresh()
    } else {
      dialogError.value = err?.status === 422 ? firstError(err) : (err?.message || 'That could not be done. Please try again.')
    }
  } finally {
    dialogBusy.value = false
  }
}

/** Explain a refusal by its code, falling back to the API's own words. */
function refusalMessage(err) {
  const code = err?.data?.code

  return (code && code !== 'invalid_transition' ? err?.data?.message : null)
    || UNIT_REFUSAL_MESSAGES[code]
    || err?.message
    || 'That could not be done.'
}

function firstError(err) {
  const first = Object.values(err?.errors ?? {})[0]

  return (Array.isArray(first) ? first[0] : first) || err?.message || ''
}

// --- Toast ---
const notice = ref('')
let noticeTimer = null
watch(notice, (message) => {
  clearTimeout(noticeTimer)
  if (message) noticeTimer = setTimeout(() => { notice.value = '' }, 6000)
})

// --- Formatting ---
const bagLabel = (unit) => unit.bag_number || unit.unit_id
const remaining = (unit) => hospitalRemainingDaysTag(unit.status, unit.days_remaining)

function displayType(code) {
  // A true minus sign, which reads as "minus" aloud and lines up with the plus.
  return code ? String(code).replace('-', '−') : '—'
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })
}

const lastUpdatedLabel = computed(() => (lastUpdated.value
  ? lastUpdated.value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  : ''))

// Bags confirmed elsewhere show up without a reload: once a minute, while the
// tab is in view and nothing is being stocked in. Marks and typed locations
// survive it.
const POLL_MS = 60_000
let pollTimer = null

onMounted(() => {
  refresh()
  pollTimer = setInterval(() => {
    if (!document.hidden && !stockingIn.value) refresh()
  }, POLL_MS)
})

onBeforeUnmount(() => {
  clearInterval(pollTimer)
  clearTimeout(noticeTimer)
})
</script>

<style scoped>
/* Blood Bank Inventory's quiet look (2026-10-28), itself the centre's Blood
   Inventory's: one surface set apart by hairlines, three greys of ink, and
   green, amber and red for state alone. The dark selector sits whole inside
   :global(), so the tokens never land on <html>. */
.inv-tones {
  --inv-page: var(--rb-page-bg);
  --inv-surface: var(--rb-surface);
  --inv-elevated: var(--rb-surface-alt);
  --inv-hover: var(--rb-surface-hover);
  --inv-border: var(--rb-border-strong);
  --inv-border-soft: var(--rb-border);
  --inv-text: var(--rb-text-primary);
  --inv-muted: var(--rb-text-secondary);
  --inv-faint: var(--rb-text-muted);
  --inv-ok: #15803D;
  --inv-warn: #B45309;
  --inv-crit: #B91C1C;
  --inv-ok-fill: #1BAF7A;
  --inv-warn-fill: #EDA100;
  --inv-crit-fill: #DC2626;
  --inv-action: var(--rb-primary);
  --inv-action-hover: var(--rb-primary-hover);
  --inv-action-text: var(--rb-primary-text);
  --tone: var(--inv-muted);
  --tone-fill: var(--inv-faint);
}
:global(.dark .inv-tones) {
  --inv-border-soft: var(--ink-hover, #263345);
  --inv-ok: #4ADE80;
  --inv-warn: #FBBF24;
  --inv-crit: #F87171;
  --inv-ok-fill: #199E70;
  --inv-warn-fill: #C98500;
  --inv-crit-fill: #EF4444;
  color-scheme: dark;
}
.tone--success { --tone: var(--inv-ok); --tone-fill: var(--inv-ok-fill); }
.tone--warning { --tone: var(--inv-warn); --tone-fill: var(--inv-warn-fill); }
.tone--danger { --tone: var(--inv-crit); --tone-fill: var(--inv-crit-fill); }
.tone--neutral { --tone: var(--inv-muted); --tone-fill: var(--inv-muted); }
.tone--muted { --tone: var(--inv-faint); --tone-fill: var(--inv-faint); }

.si-page {
  font-family: var(--rb-font-sans);
  max-width: var(--rb-content-max, 1600px);
  margin: 0 auto;
  background: var(--inv-page);
  box-shadow: 0 0 0 100vmax var(--inv-page);
  color: var(--inv-text);
  padding: 24px var(--rb-gutter, 24px) 40px;
}
.si-inner { display: flex; flex-direction: column; gap: 16px; container-type: inline-size; container-name: si; }

.inv-tones :is(button, a, input, select, textarea, [tabindex]):focus-visible { outline: 2px solid var(--inv-action-text); outline-offset: 2px; }

/* Header */
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.page-title { font-size: 20px; font-weight: 700; letter-spacing: -0.015em; color: var(--inv-text); margin: 0; }
.page-subtitle { font-size: 13px; color: var(--inv-muted); margin: 4px 0 0; }
.page-head__meta { display: flex; align-items: center; gap: 12px; }
.live-note { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: var(--inv-muted); }
.live-note__dot { width: 6px; height: 6px; border-radius: 999px; background: var(--inv-ok-fill); box-shadow: 0 0 0 3px color-mix(in srgb, var(--inv-ok-fill) 22%, transparent); }
.spin-icon { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.load-error {
  display: flex; align-items: center; gap: 8px; margin: 0; padding: 10px 14px; border-radius: 10px;
  background: var(--inv-surface); border: 1px solid var(--inv-border); color: var(--inv-text); font-size: 13px;
}
.load-error :deep(svg) { color: var(--inv-crit); }
.load-error span { flex: 1; }

/* Buttons: the app's blue for the one action, the rest outlined. */
.btn-primary {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; line-height: 1.2;
  color: #fff; background: var(--inv-action); border: 1px solid var(--inv-action);
  box-shadow: 0 1px 2px rgba(var(--rb-primary-rgb), 0.25);
  cursor: pointer; text-decoration: none; font-family: inherit; transition: background 0.15s ease, box-shadow 0.15s ease;
}
.btn-primary:hover:not(:disabled) { background: var(--inv-action-hover); border-color: var(--inv-action-hover); box-shadow: 0 4px 12px rgba(var(--rb-primary-rgb), 0.28); }
.btn-primary:active:not(:disabled) { transform: translateY(1px); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-outline {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; line-height: 1.2;
  color: var(--inv-text); background: var(--inv-surface); border: 1px solid var(--inv-border);
  cursor: pointer; font-family: inherit; text-decoration: none; white-space: nowrap; transition: background 0.15s ease, border-color 0.15s ease;
}
.btn-outline:hover:not(:disabled) { background: var(--inv-hover); border-color: var(--rb-border-hover); }
.btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-outline--sm { padding: 6px 11px; font-size: 12px; }
.btn-outline--danger { color: var(--inv-crit); border-color: color-mix(in srgb, var(--inv-crit) 35%, var(--inv-border)); }
.btn-outline--danger:hover:not(:disabled) { background: color-mix(in srgb, var(--inv-crit) 8%, transparent); border-color: var(--inv-crit); }
.link-btn {
  display: inline-flex; align-items: center; gap: 4px; padding: 0; border: none; background: none;
  font: inherit; font-size: 12.5px; font-weight: 600; color: var(--inv-action-text); cursor: pointer; text-decoration: none;
}
.link-btn:hover { text-decoration: underline; text-underline-offset: 3px; }

/* Summary cards: one surface, the state in the icon alone. */
.kpi-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.kpi {
  display: flex; align-items: center; gap: 14px; min-width: 0; min-height: 88px;
  padding: 16px; border-radius: 12px; border: 1px solid var(--inv-border); background: var(--inv-surface); color: var(--inv-text);
}
.kpi__icon {
  width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--tone-fill) 14%, transparent); color: var(--tone);
}
.kpi.tone--neutral .kpi__icon { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--inv-action-text); }
.kpi.tone--muted .kpi__icon { background: var(--inv-elevated); color: var(--inv-faint); }
.kpi__body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.kpi__label { font-size: 12.5px; font-weight: 500; color: var(--inv-muted); }
.kpi__value { font-size: 24px; font-weight: 650; line-height: 1.1; letter-spacing: -0.02em; color: var(--inv-text); font-variant-numeric: tabular-nums; }
.kpi__sub { font-size: 12px; color: var(--inv-muted); }

/* Panel */
.panel { background: var(--inv-surface); border: 1px solid var(--inv-border); border-radius: 12px; min-width: 0; display: flex; flex-direction: column; }
.panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 16px 18px 12px; flex-wrap: wrap; }
.panel-title { font-size: 15px; font-weight: 600; color: var(--inv-text); margin: 0; }
.panel-subtitle { font-size: 12.5px; color: var(--inv-muted); margin: 3px 0 0; max-width: 72ch; }

/* Scan, then location */
.tools { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 0 18px 14px; }
.scan-field { position: relative; flex: 1 1 260px; max-width: 360px; }
.scan-field__icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--inv-muted); pointer-events: none; }
.scan-note { margin: 0; flex: 1 1 auto; font-size: 12.5px; color: var(--inv-muted); }
.scan-note--alert { color: var(--inv-crit); font-weight: 600; }
.bulk-field { display: flex; gap: 8px; align-items: center; margin-left: auto; }
.bulk-field .text-input { width: 230px; }
.text-input {
  width: 100%; height: 36px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--inv-border);
  background: var(--inv-elevated); color: var(--inv-text); font: inherit; font-size: 12.5px; transition: border-color 0.15s ease;
}
.text-input::placeholder { color: var(--inv-muted); }
.text-input:focus { outline: none; border-color: var(--inv-action); box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.12); }
.text-input--scan { padding-left: 34px; }
.text-input--cell { height: 32px; max-width: 220px; min-width: 140px; }

/* Table */
.list-state { padding: 18px; }
.table-wrap { position: relative; overflow-x: auto; }
.unit-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.unit-table thead th {
  text-align: left; font-size: 11.5px; font-weight: 500; color: var(--inv-muted); padding: 9px 8px;
  border-top: 1px solid var(--inv-border); border-bottom: 1px solid var(--inv-border); white-space: nowrap;
}
.unit-table tbody td { padding: 10px 8px; border-bottom: 1px solid var(--inv-border-soft); color: var(--inv-text); white-space: nowrap; vertical-align: middle; }
.unit-table th:first-child, .unit-table td:first-child { padding-left: 18px; }
.unit-table th:last-child, .unit-table td:last-child { padding-right: 18px; }
.unit-table .wrap-cell { white-space: normal; min-width: 120px; }
.unit-table tbody tr:hover { background: var(--inv-hover); }
.check-col { width: 36px; }
.actions-col { text-align: right; }
.cell-sub { display: block; margin-top: 3px; font-size: 11.5px; color: var(--inv-muted); }
.mono { font-family: var(--rb-font-mono); font-size: 11.5px; }
.num { font-variant-numeric: tabular-nums; }
.ink-danger { color: var(--inv-crit) !important; font-weight: 600; }
.type-chip {
  display: inline-flex; min-width: 32px; justify-content: center; padding: 1px 7px; border-radius: 6px;
  border: 1px solid var(--inv-border); background: var(--inv-elevated); font-size: 12px; font-weight: 600; line-height: 1.6; color: var(--inv-text);
}
.days { font-variant-numeric: tabular-nums; color: var(--tone); }
.days.tone--warning, .days.tone--danger { font-weight: 600; }
.days.tone--neutral { color: var(--inv-text); }
.days--pill { display: inline-flex; padding: 1px 9px; border-radius: 999px; background: color-mix(in srgb, var(--tone-fill) 14%, transparent); }
/* A scanned bag is marked along its edge; one past its date in red. */
.row--scanned td:first-child { box-shadow: inset 3px 0 0 var(--inv-ok-fill); }
.row--expired td:first-child { box-shadow: inset 3px 0 0 var(--inv-crit-fill); }

.list-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px 18px; }
.list-foot__summary { margin: 0; font-size: 12px; color: var(--inv-muted); }
.list-foot__error { margin: 0; font-size: 12.5px; color: var(--inv-crit); }

.empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 24px; text-align: center; font-size: 13px; color: var(--inv-muted); }
.empty-state__title { font-size: 14px; font-weight: 600; color: var(--inv-text); margin: 4px 0 0; }
.empty-state__desc { font-size: 12.5px; margin: 0; max-width: 48ch; }

.skeleton {
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%; border-radius: 6px; animation: shimmer 1.4s ease infinite;
}
.skeleton--line { height: 13px; margin-bottom: 10px; }
@keyframes shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

.inventory-toast {
  position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 1100;
  display: flex; align-items: center; gap: 0.55rem; max-width: min(46rem, calc(100vw - 32px)); padding: 0.7rem 0.9rem;
  border-radius: 10px; border: 1px solid var(--inv-border); background: var(--inv-elevated); color: var(--inv-text);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28); font-family: var(--rb-font-sans); font-size: 13px;
}
.inventory-toast__close { border: 0; background: none; color: var(--inv-muted); cursor: pointer; display: inline-flex; padding: 0.15rem; }
.toast-fade-enter-active, .toast-fade-leave-active { transition: opacity 0.15s ease; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .skeleton, .spin-icon { animation: none !important; }
  .toast-fade-enter-active, .toast-fade-leave-active { transition: none; }
}

@container si (max-width: 760px) {
  .kpi-row { grid-template-columns: minmax(0, 1fr); }
  .scan-field { max-width: none; }
  .bulk-field { width: 100%; margin-left: 0; }
  .bulk-field .text-input { width: 100%; }
}

@media (max-width: 640px) {
  .si-page { padding: 16px 16px 32px; }
}
</style>
