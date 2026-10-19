<template>
  <div class="rl-page">
    <div class="rl-inner">
      <div class="toast-stack" aria-live="polite">
        <transition-group name="toast">
          <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast--${t.variant}`">
            <div class="toast-title">{{ t.title }}</div>
            <div v-if="t.message" class="toast-message">{{ t.message }}</div>
          </div>
        </transition-group>
      </div>

      <PageHeader title="Receipts" subtitle="Every receipt this centre has issued. A corrected payment's old receipt stays here, voided.">
        <template #actions>
          <NuxtLink to="/blood-center/billing" class="ui-btn">
            <AssetIcon name="file-text" :size="15" />
            Statements
          </NuxtLink>
          <NuxtLink to="/blood-center/pos" class="ui-btn ui-btn--primary">
            <AssetIcon name="credit-card" :size="15" />
            Billing counter
          </NuxtLink>
        </template>
      </PageHeader>

      <section class="toolbar" aria-label="Filters">
        <div class="search">
          <AssetIcon name="search" :size="16" class="search-icon" />
          <input
            v-model="search"
            type="search"
            class="input search-input"
            placeholder="Receipt number, request reference or patient"
            aria-label="Search receipts"
            @input="onSearch"
          >
        </div>
        <div class="pills" role="group" aria-label="Status">
          <button v-for="s in STATUSES" :key="s.value" class="pill" :class="{ 'pill--on': status === s.value }" :aria-pressed="status === s.value" @click="status = s.value">
            {{ s.label }}
          </button>
        </div>
        <label class="filter"><span>From</span><DatePicker id="receipts-from" v-model="from" :max="to || undefined" aria-label="From" size="sm" /></label>
        <label class="filter"><span>To</span><DatePicker id="receipts-to" v-model="to" :min="from || undefined" aria-label="To" size="sm" /></label>
      </section>

      <section class="card" aria-label="Receipts">
        <div v-if="loading" class="skeleton-wrap"><div v-for="n in 6" :key="n" class="skeleton" /></div>

        <EmptyState v-else-if="error" icon="triangle-alert" title="The receipts could not be loaded" :description="error">
          <button class="ui-btn" @click="load()">Try again</button>
        </EmptyState>

        <EmptyState
          v-else-if="!receipts.length"
          icon="receipt"
          :title="filtered ? 'No receipt matches these filters' : 'No receipts yet'"
          :description="filtered ? 'Clear the search or widen the dates.' : 'A receipt is issued the moment a payment is taken at the counter or confirmed by GCash.'"
        />

        <div v-else class="table-scroll">
          <table class="rl-table">
            <thead>
              <tr>
                <th scope="col">Receipt</th>
                <th scope="col">Issued</th>
                <th scope="col">Received from</th>
                <th scope="col">Request</th>
                <th scope="col">Method</th>
                <th scope="col" class="num">Amount</th>
                <th scope="col" class="num">Balance after</th>
                <th scope="col">Status</th>
                <th scope="col"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in receipts" :key="r.id" class="row" :class="{ 'row--voided': r.voided }" @click="open(r)">
                <td>
                  <NuxtLink :to="`/blood-center/receipt/${r.id}`" class="link mono" @click.stop>{{ r.receipt_number }}</NuxtLink>
                </td>
                <td class="nowrap">{{ when(r.issued_at) }}</td>
                <td>
                  {{ r.payer_name || r.request?.patient_name || '—' }}
                  <span v-if="r.payer_name && r.request?.patient_name" class="sub">For {{ r.request.patient_name }}</span>
                </td>
                <td class="mono">{{ r.request?.reference_number || '—' }}</td>
                <td>{{ r.payment?.method_label || r.payment_method_label || '—' }}</td>
                <td class="num strong">{{ pesos(r.amount_paid) }}</td>
                <td class="num">{{ Number(r.balance_after) > 0 ? pesos(r.balance_after) : 'Settled' }}</td>
                <td>
                  <BillingBadge v-if="r.voided" tone="muted">Voided</BillingBadge>
                  <BillingBadge v-else-if="r.is_partial" tone="warning">Part payment</BillingBadge>
                  <BillingBadge v-else tone="success">Paid in full</BillingBadge>
                </td>
                <td class="row-actions" @click.stop>
                  <button class="ui-btn ui-btn--ghost ui-btn--sm" :disabled="r.voided" :aria-label="`Print ${r.receipt_number} on the 80mm printer`" @click="printThermal(r)">
                    <AssetIcon name="printer" :size="14" />
                  </button>
                  <button class="ui-btn ui-btn--ghost ui-btn--sm" :disabled="downloadingId === r.id" :aria-label="`Download ${r.receipt_number} as PDF`" @click="download(r)">
                    <AssetIcon name="download" :size="14" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer v-if="!loading && meta.last_page > 1" class="pager">
          <button class="ui-btn ui-btn--sm" :disabled="meta.current_page <= 1" @click="load(meta.current_page - 1)">Previous</button>
          <span>Page {{ meta.current_page }} of {{ meta.last_page }} · {{ meta.total }} receipts</span>
          <button class="ui-btn ui-btn--sm" :disabled="meta.current_page >= meta.last_page" @click="load(meta.current_page + 1)">Next</button>
        </footer>
      </section>
    </div>
  </div>
</template>

<script setup>
/**
 * The receipts this centre has issued: find one, open it, reprint it.
 *
 * Receipts carry payment details, so the page sits behind the ability to
 * record payments, as the payments list does.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import BillingBadge from '~/components/BloodCenter/BillingBadge.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { pesos, saveBlob } from '~/utils/billing'
import DatePicker from '~/components/common/DatePicker.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import EmptyState from '~/components/ui/EmptyState.vue'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'billing.record_payment',
})

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'valid', label: 'Valid' },
  { value: 'voided', label: 'Voided' },
]

/* TOASTS */
const toasts = ref([])
let toastId = 0
function toast(title, variant = 'success', message = '') {
  const id = ++toastId
  toasts.value.push({ id, title, message, variant })
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, 3600)
}

function when(iso) {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}

const receipts = ref([])
const meta = reactive({ current_page: 1, last_page: 1, total: 0 })
const loading = ref(true)
const error = ref('')
const search = ref('')
const status = ref('')
const from = ref('')
const to = ref('')
const downloadingId = ref(null)

const filtered = computed(() => Boolean(search.value.trim() || status.value || from.value || to.value))

async function load(page = 1) {
  loading.value = true
  error.value = ''

  try {
    const response = await bloodCenterService.receipts({
      page,
      ...(search.value.trim() ? { search: search.value.trim() } : {}),
      ...(status.value ? { status: status.value } : {}),
      ...(from.value ? { from: from.value } : {}),
      ...(to.value ? { to: to.value } : {}),
    })
    receipts.value = response?.data ?? []
    meta.current_page = response?.current_page ?? 1
    meta.last_page = response?.last_page ?? 1
    meta.total = response?.total ?? receipts.value.length
  } catch (err) {
    error.value = err?.message || 'Please try again.'
    receipts.value = []
  } finally {
    loading.value = false
  }
}

let searchTimer = null
function onSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => load(), 350)
}

watch([status, from, to], () => load())

function open(receipt) {
  navigateTo(`/blood-center/receipt/${receipt.id}`)
}

// The 80mm slip prints from its own page, sized for the counter's printer.
function printThermal(receipt) {
  window.open(`/blood-center/receipt-print/${receipt.id}?auto=1`, '_blank')
}

async function download(receipt) {
  downloadingId.value = receipt.id

  try {
    saveBlob(await bloodCenterService.downloadReceipt(receipt.id), `${receipt.receipt_number}.pdf`)
  } catch (err) {
    toast('Download Failed', 'danger', err?.message || 'The receipt could not be downloaded.')
  } finally {
    downloadingId.value = null
  }
}

onMounted(() => load())
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css. */
.rl-page { background: var(--rb-page-bg); font-family: var(--rb-font-sans); padding: 24px var(--rb-gutter, 24px) 40px; }
.rl-inner { max-width: var(--rb-content-max, 1600px); margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }

.page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.page-title { font-size: 20px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.page-subtitle { font-size: 13px; color: var(--rb-text-secondary); margin: 4px 0 0; max-width: 70ch; }
.header-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.toolbar { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.search { position: relative; flex: 1 1 280px; }
.search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--rb-text-muted); pointer-events: none; }
.search .search-input { padding-left: 36px; }
.pills { display: inline-flex; gap: 2px; padding: 3px; border-radius: 10px; background: var(--rb-surface-alt); border: 1px solid var(--rb-border); }
.pill { padding: 6px 12px; border: 0; border-radius: 8px; background: transparent; font-family: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); cursor: pointer; }
.pill:hover { color: var(--rb-text-primary); }
.pill--on { background: var(--rb-surface); color: var(--rb-text-primary); box-shadow: var(--rb-shadow-sm); }
.filter { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); width: 160px; }

.card { background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px; overflow: hidden; }
.table-scroll { overflow-x: auto; }
.rl-table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.rl-table th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--rb-text-secondary); background: var(--rb-surface-alt); padding: 10px 14px; border-bottom: 1px solid var(--rb-border); white-space: nowrap; }
.rl-table td { padding: 12px 14px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); vertical-align: middle; }
.rl-table tbody tr:last-child td { border-bottom: 0; }
.row { cursor: pointer; transition: background-color .12s var(--rb-ease-out); }
.row:hover td { background: var(--rb-surface-hover); }
.row--voided td { color: var(--rb-text-muted); }
.row--voided .strong { text-decoration: line-through; }
.sub { display: block; font-size: 11.5px; color: var(--rb-text-secondary); }
.row-actions { text-align: right; white-space: nowrap; }
.num { text-align: right !important; white-space: nowrap; }
.nowrap { white-space: nowrap; }
.strong { font-weight: 700; }
.mono { font-family: var(--rb-font-mono); }
.link { color: var(--rb-primary-text); font-weight: 700; text-decoration: none; }
.link:hover { text-decoration: underline; text-underline-offset: 3px; }

.pager { display: flex; justify-content: center; align-items: center; gap: 12px; padding: 12px; border-top: 1px solid var(--rb-border); font-size: 12.5px; color: var(--rb-text-secondary); }

.input {
  width: 100%; padding: 9px 11px; font-size: 13.5px; font-family: inherit;
  color: var(--rb-text-primary); background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 9px;
}
.input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

.empty { text-align: center; padding: 56px 20px; color: var(--rb-text-secondary); display: flex; flex-direction: column; align-items: center; gap: 8px; }
.empty h2 { font-size: 15px; color: var(--rb-text-primary); margin: 4px 0 0; }
.empty p { font-size: 13px; margin: 0; max-width: 52ch; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 14px; font-size: 13px; font-weight: 600; font-family: inherit;
  border-radius: 9px; cursor: pointer; white-space: nowrap; text-decoration: none;
  transition: background-color .15s var(--rb-ease-out);
}
.btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.btn-primary { background: var(--rb-primary); color: #fff; border: 1px solid var(--rb-primary); }
.btn-primary:hover:not(:disabled) { background: #10509c; }
.btn-outline { background: var(--rb-surface); color: var(--rb-text-primary); border: 1px solid var(--rb-border-strong); }
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn-ghost { background: transparent; color: var(--rb-text-secondary); border: 1px solid transparent; }
.btn-ghost:hover:not(:disabled) { background: rgba(var(--rb-primary-rgb), .07); color: var(--rb-primary-text); }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn-sm { padding: 6px 9px; font-size: 12px; }

.skeleton-wrap { padding: 14px; display: flex; flex-direction: column; gap: 8px; }
.skeleton {
  height: 42px; border-radius: 8px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 50%, var(--rb-skeleton-a) 75%);
  background-size: 200% 100%; animation: shimmer 1.4s infinite;
}
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

.toast-stack { position: fixed; top: 18px; right: 18px; z-index: 120; display: flex; flex-direction: column; gap: 8px; }
.toast { background: var(--rb-surface); border: 1px solid var(--rb-border-strong); border-radius: 10px; padding: 11px 15px; min-width: 250px; box-shadow: 0 6px 20px rgba(var(--rb-shadow-rgb), .1); }
.toast-title { font-size: 13px; font-weight: 600; color: var(--rb-text-primary); }
.toast--danger .toast-title { color: var(--rb-accent-text); }
.toast-message { font-size: 12px; color: var(--rb-text-secondary); margin-top: 2px; }
.toast-enter-active, .toast-leave-active { transition: opacity .2s, transform .2s var(--rb-ease-out); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(14px); }

.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
  .row, .btn, .toast-enter-active, .toast-leave-active { transition: none; }
}

@media (max-width: 640px) {
  .filter { width: calc(50% - 6px); }
}

/* Cards in the shared SectionCard's shape (2026-10-15). */
.card { border-radius: var(--rb-radius-lg); box-shadow: var(--rb-shadow-sm); }
</style>
