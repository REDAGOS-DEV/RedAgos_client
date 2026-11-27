<template>
  <div class="list-page inv-tones">
    <div class="list-inner">
      <PageHeader title="Stock Intake" :subtitle="hospitalPageSubtitle('stockIntake', can)">
        <template #actions>
          <button
            type="button"
            class="btn-outline"
            :disabled="refreshing"
            aria-label="Refresh the list"
            :title="lastUpdatedLabel ? `Refresh · updated ${lastUpdatedLabel}` : 'Refresh'"
            @click="refresh()"
          >
            <AssetIcon name="refresh-cw" :size="14" :class="{ spin: refreshing }" />
            Refresh
          </button>
          <NuxtLink to="/hospital/inventory" class="btn-outline" title="Blood Bank Inventory">
            <AssetIcon name="package" :size="14" />
            Blood Bank Inventory
          </NuxtLink>
          <!-- Blood from outside RedAgos is added here (project owner, 2026-10-30). -->
          <button v-if="canAdd" type="button" class="btn-primary" @click="addingUnit = true">
            <AssetIcon name="plus" :size="15" />
            Add Blood Unit
          </button>
        </template>
      </PageHeader>

      <div v-if="loadError" class="banner banner--error" role="alert">
        <AssetIcon name="circle-alert" :size="16" />
        <p class="banner__text">{{ loadError }}</p>
        <button type="button" class="btn-link" @click="refresh()">Retry</button>
      </div>

      <!-- ============ SCAN ============ -->
      <!-- The work of the page first (2026-11-27): scan, give the scanned bags a
           shelf, and see how far along the batch is. -->
      <section class="scan-panel" aria-labelledby="scan-title">
        <div class="scan-panel__head">
          <h2 id="scan-title" class="scan-panel__title">
            <span class="scan-panel__icon" aria-hidden="true"><AssetIcon name="scan-line" :size="16" /></span>
            Scan bags to stock in
          </h2>
          <span v-if="pastDate" class="scan-flag" :title="'Discard these rather than stock them in'">
            <AssetIcon name="triangle-alert" :size="13" />
            {{ pastDate }} past {{ pastDate === 1 ? 'its' : 'their' }} date
          </span>
        </div>

        <div class="scan-panel__row">
          <form class="scan-field" @submit.prevent="scanBag">
            <AssetIcon name="scan-line" :size="17" class="scan-field__icon" />
            <input
              ref="scanInput"
              v-model="scanEntry"
              type="text"
              class="scan-field__input mono"
              placeholder="Scan or type a bag number"
              aria-label="Scan a bag to stock in"
              autocomplete="off"
              spellcheck="false"
              autocapitalize="characters"
              maxlength="50"
            />
            <kbd class="scan-field__hint" aria-hidden="true">Enter</kbd>
          </form>

          <form class="bulk-field" @submit.prevent="applyBulkLocation">
            <SelectField
              v-model="bulkLocation"
              class="bulk-field__select"
              :options="locationOptions"
              placeholder="Location for the scanned bags"
              aria-label="Storage location for the scanned bags"
              empty-text="No storage locations loaded"
            />
            <button type="submit" class="btn-outline" :disabled="!bulkLocation || !ticked.length">Apply</button>
          </form>
        </div>

        <!-- How far along the batch is. -->
        <div class="scan-progress" :aria-label="`${ticked.length} of ${tickable.length} bags scanned`">
          <span class="scan-progress__track" aria-hidden="true">
            <span class="scan-progress__fill" :style="{ width: tickable.length ? `${(ticked.length / tickable.length) * 100}%` : '0%' }" />
          </span>
          <span class="scan-progress__label">
            <strong>{{ loading ? '–' : ticked.length }}</strong> of {{ loading ? '–' : tickable.length }} scanned
          </span>
          <span v-if="scanNote" class="scan-progress__note" :class="{ 'scan-progress__note--alert': scanAlert }" aria-live="polite">{{ scanNote }}</span>
        </div>
      </section>

      <!-- ============ ARRIVED BAGS ============ -->
      <!-- Receiving's second step (project owner, 2026-10-11): bags whose
           arrival was confirmed, or that came from outside RedAgos, wait here
           until inventory staff put them on a shelf. They are not stock until
           then. Its own page since 2026-10-28, apart from Blood Bank Inventory. -->
      <section class="panel arrived-panel" aria-labelledby="arrived-title">
        <header class="list-head">
          <h2 id="arrived-title" class="list-head__title">Awaiting stock-in</h2>
          <span class="list-head__count">{{ loading ? '–' : arrived.length }}</span>
        </header>

        <div class="table-wrap" :class="{ 'table-wrap--busy': refreshing && arrived.length }">
          <table class="list-table">
            <caption class="sr-only">Bags that arrived and wait to be stocked in</caption>
            <thead>
              <tr>
                <th scope="col" class="check-col">
                  <input
                    type="checkbox"
                    :checked="allTicked"
                    :indeterminate.prop="ticked.length > 0 && !allTicked"
                    :disabled="!tickable.length"
                    aria-label="Mark every bag in date, without scanning"
                    @change="toggleAllTicked"
                  />
                </th>
                <th scope="col">Bag</th>
                <th scope="col">Type</th>
                <th scope="col">Component</th>
                <th scope="col">Expires</th>
                <th scope="col">Arrived</th>
                <th scope="col">Storage location</th>
                <th v-if="canDiscard" scope="col" class="c-actions">Actions</th>
              </tr>
            </thead>

            <tbody v-if="loading">
              <SkeletonRows :columns="columnCount" :rows="5" />
            </tbody>

            <tbody v-else-if="!arrived.length">
              <tr>
                <td :colspan="columnCount" class="empty-cell">
                  <div class="empty-state">
                    <span class="empty-state__icon"><AssetIcon name="package-check" :size="20" /></span>
                    <p class="empty-state__title">Nothing awaiting stock-in</p>
                    <p class="empty-state__text">
                      Bags appear here once their arrival is confirmed on a blood request, or they are added with Add Blood Unit.
                    </p>
                    <button v-if="canAdd" type="button" class="btn-primary" @click="addingUnit = true">
                      <AssetIcon name="plus" :size="15" />
                      Add Blood Unit
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>

            <tbody v-else>
              <tr v-for="unit in arrived" :key="unit.id" class="list-row" :class="{ 'row--expired': unit.bag_expired, 'row--scanned': ticked.includes(unit.unit_id) }">
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
                  <div class="cell">
                    <span class="code">
                      <AssetIcon v-if="ticked.includes(unit.unit_id)" name="check" :size="13" class="scanned-mark" />
                      {{ bagLabel(unit) }}
                    </span>
                    <span v-if="unit.source?.reference_number" class="cell__sub">from {{ unit.source.reference_number }}</span>
                    <span v-else-if="unit.source?.direct_distribution" class="cell__sub">from {{ unit.source.direct_distribution.source_name || 'outside RedAgos' }}</span>
                  </div>
                </td>
                <td><span class="blood">{{ displayType(unit.blood_type?.code) }}</span></td>
                <td>
                  <div class="cell">
                    <span>{{ unit.component?.name || '—' }}</span>
                    <span v-if="unit.volume_ml" class="cell__sub">{{ unit.volume_ml }} mL</span>
                  </div>
                </td>
                <!-- The date over how long is left (2026-11-27: one column). -->
                <td class="expires-cell">
                  <span class="expires-cell__date" :class="{ 'ink-danger': unit.bag_expired }">{{ unit.expiry_date || '—' }}</span>
                  <span class="days-pill" :class="`tone--${remaining(unit).tone}`">{{ remaining(unit).label }}</span>
                </td>
                <td class="nowrap">{{ formatDateTime(unit.received_at) }}</td>
                <td>
                  <!-- Every bag goes onto a shelf, picked from the list as at the centre's Stock Intake (project owner, 2026-10-30). -->
                  <div v-if="!unit.bag_expired" class="location-cell">
                    <SelectField
                      v-model="locations[unit.unit_id]"
                      :options="locationOptions"
                      placeholder="Select a location"
                      :aria-label="`Storage location for ${bagLabel(unit)}`"
                      empty-text="No storage locations loaded"
                      size="sm"
                    />
                  </div>
                  <span v-else class="ink-danger">Past its date — discard it</span>
                </td>
                <td v-if="canDiscard" class="c-actions">
                  <div class="row-actions">
                    <button
                      type="button"
                      class="icon-btn icon-btn--danger"
                      :disabled="dialogBusy"
                      :aria-label="`Discard ${bagLabel(unit)}`"
                      title="Discard"
                      @click="startDiscard(unit)"
                    >
                      <AssetIcon name="trash-2" :size="15" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer v-if="arrived.length" class="list-foot">
          <p v-if="stockInError" class="list-foot__error" role="alert">{{ stockInError }}</p>
          <ul v-else-if="blockers.length" class="blockers">
            <li v-for="blocker in blockers" :key="blocker">
              <AssetIcon name="circle-alert" :size="14" />
              {{ blocker }}
            </li>
          </ul>
          <p v-else class="list-foot__summary">{{ arrived.length }} bag{{ arrived.length === 1 ? '' : 's' }} awaiting stock-in</p>
          <button type="button" class="btn-primary" :disabled="!canStockIn" @click="stockInTicked">
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

    <HospitalAddBloodUnitDialog v-if="addingUnit" @added="onUnitAdded" @close="addingUnit = false" />

    <Teleport to="body" :disabled="pageHidden">
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
import SkeletonRows from '~/components/ui/SkeletonRows.vue'

