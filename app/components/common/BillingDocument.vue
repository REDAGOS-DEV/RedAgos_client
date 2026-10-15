<template>
  <article class="doc" :aria-label="title">
    <!-- Headed by the issuing centre: its own logo, or its initials when it has none. -->
    <header class="doc-head">
      <div class="doc-brand">
        <img v-if="issuer?.logo_url && !logoFailed" class="issuer-logo" :src="issuer.logo_url" alt="" @error="logoFailed = true">
        <div v-else class="monogram" aria-hidden="true">{{ initials }}</div>
        <div>
          <h2>{{ issuer?.name || 'Blood centre' }}</h2>
          <p v-if="issuer?.address">{{ issuer.address }}</p>
          <p v-if="contactLine">{{ contactLine }}</p>
        </div>
      </div>
      <div class="doc-title">
        <p class="kicker">{{ revision ? 'Statement of account' : 'Payment acknowledgement receipt' }}</p>
        <p class="doc-no mono">{{ revision ? revision.document_number : receipt?.receipt_number }}</p>
        <p>{{ revision ? `Revision ${revision.revision_number} · ` : '' }}Issued {{ when(issuedAt) }}</p>
      </div>
    </header>

    <div class="doc-body">
      <!-- STATEMENT: what is owed, once, beside who owes it. -->
      <template v-if="revision && figures">
        <p v-if="revision.billing_status === 'void'" class="void-banner" role="status">
          <strong>This statement has been voided.</strong>
        </p>

        <section class="hero" :aria-label="statementHero.label">
          <div class="hero-main">
            <p class="cap">{{ statementHero.label }}</p>
            <p class="hero-amount" :class="{ 'hero-amount--void': revision.billing_status === 'void' }">{{ pesos(statementHero.amount) }}</p>
            <span class="stamp" :class="`stamp--${stamp.tone}`">{{ stamp.label }}</span>
          </div>
          <!-- Who owes it. A weekly order is the hospital's, a Patient Transfusion the patient's. -->
          <div class="hero-side hero-side--party">
            <template v-if="revision.statement_only">
              <p class="cap">Bill to</p>
              <strong>{{ revision.bill_to?.facility || '—' }}</strong>
              <p>Requesting hospital</p>
            </template>
            <template v-else>
              <p class="cap">Bill to / Patient</p>
              <strong>{{ revision.bill_to?.patient_name || 'Patient' }}</strong>
              <p v-if="revision.bill_to?.facility">c/o {{ revision.bill_to.facility }}</p>
              <p>Payable by the patient or their watcher</p>
            </template>
          </div>
        </section>

        <div class="parties">
          <div>
            <p class="cap">Blood request</p>
            <strong class="mono">{{ requestReference || '—' }}</strong>
            <p>{{ revision.statement_only ? 'Weekly replenishment' : 'Patient transfusion' }}</p>
          </div>
          <div>
            <p class="cap">Payable</p>
            <strong>{{ revision.statement_only ? 'Settled outside RedAgos' : 'Before the units are released' }}</strong>
          </div>
          <div>
            <p class="cap">Currency</p>
            <strong>PHP (₱)</strong>
          </div>
        </div>
      </template>

      <!-- RECEIPT: the amount received, once, with how and when; then who and what for. -->
      <template v-else-if="receipt">
        <p v-if="receipt.voided" class="void-banner" role="status">
          <strong>This receipt is void.</strong> {{ receipt.void_reason }}
        </p>

        <section class="hero" aria-label="Amount received">
          <div class="hero-main">
            <p class="cap">Amount received</p>
            <p class="hero-amount" :class="{ 'hero-amount--void': receipt.voided }">{{ pesos(receipt.amount_paid) }}</p>
            <span class="stamp" :class="`stamp--${stamp.tone}`">{{ stamp.label }}</span>
          </div>
          <dl class="hero-side">
            <div class="kv"><dt>Payment method</dt><dd>{{ receipt.payment?.method_label || receipt.payment_method_label || '—' }}</dd></div>
            <div class="kv"><dt>Payment date</dt><dd>{{ when(receipt.payment?.paid_at || receipt.issued_at) }}</dd></div>
            <div class="kv"><dt>Reference</dt><dd class="mono">{{ paymentReference || '—' }}</dd></div>
            <div class="kv"><dt>Received by</dt><dd>{{ receipt.received_by || 'Confirmed by the payment provider' }}</dd></div>
          </dl>
        </section>

        <div class="parties">
          <div>
            <p class="cap">Received from</p>
            <strong>{{ receipt.payer_name || '—' }}</strong>
          </div>
          <div>
            <p class="cap">For patient</p>
            <strong>{{ receipt.request?.patient_name || '—' }}</strong>
            <p v-if="receipt.request?.requesting_facility">c/o {{ receipt.request.requesting_facility }}</p>
          </div>
          <div>
            <p class="cap">Blood request</p>
            <strong class="mono">{{ requestReference || '—' }}</strong>
            <p v-if="receipt.statement">
              Statement <span class="mono">{{ receipt.statement.document_number }}</span>, rev.&nbsp;{{ receipt.statement.revision_number }}
            </p>
            <p v-if="receipt.replaces_receipt_number">Replaces receipt <span class="mono">{{ receipt.replaces_receipt_number }}</span></p>
          </div>
        </div>
      </template>

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
                <th scope="col" class="money">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(line, i) in lines" :key="i">
                <td class="idx">{{ i + 1 }}</td>
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

      <!-- STATEMENT: what it means beside the totals -->
      <div v-if="revision && figures" class="summary">
        <div>
          <template v-if="statementNote">
            <p class="cap">Note</p>
            <p class="status-box">{{ statementNote }}</p>
          </template>
        </div>
        <div>
          <p class="cap">Totals</p>
          <div class="balance">
            <div class="bal-row"><span>Subtotal</span><strong>{{ pesos(figures.subtotal) }}</strong></div>
            <div v-if="figures.subsidy > 0" class="bal-row bal-row--less">
              <span>Government subsidy</span><strong>− {{ pesos(figures.subsidy) }}</strong>
            </div>
            <template v-if="figures.paid > 0 && figures.subsidy === 0">
              <div class="bal-row bal-row--this">
                <span>{{ revision.statement_only ? 'Amount billed' : 'Amount payable' }}</span><strong>{{ pesos(figures.payable) }}</strong>
              </div>
              <div class="bal-row"><span>Amount already paid</span><strong>− {{ pesos(figures.paid) }}</strong></div>
              <div class="bal-row bal-row--end" :class="figures.balance > 0 ? 'bal-row--due' : 'bal-row--settled'">
                <span>Outstanding balance</span><strong>{{ pesos(figures.balance) }}</strong>
              </div>
            </template>
            <div v-else class="bal-row bal-row--end bal-row--excess">
              <span>{{ revision.statement_only ? 'Amount billed' : 'Amount payable' }}</span><strong>{{ pesos(figures.payable) }}</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- RECEIPT: cash at the counter (when cash changed hands) beside the balance -->
      <div v-if="receipt && !revision" class="summary">
        <div>
          <template v-if="hasCash">
            <p class="cap">Cash at the counter</p>
            <dl class="cash-box">
              <template v-if="receipt.payment?.amount_tendered">
                <div class="kv"><dt>Cash tendered</dt><dd>{{ pesos(receipt.payment.amount_tendered) }}</dd></div>
                <div class="kv"><dt>Change given</dt><dd>{{ pesos(receipt.payment.change_given ?? 0) }}</dd></div>
              </template>
              <div v-if="receipt.payment?.cash_session_number" class="kv">
                <dt>Counter shift</dt><dd class="mono">{{ receipt.payment.cash_session_number }}</dd>
              </div>
            </dl>
          </template>
        </div>
        <div>
          <p class="cap">Balance</p>
          <div class="balance">
            <div v-if="receipt.statement" class="bal-row">
              <span>Statement total</span><strong>{{ pesos(receipt.statement.total_amount) }}</strong>
            </div>
            <div class="bal-row"><span>Balance before this payment</span><strong>{{ pesos(receipt.balance_before) }}</strong></div>
            <div class="bal-row bal-row--this"><span>This payment</span><strong>− {{ pesos(receipt.amount_paid) }}</strong></div>
            <div v-if="balanceAfter < 0" class="bal-row bal-row--end bal-row--excess">
              <span>Received in excess of the balance</span><strong>{{ pesos(-balanceAfter) }}</strong>
            </div>
            <div v-else class="bal-row bal-row--end" :class="balanceAfter > 0 ? 'bal-row--due' : 'bal-row--settled'">
              <span>Remaining balance</span><strong>{{ pesos(balanceAfter) }}</strong>
            </div>
          </div>
        </div>
      </div>

      <div class="notes">
        <template v-if="revision">
          <p>
            This Statement of Account is not an invoice and not an official receipt. Payment is acknowledged by a
            separate Payment Acknowledgement Receipt. The figures are those frozen when this revision was issued.
          </p>
          <div class="signatures">
            <p><strong>{{ revision.issued_by }}&nbsp;</strong>Prepared by</p>
            <p><strong>&nbsp;</strong>Authorized by</p>
          </div>
        </template>
        <template v-else-if="receipt">
          <p v-if="receipt.is_partial && !receipt.voided" class="notes-status">
            Part payment. This acknowledges the amount above only; {{ pesos(balanceAfter) }} is still due.
          </p>
          <p v-else-if="!receipt.voided && balanceAfter <= 0" class="notes-status">The statement is settled by this payment.</p>
          <p>This acknowledges payment received. It is not a BIR official receipt. Amounts are in Philippine pesos (PHP).</p>
          <div class="signatures">
            <p><strong>{{ receipt.received_by }}&nbsp;</strong>Received by</p>
            <p><strong>&nbsp;</strong>Authorized by</p>
          </div>
        </template>
      </div>
    </div>

    <footer class="doc-footer">
      <span>{{ issuer?.name || 'Blood centre' }} · {{ revision ? 'Statement of Account' : 'Payment Acknowledgement Receipt' }}</span>
      <span>Keep this document for reference · Generated by RedAgos</span>
      <span class="mono">{{ revision?.document_number || receipt?.receipt_number }}</span>
    </footer>
  </article>
