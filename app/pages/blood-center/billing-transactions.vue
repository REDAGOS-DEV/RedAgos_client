<template>
  <div class="tx-page">
    <div class="tx-inner">
      <header class="page-header">
        <div>
          <h1 class="page-title">Billing Transactions</h1>
          <p class="page-subtitle">
            Every money event on this centre's bills, numbered and in order: charges as units are reserved,
            payments at the counter and through GCash, subsidies, corrections, voids and hospital settlements.
            Nothing here is ever edited; a mistake is answered by a further transaction.
          </p>
        </div>
        <div class="header-actions">
          <NuxtLink to="/blood-center/billing" class="btn btn-outline">Bills &amp; statements</NuxtLink>
          <button class="btn btn-outline" :disabled="exporting" @click="exportCsv">
            <AssetIcon name="download" :size="15" />
            {{ exporting ? 'Exporting…' : 'Export CSV' }}
          </button>
        </div>
      </header>

      <!-- FILTERS -->
      <section class="filters" aria-label="Filters">
        <label class="filter">
          <span>From</span>
          <input v-model="filters.from" type="date" class="input">
        </label>
        <label class="filter">
          <span>To</span>
          <input v-model="filters.to" type="date" class="input">
        </label>
        <label class="filter">
          <span>Category</span>
          <select v-model="filters.category" class="input">
            <option value="">All</option>
            <option value="patient_transfusion">Patient transfusion</option>
            <option value="weekly_replenishment">Weekly replenishment</option>
          </select>
        </label>
        <label class="filter">
          <span>Type</span>
          <select v-model="filters.type" class="input">
            <option value="">All</option>
            <option v-for="t in TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
        </label>
        <label class="filter">
          <span>Channel</span>
          <select v-model="filters.channel" class="input">
            <option value="">All</option>
            <option value="counter">Counter</option>
            <option value="gateway">GCash checkout</option>
            <option value="outside">Outside RedAgos</option>
            <option value="system">System</option>
          </select>
        </label>
        <label class="filter">
          <span>Method</span>
          <select v-model="filters.payment_method" class="input">
            <option value="">All</option>
            <option value="cash">Cash</option>
            <option value="gcash">GCash</option>
          </select>
        </label>
        <label class="filter filter--search">
          <span>Search</span>
          <input v-model.trim="filters.search" type="search" class="input" placeholder="TXN, request or payment reference" @input="onSearch">
        </label>
        <button class="btn btn-ghost" @click="reset">Reset</button>
      </section>

      <!-- TOTALS for everything the filters match, not just this page -->
      <section v-if="totals" class="totals" aria-label="Totals">
        <div class="total"><span>Transactions</span><strong>{{ totals.count }}</strong></div>
        <div class="total"><span>Charged</span><strong>{{ pesos(totals.charged) }}</strong></div>
        <div class="total total--good"><span>Collected</span><strong>{{ pesos(totals.collected) }}</strong></div>
        <div class="total"><span>Subsidised</span><strong>{{ pesos(totals.subsidised) }}</strong></div>
        <div class="total"><span>Settled by hospitals</span><strong>{{ pesos(totals.settled_outside) }}</strong></div>
      </section>

      <p v-if="error" class="banner banner--error">{{ error }}</p>

      <div class="card">
        <div v-if="loading" class="skeleton-wrap">
          <div v-for="n in 6" :key="n" class="skeleton skeleton--row" />
        </div>

        <div v-else-if="!rows.length" class="empty">
          <AssetIcon name="list" :size="32" />
          <h3>No transactions</h3>
          <p>Nothing matches these filters.</p>
        </div>

        <div v-else class="table-wrap">
          <table class="tx-table">
            <thead>
              <tr>
                <th scope="col">Transaction</th>
                <th scope="col">When</th>
                <th scope="col">Request</th>
                <th scope="col">Category</th>
                <th scope="col">Type</th>
                <th scope="col">Channel</th>
                <th scope="col" class="num">Amount</th>
                <th scope="col" class="num">Balance</th>
                <th scope="col">Documents</th>
                <th scope="col">By</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.id">
                <td class="mono">{{ row.transaction_number }}</td>
                <td class="nowrap">{{ when(row.occurred_at) }}</td>
                <td class="mono">{{ row.request?.reference_number || '—' }}</td>
                <td>{{ row.category_label }}</td>
                <td>
                  <span class="chip" :class="`tone--${transactionTone(row.type)}`">{{ row.type_label }}</span>
                  <span v-if="row.reverses_transaction_number" class="sub">reverses {{ row.reverses_transaction_number }}</span>
                  <span v-if="row.note" class="sub">{{ row.note }}</span>
                </td>
                <td>
                  {{ row.channel_label }}
                  <span v-if="row.payment_method_label" class="sub">{{ row.payment_method_label }}</span>
                </td>
                <td class="num amount" :class="`amount--${row.direction}`">{{ journalAmount(row) }}</td>
                <td class="num">{{ pesos(row.balance_after) }}</td>
                <td class="docs">
                  <span v-if="row.receipt" class="mono">{{ row.receipt.receipt_number }}</span>
                  <span v-if="row.statement" class="mono">{{ row.statement.document_number }}</span>
                  <span v-if="row.cash_session" class="mono">{{ row.cash_session.session_number }}</span>
                  <span v-if="row.reference" class="mono sub">Ref {{ row.reference }}</span>
                </td>
                <td>{{ row.recorded_by || (row.channel === 'gateway' ? 'Provider' : 'System') }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer v-if="meta.last_page > 1" class="pager">
          <button class="btn btn-outline btn-sm" :disabled="meta.current_page <= 1 || loading" @click="load(meta.current_page - 1)">Previous</button>
          <span>Page {{ meta.current_page }} of {{ meta.last_page }}</span>
          <button class="btn btn-outline btn-sm" :disabled="meta.current_page >= meta.last_page || loading" @click="load(meta.current_page + 1)">Next</button>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * The centre's billing journal, as the server keeps it.
 *
 * Read only. Every row was written in the same transaction as the change it
 * records, and the database refuses to change or delete one. The totals are
 * the server's, over everything the filters match — not added up from the page
 * on screen.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { journalAmount, pesos, saveBlob, transactionTone } from '~/utils/billing'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'billing.record_payment',
})