import PageHeader from '~/components/ui/PageHeader.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import SelectField from '~/components/common/SelectField.vue'
import HospitalAddBloodUnitDialog from '~/components/Hospital/AddBloodUnitDialog.vue'
import HospitalUnitReasonDialog from '~/components/Hospital/UnitReasonDialog.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import { UNIT_REFUSAL_MESSAGES } from '~/types/hospitalInventory'
import { hospitalRemainingDaysTag } from '~/utils/hospitalInventoryDashboard'
import { matchStockInScan } from '~/utils/stockIn'
import { hospitalPageSubtitle } from '~/utils/hospitalPageSubtitles'
import { onPageReturn, usePageHidden } from '~/composables/useKeptAlive'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard', requires: 'hospital.inventory.stock_in', keepalive: true })

/*
 * Stock-in is the inventory staff's and the Head's (hospital roles, project
 * owner 2026-10-11); the page itself needs it. The server refuses the
 * endpoints with `can:` either way.
 */
const { can } = useUser()
const canDiscard = computed(() => can('hospital.inventory.discard'))
// Adding a bag is a direct-distribution receipt on the server, so it needs that ability.
const canAdd = computed(() => can('hospital.receiving.direct'))
const columnCount = computed(() => (canDiscard.value ? 8 : 7))

