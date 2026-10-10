<template>
  <div class="rcv-page">
    <div class="rcv-inner">
      <NuxtLink to="/hospital/receiving/weekly" class="back-link">
        <AssetIcon name="arrow-left" :size="14" />
        Weekly Request
      </NuxtLink>

      <div v-if="loading" class="panel list-state" aria-busy="true">
        <div class="skeleton" style="width:40%" />
        <div class="skeleton" style="width:75%" />
        <div class="skeleton" style="width:60%" />
      </div>

      <div v-else-if="loadError" class="banner banner--error" role="alert">
        <AssetIcon name="triangle-alert" :size="16" />
        <span>{{ loadError }}</span>
        <button type="button" class="btn btn--sm" @click="load">Try again</button>
      </div>

      <template v-else-if="weekly">
        <header class="page-header">
          <div>
            <h1 class="page-title">
              <span class="mono">{{ weekly.reference_number }}</span>
              <span class="pill" :class="`tone--${WEEKLY_STATUS_TONES[weekly.status] || 'muted'}`">
                <span class="pill__dot" />
                {{ weekly.status_label }}
              </span>
            </h1>
            <p class="page-subtitle">
              Weekly request to <strong>{{ weekly.target_facility?.name || 'the blood center' }}</strong>
              for {{ formatDay(weekly.request_day) }}<template v-if="weekly.requester_name">, sent by {{ weekly.requester_name }}</template>.
            </p>
          </div>
          <button type="button" class="btn" :disabled="refreshing" @click="refresh">
            <AssetIcon name="refresh-cw" :size="14" :class="{ 'spin-icon': refreshing }" />
            {{ refreshing ? 'Refreshing…' : 'Refresh' }}
          </button>
        </header>

        <section class="stats-grid" aria-label="What came of this weekly request">
          <div v-for="card in cards" :key="card.label" class="stat-card">
            <span class="stat-card__label">{{ card.label }}</span>
            <span class="stat-card__value" :class="card.class">{{ card.value }}</span>
            <span class="stat-card__hint">{{ card.hint }}</span>
          </div>
        </section>

        <p v-if="weekly.is_open" class="note">
          <AssetIcon name="info" :size="14" />
          The center supplies what it can. When it dispatches, anything it did not reserve is closed as not supplied —
          your next request day's order takes its place.
        </p>

        <HospitalScanReceivePanel
          v-if="awaiting.length"
          ref="receivePanel"
          :bags="awaiting"
          :busy="receiving"
          @confirm="receive"
        />

        <div v-if="receiveError" class="banner banner--error" role="alert">
          <AssetIcon name="triangle-alert" :size="16" />
          <span>{{ receiveError }}</span>
        </div>

        <!-- What was asked, line by line, against what the center supplied. -->
        <section class="panel" aria-labelledby="lines-title">
          <div class="panel__head">
            <h2 id="lines-title" class="panel__title">Requested and supplied</h2>
            <p class="panel__hint">
              The center supplies what it can. Requested never changes; only supplied units, once you receive them,
              are added to your inventory.
            </p>
          </div>
          <div class="table-wrap">
            <table class="lines-table">
              <caption class="sr-only">Requested and supplied quantities for each component and blood type</caption>
              <thead>
                <tr>
                  <th scope="col">Component</th>
                  <th scope="col">Blood type</th>
                  <th scope="col" class="num">Requested</th>
                  <th scope="col" class="num">Supplied</th>
                  <th scope="col" class="num">Received</th>
                  <th scope="col" class="num">Not supplied</th>
                  <th scope="col">Status</th>
                  <th scope="col">Request</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in lineRows" :key="row.key">
                  <th scope="row" class="lines-table__component">{{ row.component }}</th>
                  <td><span class="type-pill">{{ row.bloodType }}</span></td>
                  <td class="num">{{ row.requested }}</td>
                  <td class="num strong">{{ row.supplied }}</td>
                  <td class="num">{{ row.received }}</td>
                  <td class="num" :class="{ 'cell--short': row.notSupplied }">{{ row.notSupplied }}</td>
                  <td><span class="pill" :class="`tone--${row.tone}`">{{ row.statusLabel }}</span></td>
                  <td>
                    <NuxtLink :to="`/hospital/bloodrequests/${row.requestId}`" class="link-btn mono">{{ row.reference }}</NuxtLink>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colspan="2">Total</th>
                  <td class="num">{{ totals.requested }}</td>
                  <td class="num strong">{{ totals.fulfilled }}</td>
                  <td class="num">{{ totals.received }}</td>
                  <td class="num">{{ totals.not_supplied }}</td>
                  <td colspan="2" />
                </tr>
              </tfoot>
            </table>
          </div>
          <p v-for="request in rejected" :key="request.id" class="rejected-note">
            {{ request.reference_number }} ({{ bloodTypeSummary(request) }}) was rejected: {{ request.rejection_reason || 'no reason given' }}
          </p>
        </section>
      </template>
    </div>

    <Transition name="toast">
      <div v-if="toast" class="toast" role="status">{{ toast }}</div>
    </Transition>
  </div>
