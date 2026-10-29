<template>
  <div class="soa-page">
    <div class="soa-inner">
      <div class="toast-stack" aria-live="polite">
        <transition-group name="toast">
          <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast--${t.variant}`">
            <div class="toast-title">{{ t.title }}</div>
            <div v-if="t.message" class="toast-message">{{ t.message }}</div>
          </div>
        </transition-group>
      </div>

      <!-- Statements of Account only (project owner, 2026-10-25). -->
      <PageHeader title="Statements" subtitle="A hospital's weekly invoices, settlements and balance over a period.">
        <template #actions>
          <button class="ui-btn" :disabled="!statement || printing" @click="print">
            <AssetIcon name="printer" :size="15" />
            {{ printing ? 'Opening…' : 'Print' }}
          </button>
          <button class="ui-btn ui-btn--primary" :disabled="!statement || downloading" @click="download">
            <AssetIcon name="download" :size="15" />
            Download PDF
          </button>
        </template>
      </PageHeader>

      <section class="toolbar" aria-label="Statement for">
        <div class="field field--hospital">
          <label for="soa-hospital" class="field-label">Hospital</label>
          <SelectField
            id="soa-hospital"
            v-model="hospitalId"
            :options="hospitalOptions"
            icon="building-2"
            :placeholder="hospitalsLoading ? 'Loading…' : 'No hospital invoiced yet'"
            :disabled="!hospitals.length"
            size="sm"
          />
        </div>
        <div class="field">
          <label for="soa-period" class="field-label">Period</label>
          <SelectField id="soa-period" :model-value="preset" :options="PERIOD_OPTIONS" icon="calendar" size="sm" @update:model-value="choose" />
        </div>
        <template v-if="preset === 'custom'">
          <div class="field field--date">
            <label for="soa-from" class="field-label">From</label>
            <DatePicker id="soa-from" v-model="from" :max="to || undefined" size="sm" />
          </div>
          <div class="field field--date">
            <label for="soa-to" class="field-label">To</label>
            <DatePicker id="soa-to" v-model="to" :min="from || undefined" size="sm" />
          </div>
        </template>
      </section>

      <p v-if="error" class="banner banner--error" role="alert">
        <AssetIcon name="triangle-alert" :size="15" />
        <span>{{ error }}</span>
        <button class="ui-btn ui-btn--sm" @click="load">Retry</button>
      </p>

      <!--
        No hospital invoiced yet: said plainly, with the way to its invoices,
        rather than a statement of ₱0.00 that reads like real figures
        (2026-10-27).
      -->
      <section v-if="!hospitalsLoading && !hospitals.length" class="card soa-empty" aria-labelledby="soa-empty-title">
        <span class="soa-empty__icon"><AssetIcon name="clipboard" :size="24" /></span>
        <h2 id="soa-empty-title" class="soa-empty__title">No hospital statements yet</h2>
        <p class="soa-empty__text">
          A statement sums up one hospital's weekly invoices, the settlements it made and what it still owes over a
          period. It appears here once a hospital's weekly order is released and invoiced.
        </p>
        <ol class="soa-empty__steps">
          <li><span>1</span> A hospital sends a weekly replenishment order</li>
          <li><span>2</span> Issuance releases it, and its invoice is raised</li>
          <li><span>3</span> Pick the hospital here to print or download its statement</li>
        </ol>
        <NuxtLink to="/blood-center/billing?category=weekly" class="ui-btn">
          <AssetIcon name="file-text" :size="15" />
          View hospital invoices
        </NuxtLink>
      </section>

      <!-- The statement keeps its layout while a hospital's is loading, and fills in place. -->
      <article v-else class="card soa" :class="{ 'soa--empty': !statement }" aria-labelledby="soa-to" :aria-busy="loading">
        <header class="soa-head">
          <div class="soa-party">
            <span class="soa-cap">Bill to</span>
            <h2 id="soa-to">{{ statement?.hospital?.name || selectedHospital?.label || 'No hospital selected' }}</h2>
            <p v-if="statement?.hospital?.address" class="soa-address">{{ statement.hospital.address }}</p>
            <p class="soa-period">{{ periodLabel(from, to) }}</p>
          </div>
          <div class="soa-balance">
            <span class="soa-cap">Remaining balance</span>
            <strong>{{ pesos(statement?.closing_balance) }}</strong>
          </div>
        </header>

        <dl class="soa-figures">
          <div><dt>Opening balance</dt><dd>{{ pesos(statement?.opening_balance) }}</dd></div>
          <div><dt>Invoiced</dt><dd>{{ pesos(statement?.invoiced) }}</dd></div>
          <div><dt>Payments</dt><dd>{{ pesos(statement?.payments) }}</dd></div>
          <div><dt>Closing balance</dt><dd>{{ pesos(statement?.closing_balance) }}</dd></div>
        </dl>

        <section class="soa-section" aria-labelledby="soa-invoices">
          <h3 id="soa-invoices" class="soa-section-title">Invoices</h3>
          <div class="table-scroll">
            <table class="soa-table">
              <thead>
                <tr>
                  <th scope="col">Invoice</th>
                  <th scope="col">Request</th>
                  <th scope="col">Billed on</th>
                  <th scope="col" class="num">Amount</th>
                  <th scope="col" class="num">Settled</th>
                  <th scope="col" class="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                <template v-if="loading">
                  <tr v-for="n in 3" :key="`s-${n}`"><td colspan="6"><span class="skeleton" /></td></tr>
                </template>
                <template v-else>
                  <tr v-for="inv in invoices" :key="inv.billing_id">
                    <td>
                      <NuxtLink :to="`/blood-center/invoice/${inv.request_id}`" class="link mono">{{ inv.invoice_number || 'Not issued' }}</NuxtLink>
                    </td>
                    <td class="mono">{{ inv.request_reference || '—' }}</td>
                    <td class="nowrap">{{ day(inv.billed_on) }}</td>
                    <td class="num">{{ pesos(inv.amount) }}</td>
                    <td class="num">{{ pesos(inv.settled) }}</td>
                    <td class="num strong" :class="{ owing: Number(inv.balance) > 0 }">{{ pesos(inv.balance) }}</td>
                  </tr>
                  <tr v-if="!invoices.length" class="empty-row">
                    <td colspan="6">No invoices in this period.</td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </section>

        <section class="soa-section" aria-labelledby="soa-activity">
          <h3 id="soa-activity" class="soa-section-title">Activity</h3>
          <div class="table-scroll">
            <table class="soa-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Description</th>
                  <th scope="col" class="num">Charges</th>
                  <th scope="col" class="num">Payments</th>
                  <th scope="col" class="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr class="carried">
                  <td class="nowrap">{{ day(from) }}</td>
                  <td>Opening balance</td>
                  <td class="num" />
                  <td class="num" />
                  <td class="num">{{ pesos(statement?.opening_balance) }}</td>
                </tr>
                <template v-if="loading">
                  <tr v-for="n in 3" :key="`a-${n}`"><td colspan="5"><span class="skeleton" /></td></tr>
                </template>
                <tr v-for="row in activity" v-else :key="row.transaction_number">
                  <td class="nowrap">{{ day(row.occurred_at) }}</td>
                  <td>
                    {{ row.type_label }}
                    <span class="mono muted">· {{ row.invoice_number || row.request_reference }}</span>
                    <span v-if="row.reference" class="muted"> · ref <span class="mono">{{ row.reference }}</span></span>
                  </td>
                  <td class="num">{{ row.charge ? pesos(row.charge) : '' }}</td>
                  <td class="num">{{ row.payment ? pesos(row.payment) : '' }}</td>
                  <td class="num">{{ pesos(row.balance) }}</td>
                </tr>
                <tr class="closing">
                  <td class="nowrap">{{ day(to) }}</td>
                  <td>Closing balance</td>
                  <td class="num">{{ pesos(statement?.invoiced) }}</td>
                  <td class="num">{{ pesos(statement?.payments) }}</td>
                  <td class="num">{{ pesos(statement?.closing_balance) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </article>
    </div>
  </div>
</template>

<script setup>
/**
 * Statements of Account (project owner, 2026-10-25): one hospital's weekly
 * invoices, its settlements and what it still owes, over a period it picks.
 *
 * The owner's terms: an invoice is one billable request; a statement sums up
 * a facility's invoices, payments and remaining balance over a period; a
 * receipt proves a payment. Only what the hospital owes is on it, its weekly
 * replenishment invoices; a patient's invoice is the patient's. Built by the
 * server from the billing journal each time it is asked, never stored or
 * numbered, and printed from the same figures as its PDF.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import DatePicker from '~/components/common/DatePicker.vue'
import SelectField from '~/components/common/SelectField.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { pesos, saveBlob } from '~/utils/billing'
import { PERIOD_PRESETS, periodFor, periodLabel } from '~/utils/reportPeriod'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'billing.view',
})

useHead({ title: 'Statements · RedAgos' })

const PERIOD_OPTIONS = PERIOD_PRESETS.map((p) => ({ value: p.value, label: p.label }))

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

function day(value) {
  if (!value) return '—'
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value)
  return date.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

/* WHOSE STATEMENT, AND FOR WHEN */
const hospitals = ref([])
const hospitalsLoading = ref(true)
const hospitalId = ref(null)
const hospitalOptions = computed(() => hospitals.value.map((h) => ({ value: h.id, label: h.name })))
const selectedHospital = computed(() => hospitalOptions.value.find((h) => h.value === hospitalId.value) ?? null)

const preset = ref('month')
const from = ref(periodFor('month').from)
const to = ref(periodFor('month').to)

function choose(value) {
  preset.value = value
  const range = periodFor(value)
  if (range) {
    from.value = range.from
    to.value = range.to
  }
}

/* THE STATEMENT */
const statement = ref(null)
const loading = ref(false)
const error = ref('')
const invoices = computed(() => statement.value?.invoices ?? [])
const activity = computed(() => statement.value?.activity ?? [])
const params = computed(() => ({ hospital_id: hospitalId.value, from: from.value, to: to.value }))

async function load() {
  if (!hospitalId.value || !from.value || !to.value) return
  loading.value = true
  error.value = ''

  try {
    statement.value = await bloodCenterService.accountStatement(params.value)
  } catch (err) {
    error.value = err?.message || 'The statement could not be loaded.'
    statement.value = null
  } finally {
    loading.value = false
  }
}

async function loadHospitals() {
  hospitalsLoading.value = true

  try {
    hospitals.value = (await bloodCenterService.accountStatementHospitals())?.data ?? []
    hospitalId.value = hospitals.value[0]?.id ?? null
  } catch (err) {
    error.value = err?.message || 'The hospitals could not be loaded.'
  } finally {
    hospitalsLoading.value = false
  }
}

watch([hospitalId, from, to], load)

/* PRINT AND PDF: the server's PDF, the same figures as on screen */
const downloading = ref(false)
const printing = ref(false)
const fileName = computed(() => `Statement of Account - ${statement.value?.hospital?.name ?? 'hospital'} - ${from.value} to ${to.value}.pdf`)

async function download() {
  downloading.value = true

  try {
    saveBlob(await bloodCenterService.downloadAccountStatement(params.value), fileName.value)
  } catch (err) {
    toast('Download Failed', 'danger', err?.message || 'The statement could not be downloaded.')
  } finally {
    downloading.value = false
  }
}

// Opens the PDF in a new tab, where the browser's viewer prints it.
async function print() {
  // Opened before the download, while the click still counts, so the browser
  // does not take it for a pop-up.
  const tab = window.open('', '_blank')
  printing.value = true

  try {
    const blob = await bloodCenterService.downloadAccountStatement(params.value)

    if (tab) {
      const url = URL.createObjectURL(blob)
      tab.location.href = url
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } else {
      saveBlob(blob, fileName.value)
    }
  } catch (err) {
    tab?.close()
    toast('Print Failed', 'danger', err?.message || 'The statement could not be opened.')
  } finally {
    printing.value = false
  }
}

onMounted(loadHospitals)
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css. */
.soa-page { background: var(--rb-page-bg); font-family: var(--rb-font-sans); padding: 24px var(--rb-gutter, 24px) 40px; }
.soa-inner { max-width: var(--rb-content-max, 1600px); margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }

.toolbar { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.field { display: flex; flex-direction: column; gap: 4px; width: 190px; }
.field--hospital { width: 300px; }
.field--date { width: 160px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); }

.banner { display: flex; align-items: center; gap: 9px; margin: 0; padding: 10px 14px; border-radius: 10px; font-size: 13px; }
.banner--error { background: rgba(var(--rb-accent-rgb), .08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), .25); }
.banner .ui-btn { margin-left: auto; }

.card { background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px; overflow: hidden; }

/* The document's head: who owes, for when, and the one figure they came for. */
.soa-head {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: end;
  padding: 20px 22px 18px; border-bottom: 1px solid var(--rb-border);
  background:
    radial-gradient(70% 160% at 100% 0%, rgba(var(--rb-primary-rgb), .12), transparent 62%),
    var(--rb-surface-alt);
}
.soa-cap { display: block; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--rb-text-secondary); }
.soa-party { min-width: 0; }
.soa-party h2 { margin: 4px 0 0; font-size: 20px; font-weight: 800; letter-spacing: -.01em; color: var(--rb-text-primary); overflow-wrap: anywhere; }
.soa-address { margin: 2px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.soa-period { margin: 8px 0 0; font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); }
.soa-balance { text-align: right; }
.soa-balance strong { display: block; margin-top: 2px; font-size: 34px; font-weight: 800; line-height: 1.1; letter-spacing: -.02em; color: var(--rb-text-primary); }
.soa--empty .soa-party h2,
.soa--empty .soa-balance strong { color: var(--rb-text-muted); }

/* The four figures the balance is made of, divided rather than boxed. */
.soa-figures { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0; border-bottom: 1px solid var(--rb-border); }
.soa-figures div { padding: 14px 22px; border-left: 1px solid var(--rb-border); min-width: 0; }
.soa-figures div:first-child { border-left: 0; }
.soa-figures dt { font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); }
.soa-figures dd { margin: 3px 0 0; font-size: 17px; font-weight: 800; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.soa--empty .soa-figures dd { color: var(--rb-text-muted); }

.soa-section { padding: 18px 22px 4px; }
.soa-section + .soa-section { padding-bottom: 20px; }
.soa-section-title { margin: 0 0 10px; font-size: 14px; font-weight: 800; color: var(--rb-text-primary); }

.table-scroll { overflow-x: auto; border: 1px solid var(--rb-border); border-radius: 12px; }
.soa-table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.soa-table th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--rb-text-secondary); background: var(--rb-surface-alt); padding: 9px 14px; border-bottom: 1px solid var(--rb-border); white-space: nowrap; }
.soa-table td { padding: 11px 14px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); vertical-align: middle; }
.soa-table tbody tr:last-child td { border-bottom: 0; }
.soa-table .carried td { color: var(--rb-text-secondary); font-style: italic; }
.soa-table .closing td { font-weight: 800; background: rgba(var(--rb-primary-rgb), .06); }
.empty-row td { padding: 18px 14px; text-align: center; color: var(--rb-text-muted); }

.num { text-align: right !important; white-space: nowrap; }
.nowrap { white-space: nowrap; }
.strong { font-weight: 700; }
.owing { color: var(--rb-accent-text); }
.muted { color: var(--rb-text-muted); }
.mono { font-family: var(--rb-font-mono); }
.link { color: var(--rb-primary-text); font-weight: 700; text-decoration: none; }
.link:hover { text-decoration: underline; text-underline-offset: 3px; }

.skeleton {
  display: block; height: 14px; border-radius: 6px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 50%, var(--rb-skeleton-a) 75%);
  background-size: 200% 100%; animation: shimmer 1.4s infinite;
}
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

.toast-stack { position: fixed; top: 76px; right: 18px; z-index: 120; display: flex; flex-direction: column; gap: 8px; }
.toast { background: var(--rb-surface); border: 1px solid var(--rb-border-strong); border-radius: 10px; padding: 11px 15px; min-width: 250px; box-shadow: 0 6px 20px rgba(var(--rb-shadow-rgb), .1); }
.toast-title { font-size: 13px; font-weight: 600; color: var(--rb-text-primary); }
.toast--danger .toast-title { color: var(--rb-accent-text); }
.toast-message { font-size: 12px; color: var(--rb-text-secondary); margin-top: 2px; }
.toast-enter-active, .toast-leave-active { transition: opacity .2s, transform .2s var(--rb-ease-out); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(14px); }

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
  .toast-enter-active, .toast-leave-active { transition: none; }
}

@media (max-width: 760px) {
  .soa-head { grid-template-columns: 1fr; align-items: start; gap: 12px; padding: 16px; }
  .soa-balance { text-align: left; }
  .soa-figures { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .soa-figures div { padding: 12px 16px; }
  .soa-figures div:nth-child(3) { border-left: 0; }
  .soa-figures div:nth-child(n + 3) { border-top: 1px solid var(--rb-border); }
  .soa-section { padding: 16px 16px 4px; }
  .field, .field--hospital { width: 100%; }
  .field--date { width: calc(50% - 6px); }
}

/* No hospital invoiced yet */
.soa-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 48px 24px; text-align: center; }
.soa-empty__icon { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 16px; background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); box-shadow: 0 0 0 6px rgba(var(--rb-primary-rgb), 0.04); }
.soa-empty__title { margin: 6px 0 0; font-size: 17px; font-weight: 800; color: var(--rb-text-primary); }
.soa-empty__text { max-width: 520px; margin: 0; font-size: 13.5px; line-height: 1.6; color: var(--rb-text-secondary); }
.soa-empty__steps { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 18px; margin: 8px 0 6px; padding: 0; list-style: none; }
.soa-empty__steps li { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--rb-text-secondary); }
.soa-empty__steps span { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--rb-surface-alt); font-size: 11.5px; font-weight: 800; color: var(--rb-text-primary); }
.soa-empty .ui-btn { text-decoration: none; }
</style>
