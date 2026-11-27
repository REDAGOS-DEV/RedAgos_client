<template>
  <div class="tx-page">
    <div class="tx-inner">
      <!-- Payments, the Transactions tab (2026-10-27). -->
      <PageHeader title="Payments">
        <template #actions>
          <button class="ui-btn ui-btn--download" :disabled="exporting" @click="exportCsv">
            <AssetIcon name="download" :size="15" />
            {{ exporting ? 'Exporting…' : 'Export CSV' }}
          </button>
        </template>
      </PageHeader>
      <BloodCenterPaymentsTabs class="pay-tabs-row" />

      <p v-if="error" class="banner banner--error">{{ error }}</p>

      <div class="card">
        <!-- FILTERS, inside the card (2026-10-27): the common ones in reach, the rest one click away -->
        <div class="filter-bar" aria-label="Filters">
          <div class="search">
            <AssetIcon name="search" :size="16" class="search-icon" />
            <input v-model.trim="filters.search" type="search" class="input search-input" placeholder="TXN, request or payment reference" aria-label="Search transactions" @input="onSearch">
          </div>
          <div class="range">
            <DatePicker id="tx-from" v-model="filters.from" :max="filters.to || undefined" placeholder="From" aria-label="From" size="sm" />
            <span class="range-sep" aria-hidden="true">–</span>
            <DatePicker id="tx-to" v-model="filters.to" :min="filters.from || undefined" placeholder="To" aria-label="To" size="sm" />
          </div>
          <div class="select-sm">
            <SelectField id="tx-type" v-model="filters.type" :options="typeOptions" icon="sliders-horizontal" size="sm" />
          </div>
          <button type="button" class="ui-btn btn-filters" :class="{ 'btn-filters--on': moreOpen }" :aria-expanded="moreOpen" aria-controls="tx-more" @click="moreOpen = !moreOpen">
            <AssetIcon name="sliders-horizontal" :size="15" />
            More filters
            <span v-if="moreCount" class="count-badge">{{ moreCount }}</span>
          </button>

          <div v-if="moreOpen" id="tx-more" class="more">
            <div class="field">
              <label for="tx-category" class="field-label">Category</label>
              <SelectField id="tx-category" v-model="filters.category" :options="CATEGORY_OPTIONS" size="sm" />
            </div>
            <div class="field">
              <label for="tx-channel" class="field-label">Channel</label>
              <SelectField id="tx-channel" v-model="filters.channel" :options="CHANNEL_OPTIONS" size="sm" />
            </div>
            <div class="field">
              <label for="tx-method" class="field-label">Method</label>
              <SelectField id="tx-method" v-model="filters.payment_method" :options="methodOptions" size="sm" />
            </div>
          </div>

          <div v-if="activeChips.length" class="chips" aria-label="Active filters">
            <span v-for="chip in activeChips" :key="chip.key" class="chip-filter">
              <span class="chip-filter-label">{{ chip.label }}</span>
              <button type="button" :aria-label="`Remove ${chip.label}`" @click="filters[chip.key] = ''"><AssetIcon name="x" :size="12" /></button>
            </span>
            <button class="ui-btn ui-btn--ghost ui-btn--sm" @click="reset">Clear all</button>
          </div>
        </div>
        <div v-if="loading" class="skeleton-wrap"><SkeletonList :rows="6" /></div>

        <div v-else-if="!rows.length" class="pay-empty">
          <span class="pay-empty__icon" aria-hidden="true"><AssetIcon :name="activeChips.length || filters.search ? 'search-x' : 'list'" :size="24" /></span>
          <h2 class="pay-empty__title">{{ activeChips.length || filters.search ? 'No transaction matches these filters' : 'No transactions yet' }}</h2>
          <p class="pay-empty__text">
            {{ activeChips.length || filters.search
              ? 'Try another number, widen the dates, or clear a filter.'
              : 'Every charge, payment, subsidy and void is written to this journal as it happens, and never changed.' }}
          </p>
          <button v-if="activeChips.length || filters.search" type="button" class="ui-btn" @click="reset">
            <AssetIcon name="x" :size="14" />
            Clear filters
          </button>
        </div>

        <!--
          THE JOURNAL, newest first: one plain value a column (project owner,
          2026-11-27; it was a ledger grouped by day, two lines a row). The
          eye shows everything else the entry holds.
        -->
        <div v-else class="table-scroll">
          <table class="tx-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Transaction</th>
                <th scope="col">Type</th>
                <th scope="col">Request</th>
                <th scope="col">Billed to</th>
                <th scope="col">Method</th>
                <th scope="col" class="num">Amount</th>
                <th scope="col" class="num">Balance after</th>
                <th scope="col"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.id" class="row" @click="viewing = row">
                <td class="nowrap">{{ when(row.occurred_at) }}</td>
                <td class="mono nowrap">{{ row.transaction_number }}</td>
                <td class="nowrap">{{ row.type_label }}</td>
                <td class="nowrap">
                  <NuxtLink v-if="row.request" :to="`/blood-center/invoice/${row.request.id}`" class="mono doc-link" @click.stop>{{ row.request.reference_number }}</NuxtLink>
                  <template v-else>—</template>
                </td>
                <td>{{ row.request?.patient_name || row.request?.requesting_facility || '—' }}</td>
                <td class="nowrap">{{ row.payment_method_label || '—' }}</td>
                <td class="num">{{ journalAmount(row) }}</td>
                <td class="num">{{ pesos(row.balance_after) }}</td>
                <td class="row-actions" @click.stop>
                  <RowViewButton :label="`View ${row.transaction_number}`" @view="viewing = row" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer v-if="meta.last_page > 1" class="pager">
          <button class="ui-btn ui-btn--sm" :disabled="meta.current_page <= 1 || loading" @click="load(meta.current_page - 1)">Previous</button>
          <span>Page {{ meta.current_page }} of {{ meta.last_page }}</span>
          <button class="ui-btn ui-btn--sm" :disabled="meta.current_page >= meta.last_page || loading" @click="load(meta.current_page + 1)">Next</button>
        </footer>
      </div>
    </div>

    <!-- Everything about the journal entry the row names, read only. -->
    <RecordDialog :open="Boolean(viewing)" :title="viewing?.transaction_number || 'Transaction'" eyebrow="Transaction" :sections="viewSections" @close="viewing = null" />
  </div>
