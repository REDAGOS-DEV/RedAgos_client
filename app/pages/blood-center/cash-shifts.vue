<template>
  <div class="cs-page">
    <div class="cs-inner">
      <div class="toast-stack" aria-live="polite">
        <transition-group name="toast">
          <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast--${t.variant}`">
            <div class="toast-title">{{ t.title }}</div>
            <div v-if="t.message" class="toast-message">{{ t.message }}</div>
          </div>
        </transition-group>
      </div>

      <header class="page-header">
        <div>
          <h1 class="page-title">Cash Shifts</h1>
          <p class="page-subtitle">
            {{ mayOversee
              ? 'Every cashier\'s shifts at this centre: the float, what was taken, what the drawer should hold, and what was counted.'
              : 'Your shifts at the counter: the float, what you took, what the drawer should hold, and what you counted.' }}
          </p>
        </div>
        <div class="header-actions">
          <NuxtLink to="/blood-center/pos" class="btn btn-primary">Open counter</NuxtLink>
        </div>
      </header>

      <p v-if="!shiftsEnabled" class="banner banner--warn">
        The counter is not using cash shifts: payments are taken without one. Any shifts listed here are from before.
      </p>

      <section class="filters" aria-label="Filters">
        <div class="pills" role="group" aria-label="Status">
          <button v-for="s in STATUSES" :key="s.value" class="pill" :class="{ 'pill--on': status === s.value }" @click="status = s.value">
            {{ s.label }}
          </button>
        </div>
        <label class="filter"><span>From</span><input v-model="from" type="date" class="input"></label>
        <label class="filter"><span>To</span><input v-model="to" type="date" class="input"></label>
      </section>

      <div class="cs-grid">
        <!-- LIST -->
        <section class="card list-card" aria-label="Shifts">
          <div v-if="loading" class="skeleton-wrap"><div v-for="n in 5" :key="n" class="skeleton skeleton--row" /></div>
          <div v-else-if="!shifts.length" class="empty">
            <AssetIcon name="clock" :size="30" />
            <h3>No shifts</h3>
            <p>A shift is opened at the counter before the first payment.</p>
          </div>
          <ul v-else class="shift-list">
            <li v-for="s in shifts" :key="s.id">
              <button type="button" class="shift-item" :class="{ 'shift-item--on': selected?.id === s.id }" @click="select(s.id)">
                <span class="shift-item__num mono">{{ s.session_number }}</span>
                <span class="chip" :class="s.status === 'open' ? 'tone--info' : varianceTone(s)">
                  {{ s.status === 'open' ? 'Open' : shiftVariance(s.variance).label }}
                </span>
                <span class="shift-item__meta">
                  {{ s.cashier?.name || '—' }}{{ s.counter_label ? ` · ${s.counter_label}` : '' }} · {{ day(s.opened_at) }}
                </span>
              </button>
            </li>
          </ul>
          <footer v-if="meta.last_page > 1" class="pager">
            <button class="btn btn-outline btn-sm" :disabled="meta.current_page <= 1" @click="load(meta.current_page - 1)">Previous</button>
            <span>{{ meta.current_page }} / {{ meta.last_page }}</span>
            <button class="btn btn-outline btn-sm" :disabled="meta.current_page >= meta.last_page" @click="load(meta.current_page + 1)">Next</button>
          </footer>
        </section>

        <!-- READING -->
        <section class="card detail-card" aria-label="Shift reading">
          <div v-if="detailLoading" class="skeleton skeleton--doc" />
          <div v-else-if="!selected" class="empty">
            <AssetIcon name="receipt" :size="30" />
            <h3>Pick a shift</h3>
            <p>Its reading shows the drawer and every payment taken in it.</p>
          </div>
          <template v-else>
            <header class="detail-head">
              <div>
                <h2 class="detail-title mono">{{ selected.session_number }}</h2>
                <p class="detail-sub">
                  {{ selected.cashier?.name || '—' }}{{ selected.counter_label ? ` · ${selected.counter_label}` : '' }}
                  · opened {{ when(selected.opened_at) }}
                  <template v-if="selected.closed_at"> · closed {{ when(selected.closed_at) }}<template v-if="selected.closed_by"> by {{ selected.closed_by }}</template></template>
                </p>
              </div>
              <div class="detail-actions">
                <button class="btn btn-outline btn-sm" :disabled="downloading" @click="download">
                  <AssetIcon name="download" :size="14" />
                  {{ selected.status === 'open' ? 'X reading' : 'Z report' }} PDF
                </button>
                <button
                  v-if="selected.status === 'open' && mayOversee && selected.cashier?.id !== user?.id"
                  class="btn btn-outline btn-sm"
                  @click="closing = true"
                >
                  Close for cashier
                </button>
              </div>
            </header>

            <dl class="drawer">
              <div><dt>Opening float</dt><dd>{{ pesos(selected.figures?.opening_float) }}</dd></div>
              <div><dt>Cash taken</dt><dd>{{ pesos(selected.figures?.cash_collected) }}</dd></div>
              <div><dt>Cash voided</dt><dd>{{ pesos(selected.figures?.cash_voided) }}</dd></div>
              <div class="drawer-strong"><dt>Expected in drawer</dt><dd>{{ pesos(selected.figures?.expected_cash) }}</dd></div>
              <template v-if="selected.status === 'closed'">
                <div class="drawer-strong"><dt>Counted</dt><dd>{{ pesos(selected.figures?.counted_cash) }}</dd></div>
                <div :class="`drawer-variance ${varianceTone(selected)}`"><dt>Difference</dt><dd>{{ shiftVariance(selected.figures?.variance).label }}</dd></div>
              </template>
              <div><dt>GCash at the counter</dt><dd>{{ pesos(selected.figures?.gcash_counter) }}</dd></div>
              <div><dt>GCash checkouts</dt><dd>{{ pesos(selected.figures?.gcash_checkout) }}</dd></div>
              <div class="drawer-strong"><dt>Total collected</dt><dd>{{ pesos(selected.figures?.total_collected) }}</dd></div>
            </dl>

            <p v-if="selected.closing_note" class="note"><strong>Note at close:</strong> {{ selected.closing_note }}</p>
            <p v-if="selected.pending_voids" class="banner banner--warn">
              {{ selected.pending_voids }} void request{{ selected.pending_voids === 1 ? '' : 's' }} on this shift's payments
              await{{ selected.pending_voids === 1 ? 's' : '' }} a decision. The shift cannot close until then.
            </p>

            <h3 class="section-title">Transactions</h3>
            <p v-if="!selected.transactions?.length" class="muted">Nothing was taken in this shift.</p>
            <div v-else class="table-wrap">
              <table class="tx-table">
                <thead>
                  <tr>
                    <th scope="col">Transaction</th><th scope="col">Time</th><th scope="col">Request</th>
                    <th scope="col">Type</th><th scope="col">Method</th><th scope="col">Receipt</th><th scope="col" class="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in selected.transactions" :key="row.id">
                    <td class="mono">{{ row.transaction_number }}</td>
                    <td>{{ time(row.occurred_at) }}</td>
                    <td class="mono">{{ row.request?.reference_number || '—' }}</td>
                    <td><span class="chip" :class="`tone--${transactionTone(row.type)}`">{{ row.type_label }}</span></td>
                    <td>{{ row.payment_method_label || '—' }}</td>
                    <td class="mono">{{ row.receipt?.receipt_number || '—' }}</td>
                    <td class="num">{{ journalAmount(row) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </section>
      </div>
    </div>

    <CashCountDialog
      v-if="closing && selected"
      :shift="selected"
      :busy="closingBusy"
      :error="closeError"
      @close="closing = false"
      @confirm="closeForCashier"
    />
  </div>
</template>

<script setup>
/**
 * Cash shifts and their readings.
 *
 * A cashier sees their own; the Billing Supervisor, or the centre's
 * supervisor, sees every cashier's and may close one a cashier left open,
 * counting the drawer themselves. The figures are the server's, worked out
 * from each shift's journal and frozen at close.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import CashCountDialog from '~/components/BloodCenter/CashCountDialog.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { journalAmount, pesos, saveBlob, shiftVariance, transactionTone } from '~/utils/billing'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'billing.record_payment',
})

const route = useRoute()
const { user } = useUser()

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
]

const toasts = ref([])
let toastId = 0
function toast(title, variant = 'success', message = '') {
  const id = ++toastId
  toasts.value.push({ id, title, message, variant })
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, 3600)
}

const shifts = ref([])
const meta = reactive({ current_page: 1, last_page: 1 })
const mayOversee = ref(false)
const shiftsEnabled = ref(true)
const loading = ref(true)
const status = ref('')
const from = ref('')
const to = ref('')

const selected = ref(null)
const detailLoading = ref(false)
const downloading = ref(false)
const closing = ref(false)
const closingBusy = ref(false)
const closeError = ref('')

function when(iso) {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}

function day(iso) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'
}

function time(iso) {
  return iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '—'
}

function varianceTone(shift) {
  return `tone--${shiftVariance(shift?.variance ?? shift?.figures?.variance).tone}`
}

async function load(page = 1) {
  loading.value = true

  try {
    const response = await bloodCenterService.cashShifts({
      page,
      ...(status.value ? { status: status.value } : {}),
      ...(from.value ? { from: from.value } : {}),
      ...(to.value ? { to: to.value } : {}),
    })
    shifts.value = response?.data ?? []
    mayOversee.value = Boolean(response?.may_oversee)
    shiftsEnabled.value = response?.shifts_enabled !== false
    meta.current_page = response?.current_page ?? 1
    meta.last_page = response?.last_page ?? 1
  } catch (err) {
    toast('Could Not Load Shifts', 'danger', err?.message)
    shifts.value = []
  } finally {
    loading.value = false
  }
}

async function select(id) {
  detailLoading.value = true

  try {
    selected.value = (await bloodCenterService.cashShift(id))?.session ?? null
  } catch (err) {
    toast('Shift Not Found', 'danger', err?.message)
    selected.value = null
  } finally {
    detailLoading.value = false
  }
}

async function download() {
  downloading.value = true

  try {
    const suffix = selected.value.status === 'open' ? 'X' : 'Z'
    saveBlob(await bloodCenterService.downloadShiftReport(selected.value.id), `${selected.value.session_number}-${suffix}.pdf`)
  } catch (err) {
    toast('Download Failed', 'danger', err?.message || 'The report could not be downloaded.')
  } finally {
    downloading.value = false
  }
}

async function closeForCashier(payload) {
  closingBusy.value = true
  closeError.value = ''

  try {
    const response = await bloodCenterService.closeShift(selected.value.id, payload)
    toast('Shift Closed', 'success', response.message)
    closing.value = false
    selected.value = response.session
    await load(meta.current_page)
  } catch (err) {
    const first = Object.values(err?.errors ?? {})[0]
    closeError.value = (Array.isArray(first) ? first[0] : first) || err?.message || 'The shift could not be closed.'
  } finally {
    closingBusy.value = false
  }
}

watch([status, from, to], () => load())

onMounted(async () => {
  await load()

  const preset = Number(route.query.shift)
  if (preset) await select(preset)
  else if (shifts.value[0]) await select(shifts.value[0].id)
})
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css. */
.cs-page { background: var(--rb-page-bg); font-family: var(--rb-font-sans); padding: 24px var(--rb-gutter, 24px) 40px; }
.cs-inner { max-width: var(--rb-content-max, 1600px); margin: 0 auto; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
.page-title { font-size: 20px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.page-subtitle { font-size: 13px; color: var(--rb-text-secondary); margin: 4px 0 0; max-width: 72ch; }
.header-actions .btn { text-decoration: none; }

.filters { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; margin-bottom: 14px; }
.pills { display: flex; gap: 6px; }
.pill {
  padding: 8px 14px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit;
  color: var(--rb-text-secondary); background: var(--rb-surface); border: 1px solid var(--rb-border-strong); border-radius: 999px;
}
.pill--on { border-color: var(--rb-primary); background: rgba(var(--rb-primary-rgb), .07); color: var(--rb-primary-text); }
.filter { display: flex; flex-direction: column; gap: 4px; font-size: 11.5px; font-weight: 600; color: var(--rb-text-secondary); }
.input {
  padding: 8px 10px; font-size: 13px; font-family: inherit; color: var(--rb-text-primary);
  background: var(--rb-surface); border: 1px solid var(--rb-border-strong); border-radius: 8px;
}

.cs-grid { display: grid; grid-template-columns: minmax(260px, 340px) minmax(0, 1fr); gap: 16px; align-items: start; }
.card { background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px; overflow: hidden; }
.list-card { padding: 10px; }
.detail-card { padding: 18px; }

.shift-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.shift-item {
  width: 100%; display: grid; grid-template-columns: 1fr auto; gap: 3px 8px; padding: 10px 12px; text-align: left;
  font-family: inherit; cursor: pointer; border-radius: 10px; background: var(--rb-surface); border: 1px solid var(--rb-border); color: var(--rb-text-primary);
}
.shift-item:hover { background: var(--rb-surface-hover); }
.shift-item--on { border-color: var(--rb-primary); box-shadow: inset 0 0 0 1px var(--rb-primary); }
.shift-item__num { font-size: 12.5px; font-weight: 700; }
.shift-item__meta { grid-column: 1 / -1; font-size: 12px; color: var(--rb-text-secondary); }

.detail-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.detail-title { font-size: 17px; font-weight: 800; margin: 0; color: var(--rb-text-primary); }
.detail-sub { font-size: 12.5px; color: var(--rb-text-secondary); margin: 3px 0 0; }
.detail-actions { display: flex; gap: 6px; flex-wrap: wrap; }

.drawer { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; margin: 0 0 14px; }
.drawer > div { border: 1px solid var(--rb-border); border-radius: 10px; padding: 9px 12px; }
.drawer dt { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; color: var(--rb-text-secondary); }
.drawer dd { margin: 3px 0 0; font-size: 16px; font-weight: 700; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.drawer-strong { background: var(--rb-surface-alt); }
.drawer-variance.tone--success dd { color: var(--rb-success-text); }
.drawer-variance.tone--warning dd { color: var(--rb-warning-text); }
.drawer-variance.tone--danger dd { color: var(--rb-accent-text); }

.note { font-size: 13px; color: var(--rb-text-primary); margin: 0 0 12px; }
.section-title { font-size: 13.5px; font-weight: 700; margin: 6px 0 8px; color: var(--rb-text-primary); }
.muted { font-size: 12.5px; color: var(--rb-text-muted); }
.table-wrap { overflow-x: auto; }
.tx-table { width: 100%; border-collapse: collapse; font-size: 12.5px; min-width: 640px; }
.tx-table th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: .4px; color: var(--rb-text-secondary); padding: 8px 10px; background: var(--rb-surface-alt); }
.tx-table td { padding: 8px 10px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); }
.num { text-align: right !important; white-space: nowrap; font-variant-numeric: tabular-nums; }
.mono { font-family: var(--rb-font-mono); font-size: 12px; }

.chip { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; white-space: nowrap; }
.tone--success { background: rgba(var(--rb-success-rgb), .12); color: var(--rb-success-text); }
.tone--warning { background: rgba(var(--rb-warning-rgb), .12); color: var(--rb-warning-text); }
.tone--danger { background: rgba(var(--rb-accent-rgb), .1); color: var(--rb-accent-text); }
.tone--info { background: rgba(var(--rb-primary-rgb), .08); color: var(--rb-primary-text); }
.tone--muted { background: var(--rb-surface-hover); color: var(--rb-text-secondary); }
.drawer-variance.tone--success, .drawer-variance.tone--warning, .drawer-variance.tone--danger { background: none; }

.banner { padding: 10px 13px; border-radius: 10px; font-size: 12.5px; margin: 0 0 12px; }
.banner--warn { background: rgba(var(--rb-warning-rgb), .1); color: var(--rb-warning-text); border: 1px solid rgba(var(--rb-warning-rgb), .3); }

.pager { display: flex; justify-content: center; align-items: center; gap: 10px; padding: 10px 4px 2px; font-size: 12px; color: var(--rb-text-secondary); }

.empty { text-align: center; padding: 48px 16px; color: var(--rb-text-secondary); }
.empty h3 { font-size: 15px; color: var(--rb-text-primary); margin: 10px 0 4px; }
.empty p { font-size: 13px; margin: 0; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 15px; font-size: 13px; font-weight: 600; font-family: inherit;
  border-radius: 8px; cursor: pointer; white-space: nowrap;
}
.btn-primary { background: var(--rb-primary); color: #fff; border: 1px solid var(--rb-primary); }
.btn-outline { background: var(--rb-surface); color: var(--rb-text-primary); border: 1px solid var(--rb-border-strong); }
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn-sm { padding: 6px 11px; font-size: 12px; }

.skeleton-wrap { padding: 6px; }
.skeleton {
  border-radius: 7px; margin-bottom: 8px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 50%, var(--rb-skeleton-a) 75%);
  background-size: 200% 100%; animation: shimmer 1.4s infinite;
}
.skeleton--row { height: 52px; }
.skeleton--doc { height: 380px; }
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

.toast-stack { position: fixed; top: 18px; right: 18px; z-index: 120; display: flex; flex-direction: column; gap: 8px; }
.toast { background: var(--rb-surface); border: 1px solid var(--rb-border-strong); border-radius: 10px; padding: 11px 15px; min-width: 250px; box-shadow: 0 6px 20px rgba(var(--rb-shadow-rgb), .1); }
.toast--danger .toast-title { color: var(--rb-accent-text); }
.toast--success .toast-title { color: var(--rb-success-text); }
.toast-title { font-size: 13px; font-weight: 600; color: var(--rb-text-primary); }
.toast-message { font-size: 12px; color: var(--rb-text-secondary); margin-top: 2px; }
.toast-enter-active, .toast-leave-active { transition: opacity .25s, transform .25s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(14px); }

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
  .toast-enter-active, .toast-leave-active { transition: none; }
}

@media (max-width: 900px) {
  .cs-grid { grid-template-columns: 1fr; }
}
</style>