</template>

<script setup lang="ts">
/*
 * One billing document on screen, laid out as it prints: a Statement of
 * Account revision or a Payment Acknowledgement Receipt. It shows the
 * server's frozen figures and works out nothing that matters; the PDF from the
 * server stays the official copy.
 *
 * Redesigned 2026-10-14 to match the PDFs: the one figure the reader came for
 * (what is owed, or what was received) stated once, large, at the top; blue
 * carries the document, with red only as the thin edge above it.
 *
 * Headed by the centre that issued it — the logo it was issued with, or the
 * centre's initials — never by a shared mark. RedAgos is named in the footer.
 */
import type { PaymentReceiptSummary, StatementRevision } from '~/types/bloodRequest'
import { facilityInitials, pesos, statementFigures, statementStamp } from '~/utils/billing'

const props = defineProps<{
  revision?: StatementRevision | null
  receipt?: PaymentReceiptSummary | null
  /** The payment's reference, which only staff who may record payments are given. */
  paymentReference?: string | null
}>()

const title = computed(() => (props.revision ? 'Statement of Account' : 'Payment Acknowledgement Receipt'))

const issuedAt = computed(() => props.revision?.issued_at ?? props.receipt?.issued_at ?? null)
const issuer = computed(() => props.revision?.issuer ?? props.receipt?.issuing_facility ?? null)
const initials = computed(() => facilityInitials(issuer.value?.name))

