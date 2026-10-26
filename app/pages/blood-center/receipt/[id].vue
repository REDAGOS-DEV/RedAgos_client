<template>
  <div class="rc-page">
    <div class="rc-inner">
      <div class="toast-stack" aria-live="polite">
        <transition-group name="toast">
          <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast--${t.variant}`">
            <div class="toast-title">{{ t.title }}</div>
            <div v-if="t.message" class="toast-message">{{ t.message }}</div>
          </div>
        </transition-group>
      </div>

      <nav class="crumbs" aria-label="Breadcrumb">
        <NuxtLink to="/blood-center/receipts">Receipts</NuxtLink>
        <AssetIcon name="chevron-right" :size="14" />
        <span aria-current="page">{{ receipt?.receipt_number || 'Receipt' }}</span>
      </nav>

      <div v-if="loading" class="skeleton-stack">
        <div class="skeleton skeleton--head" />
        <div class="skeleton skeleton--facts" />
        <div class="skeleton skeleton--doc" />
      </div>

      <div v-else-if="loadError" class="empty card">
        <AssetIcon name="triangle-alert" :size="30" />
        <h2>This receipt could not be opened</h2>
        <p>{{ loadError }}</p>
        <div class="empty-actions">
          <NuxtLink to="/blood-center/receipts" class="ui-btn">Back to receipts</NuxtLink>
          <button class="ui-btn ui-btn--primary" @click="load">Try again</button>
        </div>
      </div>

      <template v-else-if="receipt">
        <header class="doc-header">
          <div>
            <h1 class="page-title">Acknowledgement Receipt</h1>
            <div class="doc-meta">
              <span class="doc-number mono">{{ receipt.receipt_number }}</span>
              <BillingBadge :tone="badge.tone">{{ badge.label }}</BillingBadge>
            </div>
          </div>
          <div class="header-actions">
            <button class="ui-btn" :disabled="receipt.voided" @click="printThermal">
              <AssetIcon name="printer" :size="15" />
              Print (80mm)
            </button>
            <button class="ui-btn" :disabled="downloading" @click="download">
              <AssetIcon name="download" :size="15" />
              Download PDF
            </button>
            <NuxtLink v-if="receipt.request_id" :to="`/blood-center/invoice/${receipt.request_id}`" class="ui-btn ui-btn--primary">
              <AssetIcon name="file-text" :size="15" />
              Open invoice
            </NuxtLink>
          </div>
        </header>

        <p v-if="receipt.voided" class="banner banner--error">
          <AssetIcon name="triangle-alert" :size="15" />
          <span>
            This receipt is void and no longer acknowledges a payment.
            <template v-if="receipt.void_reason"> Reason: {{ receipt.void_reason }}.</template>
          </span>
        </p>

        <div class="view-switch" role="tablist" aria-label="View">
          <button role="tab" class="view-tab" :class="{ 'view-tab--on': view === 'details' }" :aria-selected="view === 'details'" @click="view = 'details'">Details</button>
          <button role="tab" class="view-tab" :class="{ 'view-tab--on': view === 'printed' }" :aria-selected="view === 'printed'" @click="view = 'printed'">As printed</button>
        </div>

        <BillingDocument v-if="view === 'printed'" :receipt="receipt" :payment-reference="paymentReference" :payment-parts="paymentParts" />

        <template v-else>
          <div class="facts-row">
            <BillingFacts title="Issued by" :rows="issuerRows">
              <template #lead>
                <div class="issuer">
                  <img v-if="receipt.issuing_facility?.logo_url && !logoFailed" :src="receipt.issuing_facility.logo_url" alt="" class="issuer-logo" @error="logoFailed = true">
                  <span v-else class="monogram" aria-hidden="true">{{ facilityInitials(receipt.issuing_facility?.name) }}</span>
                  <strong>{{ receipt.issuing_facility?.name || 'Blood centre' }}</strong>
                </div>
              </template>
            </BillingFacts>
            <BillingFacts title="Received from" :rows="payerRows" />
            <BillingFacts title="Receipt details" :rows="detailRows" />
          </div>

          <div class="split">
            <section class="card" aria-labelledby="summary-title">
              <h2 id="summary-title" class="card-title">Payment summary</h2>
              <dl class="summary">
                <div><dt>Method</dt><dd>{{ receipt.payment?.method_label || receipt.payment_method_label || '—' }}</dd></div>
                <!-- A payment split across methods: each part, on this one receipt. -->
                <template v-if="paymentParts.length > 1">
                  <div v-for="(part, i) in paymentParts" :key="i" class="part">
                    <dt>{{ part.method_label }}</dt>
                    <dd>
                      {{ pesos(part.amount_paid) }}
                      <span v-if="part.reference_number" class="part-ref mono">{{ part.reference_number }}</span>
                      <span v-if="part.additional_information" class="part-ref">{{ part.additional_information }}</span>
                    </dd>
                  </div>
                </template>
                <div><dt>Amount received</dt><dd class="strong">{{ pesos(receipt.amount_paid) }}</dd></div>
                <div v-if="receipt.payment?.amount_tendered"><dt>Cash handed over</dt><dd>{{ pesos(receipt.payment.amount_tendered) }}</dd></div>
                <div v-if="receipt.payment?.amount_tendered"><dt>Change given</dt><dd>{{ pesos(receipt.payment.change_given) }}</dd></div>
                <div><dt>Paid on</dt><dd>{{ when(receipt.payment?.paid_at || receipt.issued_at) }}</dd></div>
                <div v-if="paymentReference"><dt>Reference</dt><dd class="mono">{{ paymentReference }}</dd></div>
                <div v-if="paymentInfo"><dt>Additional information</dt><dd>{{ paymentInfo }}</dd></div>
              </dl>
            </section>

            <!-- The acknowledgement itself: what this piece of paper says happened. -->
            <section class="ack" :class="receipt.voided ? 'ack--void' : figures.remaining > 0 ? 'ack--partial' : 'ack--paid'" aria-labelledby="ack-title">
              <span class="ack-mark" aria-hidden="true">
                <AssetIcon :name="receipt.voided ? 'x' : 'check'" :size="20" />
              </span>
              <div>
                <h2 id="ack-title" class="ack-title">{{ receipt.voided ? 'Receipt voided' : 'Payment received' }}</h2>
                <p class="ack-amount">{{ pesos(receipt.amount_paid) }}</p>
                <p class="ack-note">
                  <template v-if="receipt.voided">Kept on record; it no longer counts as collected.</template>
                  <template v-else-if="figures.remaining > 0">A part payment: {{ pesos(figures.remaining) }} is still due on this bill.</template>
                  <template v-else>The bill was settled by this payment.</template>
                </p>
              </div>
            </section>
          </div>

          <section class="card" aria-labelledby="items-title">
            <div class="card-head">
              <h2 id="items-title" class="card-title">Items</h2>
              <p class="card-hint">As billed on {{ receipt.statement?.document_number || 'the invoice' }} when the payment was taken.</p>
            </div>
            <BillingLines
              :lines="receipt.lines || []"
              :totals="totalRows"
              :show-blood-type="false"
              empty="This receipt was issued before receipts listed their items."
            />
          </section>

          <section class="card notes" aria-labelledby="remarks-title">
            <h2 id="remarks-title" class="card-title">Remarks</h2>
            <ul>
              <li v-if="receipt.replaces_receipt_number">Replaces receipt {{ receipt.replaces_receipt_number }}, voided when the payment was corrected.</li>
              <li v-if="receipt.payment?.cash_session_number">Taken in cash shift {{ receipt.payment.cash_session_number }}.</li>
              <li>An acknowledgement of payment for blood service fees. It is not a BIR official receipt.</li>
            </ul>
          </section>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup>
/**
 * One Payment Acknowledgement Receipt, as it was frozen when the money came in.
 *
 * Everything here is read from the receipt's snapshot, so it shows what the
 * payer was handed even if the bill has changed since. The PDF from the
 * server is the official copy; the 80mm print is the counter's slip.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import BillingDocument from '~/components/common/BillingDocument.vue'
import BillingBadge from '~/components/BloodCenter/BillingBadge.vue'
import BillingFacts from '~/components/BloodCenter/BillingFacts.vue'
import BillingLines from '~/components/BloodCenter/BillingLines.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { facilityInitials, pesos, receiptFigures, saveBlob } from '~/utils/billing'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'billing.record_payment',
})

const route = useRoute()
const receiptId = computed(() => Number(route.params.id))

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

const receipt = ref(null)
const paymentReference = ref(null)
// A card payment's additional information (the cardholder's last name), like the reference, on screen only.
const paymentInfo = ref(null)
// Each part of a payment split across methods, with its reference, on screen only.
const paymentParts = ref([])
const loading = ref(true)
const loadError = ref('')
const view = ref('details')
const logoFailed = ref(false)
const downloading = ref(false)

const figures = computed(() => receiptFigures(receipt.value ?? { amount_paid: 0, balance_before: 0, balance_after: 0, statement: null }))

const badge = computed(() => {
  if (receipt.value?.voided) return { label: 'Voided', tone: 'muted' }
  return figures.value.remaining > 0 ? { label: 'Part payment', tone: 'warning' } : { label: 'Paid in full', tone: 'success' }
})

const issuerRows = computed(() => {
  const f = receipt.value?.issuing_facility
  return [
    { label: 'Address', value: f?.address },
    { label: 'DOH licence', value: f?.doh_license_number },
    { label: 'Contact', value: [f?.phone, f?.email].filter(Boolean).join(' · ') },
  ]
})

const payerRows = computed(() => {
  const r = receipt.value
  return [
    { label: 'Payer', value: r?.payer_name || 'Not named' },
    { label: 'For patient', value: r?.request?.patient_name },
    { label: 'Hospital', value: r?.request?.requesting_facility },
  ]
})

const detailRows = computed(() => {
  const r = receipt.value
  return [
    { label: 'Issued', value: when(r?.issued_at) },
    { label: 'Received by', value: r?.received_by || 'Payment provider' },
    { label: 'Invoice', value: r?.statement?.document_number, mono: true },
    { label: 'Request', value: r?.request?.reference_number, mono: true },
  ]
})

const totalRows = computed(() => {
  const f = figures.value
  const rows = []

  if (f.total !== null) rows.push({ label: 'Bill total', value: pesos(f.total) })
  if (f.paidBefore !== null) rows.push({ label: 'Paid before this receipt', value: f.paidBefore > 0 ? `− ${pesos(f.paidBefore)}` : pesos(0) })
  rows.push({ label: 'This payment', value: `− ${pesos(f.paid)}`, tone: 'success' })
  rows.push({ label: 'Remaining balance', value: pesos(f.remaining), emphasis: true, tone: f.remaining > 0 ? 'danger' : 'success' })

  return rows
})

async function load() {
  loading.value = true
  loadError.value = ''

  try {
    const response = await bloodCenterService.receipt(receiptId.value)
    receipt.value = response?.receipt ?? null
    paymentReference.value = response?.payment_reference ?? null
    paymentInfo.value = response?.payment_additional_information ?? null
    paymentParts.value = response?.payment_parts ?? []
  } catch (err) {
    loadError.value = err?.status === 404 ? 'No receipt with that number was issued by this centre.' : (err?.message || 'Please try again.')
  } finally {
    loading.value = false
  }
}

// The 80mm slip prints from its own page, sized for the counter's printer.
function printThermal() {
  window.open(`/blood-center/receipt-print/${receiptId.value}?auto=1`, '_blank')
}

async function download() {
  downloading.value = true

  try {
    saveBlob(await bloodCenterService.downloadReceipt(receiptId.value), `${receipt.value.receipt_number}.pdf`)
  } catch (err) {
    toast('Download Failed', 'danger', err?.message || 'The receipt could not be downloaded.')
  } finally {
    downloading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css. */
.rc-page { background: var(--rb-page-bg); font-family: var(--rb-font-sans); padding: 24px var(--rb-gutter, 24px) 40px; }
.rc-inner { max-width: var(--rb-content-max, 1600px); margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }

.crumbs { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--rb-text-secondary); }
.crumbs a { color: var(--rb-text-secondary); text-decoration: none; }
.crumbs a:hover { color: var(--rb-primary-text); text-decoration: underline; text-underline-offset: 3px; }
.crumbs span[aria-current] { color: var(--rb-text-primary); font-weight: 600; font-family: var(--rb-font-mono); }

.doc-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
.page-title { font-size: 22px; font-weight: 800; color: var(--rb-text-primary); margin: 0; letter-spacing: -0.01em; }
.doc-meta { display: flex; align-items: center; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
.doc-number { font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.header-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.view-switch { display: inline-flex; gap: 2px; padding: 3px; border-radius: 10px; background: var(--rb-surface-alt); border: 1px solid var(--rb-border); align-self: flex-start; }
.view-tab { padding: 6px 14px; border: 0; border-radius: 8px; background: transparent; font-family: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); cursor: pointer; }
.view-tab:hover { color: var(--rb-text-primary); }
.view-tab--on { background: var(--rb-surface); color: var(--rb-text-primary); box-shadow: var(--rb-shadow-sm); }

.facts-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.issuer { display: flex; align-items: center; gap: 10px; }
.issuer strong { font-size: 14px; color: var(--rb-text-primary); }
.issuer-logo { width: 40px; height: 40px; object-fit: contain; border-radius: 8px; }
.monogram {
  width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; flex: none;
  font-weight: 800; font-size: 14px; color: var(--rb-primary-text); background: rgba(var(--rb-primary-rgb), .1);
}

.card { background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px; padding: 18px; min-width: 0; }
.card-head { margin-bottom: 14px; }
.card-title { font-size: 15px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.card-hint { font-size: 12.5px; color: var(--rb-text-secondary); margin: 3px 0 0; }

.split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: stretch; }
.summary { margin: 12px 0 0; display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
.summary div { display: flex; justify-content: space-between; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--rb-border); }
.summary div:last-child { border-bottom: 0; padding-bottom: 0; }
.summary dt { color: var(--rb-text-secondary); }
.summary dd { margin: 0; color: var(--rb-text-primary); font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }
.summary .part dt { padding-left: 12px; }
.part-ref { display: block; font-size: 11.5px; font-weight: 500; color: var(--rb-text-secondary); }

.ack { display: flex; gap: 14px; align-items: flex-start; padding: 20px; border-radius: 14px; border: 1px solid; }
.ack-mark { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; flex: none; color: #fff; }
.ack-title { margin: 0; font-size: 14px; font-weight: 700; }
.ack-amount { margin: 2px 0 0; font-size: 28px; font-weight: 800; letter-spacing: -0.01em; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.ack-note { margin: 4px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.ack--paid { background: rgba(var(--rb-success-rgb), .07); border-color: rgba(var(--rb-success-rgb), .28); }
.ack--paid .ack-mark { background: var(--rb-success); }
.ack--paid .ack-title { color: var(--rb-success-text); }
.ack--partial { background: rgba(var(--rb-warning-rgb), .08); border-color: rgba(var(--rb-warning-rgb), .3); }
.ack--partial .ack-mark { background: var(--rb-warning); }
.ack--partial .ack-title { color: var(--rb-warning-text); }
.ack--void { background: var(--rb-surface-alt); border-color: var(--rb-border-strong); }
.ack--void .ack-mark { background: var(--rb-text-muted); }
.ack--void .ack-title { color: var(--rb-text-secondary); }
.ack--void .ack-amount { text-decoration: line-through; color: var(--rb-text-muted); }

.notes ul { margin: 10px 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--rb-text-secondary); }

.mono { font-family: var(--rb-font-mono); }
.strong { font-weight: 800 !important; }

.banner { display: flex; align-items: flex-start; gap: 9px; padding: 11px 14px; border-radius: 10px; font-size: 13px; margin: 0; }
.banner--error { background: rgba(var(--rb-accent-rgb), .08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), .25); }

.empty { text-align: center; padding: 48px 20px; color: var(--rb-text-secondary); display: flex; flex-direction: column; align-items: center; gap: 8px; }
.empty h2 { font-size: 16px; color: var(--rb-text-primary); margin: 4px 0 0; }
.empty p { font-size: 13px; margin: 0; }
.empty-actions { display: flex; gap: 8px; margin-top: 8px; }

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
.btn:disabled { opacity: .55; cursor: not-allowed; }

.skeleton-stack { display: flex; flex-direction: column; gap: 12px; }
.skeleton {
  border-radius: 12px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 50%, var(--rb-skeleton-a) 75%);
  background-size: 200% 100%; animation: shimmer 1.4s infinite;
}
.skeleton--head { height: 64px; }
.skeleton--facts { height: 150px; }
.skeleton--doc { height: 320px; }
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

.toast-stack { position: fixed; top: 18px; right: 18px; z-index: 120; display: flex; flex-direction: column; gap: 8px; }
.toast { background: var(--rb-surface); border: 1px solid var(--rb-border-strong); border-radius: 10px; padding: 11px 15px; min-width: 250px; box-shadow: 0 6px 20px rgba(var(--rb-shadow-rgb), .1); }
.toast-title { font-size: 13px; font-weight: 600; color: var(--rb-text-primary); }
.toast--danger .toast-title { color: var(--rb-accent-text); }
.toast-message { font-size: 12px; color: var(--rb-text-secondary); margin-top: 2px; }
.toast-enter-active, .toast-leave-active { transition: opacity .2s, transform .2s var(--rb-ease-out); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(14px); }

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
  .toast-enter-active, .toast-leave-active, .btn { transition: none; }
}

@media (max-width: 860px) {
  .facts-row, .split { grid-template-columns: 1fr; }
  .doc-header { align-items: flex-start; }
}
</style>