const loading = ref(true)
const loadError = ref('')
const refreshing = ref(false)
const lastUpdated = ref(null)

const arrived = ref([])
const ticked = ref([])
const locations = reactive({})
const bulkLocation = ref(null)
const stockingIn = ref(false)
const stockInError = ref('')
const storageLocations = ref([])

const locationOptions = computed(() => storageLocations.value.map((location) => ({ value: location, label: location })))

const tickable = computed(() => arrived.value.filter((unit) => !unit.bag_expired).map((unit) => unit.unit_id))
const allTicked = computed(() => tickable.value.length > 0 && tickable.value.every((id) => ticked.value.includes(id)))
const pastDate = computed(() => arrived.value.filter((unit) => unit.bag_expired).length)

/**
 * Refuse here for the reasons the server would, as the centre's Stock Intake
 * does: every bag goes onto a shelf (project owner, 2026-10-30).
 */
const blockers = computed(() => {
  if (!ticked.value.length) return []
  if (!storageLocations.value.length) return ['The storage locations could not be loaded. Reload the page to stock bags in.']

  const missing = ticked.value.filter((id) => !locations[id]).length

  return missing
    ? [`${missing} scanned bag${missing === 1 ? ' needs' : 's need'} a storage location.`]
    : []
})

const canStockIn = computed(() => ticked.value.length > 0 && !stockingIn.value && !blockers.value.length)


async function loadArrived() {
  const page = await hospitalService.inventory({ status: 'received', per_page: 100 })
  arrived.value = page?.data ?? []

  // Nothing is marked until it is scanned (or ticked by hand); a bag no
  // longer waiting drops out of the marks.
  const waiting = new Set(tickable.value)
  ticked.value = ticked.value.filter((id) => waiting.has(id))
}

// What the location fields pick from: the configured fridges and freezers, and
// places already used. Every bag needs one, so without the list nothing can be
// stocked in; the blockers say so.
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
  const location = bulkLocation.value
  if (!location) return

  for (const id of ticked.value) locations[id] = location
  bulkLocation.value = null
}