// A signed link expires; a document left open past it falls back to the initials.
const logoFailed = ref(false)
watch(() => issuer.value?.logo_url, () => { logoFailed.value = false })
const requestReference = computed(() => props.revision?.request_reference ?? props.receipt?.request?.reference_number ?? null)
const lines = computed(() => props.revision?.lines ?? props.receipt?.lines ?? [])
const figures = computed(() => (props.revision ? statementFigures(props.revision) : null))
const balanceAfter = computed(() => Number(props.receipt?.balance_after ?? 0))
const hasCash = computed(() => Boolean(props.receipt?.payment?.amount_tendered || props.receipt?.payment?.cash_session_number))
// DOH licence, phone and email on one line under the centre's name.
const contactLine = computed(() => [
  issuer.value?.doh_license_number ? `DOH licence ${issuer.value.doh_license_number}` : null,
  issuer.value?.phone,
  issuer.value?.email,
].filter(Boolean).join(' · '))

// The statement's headline figure: what is still owed once something was paid,
// otherwise what the statement charges. The totals below show how it adds up.
const statementHero = computed(() => {
  const f = figures.value
  if (!props.revision || !f) return { label: '', amount: 0 }
  if (props.revision.statement_only) return { label: 'Amount billed', amount: f.payable }
  if (f.paid > 0 && f.subsidy === 0) return { label: 'Outstanding balance', amount: f.balance }
  return { label: 'Amount payable', amount: f.payable }
})