const TYPES = [
  { value: 'charge', label: 'Charge' },
  { value: 'charge_adjustment', label: 'Charge adjustment' },
  { value: 'payment', label: 'Payment' },
  { value: 'payment_correction', label: 'Payment correction' },
  { value: 'payment_void', label: 'Payment void' },
  { value: 'subsidy', label: 'Government subsidy' },
  { value: 'external_settlement', label: 'Settled by hospital' },
  { value: 'opening_balance', label: 'Opening balance' },
]

const blank = () => ({ from: '', to: '', category: '', type: '', channel: '', payment_method: '', search: '' })

const filters = reactive(blank())
const rows = ref([])
const totals = ref(null)
const meta = reactive({ current_page: 1, last_page: 1 })
const loading = ref(true)
const error = ref('')
const exporting = ref(false)

function params() {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''))
}

function when(iso) {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}

async function load(page = 1) {
  loading.value = true
  error.value = ''

  try {
    const response = await bloodCenterService.billingTransactions({ ...params(), page, per_page: 50 })
    rows.value = response?.data ?? []
    totals.value = response?.totals ?? null
    meta.current_page = response?.current_page ?? 1
    meta.last_page = response?.last_page ?? 1
  } catch (err) {
    const first = Object.values(err?.errors ?? {})[0]
    error.value = (Array.isArray(first) ? first[0] : first) || err?.message || 'Could not load the transactions.'
    rows.value = []
  } finally {
    loading.value = false
  }
}

let searchTimer = null
function onSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => load(), 400)
}

watch(() => [filters.from, filters.to, filters.category, filters.type, filters.channel, filters.payment_method], () => load())

function reset() {
  Object.assign(filters, blank())
}

async function exportCsv() {
  exporting.value = true

  try {
    saveBlob(await bloodCenterService.exportBillingTransactions(params()), `billing-transactions-${new Date().toISOString().slice(0, 10)}.csv`)
  } catch (err) {
    error.value = err?.message || 'The export failed.'
  } finally {
    exporting.value = false
  }
}

