<template>
  <div class="tx-page">
    <div class="tx-inner">
      <!-- Two columns, so the actions stay on the right at every width. -->
      <!-- The shared header keeps the actions on the right at every width. -->
      <PageHeader title="Billing Transactions" subtitle="Every money event on this centre's bills, numbered and in order. Nothing here is edited; a mistake gets a new transaction.">
        <template #actions>
          <NuxtLink to="/blood-center/billing" class="ui-btn" title="Statements" aria-label="Statements">
            <AssetIcon name="file-text" :size="15" />
            <span class="btn-label">Statements</span>
          </NuxtLink>
          <NuxtLink to="/blood-center/receipts" class="ui-btn" title="Receipts" aria-label="Receipts">
            <AssetIcon name="receipt" :size="15" />
            <span class="btn-label">Receipts</span>
          </NuxtLink>
          <button class="ui-btn ui-btn--primary" :disabled="exporting" @click="exportCsv">
            <AssetIcon name="download" :size="15" />
            {{ exporting ? 'Exporting…' : 'Export CSV' }}
          </button>
        </template>
      </PageHeader>

      <!-- MONEY FLOW: the server's totals over everything the filters match, not just this page -->
      <section v-if="totals" class="flow" aria-label="Totals">
        <div class="flow-charged">
          <span class="cap">Charged</span>
          <strong>{{ pesos(totals.charged) }}</strong>
          <small>{{ totals.count }} {{ Number(totals.count) === 1 ? 'transaction' : 'transactions' }}</small>
        </div>
        <AssetIcon name="arrow-right" :size="18" class="flow-arrow" aria-hidden="true" />
        <div class="flow-split">
          <div class="flow-bar" role="img" :aria-label="`Collected ${pesos(totals.collected)}, subsidised ${pesos(totals.subsidised)}, settled by hospitals ${pesos(totals.settled_outside)}`">
            <span v-for="part in flowParts" :key="part.key" :class="`flow-bar--${part.key}`" :style="{ width: `${part.share}%` }" />
          </div>
          <dl class="flow-legend">
            <div v-for="part in flowParts" :key="part.key" class="flow-item">
              <dt><span class="flow-dot" :class="`flow-bar--${part.key}`" />{{ part.label }}</dt>
              <dd>{{ pesos(part.amount) }}</dd>
            </div>
          </dl>
        </div>
      </section>

      <!-- FILTERS: the common ones in reach, the rest one click away -->
      <section class="filter-bar" aria-label="Filters">
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
      </section>

      <p v-if="error" class="banner banner--error">{{ error }}</p>

      <div class="card">
        <div v-if="loading" class="skeleton-wrap">
          <div v-for="n in 6" :key="n" class="skeleton-row">
            <span class="skeleton skeleton--dot" />
            <div class="skeleton-lines"><span class="skeleton skeleton--line" /><span class="skeleton skeleton--line skeleton--short" /></div>
            <span class="skeleton skeleton--amount" />
          </div>
        </div>

        <div v-else-if="!rows.length" class="empty">
          <span class="empty-icon" aria-hidden="true"><AssetIcon name="list" :size="26" /></span>
          <h3>No transactions</h3>
          <p>Nothing matches these filters.</p>
        </div>

        <!-- THE LEDGER: newest first, grouped by day, two lines a row -->
        <div v-else class="ledger">
          <section v-for="group in groups" :key="group.key" class="day" :aria-label="group.label">
            <h2 class="day-head">{{ group.label }}</h2>
            <ol class="day-rows">
              <li v-for="row in group.rows" :key="row.id" class="tx" :class="{ 'tx--reversal': row.reverses_transaction_number }">
                <span class="tx-dot" :class="`dot--${transactionTone(row.type)}`" aria-hidden="true" />
                <div class="tx-main">
                  <div class="tx-line">
                    <span class="chip" :class="`tone--${transactionTone(row.type)}`">{{ row.type_label }}</span>
                    <span class="mono tx-no">{{ row.transaction_number }}</span>
                    <template v-if="row.request">
                      <NuxtLink :to="`/blood-center/statement/${row.request.id}`" class="mono doc-link">{{ row.request.reference_number }}</NuxtLink>
                      <span v-if="row.request.patient_name || row.request.requesting_facility" class="tx-who">{{ row.request.patient_name || row.request.requesting_facility }}</span>
                    </template>
                    <span v-else class="mono muted">—</span>
                  </div>
                  <div class="tx-meta">
                    <span>{{ time(row.occurred_at) }}</span>
                    <span>{{ row.category_label }}</span>
                    <span>{{ row.channel_label }}<template v-if="row.payment_method_label"> · {{ row.payment_method_label }}</template></span>
                    <span>{{ row.recorded_by || (row.channel === 'gateway' ? 'Provider' : 'System') }}</span>
                    <span v-if="row.reverses_transaction_number" class="tx-reverses">Reverses <span class="mono">{{ row.reverses_transaction_number }}</span></span>
                  </div>
                  <p v-if="row.note" class="tx-note">{{ row.note }}</p>
                  <div v-if="row.receipt || row.statement || row.cash_session || row.reference" class="tx-docs">
                    <NuxtLink v-if="row.receipt" :to="`/blood-center/receipt/${row.receipt.id}`" class="doc-pill doc-pill--link mono">
                      <AssetIcon name="receipt" :size="12" />{{ row.receipt.receipt_number }}
                    </NuxtLink>
                    <span v-if="row.statement" class="doc-pill mono"><AssetIcon name="file-text" :size="12" />{{ row.statement.document_number }}</span>
                    <span v-if="row.cash_session" class="doc-pill mono"><AssetIcon name="clock" :size="12" />{{ row.cash_session.session_number }}</span>
                    <span v-if="row.reference" class="doc-pill mono">Ref {{ row.reference }}</span>
                  </div>
                </div>
                <div class="tx-money">
                  <strong class="amount" :class="`amount--${row.direction}`">{{ journalAmount(row) }}</strong>
                  <span class="tx-balance">Balance {{ pesos(row.balance_after) }}</span>
                </div>
              </li>
            </ol>
          </section>
        </div>

        <footer v-if="meta.last_page > 1" class="pager">
          <button class="ui-btn ui-btn--sm" :disabled="meta.current_page <= 1 || loading" @click="load(meta.current_page - 1)">Previous</button>
          <span>Page {{ meta.current_page }} of {{ meta.last_page }}</span>
          <button class="ui-btn ui-btn--sm" :disabled="meta.current_page >= meta.last_page || loading" @click="load(meta.current_page + 1)">Next</button>
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
 *
 * Laid out (2026-10-14) as a ledger grouped by day, two lines a row, under a
 * strip showing where the charged money went; the less-used filters fold away.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import DatePicker from '~/components/common/DatePicker.vue'