async function stockInTicked() {
  if (!canStockIn.value) return

  stockingIn.value = true
  stockInError.value = ''

  try {
    const response = await hospitalService.stockIn(ticked.value.map((id) => ({
      unit_id: id,
      storage_location: locations[id],
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

/* ADD: blood from outside RedAgos, typed in; it arrives awaiting stock-in like any other bag. */
const addingUnit = ref(false)

async function onUnitAdded(response) {
  addingUnit.value = false

  const delivery = response?.direct_distribution
  const ids = (delivery?.units ?? []).map((unit) => unit.unit_id)
  const count = ids.length || delivery?.quantity || 1

  await refresh()

  // The bags are in hand, so they come marked, ready for their location.
  const waiting = new Set(tickable.value)
  ticked.value = [...new Set([...ticked.value, ...ids.filter((id) => waiting.has(id))])]
  scanNote.value = ''
  scanAlert.value = false
  notice.value = `${count === 1 ? `${delivery?.external_unit_number ?? 'Bag'} added` : `${count} bags under ${delivery?.external_unit_number} added`}. Choose a storage location, then stock ${count === 1 ? 'it' : 'them'} in.`
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
      notice.value = { tone: 'error', text: refusalMessage(err) }
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
useNoticeToast(notice)
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

// Kept alive: no polling while away; back here, a refresh straight away.
const pageHidden = usePageHidden()

onMounted(() => {
  refresh()
  pollTimer = setInterval(() => {
    if (!document.hidden && !pageHidden.value && !stockingIn.value) refresh()
  }, POLL_MS)
})

onPageReturn(() => {
  if (!stockingIn.value) refresh()
})

onBeforeUnmount(() => {
  clearInterval(pollTimer)
  clearTimeout(noticeTimer)
})
</script>

<!-- The list: the blood centre's Donor Management structure (project owner, 2026-10-30). -->
<style scoped src="~/assets/css/list-ui.css"></style>

<style scoped>
/* Blood Bank Inventory's quiet look (2026-10-28), kept for the summary cards
   above the list. The dark selector sits whole inside :global(), so the
   tokens never land on <html>. */
.inv-tones {
  --inv-surface: var(--rb-surface);
  --inv-elevated: var(--rb-surface-alt);
  --inv-border: var(--rb-border-strong);
  --inv-text: var(--rb-text-primary);
  --inv-muted: var(--rb-text-secondary);
  --inv-faint: var(--rb-text-muted);
  --inv-ok: #15803D;
  --inv-warn: #B45309;
  --inv-crit: #B91C1C;
  --inv-ok-fill: #1BAF7A;
  --inv-warn-fill: #EDA100;
  --inv-crit-fill: #DC2626;
  --inv-action-text: var(--rb-primary-text);
  --tone: var(--inv-muted);
  --tone-fill: var(--inv-faint);
}
:global(.dark .inv-tones) {
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

.list-inner { container-type: inline-size; container-name: si; }

/* ── The scan panel (2026-11-27) ── */
.scan-panel {
  display: flex; flex-direction: column; gap: 14px; padding: 18px 20px;
  border: 1px solid var(--rb-border); border-radius: var(--rb-radius-lg);
  background: var(--rb-surface); box-shadow: var(--rb-shadow-sm);
}
.scan-panel__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.scan-panel__title { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 15px; font-weight: 700; color: var(--rb-text-primary); }
.scan-panel__icon { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: rgba(var(--rb-primary-rgb), .1); color: var(--rb-primary-text); }
.scan-flag {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px;
  background: rgba(var(--rb-accent-rgb), .1); color: var(--rb-accent-text); font-size: 12.5px; font-weight: 700;
}
.scan-panel__row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }

/* The scanner field: large, where a scan lands. */
.scan-field { position: relative; flex: 1 1 320px; min-width: 0; }
.scan-field__icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--rb-primary-text); pointer-events: none; }
.scan-field__input {
  width: 100%; height: 46px; padding: 0 72px 0 42px; border: 1.5px solid var(--rb-border-strong); border-radius: 12px;
  background: var(--rb-surface-alt); font: inherit; font-size: 15px; letter-spacing: .02em; color: var(--rb-text-primary);
  transition: border-color .15s ease, box-shadow .15s ease, background-color .15s ease;
}
.scan-field__input::placeholder { color: var(--rb-text-muted); letter-spacing: 0; }
.scan-field__input:focus { outline: none; border-color: var(--rb-primary); background: var(--rb-surface); box-shadow: 0 0 0 4px rgba(var(--rb-primary-rgb), .12); }
.scan-field__hint {
  position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
  padding: 2px 7px; border: 1px solid var(--rb-border-strong); border-radius: 6px; background: var(--rb-surface);
  font: inherit; font-size: 11px; font-weight: 600; color: var(--rb-text-muted);
}

/* How far along the batch is. */
.scan-progress { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; }
.scan-progress__track { flex: 1 1 200px; height: 8px; overflow: hidden; border-radius: 999px; background: var(--rb-surface-alt); }
.scan-progress__fill { display: block; height: 100%; border-radius: inherit; background: var(--inv-ok-fill); transition: width .3s ease; }
.scan-progress__label { font-size: 13px; color: var(--rb-text-secondary); white-space: nowrap; }
.scan-progress__label strong { font-weight: 800; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.scan-progress__note { font-size: 12.5px; color: var(--rb-text-secondary); }
.scan-progress__note--alert { color: var(--rb-accent-text); font-weight: 600; }

/* This panel lets its stock-in bar stick to the bottom of the screen. */
.arrived-panel { overflow: visible; }
.arrived-panel .table-wrap { border-radius: 0; }

/* The list's heading, with how many wait. */
.list-head { display: flex; align-items: center; gap: 8px; padding: 14px 16px; border-bottom: 1px solid var(--rb-border); }
.list-head__title { margin: 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.list-head__count { min-width: 22px; padding: 1px 8px; border-radius: 999px; background: var(--rb-surface-alt); font-size: 12px; font-weight: 700; text-align: center; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }

/* Expires: the date over how long is left. */
.expires-cell { white-space: nowrap; }
.expires-cell__date { display: block; font-size: 13px; }
.days-pill {
  display: inline-flex; margin-top: 3px; padding: 1px 8px; border-radius: 999px;
  background: color-mix(in srgb, var(--tone-fill) 14%, transparent); color: var(--tone); font-size: 11.5px; font-weight: 700;
}
.scanned-mark { margin-right: 4px; vertical-align: -2px; color: var(--inv-ok); }

/* The scanned bags' location, beside the scan field. */
.bulk-field { display: flex; flex: none; align-items: center; gap: 8px; }
.bulk-field__select { width: 240px; }

.check-col { width: 36px; }
.location-cell { width: 200px; }
.ink-danger { color: var(--rb-accent-text) !important; font-weight: 600; }
/* A scanned bag is marked along its edge; one past its date in red. */
.row--scanned td:first-child { box-shadow: inset 3px 0 0 var(--inv-ok-fill); }
.row--scanned { background: color-mix(in srgb, var(--inv-ok-fill) 6%, transparent); }
.row--expired td:first-child { box-shadow: inset 3px 0 0 var(--inv-crit-fill); }

/* Where the pager sits on the donors page: what stops the stock-in, and the button. */
.list-foot {
  position: sticky; bottom: 0; z-index: 2;
  display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  padding: 12px 16px; border-top: 1px solid var(--rb-border);
  background: var(--rb-surface); border-radius: 0 0 var(--rb-radius-lg) var(--rb-radius-lg);
  box-shadow: 0 -8px 16px -12px rgba(15, 23, 42, .25);
}
.list-foot__summary { margin: 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.list-foot__error { margin: 0; font-size: 12.5px; color: var(--rb-accent-text); }
/* What still stops the stock-in, as on the centre's Stock Intake. */
.blockers {
  margin: 0; padding: 8px 12px; list-style: none; display: flex; flex-direction: column; gap: 6px;
  border-radius: 10px; background: rgba(var(--rb-warning-rgb), 0.08); font-size: 12.5px; color: var(--rb-warning-text);
}
.blockers li { display: flex; align-items: center; gap: 7px; }

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
  .toast-fade-enter-active, .toast-fade-leave-active { transition: none; }
}

@container si (max-width: 760px) {
  .bulk-field { width: 100%; }
  .bulk-field__select { flex: 1; width: auto; min-width: 0; }
}
</style>