// What the statement's status means, beside the totals.
const statementNote = computed(() => {
  const r = props.revision
  if (!r) return ''
  if (r.billing_status === 'statement_only') {
    return 'Weekly replenishment order. This statement goes to the requesting hospital for settlement outside RedAgos; no payment is collected against it in this system.'
  }
  if (r.billing_status === 'subsidised') {
    const paid = figures.value?.paid ?? 0
    return 'Covered by the government subsidy. Nothing is payable on this request.'
      + (paid > 0 ? ` ${pesos(paid)} was received before the subsidy; any refund is settled outside RedAgos.` : '')
  }
  // A void statement says so in the banner at the top.
  if (r.billing_status !== 'void' && (figures.value?.paid ?? 0) > 0) return 'Payments received before this statement are deducted above.'
  return ''
})

const stamp = computed(() => {
  if (props.revision) return statementStamp(props.revision.billing_status)
  if (props.receipt?.voided) return { label: 'VOID', tone: 'muted' }
  return props.receipt?.is_partial
    ? { label: 'PARTIAL PAYMENT', tone: 'warning' }
    : { label: 'PAID IN FULL', tone: 'success' }
})

function when(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css. Blue carries it; red is only the top edge. */
.doc {
  background: var(--rb-surface); border: 1px solid var(--rb-border); border-top: 4px solid #C62828; border-radius: 14px;
  overflow: hidden; color: var(--rb-text-primary); font-size: 13px; line-height: 1.45;
}

.doc-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; padding: 20px 22px; border-bottom: 2px solid var(--rb-primary); }
.doc-brand { display: flex; gap: 12px; align-items: center; }
.issuer-logo { flex: none; max-width: 120px; max-height: 52px; object-fit: contain; }
.monogram { width: 48px; height: 48px; flex: none; border-radius: 12px; background: var(--rb-primary); color: #fff; display: grid; place-items: center; font-size: 18px; font-weight: 800; letter-spacing: .5px; }
.doc-brand h2 { margin: 0; font-size: 17px; font-weight: 800; }
.doc-brand p { margin: 1px 0; color: var(--rb-text-secondary); font-size: 11.5px; }
.doc-title { text-align: right; }
.doc-title p { margin: 3px 0; color: var(--rb-text-secondary); font-size: 12px; }
.doc-title .kicker { margin: 0; font-size: 10.5px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: var(--rb-primary-text); }
.doc-title .doc-no { margin: 4px 0 2px; font-size: 16px; font-weight: 800; color: var(--rb-text-primary); }

.stamp { display: inline-flex; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: .3px; margin-top: 4px; }
.stamp--success { background: rgba(var(--rb-success-rgb), .14); color: var(--rb-success-text); }
.stamp--warning { background: rgba(var(--rb-warning-rgb), .14); color: var(--rb-warning-text); }
.stamp--danger { background: rgba(var(--rb-accent-rgb), .1); color: var(--rb-accent-text); }
.stamp--info { background: rgba(var(--rb-primary-rgb), .1); color: var(--rb-primary-text); }
.stamp--muted { background: var(--rb-surface-hover); color: var(--rb-text-muted); }

.doc-body { padding: 20px 22px; }
.cap { margin: 0 0 4px; font-size: 10px; font-weight: 800; letter-spacing: .9px; text-transform: uppercase; color: var(--rb-text-secondary); }
.void-banner { margin: 0 0 14px; padding: 9px 12px; border: 1px solid rgba(var(--rb-accent-rgb), .3); border-radius: 9px; background: rgba(var(--rb-accent-rgb), .07); color: var(--rb-accent-text); font-size: 12.5px; }

/* The one figure the reader came for. */
.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); border: 1px solid rgba(var(--rb-primary-rgb), .2); border-radius: 12px; background: rgba(var(--rb-primary-rgb), .06); }
.hero-main { padding: 16px 18px; border-right: 1px solid rgba(var(--rb-primary-rgb), .2); }
.hero-amount { margin: 2px 0 6px; font-size: 32px; font-weight: 800; line-height: 1.15; color: var(--rb-primary-text); font-variant-numeric: tabular-nums; }
.hero-amount--void { color: var(--rb-text-muted); text-decoration: line-through; }
.hero-side { margin: 0; padding: 12px 18px; align-self: center; }
.hero-side--party strong { display: block; font-size: 16px; font-weight: 800; overflow-wrap: anywhere; }
.hero-side--party p:not(.cap) { margin: 2px 0 0; color: var(--rb-text-secondary); font-size: 12px; overflow-wrap: anywhere; }
.kv { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; font-size: 12px; }
.kv dt { color: var(--rb-text-secondary); }
.kv dd { margin: 0; font-weight: 700; text-align: right; overflow-wrap: anywhere; }