import SelectField from '~/components/common/SelectField.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { RECORDED_METHODS, journalAmount, pesos, saveBlob, transactionTone } from '~/utils/billing'
import PageHeader from '~/components/ui/PageHeader.vue'

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
const totals = ref(null)
const meta = reactive({ current_page: 1, last_page: 1 })
const loading = ref(true)
const error = ref('')
const exporting = ref(false)

function params() {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''))
}

function time(iso) {
  return iso ? new Date(iso).toLocaleTimeString(undefined, { timeStyle: 'short' }) : '—'
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

/* MONEY FLOW: where the charged money went, from the server's totals */
const flowParts = computed(() => {
  const t = totals.value
  if (!t) return []
  const parts = [
    { key: 'collected', label: 'Collected', amount: Number(t.collected) || 0 },
    { key: 'subsidised', label: 'Subsidised', amount: Number(t.subsidised) || 0 },
    { key: 'settled', label: 'Settled by hospitals', amount: Number(t.settled_outside) || 0 },
  ]
  // Shares of the charged total; the rest of the bar stays empty for what is still owed.
  const base = Math.max(Number(t.charged) || 0, parts.reduce((sum, part) => sum + part.amount, 0))
  return parts.map((part) => ({ ...part, share: base > 0 ? (part.amount / base) * 100 : 0 }))
})

/* THE LEDGER: the page's rows, kept in the server's order, under a heading per day */
function dayKey(iso) {
  if (!iso) return 'none'
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayLabel(iso) {
  if (!iso) return 'Undated'
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const date = d.toLocaleDateString(undefined, { dateStyle: 'medium' })
  if (dayKey(iso) === dayKey(today.toISOString())) return `Today · ${date}`
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return `Yesterday · ${date}`
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
}

const groups = computed(() => {
  const list = []
  for (const row of rows.value) {
    const key = dayKey(row.occurred_at)
    let group = list[list.length - 1]
    if (!group || group.key !== key) {
      group = { key, label: dayLabel(row.occurred_at), rows: [] }
      list.push(group)
    }
    group.rows.push(row)
  }
  return list
})

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
.tx-inner { max-width: var(--rb-content-max, 1600px); margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }

/* Text | actions. The actions never wrap under the text, so they stay right at every width. */
.page-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 16px; }
.page-heading { min-width: 0; }
.page-title { font-size: 24px; font-weight: 800; letter-spacing: -0.01em; color: var(--rb-text-primary); margin: 0; }
.page-subtitle { font-size: 13px; color: var(--rb-text-secondary); margin: 4px 0 0; max-width: 78ch; }
.header-actions { display: flex; gap: 8px; justify-content: flex-end; }
.header-actions .btn { text-decoration: none; }

.cap { font-size: 10.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--rb-text-secondary); }