</template>

<script setup>
/**
 * The centre's billing journal, as the server keeps it.
 *
 * Read only. Every row was written in the same transaction as the change it
 * records, and the database refuses to change or delete one.
 *
 * A table, one plain value a column, with each entry's eye showing the rest
 * (project owner, 2026-11-27; it was a ledger grouped by day, two lines a
 * row). The less-used filters fold away. The money-flow strip above it was
 * removed (project owner, 2026-10-25): the page shows the transactions only.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import DatePicker from '~/components/common/DatePicker.vue'
import SelectField from '~/components/common/SelectField.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { RECORDED_METHODS, journalAmount, pesos, saveBlob } from '~/utils/billing'
import SkeletonList from '~/components/ui/SkeletonList.vue'
import RecordDialog from '~/components/ui/RecordDialog.vue'
import RowViewButton from '~/components/ui/RowViewButton.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import { onPageReturn } from '~/composables/useKeptAlive'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'billing.record_payment',
  keepalive: true,
})

const TYPES = [
  { value: 'charge', label: 'Charge' },
  { value: 'charge_adjustment', label: 'Charge adjustment' },
  { value: 'payment', label: 'Payment' },
  { value: 'payment_correction', label: 'Payment correction' },
  { value: 'payment_void', label: 'Payment void' },
  { value: 'subsidy', label: 'Government subsidy' },
  { value: 'discount', label: 'Discount' },
  { value: 'discount_reversal', label: 'Discount removed' },
  { value: 'external_settlement', label: 'Settled by hospital' },
  { value: 'opening_balance', label: 'Opening balance' },
]

const CATEGORY_OPTIONS = [
  { value: '', label: 'All categories' },
  { value: 'patient_transfusion', label: 'Patient transfusion' },
  { value: 'weekly_replenishment', label: 'Weekly replenishment' },
]

const CHANNEL_OPTIONS = [
  { value: '', label: 'All channels' },
  { value: 'counter', label: 'Counter' },
  { value: 'gateway', label: 'GCash checkout' },
  { value: 'outside', label: 'Outside RedAgos' },
  { value: 'system', label: 'System' },
]

const typeOptions = [{ value: '', label: 'All types' }, ...TYPES]
const methodOptions = [{ value: '', label: 'All methods' }, ...RECORDED_METHODS.map((m) => ({ value: m.value, label: m.label }))]

const blank = () => ({ from: '', to: '', category: '', type: '', channel: '', payment_method: '', search: '' })

const filters = reactive(blank())
const rows = ref([])
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

/* FILTERS: Category, Channel and Method fold away; every active one shows as a chip. */
const moreOpen = ref(false)
const moreCount = computed(() => ['category', 'channel', 'payment_method'].filter((k) => filters[k] !== '').length)

function labelIn(options, value) {
  return options.find((o) => o.value === value)?.label ?? value
}