.parties { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 18px 0 20px; }
.parties > div { min-width: 0; padding: 0 16px; border-left: 1px solid var(--rb-border); }
.parties > div:first-child { padding-left: 0; border-left: none; }
.parties strong { display: block; font-size: 13.5px; overflow-wrap: anywhere; }
.parties p:not(.cap) { margin: 2px 0 0; color: var(--rb-text-secondary); font-size: 12px; overflow-wrap: anywhere; }

.section-title { font-size: 13.5px; font-weight: 800; margin: 0 0 8px; }
.table-wrap { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; min-width: 460px; font-size: 12.5px; }
th { text-align: left; color: var(--rb-text-secondary); font-size: 10.5px; text-transform: uppercase; letter-spacing: .6px; border-bottom: 1.5px solid var(--rb-text-primary) !important; }
th, td { padding: 10px; border-bottom: 1px solid var(--rb-border); }
.money { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.idx { color: var(--rb-text-muted); width: 32px; }
.muted { color: var(--rb-text-muted); font-size: 12.5px; }

/* Beside the totals: a note (statement) or the cash at the counter (receipt). */
.summary { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; margin-top: 18px; }
.status-box { margin: 0; padding: 10px 12px; border: 1px solid var(--rb-border); border-radius: 10px; font-size: 12px; color: var(--rb-text-primary); }
.cash-box { margin: 0; padding: 9px 12px; border: 1px solid var(--rb-border); border-radius: 10px; }
.bal-row { display: flex; justify-content: space-between; gap: 14px; padding: 7px 10px; border-bottom: 1px solid var(--rb-border); font-size: 12.5px; }
.bal-row strong { font-variant-numeric: tabular-nums; white-space: nowrap; font-weight: 600; }
.bal-row--less { color: var(--rb-success-text); }
.bal-row--this, .bal-row--this strong { color: var(--rb-primary-text); font-weight: 800; }
.bal-row--end { font-weight: 800; border-bottom: none; }
.bal-row--end strong { font-weight: 800; }
.bal-row--due { background: rgba(var(--rb-warning-rgb), .14); color: var(--rb-warning-text); }
.bal-row--settled { background: rgba(var(--rb-success-rgb), .12); color: var(--rb-success-text); }
.bal-row--excess { background: rgba(var(--rb-primary-rgb), .1); color: var(--rb-primary-text); }

.notes { margin-top: 22px; color: var(--rb-text-secondary); font-size: 11.5px; }
.notes p { margin: 5px 0 0; }
.notes-status { color: var(--rb-text-primary); font-weight: 700; }
.signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 36px; }
.signatures p { margin: 0; padding-top: 5px; border-top: 1px solid var(--rb-border-strong); }
.signatures strong { display: block; color: var(--rb-text-primary); }

.doc-footer { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 11px 22px; border-top: 1px solid var(--rb-border); color: var(--rb-text-muted); font-size: 11px; }
.mono { font-family: var(--rb-font-mono); }

@media (max-width: 720px) {
  .doc-head { flex-direction: column; }
  .doc-title { text-align: left; }
  .hero, .summary { grid-template-columns: 1fr; }
  .hero-main { border-right: none; border-bottom: 1px solid rgba(var(--rb-primary-rgb), .2); }
  .parties { grid-template-columns: 1fr; gap: 12px; }
  .parties > div { padding: 0; border-left: none; }
}
</style>
