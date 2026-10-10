<template>
  <article class="doc" :aria-label="title">
    <header class="doc-head">
      <div class="doc-brand">
        <div class="logo" aria-hidden="true">+</div>
        <div>
          <h2>RedAgos</h2>
          <p>Blood Bank Management &amp; Inventory System</p>
          <p v-if="issuer?.name">{{ issuer.name }}</p>
        </div>
      </div>
      <div class="doc-title">
        <h2>{{ title }}</h2>
        <p class="mono">{{ numberLine }}</p>
        <p>Date issued: {{ when(issuedAt) }}</p>
        <span class="stamp" :class="`stamp--${stamp.tone}`">{{ stamp.label }}</span>
      </div>
    </header>

    <div class="doc-body">
      <div class="info-grid">
        <div class="info-box">
          <h3>Issued by</h3>
          <strong>{{ issuer?.name || '—' }}</strong>
          <p v-if="issuer?.address">{{ issuer.address }}</p>
          <p v-if="issuer?.doh_license_number">DOH licence: {{ issuer.doh_license_number }}</p>
          <p v-if="issuer?.phone || issuer?.email">{{ [issuer?.phone, issuer?.email].filter(Boolean).join(' · ') }}</p>
        </div>

        <!-- Statement: who owes it. A weekly order is the hospital's, a Patient Transfusion the patient's. -->
        <div v-if="revision" class="info-box">
          <template v-if="revision.statement_only">
            <h3>Bill to</h3>
            <strong>{{ revision.bill_to?.facility || '—' }}</strong>
            <p>Requesting hospital</p>
          </template>
          <template v-else>
            <h3>Bill to / Patient</h3>
            <strong>{{ revision.bill_to?.patient_name || 'Patient' }}</strong>
            <p v-if="revision.bill_to?.facility">c/o {{ revision.bill_to.facility }}</p>
            <p>Payable by the patient or their watcher</p>
          </template>
        </div>
        <!-- Receipt: who paid it. -->
        <div v-else-if="receipt" class="info-box">
          <h3>Received from</h3>
          <strong>{{ receipt.payer_name || '—' }}</strong>
          <p v-if="receipt.request?.patient_name">For patient: {{ receipt.request.patient_name }}</p>
          <p v-if="receipt.request?.requesting_facility">c/o {{ receipt.request.requesting_facility }}</p>
        </div>

        <div class="info-box">
          <h3>Transaction details</h3>
          <p>Blood request: <strong class="mono inline">{{ requestReference || '—' }}</strong></p>
          <template v-if="revision">
            <p>Request type: {{ revision.statement_only ? 'Weekly replenishment' : 'Patient transfusion' }}</p>
            <p>Payable: {{ revision.statement_only ? 'Settled outside RedAgos' : 'Before the units are released' }}</p>
          </template>
          <template v-else-if="receipt">
            <p v-if="receipt.statement">
              Statement: <span class="mono">{{ receipt.statement.document_number }}</span> (rev. {{ receipt.statement.revision_number }})
            </p>
            <p v-if="receipt.replaces_receipt_number">Replaces receipt: <span class="mono">{{ receipt.replaces_receipt_number }}</span></p>
          </template>
          <p>Currency: PHP (₱)</p>
        </div>
      </div>

      <template v-if="lines.length">
        <h3 class="section-title">Blood components</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Component</th>
                <th scope="col" class="money">Qty</th>
                <th scope="col" class="money">Unit price</th>
                <th scope="col" class="money">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(line, i) in lines" :key="i">
                <td>{{ i + 1 }}</td>
                <td><strong>{{ line.component_name }}</strong></td>
                <td class="money">{{ line.quantity }}</td>
                <td class="money">{{ pesos(line.unit_price) }}</td>
                <td class="money">{{ pesos(line.line_total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <p v-else-if="revision" class="muted">No units are held for this request.</p>

      <!-- STATEMENT TOTALS -->
      <div v-if="revision && figures" class="totals">
        <div class="total-row"><span>Subtotal</span><strong>{{ pesos(figures.subtotal) }}</strong></div>
        <div v-if="figures.subsidy > 0" class="total-row total-row--less">
          <span>Government subsidy</span><strong>− {{ pesos(figures.subsidy) }}</strong>
        </div>
        <div class="total-row total-row--grand">
          <span>{{ revision.statement_only ? 'Amount billed' : 'Amount payable' }}</span><strong>{{ pesos(figures.payable) }}</strong>
        </div>
        <template v-if="figures.paid > 0 && figures.subsidy === 0">
          <div class="total-row"><span>Amount already paid</span><strong>{{ pesos(figures.paid) }}</strong></div>
          <div class="total-row total-row--balance"><span>Outstanding balance</span><strong>{{ pesos(figures.balance) }}</strong></div>
        </template>
      </div>

      <!-- RECEIPT TOTALS AND PAYMENT -->
      <template v-if="receipt">
        <div class="totals">
          <div v-if="receipt.statement" class="total-row">
            <span>Statement total</span><strong>{{ pesos(receipt.statement.total_amount) }}</strong>
          </div>
          <div class="total-row"><span>Balance before this payment</span><strong>{{ pesos(receipt.balance_before) }}</strong></div>
          <div class="total-row total-row--grand"><span>Amount received</span><strong>{{ pesos(receipt.amount_paid) }}</strong></div>
          <div v-if="balanceAfter < 0" class="total-row total-row--balance">
            <span>Received in excess of the balance</span><strong>{{ pesos(-balanceAfter) }}</strong>
          </div>
          <div v-else class="total-row" :class="balanceAfter > 0 ? 'total-row--balance' : 'total-row--settled'">
            <span>Remaining balance</span><strong>{{ pesos(balanceAfter) }}</strong>
          </div>
        </div>

        <div class="payment-panel">
          <div class="payment-box">
            <h3>Payment received</h3>
            <div class="kv"><span>Payment method</span><strong>{{ receipt.payment?.method_label || receipt.payment_method_label || '—' }}</strong></div>
            <div class="kv"><span>Amount received</span><strong>{{ pesos(receipt.amount_paid) }}</strong></div>
            <div class="kv"><span>Payment reference</span><strong class="mono">{{ paymentReference || '—' }}</strong></div>
            <div class="kv"><span>Payment date</span><strong>{{ when(receipt.payment?.paid_at || receipt.issued_at) }}</strong></div>
            <div class="kv"><span>Received by</span><strong>{{ receipt.received_by || 'Confirmed by the payment provider' }}</strong></div>
          </div>
          <div class="payment-box callout" :class="{ 'callout--partial': receipt.is_partial }">
            <h3>{{ receipt.is_partial ? 'Part payment recorded' : 'Payment recorded' }}</h3>
            <strong>{{ pesos(receipt.amount_paid) }} received</strong>
            <p>
              {{ receipt.is_partial
                ? `This acknowledges the amount above only. ${pesos(balanceAfter)} is still due.`
                : 'The statement is settled by this payment.' }}
            </p>
          </div>
        </div>
      </template>

      <div class="notes">
        <strong>Notes</strong>
        <template v-if="revision">
          <p v-if="revision.billing_status === 'statement_only'" class="notes-status">
            Weekly replenishment order. This statement goes to the requesting hospital for settlement outside
            RedAgos; no payment is collected against it in this system.
          </p>
          <p v-else-if="revision.billing_status === 'subsidised'" class="notes-status">
            Covered by the government subsidy. Nothing is payable on this request.
            <template v-if="figures && figures.paid > 0">
              {{ pesos(figures.paid) }} was received before the subsidy; any refund is settled outside RedAgos.
            </template>
          </p>
          <p v-else-if="revision.billing_status === 'void'" class="notes-status">This statement has been voided.</p>
          <p>
            This Statement of Account is not an invoice and not an official receipt. Payment is acknowledged by a
            separate Payment Acknowledgement Receipt. The figures are those frozen when this revision was issued.
          </p>
          <p class="sign">
            <span>Prepared by: {{ revision.issued_by || '______________' }}</span>
            <span>Authorized by: ______________</span>
          </p>
        </template>
        <template v-else-if="receipt">
          <p v-if="receipt.voided" class="notes-status">Voided: {{ receipt.void_reason }}</p>
          <p>This acknowledges payment received. It is not a BIR official receipt.</p>
          <p class="sign">
            <span>Received by: {{ receipt.received_by || '______________' }}</span>
            <span>Authorized by: ______________</span>
          </p>
        </template>
      </div>
    </div>

    <footer class="doc-footer">
      <span>RedAgos · {{ revision ? 'Statement of Account' : 'Payment Acknowledgement Receipt' }}</span>
      <span>Keep this document for reference</span>
      <span class="mono">{{ revision?.document_number || receipt?.receipt_number }}</span>
    </footer>
  </article>
</template>

<script setup lang="ts">
/*
 * One billing document on screen, laid out as it prints (the owner's billing
 * mock-up, 2026-10-11): a Statement of Account revision or a Payment
 * Acknowledgement Receipt. It shows the server's frozen figures and works out
 * nothing that matters; the PDF from the server stays the official copy.
 */
import type { PaymentReceiptSummary, StatementRevision } from '~/types/bloodRequest'
import { pesos, statementFigures, statementStamp } from '~/utils/billing'

const props = defineProps<{
  revision?: StatementRevision | null
  receipt?: PaymentReceiptSummary | null
  /** The payment's reference, which only staff who may record payments are given. */
  paymentReference?: string | null
}>()

const title = computed(() => (props.revision ? 'STATEMENT OF ACCOUNT' : 'PAYMENT ACKNOWLEDGEMENT RECEIPT'))

const numberLine = computed(() => props.revision
  ? `No. ${props.revision.document_number} · Revision ${props.revision.revision_number}`
  : `Receipt No. ${props.receipt?.receipt_number ?? ''}`)

const issuedAt = computed(() => props.revision?.issued_at ?? props.receipt?.issued_at ?? null)
const issuer = computed(() => props.revision?.issuer ?? props.receipt?.issuing_facility ?? null)
const requestReference = computed(() => props.revision?.request_reference ?? props.receipt?.request?.reference_number ?? null)
const lines = computed(() => props.revision?.lines ?? props.receipt?.lines ?? [])
const figures = computed(() => (props.revision ? statementFigures(props.revision) : null))
const balanceAfter = computed(() => Number(props.receipt?.balance_after ?? 0))

const stamp = computed(() => {
  if (props.revision) return statementStamp(props.revision.billing_status)
  if (props.receipt?.voided) return { label: 'VOID', tone: 'muted' }
  return props.receipt?.is_partial
    ? { label: 'PARTIAL PAYMENT', tone: 'warning' }
    : { label: 'PAYMENT RECEIVED', tone: 'success' }
})

function when(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css. */
.doc { background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px; overflow: hidden; color: var(--rb-text-primary); font-size: 13px; line-height: 1.45; }

.doc-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; padding: 20px 22px; border-bottom: 1px solid var(--rb-border); }
.doc-brand { display: flex; gap: 12px; align-items: center; }
.logo { width: 40px; height: 40px; flex: none; border-radius: 13px 13px 13px 5px; background: var(--rb-accent); color: #fff; display: grid; place-items: center; font-size: 24px; font-weight: 800; }
.doc-brand h2 { margin: 0; font-size: 17px; }
.doc-brand p { margin: 1px 0; color: var(--rb-text-secondary); font-size: 11.5px; }
.doc-title { text-align: right; }
.doc-title h2 { margin: 0; font-size: 18px; color: var(--rb-accent-text); letter-spacing: .6px; }
.doc-title p { margin: 3px 0; color: var(--rb-text-secondary); font-size: 12px; }

.stamp { display: inline-flex; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: .3px; margin-top: 4px; }
.stamp--success { background: rgba(var(--rb-success-rgb), .14); color: var(--rb-success-text); }
.stamp--warning { background: rgba(var(--rb-warning-rgb), .14); color: var(--rb-warning-text); }
.stamp--danger { background: rgba(var(--rb-accent-rgb), .1); color: var(--rb-accent-text); }
.stamp--info { background: rgba(var(--rb-primary-rgb), .1); color: var(--rb-primary-text); }
.stamp--muted { background: var(--rb-surface-hover); color: var(--rb-text-muted); }

.doc-body { padding: 20px 22px; }
.info-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 18px; }
.info-box { background: var(--rb-surface-alt); border: 1px solid var(--rb-border); border-radius: 10px; padding: 12px; min-width: 0; }
.info-box h3 { margin: 0 0 7px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .7px; color: var(--rb-text-secondary); }
.info-box strong { display: block; margin-bottom: 3px; overflow-wrap: anywhere; }
.info-box strong.inline { display: inline; }
.info-box p { margin: 3px 0; color: var(--rb-text-secondary); font-size: 12px; overflow-wrap: anywhere; }

.section-title { font-size: 13.5px; font-weight: 800; margin: 0 0 8px; }
.table-wrap { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; min-width: 460px; font-size: 12.5px; }
th { text-align: left; color: var(--rb-text-secondary); background: var(--rb-surface-alt); font-size: 10.5px; text-transform: uppercase; letter-spacing: .6px; }
th, td { padding: 10px; border-bottom: 1px solid var(--rb-border); }
.money { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.muted { color: var(--rb-text-muted); font-size: 12.5px; }

.totals { width: min(100%, 340px); margin: 14px 0 6px auto; }
.total-row { display: flex; justify-content: space-between; gap: 14px; padding: 7px 10px; border-bottom: 1px solid var(--rb-border); font-size: 12.5px; }
.total-row strong { font-variant-numeric: tabular-nums; white-space: nowrap; }
.total-row--less { color: var(--rb-success-text); }
.total-row--grand { font-size: 15px; font-weight: 800; background: var(--rb-surface-alt); border-radius: 7px; border-bottom: none; margin-top: 4px; padding: 11px 10px; }
.total-row--balance { color: var(--rb-accent-text); font-weight: 800; background: rgba(var(--rb-accent-rgb), .08); border-radius: 7px; border-bottom: none; margin-top: 4px; }
.total-row--settled { color: var(--rb-success-text); font-weight: 800; background: rgba(var(--rb-success-rgb), .1); border-radius: 7px; border-bottom: none; margin-top: 4px; }

.payment-panel { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(180px, 1fr); gap: 10px; margin-top: 14px; }
.payment-box { border: 1px solid var(--rb-border); border-radius: 10px; padding: 13px; }
.payment-box h3 { font-size: 12px; margin: 0 0 9px; }
.kv { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; font-size: 12px; }
.kv span { color: var(--rb-text-secondary); }
.kv strong { text-align: right; overflow-wrap: anywhere; }
.callout { background: rgba(var(--rb-success-rgb), .08); border-color: rgba(var(--rb-success-rgb), .3); }
.callout strong { color: var(--rb-success-text); font-size: 15px; }
.callout p { font-size: 11.5px; margin: 7px 0 0; color: var(--rb-text-secondary); }
.callout--partial { background: rgba(var(--rb-warning-rgb), .08); border-color: rgba(var(--rb-warning-rgb), .3); }
.callout--partial strong { color: var(--rb-warning-text); }

.notes { margin-top: 16px; padding: 12px 13px; background: var(--rb-surface-alt); border: 1px dashed var(--rb-border-strong); border-radius: 10px; color: var(--rb-text-secondary); font-size: 11.5px; }
.notes p { margin: 5px 0 0; }
.notes-status { color: var(--rb-text-primary); }
.sign { display: flex; flex-wrap: wrap; gap: 8px 28px; margin-top: 14px !important; }

.doc-footer { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 11px 22px; background: var(--rb-accent); color: #fff; font-size: 11px; }
.mono { font-family: var(--rb-font-mono); }

@media (max-width: 720px) {
  .doc-head { flex-direction: column; }
  .doc-title { text-align: left; }
  .info-grid, .payment-panel { grid-template-columns: 1fr; }
}
</style>