/* Money flow: charged on the left, where it went on the right. */
.flow {
  display: grid; grid-template-columns: auto auto minmax(0, 1fr); align-items: center; gap: 22px;
  padding: 18px 22px; background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px;
}
.flow-charged { display: flex; flex-direction: column; gap: 2px; }
.flow-charged strong { font-size: 26px; font-weight: 800; line-height: 1.15; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.flow-charged small { font-size: 12px; color: var(--rb-text-secondary); }
.flow-arrow { color: var(--rb-text-muted); }
.flow-split { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.flow-bar { display: flex; height: 10px; border-radius: 999px; overflow: hidden; background: var(--rb-surface-alt); border: 1px solid var(--rb-border); }
.flow-bar > span { height: 100%; }
.flow-bar--collected { background: var(--rb-success, #2E7D32); }
.flow-bar--subsidised { background: rgb(var(--rb-purple-rgb)); }
.flow-bar--settled { background: var(--rb-primary); }
.flow-legend { display: flex; flex-wrap: wrap; gap: 6px 28px; margin: 0; }
.flow-item { display: flex; flex-direction: column; gap: 1px; }
.flow-item dt { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); }
.flow-item dd { margin: 0 0 0 14px; font-size: 16px; font-weight: 800; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.flow-dot { width: 8px; height: 8px; border-radius: 50%; }

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

/* The ledger */
.card { background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px; overflow: hidden; }
.day + .day { border-top: 1px solid var(--rb-border); }
.day-head {
  position: sticky; top: 0; z-index: 1; margin: 0; padding: 9px 20px;
  font-size: 11.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--rb-text-secondary);
  background: var(--rb-surface-alt); border-bottom: 1px solid var(--rb-border);
}
.day-rows { list-style: none; margin: 0; padding: 0; }
.tx { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; gap: 14px; align-items: start; padding: 14px 20px; }
.tx + .tx { border-top: 1px solid var(--rb-border); }
.tx:hover { background: var(--rb-surface-hover); }
.tx-dot { width: 10px; height: 10px; margin-top: 6px; border-radius: 50%; }
.dot--success { background: var(--rb-success, #2E7D32); }
.dot--warning { background: rgb(var(--rb-warning-rgb)); }
.dot--danger { background: var(--rb-accent); }
.dot--info { background: rgb(var(--rb-purple-rgb)); }
.dot--muted { background: var(--rb-border-strong); }
.tx-main { min-width: 0; }
.tx-line { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: 13.5px; }
.tx-no { color: var(--rb-text-secondary); }
.tx-who { font-weight: 600; color: var(--rb-text-primary); }
.tx-meta { display: flex; flex-wrap: wrap; gap: 2px 0; margin-top: 4px; font-size: 12px; color: var(--rb-text-secondary); }
.tx-meta > span + span::before { content: '·'; margin: 0 7px; color: var(--rb-text-muted); }
.tx-reverses { color: var(--rb-accent-text); font-weight: 600; }
.tx-note { margin: 5px 0 0; font-size: 12px; color: var(--rb-text-secondary); font-style: italic; }
.tx-docs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.doc-pill {
  display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px; border-radius: 7px;
  font-size: 11.5px; color: var(--rb-text-secondary); background: var(--rb-surface-alt); border: 1px solid var(--rb-border);
}
.doc-pill--link { color: var(--rb-primary-text); text-decoration: none; font-weight: 600; }
.doc-pill--link:hover { border-color: rgba(var(--rb-primary-rgb), .4); }
.tx-money { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; white-space: nowrap; }
.amount { font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums; }
.amount--debit { color: var(--rb-text-primary); }
.amount--credit { color: var(--rb-success-text); }
.amount--none { color: var(--rb-text-muted); }
.tx-balance { font-size: 11.5px; color: var(--rb-text-secondary); font-variant-numeric: tabular-nums; }
.tx--reversal .amount { color: var(--rb-accent-text); }

.mono { font-family: var(--rb-font-mono); font-size: 12px; }
.muted { color: var(--rb-text-muted); }
.doc-link { color: var(--rb-primary-text); font-weight: 700; text-decoration: none; }
.doc-link:hover { text-decoration: underline; text-underline-offset: 3px; }

.chip { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
.tone--success { background: rgba(var(--rb-success-rgb), .12); color: var(--rb-success-text); }
.tone--warning { background: rgba(var(--rb-warning-rgb), .14); color: var(--rb-warning-text); }
.tone--danger { background: rgba(var(--rb-accent-rgb), .1); color: var(--rb-accent-text); }
.tone--info { background: rgba(var(--rb-purple-rgb), .1); color: var(--rb-purple-text); }
.tone--muted { background: var(--rb-surface-alt); color: var(--rb-text-secondary); border: 1px solid var(--rb-border); }

.pager { display: flex; justify-content: center; align-items: center; gap: 12px; padding: 12px; font-size: 12.5px; color: var(--rb-text-secondary); border-top: 1px solid var(--rb-border); }

.banner { padding: 11px 14px; border-radius: 10px; font-size: 13px; margin: 0; }
.banner--error { background: rgba(var(--rb-accent-rgb), .08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), .25); }

.empty { text-align: center; padding: 56px 20px; color: var(--rb-text-secondary); display: flex; flex-direction: column; align-items: center; gap: 6px; }
.empty-icon { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; color: var(--rb-primary-text); background: rgba(var(--rb-primary-rgb), .08); margin-bottom: 4px; }
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

/* Loading rows shaped like the ledger's */
.skeleton-wrap { padding: 6px 20px; }
.skeleton-row { display: grid; grid-template-columns: 10px minmax(0, 1fr) 110px; gap: 14px; align-items: center; padding: 12px 0; }
.skeleton-row + .skeleton-row { border-top: 1px solid var(--rb-border); }
.skeleton-lines { display: flex; flex-direction: column; gap: 7px; }
.skeleton {
  display: block; border-radius: 6px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 50%, var(--rb-skeleton-a) 75%);
  background-size: 200% 100%; animation: shimmer 1.4s infinite;
}
.skeleton--dot { width: 10px; height: 10px; border-radius: 50%; }
.skeleton--line { height: 13px; width: 60%; }
.skeleton--short { width: 38%; }
.skeleton--amount { height: 18px; }
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
  .btn { transition: none; }
}

/* Narrow: the link labels give way to their icons; the actions stay right. */
@media (max-width: 960px) {
  .btn-label { display: none; }
  .flow { grid-template-columns: 1fr; gap: 14px; }
  .flow-arrow { display: none; }
  .more { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
}
</style>