function shortDay(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

const activeChips = computed(() => [
  filters.from && { key: 'from', label: `From ${shortDay(filters.from)}` },
  filters.to && { key: 'to', label: `To ${shortDay(filters.to)}` },
  filters.type && { key: 'type', label: labelIn(typeOptions, filters.type) },
  filters.category && { key: 'category', label: labelIn(CATEGORY_OPTIONS, filters.category) },
  filters.channel && { key: 'channel', label: labelIn(CHANNEL_OPTIONS, filters.channel) },
  filters.payment_method && { key: 'payment_method', label: labelIn(methodOptions, filters.payment_method) },
  filters.search && { key: 'search', label: `“${filters.search}”` },
].filter(Boolean))

/* VIEW: the row's eye opens everything the table leaves out (project owner, 2026-11-27) */
const viewing = ref(null)
const viewSections = computed(() => {
  const row = viewing.value
  if (!row) return []
  const request = row.request
  return [
    { title: 'Transaction', rows: [
      { label: 'Transaction number', value: row.transaction_number, mono: true },
      { label: 'Date', value: when(row.occurred_at) },
      { label: 'Type', value: row.type_label },
      { label: 'Category', value: row.category_label },
      { label: 'Channel', value: row.channel_label },
      { label: 'Method', value: row.payment_method_label },
      { label: 'Recorded by', value: row.recorded_by || (row.channel === 'gateway' ? 'Provider' : 'System') },
      { label: 'Reverses', value: row.reverses_transaction_number, mono: true },
      { label: 'Note', value: row.note, wide: true },
    ] },
    { title: 'Amount', rows: [
      { label: 'Amount', value: journalAmount(row) },
      { label: 'Entry', value: row.direction === 'debit' ? 'Charge (adds to the balance)' : row.direction === 'credit' ? 'Credit (takes off the balance)' : '' },
      { label: 'Balance after', value: pesos(row.balance_after) },
    ] },
    { title: 'Bill', rows: [
      { label: 'Request', value: request?.reference_number, mono: true, to: request ? `/blood-center/invoice/${request.id}` : '' },
      { label: 'Patient', value: request?.patient_name },
      { label: 'Hospital', value: request?.requesting_facility },
      { label: 'Invoice', value: row.statement?.document_number, mono: true },
      { label: 'Receipt', value: row.receipt?.receipt_number, mono: true, to: row.receipt ? `/blood-center/receipt/${row.receipt.id}` : '' },
      { label: 'Cash shift', value: row.cash_session?.session_number, mono: true },
      { label: 'Reference', value: row.reference, mono: true },
    ] },
  ]
})

// `quiet`, on return to this kept-alive page: no skeleton over the rows on screen.
async function load(page = 1, options = {}) {
  // Read, not destructured: an event or watch handing its own value in may hand in null.
  const quiet = options?.quiet === true
  if (!quiet) loading.value = true
  error.value = ''

  try {
    const response = await bloodCenterService.billingTransactions({ ...params(), page, per_page: 50 })
    rows.value = response?.data ?? []
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
onPageReturn(() => load(meta.current_page, { quiet: true }))
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css. */
.tx-page { background: var(--rb-page-bg); font-family: var(--rb-font-sans); padding: 24px var(--rb-gutter, 24px) 40px; }
.tx-inner { max-width: var(--rb-content-max, 1600px); margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }

/* Text | actions. The actions never wrap under the text, so they stay right at every width. */
.page-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 16px; }
.page-heading { min-width: 0; }
.page-title { font-size: 24px; font-weight: 800; letter-spacing: -0.01em; color: var(--rb-text-primary); margin: 0; }
.page-subtitle { font-size: 13px; color: var(--rb-text-secondary); margin: 4px 0 0; max-width: 78ch; }
.header-actions { display: flex; gap: 8px; justify-content: flex-end; }
.header-actions .btn { text-decoration: none; }


/* Filter bar */
.filter-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.search { position: relative; flex: 1 1 260px; min-width: 220px; }
.search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--rb-text-muted); pointer-events: none; }
.input {
  width: 100%; height: 36px; padding: 0 11px; font-size: 13px; font-family: inherit;
  color: var(--rb-text-primary); background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 9px;
}
.input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }
.search .search-input { padding-left: 36px; }
.range { display: flex; align-items: center; gap: 6px; }
.range > :not(.range-sep) { width: 160px; }
.range-sep { color: var(--rb-text-muted); }
.select-sm { width: 210px; }
.btn-filters { height: 36px; }
.btn-filters--on { border-color: var(--rb-primary); color: var(--rb-primary-text); }
.count-badge { min-width: 18px; padding: 0 6px; border-radius: 999px; font-size: 11px; font-weight: 800; color: #fff; background: var(--rb-primary); text-align: center; }

.more {
  flex-basis: 100%; display: grid; grid-template-columns: repeat(3, minmax(0, 220px)); gap: 12px;
  padding: 12px 14px; background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 12px;
}
.field { display: flex; flex-direction: column; gap: 5px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); }