onMounted(() => load())
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css. */
.tx-page { background: var(--rb-page-bg); font-family: var(--rb-font-sans); padding: 24px var(--rb-gutter, 24px) 40px; }
.tx-inner { max-width: var(--rb-content-max, 1600px); margin: 0 auto; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
.page-title { font-size: 20px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.page-subtitle { font-size: 13px; color: var(--rb-text-secondary); margin: 4px 0 0; max-width: 78ch; }
.header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.header-actions .btn { text-decoration: none; }

.filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; margin-bottom: 12px; }
.filter { display: flex; flex-direction: column; gap: 4px; font-size: 11.5px; font-weight: 600; color: var(--rb-text-secondary); min-width: 140px; }
.filter--search { flex: 1; min-width: 220px; }
.input {
  width: 100%; padding: 8px 10px; font-size: 13px; font-family: inherit;
  color: var(--rb-text-primary); background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 8px;
}
.input:focus { outline: none; border-color: var(--rb-primary); }

.totals { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
.total { background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 3px; }
.total span { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; color: var(--rb-text-secondary); }
.total strong { font-size: 18px; font-weight: 700; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.total--good strong { color: var(--rb-success-text); }

.card { background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px; overflow: hidden; }
.table-wrap { overflow-x: auto; }
.tx-table { width: 100%; border-collapse: collapse; font-size: 12.5px; min-width: 1100px; }
.tx-table th {
  text-align: left; font-size: 10.5px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase;
  color: var(--rb-text-secondary); padding: 10px 12px; border-bottom: 1px solid var(--rb-border-strong); background: var(--rb-surface-alt);
}
.tx-table td { padding: 10px 12px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); vertical-align: top; }
.tx-table tr:last-child td { border-bottom: none; }
.num { text-align: right !important; white-space: nowrap; font-variant-numeric: tabular-nums; }
.nowrap { white-space: nowrap; }
.mono { font-family: var(--rb-font-mono); font-size: 12px; }
.sub { display: block; font-size: 11.5px; color: var(--rb-text-secondary); margin-top: 2px; }
.docs { display: flex; flex-direction: column; gap: 2px; }
.amount { font-weight: 700; }
.amount--debit { color: var(--rb-text-primary); }
.amount--credit { color: var(--rb-success-text); }
.amount--none { color: var(--rb-text-muted); }

.chip { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; white-space: nowrap; }
.tone--success { background: rgba(var(--rb-success-rgb), .12); color: var(--rb-success-text); }
.tone--warning { background: rgba(var(--rb-warning-rgb), .12); color: var(--rb-warning-text); }
.tone--danger { background: rgba(var(--rb-accent-rgb), .1); color: var(--rb-accent-text); }
.tone--info { background: rgba(var(--rb-primary-rgb), .08); color: var(--rb-primary-text); }
.tone--muted { background: var(--rb-surface-hover); color: var(--rb-text-secondary); }

.pager { display: flex; justify-content: center; align-items: center; gap: 12px; padding: 12px; font-size: 12.5px; color: var(--rb-text-secondary); border-top: 1px solid var(--rb-border); }

.banner { padding: 11px 14px; border-radius: 10px; font-size: 13px; margin: 0 0 12px; }
.banner--error { background: rgba(var(--rb-accent-rgb), .08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), .25); }

.empty { text-align: center; padding: 48px 20px; color: var(--rb-text-secondary); }
.empty h3 { font-size: 15px; color: var(--rb-text-primary); margin: 10px 0 4px; }
.empty p { font-size: 13px; margin: 0; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 15px; font-size: 13px; font-weight: 600; font-family: inherit;
  border-radius: 8px; cursor: pointer; white-space: nowrap;
}
.btn-outline { background: var(--rb-surface); color: var(--rb-text-primary); border: 1px solid var(--rb-border-strong); }
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn-ghost { background: transparent; color: var(--rb-text-secondary); border: 1px solid transparent; }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn-sm { padding: 6px 11px; font-size: 12px; }

.skeleton-wrap { padding: 14px; }
.skeleton {
  border-radius: 7px; margin-bottom: 8px; height: 34px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 50%, var(--rb-skeleton-a) 75%);
  background-size: 200% 100%; animation: shimmer 1.4s infinite;
}
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
}

@media (max-width: 900px) {
  .totals { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