</template>

<script setup>
/**
 * One weekly request: what was asked of the center, what it supplied, and receiving the delivery.
 *
 * The weekly request is one replenishment request whose lines each name their
 * own blood type; one sent before lines carried a type is one request per
 * type, and reads the same here. Bags dispatched and not yet received are
 * scanned in by barcode — they are RedAgos bags, so they carry the sticker —
 * and confirmed per request, since receipt is recorded on each. Confirmed bags
 * go straight onto the blood bank's shelf.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import HospitalScanReceivePanel from '~/components/Hospital/ScanReceivePanel.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import { bloodTypeSummary, LINE_STATUS_LABELS, LINE_STATUS_TONES } from '~/types/bloodRequest'
import { RECEIVING_REFUSAL_MESSAGES, WEEKLY_STATUS_TONES } from '~/types/receiving'
import { receiptsByRequest } from '~/utils/receiving'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard' })

const route = useRoute()

const weekly = ref(null)
const loading = ref(true)
const loadError = ref('')
const refreshing = ref(false)
const receiving = ref(false)
const receiveError = ref('')
const receivePanel = ref(null)

const toast = ref('')
let toastTimer = null

const totals = computed(() => weekly.value?.totals ?? {})

const cards = computed(() => [
  { label: 'Requested', value: totals.value.requested ?? 0, hint: 'Across every blood type' },
  { label: 'Supplied', value: totals.value.fulfilled ?? 0, hint: 'Dispatched by the center', class: 'stat-card__value--strong' },
  { label: 'Received', value: totals.value.received ?? 0, hint: 'Confirmed into your stock' },
  { label: 'To receive', value: totals.value.awaiting_receipt ?? 0, hint: 'Dispatched, not yet confirmed', class: totals.value.awaiting_receipt ? 'stat-card__value--warning' : '' },
  { label: 'Not supplied', value: totals.value.not_supplied ?? 0, hint: 'Closed — will not come', class: totals.value.not_supplied ? 'stat-card__value--danger' : '' },
])

/**
 * One row per component and blood type: what was asked against what came of it.
 *
 * Read from each request's own lines, so requested and supplied are separate
 * figures. Not supplied counts only what can no longer come: the remainder of a
 * line the center closed, or of a request it rejected or that was cancelled.
 */
const lineRows = computed(() => (weekly.value?.requests ?? []).flatMap((request) => {
  const dead = ['rejected', 'cancelled'].includes(request.status)

  return (request.items ?? []).map((item) => {
    const supplied = item.fulfilled_quantity ?? 0
    const closed = Boolean(item.closed_at) || dead
    const status = dead ? 'closed_short' : (item.line_status ?? 'unfulfilled')

    return {
      key: `${request.id}-${item.id}`,
      requestId: request.id,
      reference: request.reference_number,
      component: item.component?.name ?? '—',
      bloodType: item.blood_type?.code ?? request.blood_type?.code ?? '—',
      requested: item.quantity,
      supplied,
      received: item.received_quantity ?? 0,
      notSupplied: closed ? Math.max(0, item.quantity - supplied) : 0,
      tone: LINE_STATUS_TONES[status] ?? 'muted',
      statusLabel: dead
        ? (request.status === 'rejected' ? 'Rejected' : 'Cancelled')
        : (item.line_status_label ?? LINE_STATUS_LABELS[status] ?? '—'),
    }
  })
}))