.chips { flex-basis: 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.chip-filter {
  display: inline-flex; align-items: center; gap: 4px; padding: 3px 4px 3px 10px; border-radius: 999px;
  font-size: 12px; font-weight: 600; color: var(--rb-primary-text);
  background: rgba(var(--rb-primary-rgb), .08); border: 1px solid rgba(var(--rb-primary-rgb), .2);
}
.chip-filter button { display: grid; place-items: center; width: 18px; height: 18px; border: 0; border-radius: 50%; background: transparent; color: inherit; cursor: pointer; }
.chip-filter button:hover { background: rgba(var(--rb-primary-rgb), .15); }
.chip-filter button:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

/* The journal */
.card { background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px; overflow: hidden; }
.table-scroll { overflow-x: auto; }
.tx-table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.tx-table th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--rb-text-secondary); background: var(--rb-surface-alt); padding: 10px 14px; border-bottom: 1px solid var(--rb-border); white-space: nowrap; }
.tx-table td { padding: 13px 14px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); vertical-align: middle; }
.tx-table tbody tr:last-child td { border-bottom: 0; }
.row { cursor: pointer; transition: background-color .12s var(--rb-ease-out); }
.row:hover td { background: var(--rb-surface-hover); }
.num { text-align: right !important; white-space: nowrap; }
.nowrap { white-space: nowrap; }
.row-actions { text-align: right; white-space: nowrap; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

.mono { font-family: var(--rb-font-mono); font-size: 12px; }
.muted { color: var(--rb-text-muted); }
.doc-link { color: var(--rb-primary-text); font-weight: 700; text-decoration: none; }
.doc-link:hover { text-decoration: underline; text-underline-offset: 3px; }


.pager { display: flex; justify-content: center; align-items: center; gap: 12px; padding: 12px; font-size: 12.5px; color: var(--rb-text-secondary); border-top: 1px solid var(--rb-border); }

.banner { padding: 11px 14px; border-radius: 10px; font-size: 13px; margin: 0; }
.banner--error { background: rgba(var(--rb-accent-rgb), .08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), .25); }

.empty { text-align: center; padding: 56px 20px; color: var(--rb-text-secondary); display: flex; flex-direction: column; align-items: center; gap: 6px; }
.empty-icon { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; color: var(--rb-text-secondary); background: var(--rb-surface-alt); border: 1px solid var(--rb-border); margin-bottom: 4px; }
.empty h3 { font-size: 15px; color: var(--rb-text-primary); margin: 0; }
.empty p { font-size: 13px; margin: 0; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 14px; font-size: 13px; font-weight: 600; font-family: inherit;
  border-radius: 9px; cursor: pointer; white-space: nowrap; text-decoration: none;
  transition: background-color .15s var(--rb-ease-out), border-color .15s var(--rb-ease-out);
}
.btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.btn-primary { background: var(--rb-primary); color: #fff; border: 1px solid var(--rb-primary); }
.btn-primary:hover:not(:disabled) { background: #10509c; }
.btn-outline { background: var(--rb-surface); color: var(--rb-text-primary); border: 1px solid var(--rb-border-strong); }
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn-ghost { background: transparent; color: var(--rb-primary-text); border: 1px solid transparent; }
.btn-ghost:hover:not(:disabled) { background: rgba(var(--rb-primary-rgb), .07); }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn-sm { padding: 5px 10px; font-size: 12px; }

.skeleton-wrap { padding: 14px; }
.skeleton {
  display: block; border-radius: 6px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 50%, var(--rb-skeleton-a) 75%);
  background-size: 200% 100%; animation: shimmer 1.4s infinite;
}
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
  .btn, .row { transition: none; }
}

@media (max-width: 960px) {
  .more { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
}

/* The Payments tabs sit at their own width, under the title. */
.pay-tabs-row { align-self: flex-start; }

/* Empty: laid out as Receipts', Invoices' and Statements' (2026-10-27). */
.pay-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 48px 24px; text-align: center; }
.pay-empty__icon { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 16px; background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); box-shadow: 0 0 0 6px rgba(var(--rb-primary-rgb), 0.04); }
.pay-empty__title { margin: 6px 0 0; font-size: 17px; font-weight: 800; color: var(--rb-text-primary); }
.pay-empty__text { max-width: 520px; margin: 0; font-size: 13.5px; line-height: 1.6; color: var(--rb-text-secondary); text-wrap: pretty; }
.pay-empty .ui-btn { margin-top: 6px; }
.card { border-radius: 16px; }
/* The filters inside the card, as on Receipts and Invoices. */
.card > .filter-bar { padding: 14px 16px; border-bottom: 1px solid var(--rb-border); }
.filter-bar .search { flex: 1 1 320px; min-width: 0; }
</style>