const rejected = computed(() => (weekly.value?.requests ?? []).filter((request) => request.status === 'rejected'))

/** Bags dispatched for this weekly request and not yet received, across its blood types. */
const awaiting = computed(() => (weekly.value?.requests ?? []).flatMap((request) => {
  const lines = new Map((request.items ?? []).map((item) => [item.id, item]))

  return (request.allocations ?? [])
    .filter((allocation) => allocation.status === 'released' && !allocation.received_at)
    .map((allocation) => ({
      allocation_id: allocation.id,
      request_id: request.id,
      unit_id: allocation.unit_id,
      blood_type: lines.get(allocation.request_item_id)?.blood_type?.code ?? request.blood_type?.code ?? null,
      component: lines.get(allocation.request_item_id)?.component?.name ?? null,
      expiry_date: allocation.expiry_date,
      released_at: allocation.released_at,
    }))
}))

onMounted(async () => {
  await load()

  if (route.query.sent && weekly.value) {
    showToast(`Weekly request ${weekly.value.reference_number} sent to ${weekly.value.target_facility?.name ?? 'the blood center'}.`)
  }
})

onUnmounted(() => clearTimeout(toastTimer))

async function load() {
  loadError.value = ''

  try {
    weekly.value = (await hospitalService.showWeeklyRequest(route.params.id)).weekly_request
  } catch (err) {
    loadError.value = RECEIVING_REFUSAL_MESSAGES[err?.data?.code] || err?.message || 'Could not load this weekly request.'
  } finally {
    loading.value = false
  }
}

async function refresh() {
  refreshing.value = true

  try {
    await load()
  } finally {
    refreshing.value = false
  }
}

/**
 * Confirm the ticked bags, one call per blood request.
 *
 * A request refused on its own (a colleague confirmed it a moment ago) does
 * not stop the others; what was stocked is reported, and the page reloads to
 * show where every bag now stands.
 */
async function receive(ticked) {
  receiving.value = true
  receiveError.value = ''

  let stocked = 0
  const failures = []

  for (const [requestId, allocationIds] of receiptsByRequest(awaiting.value, ticked)) {
    try {
      const response = await hospitalService.confirmReceipt(requestId, allocationIds)
      stocked += response?.stocked_count ?? allocationIds.length
    } catch (err) {
      const reference = weekly.value.requests.find((request) => request.id === requestId)?.reference_number
      failures.push(`${reference}: ${RECEIVING_REFUSAL_MESSAGES[err?.data?.code] || err?.message || 'could not be confirmed'}`)
    }
  }

  if (stocked) showToast(`${stocked} bag${stocked === 1 ? '' : 's'} received into your blood bank.`)
  if (failures.length) receiveError.value = failures.join(' ')

  receivePanel.value?.clear()
  await load()
  receiving.value = false
}

function showToast(message) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 4500)
}

function formatDay(value) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css; nothing is redeclared here. */
.rcv-page { min-height: 100%; background: var(--rb-page-bg); font-family: var(--rb-font-sans); padding: 20px; }
.rcv-inner { max-width: 1240px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }

.back-link { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--rb-primary-text); text-decoration: none; }
.back-link:hover { text-decoration: underline; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.page-title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 24px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.page-subtitle { font-size: 13.5px; color: var(--rb-text-secondary); margin: 6px 0 0; }
.page-subtitle strong { color: var(--rb-text-primary); }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

.banner { display: flex; align-items: center; gap: 8px; margin: 0; padding: 11px 14px; border-radius: 10px; font-size: 13px; }
.banner--error { background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), 0.25); }
.note { display: flex; align-items: flex-start; gap: 8px; margin: 0; font-size: 12.5px; color: var(--rb-text-secondary); }

.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
.stat-card {
  display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; border-radius: 14px;
  background: var(--rb-surface); border: 1px solid var(--rb-border); box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
}
.stat-card__label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--rb-text-secondary); }
.stat-card__value { font-size: 24px; font-weight: 800; color: var(--rb-text-primary); line-height: 1; font-variant-numeric: tabular-nums; }
.stat-card__value--strong { color: var(--rb-primary-text); }
.stat-card__value--warning { color: var(--rb-warning-text); }
.stat-card__value--danger { color: var(--rb-accent-text); }
.stat-card__hint { font-size: 11.5px; color: var(--rb-text-secondary); }

.panel {
  background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03); overflow: hidden;
}
.panel__head { padding: 16px 16px 8px; }
.panel__title { margin: 0; font-size: 15px; font-weight: 700; color: var(--rb-text-primary); }
.panel__hint { margin: 3px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); max-width: 80ch; }
.table-wrap { overflow-x: auto; }
.lines-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.lines-table thead th {
  text-align: left; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--rb-text-secondary); padding: 10px 14px; background: var(--rb-surface-alt); white-space: nowrap;
}
.lines-table tbody th, .lines-table tbody td, .lines-table tfoot th, .lines-table tfoot td {
  padding: 11px 14px; border-top: 1px solid var(--rb-surface-alt); color: var(--rb-text-primary); white-space: nowrap; text-align: left;
}
.lines-table .num, .lines-table thead .num { text-align: right; font-variant-numeric: tabular-nums; }
.lines-table__component { font-weight: 600; }
.lines-table tfoot th, .lines-table tfoot td { font-weight: 700; background: var(--rb-surface-alt); }
.strong { font-weight: 700; }
.cell--short { color: var(--rb-accent-text); font-weight: 700; }
.rejected-note { margin: 0; padding: 10px 16px 14px; font-size: 12px; color: var(--rb-accent-text); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }
.type-pill { display: inline-flex; font-size: 13px; font-weight: 800; padding: 4px 12px; border-radius: 999px; background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); }

.pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700; white-space: nowrap; font-family: var(--rb-font-sans); }
.pill__dot { width: 6px; height: 6px; border-radius: 999px; background: currentColor; }

.link-btn { font-size: 13px; font-weight: 600; color: var(--rb-primary-text); text-decoration: none; }
.link-btn:hover { text-decoration: underline; }

.list-state { padding: 18px 16px; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  padding: 9px 16px; font-size: 13px; font-weight: 600; font-family: inherit; text-decoration: none;
  border-radius: 9px; cursor: pointer; white-space: nowrap;
  background: var(--rb-surface); color: var(--rb-text-primary); border: 1px solid var(--rb-border-strong);
}
.btn:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn--sm { padding: 6px 11px; font-size: 12px; border-radius: 8px; }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.spin-icon { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.toast {
  position: fixed; right: 20px; bottom: 20px; z-index: 330; max-width: min(420px, calc(100vw - 40px));
  padding: 11px 16px; border-radius: 10px; background: var(--rb-text-primary); color: var(--rb-surface);
  font-size: 13px; font-weight: 600;
}
.toast-enter-active, .toast-leave-active { transition: opacity .2s ease, transform .2s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(6px); }

.skeleton {
  height: 13px; border-radius: 6px; margin-bottom: 10px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 50%, var(--rb-skeleton-a) 75%);
  background-size: 200% 100%; animation: shimmer 1.4s infinite;
}
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

.tone--success { background: rgba(var(--rb-success-rgb), 0.14); color: var(--rb-success-text); }
.tone--warning { background: rgba(var(--rb-warning-rgb), 0.16); color: var(--rb-warning-text); }
.tone--danger { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--rb-accent-text); }
.tone--info { background: rgba(var(--rb-primary-rgb), 0.12); color: var(--rb-primary-text); }
.tone--progress { background: rgba(var(--rb-purple-rgb), 0.12); color: var(--rb-purple-text); }
.tone--muted { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }

@media (prefers-reduced-motion: reduce) {
  .skeleton, .spin-icon { animation: none; }
  .toast-enter-active, .toast-leave-active { transition: none; }
}

@media (max-width: 720px) {
  .rcv-page { padding: 14px; }
}
</style>
